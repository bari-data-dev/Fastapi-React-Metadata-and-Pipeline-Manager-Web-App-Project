import json
import math
import re
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

from sqlalchemy import text
from sqlmodel import Session


ODISTS_TABLE = "gold_odists_parsing_manual"
REVISION_FIELDS = [
    "dist_code",
    "cust_code",
    "cust_name",
    "address",
    "type_outlet",
    "city",
    "province",
    "kecamatan",
    "kota",
    "provinsi",
]
TRACKED_FIELDS = ["ogal_id", *REVISION_FIELDS]


def _safe_json(value: Any, fallback: Any) -> Any:
    if value is None:
        return fallback
    if isinstance(value, (dict, list)):
        return value
    try:
        parsed = json.loads(str(value))
        return parsed
    except (TypeError, ValueError, json.JSONDecodeError):
        return fallback


def _normalize(value: Any) -> str:
    if value is None:
        return ""
    text_value = str(value)
    text_value = re.sub(r"\s+", " ", text_value.strip())
    return text_value.upper()


def _iso(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _classify_fields(fields: Iterable[str]) -> str:
    field_set = set(fields)
    has_parsing = "ogal_id" in field_set
    has_revision = any(field in field_set for field in REVISION_FIELDS)
    if has_parsing and has_revision:
        return "PARSING & REVISI DATA"
    if has_parsing:
        return "PARSING"
    if has_revision:
        return "REVISI DATA"
    return "LAINNYA"


def _ensure_schema(audit_db: Session) -> None:
    audit_db.execute(
        text(
            """
            IF OBJECT_ID(N'[tools].[odists_parsing_baseline]', N'U') IS NULL
            BEGIN
                CREATE TABLE [tools].[odists_parsing_baseline] (
                    [odist_id] BIGINT NOT NULL,
                    [original_values] NVARCHAR(MAX) NOT NULL,
                    [baseline_source] NVARCHAR(50) NOT NULL,
                    [baseline_created_at] DATETIME2 NOT NULL
                        CONSTRAINT [DF_odists_parsing_baseline_created_at]
                        DEFAULT SYSDATETIME(),
                    [baseline_updated_at] DATETIME2 NOT NULL
                        CONSTRAINT [DF_odists_parsing_baseline_updated_at]
                        DEFAULT SYSDATETIME(),
                    CONSTRAINT [PK_odists_parsing_baseline]
                        PRIMARY KEY ([odist_id]),
                    CONSTRAINT [CK_odists_parsing_baseline_json]
                        CHECK (ISJSON([original_values]) = 1)
                );
            END;
            """
        )
    )
    audit_db.execute(
        text(
            """
            IF COL_LENGTH(N'tools.odists_parsing_audit_log', N'actor_full_name') IS NULL
                ALTER TABLE [tools].[odists_parsing_audit_log]
                    ADD [actor_full_name] NVARCHAR(191) NULL;
            """
        )
    )
    audit_db.execute(
        text(
            """
            IF COL_LENGTH(N'tools.odists_parsing_audit_log', N'change_type') IS NULL
                ALTER TABLE [tools].[odists_parsing_audit_log]
                    ADD [change_type] NVARCHAR(40) NULL;
            """
        )
    )
    audit_db.execute(
        text(
            """
            IF COL_LENGTH(N'tools.odists_parsing_audit_log', N'apply_status') IS NULL
                ALTER TABLE [tools].[odists_parsing_audit_log]
                    ADD [apply_status] NVARCHAR(20) NOT NULL
                        CONSTRAINT [DF_odists_parsing_audit_apply_status]
                        DEFAULT N'COMMITTED' WITH VALUES;
            """
        )
    )
    audit_db.commit()


def _load_audits(
    audit_db: Session,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    user_id: Optional[int] = None,
) -> List[Dict[str, Any]]:
    where_parts = ["COALESCE(a.apply_status, N'COMMITTED') = N'COMMITTED'"]
    params: Dict[str, Any] = {}
    if date_from is not None:
        where_parts.append("a.changed_at >= :date_from")
        params["date_from"] = date_from
    if date_to is not None:
        where_parts.append("a.changed_at < DATEADD(DAY, 1, CAST(:date_to AS DATE))")
        params["date_to"] = date_to
    if user_id is not None:
        where_parts.append("a.user_id = :user_id")
        params["user_id"] = user_id

    rows = audit_db.execute(
        text(
            f"""
            SELECT
                a.audit_id,
                a.odist_id,
                a.user_id,
                a.username,
                COALESCE(NULLIF(a.actor_full_name, N''), NULLIF(u.full_name, N''), a.username)
                    AS actor_full_name,
                a.changed_fields,
                a.old_values,
                a.new_values,
                a.changed_at,
                a.change_type,
                COALESCE(a.apply_status, N'COMMITTED') AS apply_status
            FROM [tools].[odists_parsing_audit_log] AS a
            LEFT JOIN [tools].[app_users] AS u
                ON u.user_id = a.user_id
            WHERE {' AND '.join(where_parts)}
            ORDER BY a.changed_at ASC, a.audit_id ASC
            """
        ),
        params,
    ).mappings().all()

    result: List[Dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        item["changed_fields_list"] = _safe_json(item.get("changed_fields"), [])
        item["old_values_dict"] = _safe_json(item.get("old_values"), {})
        item["new_values_dict"] = _safe_json(item.get("new_values"), {})
        item["change_type"] = item.get("change_type") or _classify_fields(
            item["changed_fields_list"]
        )
        result.append(item)
    return result


def _load_baselines(audit_db: Session) -> Dict[int, Dict[str, Any]]:
    rows = audit_db.execute(
        text(
            """
            SELECT odist_id, original_values, baseline_source,
                   baseline_created_at, baseline_updated_at
            FROM [tools].[odists_parsing_baseline]
            """
        )
    ).mappings().all()
    return {
        int(row["odist_id"]): {
            "values": _safe_json(row["original_values"], {}),
            "source": row["baseline_source"],
            "created_at": row["baseline_created_at"],
            "updated_at": row["baseline_updated_at"],
        }
        for row in rows
    }


def _chunks(values: List[int], size: int = 500) -> Iterable[List[int]]:
    for index in range(0, len(values), size):
        yield values[index : index + size]


def _load_current_rows(
    mysql_db: Session,
    odist_ids: Iterable[int],
) -> Dict[int, Dict[str, Any]]:
    ids = sorted({int(value) for value in odist_ids})
    if not ids:
        return {}

    selected_fields = ["id", *TRACKED_FIELDS]
    additional_fields = ["cust_name", "address", "city", "province"]
    selected_fields.extend(
        field for field in additional_fields if field not in selected_fields
    )

    result: Dict[int, Dict[str, Any]] = {}
    for batch in _chunks(ids):
        placeholders = []
        params: Dict[str, Any] = {}
        for index, odist_id in enumerate(batch):
            key = f"id_{index}"
            placeholders.append(f":{key}")
            params[key] = odist_id
        rows = mysql_db.execute(
            text(
                f"""
                SELECT {', '.join(f'`{field}`' for field in selected_fields)}
                FROM `{ODISTS_TABLE}`
                WHERE `id` IN ({', '.join(placeholders)})
                """
            ),
            params,
        ).mappings().all()
        for row in rows:
            result[int(row["id"])] = dict(row)
    return result


def _group_audits_by_odist(
    audits: List[Dict[str, Any]],
) -> Dict[int, List[Dict[str, Any]]]:
    grouped: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
    for audit in audits:
        grouped[int(audit["odist_id"])].append(audit)
    return grouped


def _ensure_baselines(
    mysql_db: Session,
    audit_db: Session,
    audits: List[Dict[str, Any]],
) -> Dict[int, Dict[str, Any]]:
    baselines = _load_baselines(audit_db)
    audit_ids = sorted({int(audit["odist_id"]) for audit in audits})
    missing_ids = [odist_id for odist_id in audit_ids if odist_id not in baselines]
    if not missing_ids:
        return baselines

    current_rows = _load_current_rows(mysql_db, missing_ids)
    grouped_audits = _group_audits_by_odist(audits)

    for odist_id in missing_ids:
        current_row = current_rows.get(odist_id)
        if current_row is None:
            continue

        original_values = {
            field: current_row.get(field)
            for field in TRACKED_FIELDS
        }
        first_old_value_seen: set[str] = set()
        odist_audits = grouped_audits.get(odist_id, [])

        for audit in odist_audits:
            old_values = audit["old_values_dict"]
            for field in TRACKED_FIELDS:
                if field in old_values and field not in first_old_value_seen:
                    original_values[field] = old_values[field]
                    first_old_value_seen.add(field)

        source = (
            "RECONSTRUCTED_FROM_FIRST_AUDIT"
            if odist_audits
            else "CURRENT_AT_FIRST_REPORT"
        )
        serialized = json.dumps(original_values, ensure_ascii=False, default=str)
        audit_db.execute(
            text(
                """
                INSERT INTO [tools].[odists_parsing_baseline]
                    ([odist_id], [original_values], [baseline_source])
                SELECT :odist_id, :original_values, :baseline_source
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM [tools].[odists_parsing_baseline]
                    WHERE [odist_id] = :odist_id
                )
                """
            ),
            {
                "odist_id": odist_id,
                "original_values": serialized,
                "baseline_source": source,
            },
        )
        baselines[odist_id] = {
            "values": original_values,
            "source": source,
            "created_at": None,
            "updated_at": None,
        }

    audit_db.commit()
    return baselines


def _find_field_owner(
    field: str,
    current_value: Any,
    audits: List[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    normalized_current = _normalize(current_value)
    for audit in reversed(audits):
        new_values = audit["new_values_dict"]
        if field not in new_values:
            continue
        if _normalize(new_values[field]) == normalized_current:
            return audit
    return None


def _event_revert_state(
    audit: Dict[str, Any],
    baseline_values: Dict[str, Any],
) -> str:
    new_values = audit["new_values_dict"]
    relevant_fields = [
        field
        for field in audit["changed_fields_list"]
        if field in TRACKED_FIELDS and field in new_values
    ]
    if not relevant_fields:
        return "CHANGE"

    returned_to_original = [
        _normalize(new_values[field]) == _normalize(baseline_values.get(field))
        for field in relevant_fields
    ]
    if all(returned_to_original):
        return "REVERT"
    if any(returned_to_original):
        return "PARTIAL REVERT"
    return "CHANGE"


def _build_effective_details(
    mysql_db: Session,
    audit_db: Session,
) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]], Dict[int, Dict[str, Any]]]:
    _ensure_schema(audit_db)
    audits = _load_audits(audit_db)
    baselines = _ensure_baselines(mysql_db, audit_db, audits)
    tracked_ids = sorted(set(baselines) | {int(audit["odist_id"]) for audit in audits})
    current_rows = _load_current_rows(mysql_db, tracked_ids)
    grouped_audits = _group_audits_by_odist(audits)

    details: List[Dict[str, Any]] = []
    for odist_id in tracked_ids:
        current_row = current_rows.get(odist_id)
        baseline = baselines.get(odist_id)
        if current_row is None or baseline is None:
            continue

        baseline_values = baseline["values"]
        active_fields = [
            field
            for field in TRACKED_FIELDS
            if _normalize(current_row.get(field))
            != _normalize(baseline_values.get(field))
        ]
        if not active_fields:
            continue

        odist_audits = grouped_audits.get(odist_id, [])
        owners: Dict[str, Dict[str, Any]] = {}
        for field in active_fields:
            owner = _find_field_owner(field, current_row.get(field), odist_audits)
            owner_key = (
                f"USER:{owner['user_id']}"
                if owner is not None
                else "UNTRACKED"
            )
            owner_bucket = owners.setdefault(
                owner_key,
                {
                    "owner": owner,
                    "fields": [],
                },
            )
            owner_bucket["fields"].append(field)

        global_status = _classify_fields(active_fields)
        global_revision_fields = [
            field for field in active_fields if field in REVISION_FIELDS
        ]

        for owner_bucket in owners.values():
            owner = owner_bucket["owner"]
            owned_fields = owner_bucket["fields"]
            owned_revision_fields = [
                field for field in owned_fields if field in REVISION_FIELDS
            ]
            member_audits = (
                [
                    audit
                    for audit in odist_audits
                    if int(audit["user_id"]) == int(owner["user_id"])
                ]
                if owner is not None
                else []
            )
            member_status = _classify_fields(owned_fields)

            details.append(
                {
                    "odist_id": odist_id,
                    "member_user_id": int(owner["user_id"]) if owner else None,
                    "member_name": owner["actor_full_name"] if owner else "UNTRACKED",
                    "username": owner["username"] if owner else "-",
                    "status": member_status,
                    "global_status": global_status,
                    "original_ogal_id": baseline_values.get("ogal_id"),
                    "current_ogal_id": current_row.get("ogal_id"),
                    "active_revision_fields": global_revision_fields,
                    "owned_revision_fields": owned_revision_fields,
                    "owned_fields": owned_fields,
                    "cust_name": current_row.get("cust_name"),
                    "address": current_row.get("address"),
                    "city": current_row.get("city"),
                    "province": current_row.get("province"),
                    "first_edited_at": _iso(
                        member_audits[0]["changed_at"] if member_audits else None
                    ),
                    "last_edited_at": _iso(
                        member_audits[-1]["changed_at"] if member_audits else None
                    ),
                    "total_actions": len(member_audits),
                    "baseline_source": baseline["source"],
                    "is_untracked": owner is None,
                }
            )

    details.sort(
        key=lambda item: (
            item.get("last_edited_at") or "",
            item["odist_id"],
        ),
        reverse=True,
    )
    return details, audits, baselines


def get_summary(
    mysql_db: Session,
    audit_db: Session,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    user_id: Optional[int] = None,
) -> Dict[str, Any]:
    details, all_audits, baselines = _build_effective_details(mysql_db, audit_db)

    summary_by_member: Dict[str, Dict[str, Any]] = {}
    member_options: Dict[str, Dict[str, Any]] = {}

    for audit in all_audits:
        key = str(audit["user_id"])
        member_options[key] = {
            "user_id": int(audit["user_id"]),
            "member_name": audit["actor_full_name"],
            "username": audit["username"],
        }

    for detail in details:
        member_key = (
            str(detail["member_user_id"])
            if detail["member_user_id"] is not None
            else "UNTRACKED"
        )
        member_options.setdefault(
            member_key,
            {
                "user_id": detail["member_user_id"],
                "member_name": detail["member_name"],
                "username": detail["username"],
            },
        )
        bucket = summary_by_member.setdefault(
            member_key,
            {
                "user_id": detail["member_user_id"],
                "member_name": detail["member_name"],
                "username": detail["username"],
                "active_parsing_rows": 0,
                "active_revision_rows": 0,
                "active_parsing_revision_rows": 0,
                "active_revised_fields": 0,
                "total_edit_activities": 0,
                "reverted_activities": 0,
                "partial_revert_activities": 0,
            },
        )
        if detail["status"] in {"PARSING", "PARSING & REVISI DATA"}:
            bucket["active_parsing_rows"] += 1
        if detail["status"] in {"REVISI DATA", "PARSING & REVISI DATA"}:
            bucket["active_revision_rows"] += 1
        if detail["status"] == "PARSING & REVISI DATA":
            bucket["active_parsing_revision_rows"] += 1
        bucket["active_revised_fields"] += len(detail["owned_revision_fields"])

    activity_audits = [
        audit
        for audit in all_audits
        if (date_from is None or audit["changed_at"] >= date_from)
        and (
            date_to is None
            or audit["changed_at"].date() <= date_to.date()
        )
    ]
    for audit in activity_audits:
        member_key = str(audit["user_id"])
        bucket = summary_by_member.setdefault(
            member_key,
            {
                "user_id": int(audit["user_id"]),
                "member_name": audit["actor_full_name"],
                "username": audit["username"],
                "active_parsing_rows": 0,
                "active_revision_rows": 0,
                "active_parsing_revision_rows": 0,
                "active_revised_fields": 0,
                "total_edit_activities": 0,
                "reverted_activities": 0,
                "partial_revert_activities": 0,
            },
        )
        bucket["total_edit_activities"] += 1
        baseline_values = baselines.get(int(audit["odist_id"]), {}).get("values", {})
        revert_state = _event_revert_state(audit, baseline_values)
        if revert_state == "REVERT":
            bucket["reverted_activities"] += 1
        elif revert_state == "PARTIAL REVERT":
            bucket["partial_revert_activities"] += 1

    members = list(summary_by_member.values())
    if user_id is not None:
        members = [member for member in members if member["user_id"] == user_id]
    members.sort(
        key=lambda member: (
            member["active_parsing_rows"] + member["active_revision_rows"],
            member["total_edit_activities"],
            member["member_name"],
        ),
        reverse=True,
    )

    totals = {
        key: sum(int(member[key]) for member in members)
        for key in [
            "active_parsing_rows",
            "active_revision_rows",
            "active_parsing_revision_rows",
            "active_revised_fields",
            "total_edit_activities",
            "reverted_activities",
            "partial_revert_activities",
        ]
    }

    return {
        "members": members,
        "member_options": sorted(
            member_options.values(),
            key=lambda item: item["member_name"],
        ),
        "totals": totals,
    }


def get_effective_results(
    mysql_db: Session,
    audit_db: Session,
    page: int,
    page_size: int,
    user_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
) -> Dict[str, Any]:
    details, _, _ = _build_effective_details(mysql_db, audit_db)
    normalized_search = _normalize(search) if search else ""

    filtered: List[Dict[str, Any]] = []
    for detail in details:
        if user_id is not None and detail["member_user_id"] != user_id:
            continue
        if status_filter and detail["status"] != status_filter:
            continue
        if normalized_search:
            haystack = " ".join(
                str(detail.get(field) or "")
                for field in [
                    "odist_id",
                    "member_name",
                    "username",
                    "cust_name",
                    "address",
                    "city",
                    "province",
                ]
            )
            if normalized_search not in _normalize(haystack):
                continue
        filtered.append(detail)

    page = max(page, 1)
    page_size = min(max(page_size, 1), 200)
    total = len(filtered)
    offset = (page - 1) * page_size
    return {
        "items": filtered[offset : offset + page_size],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, math.ceil(total / page_size)),
    }


def get_activity_history(
    mysql_db: Session,
    audit_db: Session,
    page: int,
    page_size: int,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    user_id: Optional[int] = None,
    change_type: Optional[str] = None,
    revert_state: Optional[str] = None,
    search: Optional[str] = None,
) -> Dict[str, Any]:
    _ensure_schema(audit_db)
    audits = _load_audits(
        audit_db,
        date_from=date_from,
        date_to=date_to,
        user_id=user_id,
    )
    baselines = _ensure_baselines(mysql_db, audit_db, audits)
    normalized_search = _normalize(search) if search else ""

    items: List[Dict[str, Any]] = []
    for audit in reversed(audits):
        baseline_values = baselines.get(int(audit["odist_id"]), {}).get("values", {})
        audit_revert_state = _event_revert_state(audit, baseline_values)
        audit_change_type = audit["change_type"]
        if change_type and audit_change_type != change_type:
            continue
        if revert_state and audit_revert_state != revert_state:
            continue
        if normalized_search:
            haystack = " ".join(
                [
                    str(audit["odist_id"]),
                    str(audit["actor_full_name"]),
                    str(audit["username"]),
                    " ".join(audit["changed_fields_list"]),
                ]
            )
            if normalized_search not in _normalize(haystack):
                continue

        items.append(
            {
                "audit_id": int(audit["audit_id"]),
                "odist_id": int(audit["odist_id"]),
                "user_id": int(audit["user_id"]),
                "member_name": audit["actor_full_name"],
                "username": audit["username"],
                "change_type": audit_change_type,
                "revert_state": audit_revert_state,
                "changed_fields": [
                    field
                    for field in audit["changed_fields_list"]
                    if field in TRACKED_FIELDS
                ],
                "old_values": audit["old_values_dict"],
                "new_values": audit["new_values_dict"],
                "changed_at": _iso(audit["changed_at"]),
            }
        )

    page = max(page, 1)
    page_size = min(max(page_size, 1), 200)
    total = len(items)
    offset = (page - 1) * page_size
    return {
        "items": items[offset : offset + page_size],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, math.ceil(total / page_size)),
    }
