import json
import math
from typing import Any, Dict, Iterable, List, Optional, Tuple

from sqlalchemy import text
from sqlmodel import Session

from app.models.app_user import AppUser
from app.services import activity_audit_service


TABLE_SQL = "[bronze_so].[ARTBST]"
AUDIT_TABLE_NAME = "bronze_so.ARTBST"
AUDIT_MODULE_KEY = "ARTBST"
AUDIT_MODULE_LABEL = "ARTBST"

FIELD_DEFS: Dict[str, Dict[str, Any]] = {
    "id": {"data_type": "int", "nullable": False, "max_length": None, "editable": False, "label": "ID"},
    "artcode": {"data_type": "varchar", "nullable": True, "max_length": 20, "editable": True, "label": "PROD CODE"},
    "oms30_0": {"data_type": "varchar", "nullable": True, "max_length": 100, "editable": True, "label": "PROD NAME"},
    "u_konversi": {"data_type": "float", "nullable": True, "max_length": None, "editable": True, "label": "CRT"},
    "verkp_verp": {"data_type": "float", "nullable": True, "max_length": None, "editable": True, "label": "PRICE"},
    "dwh_created_by": {"data_type": "nvarchar", "nullable": True, "max_length": 100, "editable": False, "label": "DWH CREATED BY"},
    "dwh_updated_by": {"data_type": "nvarchar", "nullable": True, "max_length": 100, "editable": False, "label": "DWH UPDATED BY"},
    "dwh_created_at": {"data_type": "datetime2", "nullable": False, "max_length": None, "editable": False, "label": "DWH CREATED AT"},
    "dwh_updated_at": {"data_type": "datetime2", "nullable": True, "max_length": None, "editable": False, "label": "DWH UPDATED AT"},
}

COLUMNS = list(FIELD_DEFS.keys())
EDITABLE_FIELDS = [name for name, definition in FIELD_DEFS.items() if definition["editable"]]
INTEGER_FIELDS = {"id"}
FLOAT_FIELDS = {"u_konversi", "verkp_verp"}


def _column_sql(name: str) -> str:
    if name not in FIELD_DEFS:
        raise ValueError(f"Kolom tidak dikenal: {name}")
    return f"[{name}]"


def get_columns() -> List[Dict[str, Any]]:
    return [
        {
            "name": name,
            "label": definition["label"],
            "data_type": definition["data_type"],
            "is_nullable": definition["nullable"],
            "max_length": definition["max_length"],
            "editable": definition["editable"],
        }
        for name, definition in FIELD_DEFS.items()
    ]


def _parse_filters(filters_json: Optional[str]) -> Dict[str, str]:
    if not filters_json:
        return {}
    try:
        parsed = json.loads(filters_json)
    except json.JSONDecodeError as exc:
        raise ValueError("Format filter tidak valid") from exc
    if not isinstance(parsed, dict):
        raise ValueError("Format filter tidak valid")
    result: Dict[str, str] = {}
    for key, value in parsed.items():
        if key not in FIELD_DEFS:
            raise ValueError(f"Kolom filter tidak dikenal: {key}")
        if value is not None:
            result[key] = str(value)
    return result


def _coerce_filter_value(field: str, value: Any) -> Any:
    if value is None:
        return None
    if field in INTEGER_FIELDS:
        return int(value)
    if field in FLOAT_FIELDS:
        return float(value)
    return value


def _build_where(filters: Dict[str, str], exclude_field: Optional[str] = None) -> Tuple[str, Dict[str, Any]]:
    clauses: List[str] = []
    params: Dict[str, Any] = {}
    index = 0
    for field, raw_value in filters.items():
        if field == exclude_field:
            continue
        column = _column_sql(field)
        if raw_value.startswith("__IN__:"):
            try:
                selected = json.loads(raw_value[7:])
            except json.JSONDecodeError as exc:
                raise ValueError(f"Filter {field} tidak valid") from exc
            if not isinstance(selected, list) or not selected:
                continue
            values = [value for value in selected if value is not None]
            has_null = any(value is None for value in selected)
            parts: List[str] = []
            placeholders: List[str] = []
            for value in values:
                key = f"p{index}"
                index += 1
                placeholders.append(f":{key}")
                params[key] = _coerce_filter_value(field, value)
            if placeholders:
                parts.append(f"{column} IN ({', '.join(placeholders)})")
            if has_null:
                parts.append(f"{column} IS NULL")
            if parts:
                clauses.append("(" + " OR ".join(parts) + ")")
            continue
        key = f"p{index}"
        index += 1
        clauses.append(f"UPPER(CAST({column} AS VARCHAR(4000))) LIKE UPPER(:{key})")
        params[key] = f"%{raw_value}%"
    return (" WHERE " + " AND ".join(clauses) if clauses else ""), params


def _fetch_one_by_id(db: Session, record_id: int) -> Optional[Dict[str, Any]]:
    columns = ", ".join(_column_sql(name) for name in COLUMNS)
    row = db.execute(
        text(f"SELECT {columns} FROM {TABLE_SQL} WHERE [id] = :id"),
        {"id": record_id},
    ).mappings().first()
    return dict(row) if row else None


def _business_snapshot(row: Dict[str, Any]) -> Dict[str, Any]:
    return {field: row.get(field) for field in EDITABLE_FIELDS}


def _record_label(values: Dict[str, Any]) -> str:
    parts = [values.get("artcode"), values.get("oms30_0")]
    return " | ".join(str(value) for value in parts if value not in (None, ""))


def _actual_changes(old_row: Dict[str, Any], values: Dict[str, Any]) -> Dict[str, Any]:
    return {
        field: value
        for field, value in values.items()
        if old_row.get(field) != value
    }


def get_page(db: Session, page: int, page_size: int, filters_json: Optional[str], sort_by: str, sort_dir: str) -> Dict[str, Any]:
    if sort_by not in FIELD_DEFS:
        raise ValueError("Kolom sorting tidak valid")
    direction = sort_dir.lower()
    if direction not in ("asc", "desc"):
        raise ValueError("Arah sorting tidak valid")
    filters = _parse_filters(filters_json)
    where_sql, params = _build_where(filters)
    total = int(db.execute(text(f"SELECT COUNT(*) FROM {TABLE_SQL}{where_sql}"), params).scalar_one())
    total_pages = max(1, math.ceil(total / page_size))
    safe_page = min(max(1, page), total_pages)
    row_start = (safe_page - 1) * page_size + 1
    row_end = safe_page * page_size
    columns = ", ".join(_column_sql(name) for name in COLUMNS)
    order_sql = f"{_column_sql(sort_by)} {direction.upper()}"
    if sort_by != "id":
        order_sql += ", [id] ASC"
    rows = db.execute(
        text(
            f"""
            SELECT {columns}
            FROM (
                SELECT ROW_NUMBER() OVER (ORDER BY {order_sql}) AS [__row_number], {columns}
                FROM {TABLE_SQL}{where_sql}
            ) AS [paged]
            WHERE [__row_number] BETWEEN :row_start AND :row_end
            ORDER BY [__row_number]
            """
        ),
        {**params, "row_start": row_start, "row_end": row_end},
    ).mappings().all()
    return {
        "items": [dict(row) for row in rows],
        "total": total,
        "page": safe_page,
        "page_size": page_size,
        "total_pages": total_pages,
        "columns": get_columns(),
    }


def get_distinct_values(db: Session, field: str, search: Optional[str], limit: int, filters_json: Optional[str]) -> List[Dict[str, Any]]:
    if field not in FIELD_DEFS:
        raise ValueError("Kolom filter tidak valid")
    safe_limit = min(max(1, int(limit)), 200)
    filters = _parse_filters(filters_json)
    where_sql, params = _build_where(filters, exclude_field=field)
    column = _column_sql(field)
    if search:
        clause = f"UPPER(CAST({column} AS VARCHAR(4000))) LIKE UPPER(:value_search)"
        where_sql += (" AND " if where_sql else " WHERE ") + clause
        params["value_search"] = f"%{search}%"
    rows = db.execute(
        text(
            f"""
            SELECT TOP {safe_limit} {column} AS [value], COUNT(*) AS [row_count]
            FROM {TABLE_SQL}{where_sql}
            GROUP BY {column}
            ORDER BY CASE WHEN {column} IS NULL THEN 0 ELSE 1 END, {column}
            """
        ),
        params,
    ).mappings().all()
    return [dict(row) for row in rows]


def _normalize_write_value(field: str, value: Any) -> Any:
    if field not in EDITABLE_FIELDS:
        raise ValueError(f"Kolom tidak dapat diedit: {field}")
    definition = FIELD_DEFS[field]
    if value is None or value == "":
        return None
    if field in FLOAT_FIELDS:
        try:
            return float(value)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"{definition['label']} harus berupa angka") from exc
    text_value = str(value)
    max_length = definition["max_length"]
    if max_length is not None and len(text_value) > int(max_length):
        raise ValueError(f"{definition['label']} maksimal {max_length} karakter")
    return text_value


def _normalize_values(values: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(values, dict) or not values:
        raise ValueError("Tidak ada perubahan yang dikirim")
    return {field: _normalize_write_value(field, value) for field, value in values.items()}


def _normalize_create_values(values: Dict[str, Any]) -> Dict[str, Any]:
    return {field: _normalize_write_value(field, values.get(field)) for field in EDITABLE_FIELDS}


def create_record(db: Session, values: Dict[str, Any], current_user: AppUser) -> Dict[str, Any]:
    normalized = _normalize_create_values(values)
    column_sql = ", ".join(_column_sql(field) for field in EDITABLE_FIELDS)
    value_sql = ", ".join(f":{field}" for field in EDITABLE_FIELDS)
    actor = activity_audit_service.actor_name(current_user)[:100]
    batch_id = activity_audit_service.new_batch_id()
    try:
        record_id = int(
            db.execute(
                text(
                    f"""
                    INSERT INTO {TABLE_SQL} ({column_sql}, [dwh_created_by], [dwh_created_at])
                    OUTPUT INSERTED.[id]
                    VALUES ({value_sql}, :actor_name, SYSDATETIME())
                    """
                ),
                {**normalized, "actor_name": actor},
            ).scalar_one()
        )
        activity_audit_service.record_activity(
            db,
            module_key=AUDIT_MODULE_KEY,
            module_label=AUDIT_MODULE_LABEL,
            table_name=AUDIT_TABLE_NAME,
            record_id=record_id,
            record_label=_record_label(normalized),
            action=activity_audit_service.ACTION_INSERT,
            current_user=current_user,
            changed_fields=EDITABLE_FIELDS,
            old_values={},
            new_values=normalized,
            batch_id=batch_id,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    created = _fetch_one_by_id(db, record_id)
    if created is None:
        raise RuntimeError("Data ARTBST hasil insert tidak ditemukan")
    return created


def update_record(db: Session, record_id: int, values: Dict[str, Any], current_user: AppUser) -> Dict[str, Any]:
    old_row = _fetch_one_by_id(db, record_id)
    if old_row is None:
        raise LookupError("ARTBST tidak ditemukan")
    normalized = _normalize_values(values)
    changed = _actual_changes(old_row, normalized)
    if not changed:
        return old_row

    assignments = ", ".join(f"{_column_sql(field)} = :v_{field}" for field in changed)
    params = {f"v_{field}": value for field, value in changed.items()}
    actor = activity_audit_service.actor_name(current_user)[:100]
    params.update({"id": record_id, "actor_name": actor})
    new_snapshot = _business_snapshot(old_row)
    new_snapshot.update(changed)
    batch_id = activity_audit_service.new_batch_id()
    try:
        db.execute(
            text(
                f"""
                UPDATE {TABLE_SQL}
                SET {assignments}, [dwh_updated_by] = :actor_name, [dwh_updated_at] = SYSDATETIME()
                WHERE [id] = :id
                """
            ),
            params,
        )
        activity_audit_service.record_activity(
            db,
            module_key=AUDIT_MODULE_KEY,
            module_label=AUDIT_MODULE_LABEL,
            table_name=AUDIT_TABLE_NAME,
            record_id=record_id,
            record_label=_record_label(new_snapshot),
            action=activity_audit_service.ACTION_UPDATE,
            current_user=current_user,
            changed_fields=changed.keys(),
            old_values={field: old_row.get(field) for field in changed},
            new_values=changed,
            batch_id=batch_id,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    updated = _fetch_one_by_id(db, record_id)
    if updated is None:
        raise RuntimeError("Data ARTBST hasil update tidak ditemukan")
    return updated


def update_batch(db: Session, items: Iterable[Dict[str, Any]], current_user: AppUser) -> Dict[str, Any]:
    prepared: List[Tuple[int, Dict[str, Any], Dict[str, Any]]] = []
    for item in items:
        record_id = int(item["id"])
        old_row = _fetch_one_by_id(db, record_id)
        if old_row is None:
            raise LookupError(f"ARTBST ID {record_id} tidak ditemukan")
        normalized = _normalize_values(item["values"])
        changed = _actual_changes(old_row, normalized)
        if changed:
            prepared.append((record_id, old_row, changed))

    updated_ids: List[int] = []
    actor = activity_audit_service.actor_name(current_user)[:100]
    batch_id = activity_audit_service.new_batch_id()
    try:
        for record_id, old_row, values in prepared:
            assignments = ", ".join(f"{_column_sql(field)} = :v_{field}" for field in values)
            params = {f"v_{field}": value for field, value in values.items()}
            params.update({"id": record_id, "actor_name": actor})
            db.execute(
                text(f"UPDATE {TABLE_SQL} SET {assignments}, [dwh_updated_by] = :actor_name, [dwh_updated_at] = SYSDATETIME() WHERE [id] = :id"),
                params,
            )
            new_snapshot = _business_snapshot(old_row)
            new_snapshot.update(values)
            activity_audit_service.record_activity(
                db,
                module_key=AUDIT_MODULE_KEY,
                module_label=AUDIT_MODULE_LABEL,
                table_name=AUDIT_TABLE_NAME,
                record_id=record_id,
                record_label=_record_label(new_snapshot),
                action=activity_audit_service.ACTION_UPDATE,
                current_user=current_user,
                changed_fields=values.keys(),
                old_values={field: old_row.get(field) for field in values},
                new_values=values,
                batch_id=batch_id,
            )
            updated_ids.append(record_id)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"updated_count": len(updated_ids), "updated_ids": updated_ids}


def save_changes(
    db: Session,
    creates: Iterable[Dict[str, Any]],
    updates: Iterable[Dict[str, Any]],
    deletes: Iterable[int],
    current_user: AppUser,
) -> Dict[str, Any]:
    prepared_creates = [_normalize_create_values(values) for values in creates]
    delete_ids = list(dict.fromkeys(int(record_id) for record_id in deletes))
    delete_set = set(delete_ids)
    prepared_updates: List[Tuple[int, Dict[str, Any], Dict[str, Any]]] = []

    for item in updates:
        record_id = int(item["id"])
        if record_id in delete_set:
            raise ValueError(f"ID {record_id} tidak boleh di-update dan di-delete bersamaan")
        old_row = _fetch_one_by_id(db, record_id)
        if old_row is None:
            raise LookupError(f"ARTBST ID {record_id} tidak ditemukan")
        normalized = _normalize_values(item["values"])
        changed = _actual_changes(old_row, normalized)
        if changed:
            prepared_updates.append((record_id, old_row, changed))

    delete_rows: Dict[int, Dict[str, Any]] = {}
    for record_id in delete_ids:
        old_row = _fetch_one_by_id(db, record_id)
        if old_row is None:
            raise LookupError(f"ARTBST ID {record_id} tidak ditemukan")
        delete_rows[record_id] = old_row

    if not prepared_creates and not prepared_updates and not delete_ids:
        raise ValueError("Tidak ada perubahan yang dikirim")

    created_ids: List[int] = []
    updated_ids: List[int] = []
    deleted_ids: List[int] = []
    actor = activity_audit_service.actor_name(current_user)[:100]
    batch_id = activity_audit_service.new_batch_id()
    insert_columns = ", ".join(_column_sql(field) for field in EDITABLE_FIELDS)
    insert_values = ", ".join(f":{field}" for field in EDITABLE_FIELDS)
    try:
        for values in prepared_creates:
            record_id = int(
                db.execute(
                    text(
                        f"""
                        INSERT INTO {TABLE_SQL} ({insert_columns}, [dwh_created_by], [dwh_created_at])
                        OUTPUT INSERTED.[id]
                        VALUES ({insert_values}, :actor_name, SYSDATETIME())
                        """
                    ),
                    {**values, "actor_name": actor},
                ).scalar_one()
            )
            activity_audit_service.record_activity(
                db,
                module_key=AUDIT_MODULE_KEY,
                module_label=AUDIT_MODULE_LABEL,
                table_name=AUDIT_TABLE_NAME,
                record_id=record_id,
                record_label=_record_label(values),
                action=activity_audit_service.ACTION_INSERT,
                current_user=current_user,
                changed_fields=EDITABLE_FIELDS,
                old_values={},
                new_values=values,
                batch_id=batch_id,
            )
            created_ids.append(record_id)

        for record_id, old_row, values in prepared_updates:
            assignments = ", ".join(f"{_column_sql(field)} = :v_{field}" for field in values)
            params = {f"v_{field}": value for field, value in values.items()}
            params.update({"id": record_id, "actor_name": actor})
            db.execute(
                text(f"UPDATE {TABLE_SQL} SET {assignments}, [dwh_updated_by] = :actor_name, [dwh_updated_at] = SYSDATETIME() WHERE [id] = :id"),
                params,
            )
            new_snapshot = _business_snapshot(old_row)
            new_snapshot.update(values)
            activity_audit_service.record_activity(
                db,
                module_key=AUDIT_MODULE_KEY,
                module_label=AUDIT_MODULE_LABEL,
                table_name=AUDIT_TABLE_NAME,
                record_id=record_id,
                record_label=_record_label(new_snapshot),
                action=activity_audit_service.ACTION_UPDATE,
                current_user=current_user,
                changed_fields=values.keys(),
                old_values={field: old_row.get(field) for field in values},
                new_values=values,
                batch_id=batch_id,
            )
            updated_ids.append(record_id)

        for record_id in delete_ids:
            old_row = delete_rows[record_id]
            db.execute(text(f"DELETE FROM {TABLE_SQL} WHERE [id] = :id"), {"id": record_id})
            snapshot = _business_snapshot(old_row)
            activity_audit_service.record_activity(
                db,
                module_key=AUDIT_MODULE_KEY,
                module_label=AUDIT_MODULE_LABEL,
                table_name=AUDIT_TABLE_NAME,
                record_id=record_id,
                record_label=_record_label(snapshot),
                action=activity_audit_service.ACTION_DELETE,
                current_user=current_user,
                changed_fields=EDITABLE_FIELDS,
                old_values=snapshot,
                new_values={},
                batch_id=batch_id,
            )
            deleted_ids.append(record_id)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "created_count": len(created_ids),
        "created_ids": created_ids,
        "updated_count": len(updated_ids),
        "updated_ids": updated_ids,
        "deleted_count": len(deleted_ids),
        "deleted_ids": deleted_ids,
    }


def delete_record(db: Session, record_id: int, current_user: AppUser) -> Dict[str, Any]:
    old_row = _fetch_one_by_id(db, record_id)
    if old_row is None:
        raise LookupError("ARTBST tidak ditemukan")
    snapshot = _business_snapshot(old_row)
    batch_id = activity_audit_service.new_batch_id()
    try:
        db.execute(text(f"DELETE FROM {TABLE_SQL} WHERE [id] = :id"), {"id": record_id})
        activity_audit_service.record_activity(
            db,
            module_key=AUDIT_MODULE_KEY,
            module_label=AUDIT_MODULE_LABEL,
            table_name=AUDIT_TABLE_NAME,
            record_id=record_id,
            record_label=_record_label(snapshot),
            action=activity_audit_service.ACTION_DELETE,
            current_user=current_user,
            changed_fields=EDITABLE_FIELDS,
            old_values=snapshot,
            new_values={},
            batch_id=batch_id,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"deleted_id": record_id}
