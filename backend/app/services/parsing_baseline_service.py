import json
from collections import defaultdict
from typing import Any, Dict, Iterable, List

from sqlalchemy import text
from sqlmodel import Session

from app.services import parsing_report_service


def _chunks(values: List[int], size: int = 500) -> Iterable[List[int]]:
    for index in range(0, len(values), size):
        yield values[index : index + size]


def _safe_dict(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    if value is None:
        return {}
    try:
        parsed = json.loads(str(value))
        return parsed if isinstance(parsed, dict) else {}
    except (TypeError, ValueError, json.JSONDecodeError):
        return {}


def ensure_baselines_before_update(
    mysql_db: Session,
    audit_db: Session,
    odist_ids: Iterable[int],
) -> None:
    ids = sorted({int(value) for value in odist_ids})
    if not ids:
        return

    parsing_report_service._ensure_schema(audit_db)

    existing_ids: set[int] = set()
    for batch in _chunks(ids):
        placeholders = []
        params: Dict[str, Any] = {}
        for index, odist_id in enumerate(batch):
            key = f"id_{index}"
            placeholders.append(f":{key}")
            params[key] = odist_id
        rows = audit_db.execute(
            text(
                f"""
                SELECT odist_id
                FROM [tools].[odists_parsing_baseline]
                WHERE odist_id IN ({', '.join(placeholders)})
                """
            ),
            params,
        ).all()
        existing_ids.update(int(row[0]) for row in rows)

    missing_ids = [odist_id for odist_id in ids if odist_id not in existing_ids]
    if not missing_ids:
        return

    current_rows = parsing_report_service._load_current_rows(mysql_db, missing_ids)
    audit_history: Dict[int, List[Dict[str, Any]]] = defaultdict(list)

    for batch in _chunks(missing_ids):
        placeholders = []
        params: Dict[str, Any] = {}
        for index, odist_id in enumerate(batch):
            key = f"audit_id_{index}"
            placeholders.append(f":{key}")
            params[key] = odist_id
        rows = audit_db.execute(
            text(
                f"""
                SELECT odist_id, old_values
                FROM [tools].[odists_parsing_audit_log]
                WHERE odist_id IN ({', '.join(placeholders)})
                  AND COALESCE(apply_status, N'COMMITTED') = N'COMMITTED'
                ORDER BY odist_id ASC, changed_at ASC, audit_id ASC
                """
            ),
            params,
        ).mappings().all()
        for row in rows:
            audit_history[int(row["odist_id"])].append(
                {"old_values": _safe_dict(row["old_values"])}
            )

    for odist_id in missing_ids:
        current_row = current_rows.get(odist_id)
        if current_row is None:
            continue

        original_values = {
            field: current_row.get(field)
            for field in parsing_report_service.TRACKED_FIELDS
        }
        seen_fields: set[str] = set()
        history = audit_history.get(odist_id, [])

        for audit in history:
            old_values = audit["old_values"]
            for field in parsing_report_service.TRACKED_FIELDS:
                if field in old_values and field not in seen_fields:
                    original_values[field] = old_values[field]
                    seen_fields.add(field)

        source = (
            "RECONSTRUCTED_BEFORE_UPDATE"
            if history
            else "CAPTURED_BEFORE_FIRST_UPDATE"
        )
        audit_db.execute(
            text(
                """
                INSERT INTO [tools].[odists_parsing_baseline]
                    ([odist_id], [original_values], [baseline_source])
                SELECT :odist_id, :original_values, :baseline_source
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM [tools].[odists_parsing_baseline] WITH (UPDLOCK, HOLDLOCK)
                    WHERE [odist_id] = :odist_id
                )
                """
            ),
            {
                "odist_id": odist_id,
                "original_values": json.dumps(
                    original_values,
                    ensure_ascii=False,
                    default=str,
                ),
                "baseline_source": source,
            },
        )

    audit_db.commit()
