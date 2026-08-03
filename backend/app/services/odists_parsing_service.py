import json
import math
from typing import Any, Dict, List

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlmodel import Session

from app.models.app_user import AppUser


TABLE_NAME = "gold_odists_parsing_manual"
READ_ONLY_FIELDS = {
    "id",
    "updated_by",
    "parsed_at",
    "updated_at",
    "dwh_loaded_at",
    "dwh_refreshed_at",
    "status_upd",
}
DEFAULT_COLUMNS = [
    "id",
    "ogal_id",
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
    "status_upd",
    "updated_by",
    "parsed_at",
    "dwh_refreshed_at",
]


def _quote(name: str) -> str:
    return f"`{name.replace('`', '``')}`"


def _column_metadata(db: Session) -> List[Dict[str, Any]]:
    rows = db.execute(
        text(
            """
            SELECT
                COLUMN_NAME AS name,
                DATA_TYPE AS data_type,
                CASE WHEN IS_NULLABLE = 'YES' THEN 1 ELSE 0 END AS is_nullable,
                ORDINAL_POSITION AS ordinal_position,
                EXTRA AS extra
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = :table_name
            ORDER BY ORDINAL_POSITION
            """
        ),
        {"table_name": TABLE_NAME},
    ).mappings().all()

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Tabel {TABLE_NAME} tidak ditemukan pada database MySQL pipeline",
        )

    return [
        {
            "name": row["name"],
            "label": "odists_id" if row["name"] == "id" else row["name"],
            "data_type": row["data_type"],
            "is_nullable": bool(row["is_nullable"]),
            "ordinal_position": row["ordinal_position"],
            "editable": row["name"] not in READ_ONLY_FIELDS
            and "GENERATED" not in str(row.get("extra") or "").upper(),
        }
        for row in rows
    ]


def _parse_filters(filters_json: str | None) -> Dict[str, Any]:
    try:
        filters = json.loads(filters_json) if filters_json else {}
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=422,
            detail="Format filters harus berupa JSON object",
        ) from exc
    if not isinstance(filters, dict):
        raise HTTPException(
            status_code=422,
            detail="Format filters harus berupa JSON object",
        )
    return filters


def _build_where(
    filters: Dict[str, Any],
    allowed: set[str],
) -> tuple[str, Dict[str, Any]]:
    where_parts: List[str] = []
    params: Dict[str, Any] = {}

    for index, (field, raw_value) in enumerate(filters.items()):
        if field not in allowed or raw_value is None or str(raw_value) == "":
            continue

        value = str(raw_value)
        quoted = _quote(field)
        key = f"filter_{index}"

        if value == "__NULL__":
            where_parts.append(f"{quoted} IS NULL")
        elif value == "__EMPTY__":
            where_parts.append(f"COALESCE(CAST({quoted} AS CHAR), '') = ''")
        elif value.startswith("__IN__:"):
            try:
                selected_values = json.loads(value[7:])
            except json.JSONDecodeError as exc:
                raise HTTPException(
                    status_code=422,
                    detail=f"Format multi-value filter untuk field {field} tidak valid",
                ) from exc

            if not isinstance(selected_values, list):
                raise HTTPException(
                    status_code=422,
                    detail=f"Multi-value filter untuk field {field} harus berupa list",
                )

            or_parts: List[str] = []
            for value_index, selected_value in enumerate(selected_values):
                if selected_value is None:
                    or_parts.append(f"{quoted} IS NULL")
                else:
                    multi_key = f"filter_{index}_{value_index}"
                    or_parts.append(f"{quoted} = :{multi_key}")
                    params[multi_key] = selected_value

            if or_parts:
                where_parts.append(f"({' OR '.join(or_parts)})")
        elif value.startswith("__EQ__:"):
            where_parts.append(f"{quoted} = :{key}")
            params[key] = value[7:]
        else:
            where_parts.append(f"CAST({quoted} AS CHAR) LIKE :{key}")
            params[key] = f"%{value}%"

    return (
        " WHERE " + " AND ".join(where_parts) if where_parts else "",
        params,
    )


def get_page(
    db: Session,
    page: int,
    page_size: int,
    columns_csv: str | None,
    filters_json: str | None,
    sort_by: str,
    sort_dir: str,
) -> Dict[str, Any]:
    metadata = _column_metadata(db)
    allowed = {item["name"] for item in metadata}

    requested = [
        part.strip()
        for part in (columns_csv or "").split(",")
        if part.strip()
    ]
    selected = [name for name in requested if name in allowed]
    if not selected:
        selected = [name for name in DEFAULT_COLUMNS if name in allowed]
    if "id" in allowed and "id" not in selected:
        selected.insert(0, "id")

    filters = _parse_filters(filters_json)
    where_sql, params = _build_where(filters, allowed)

    safe_sort = sort_by if sort_by in allowed else "id"
    direction = "DESC" if sort_dir.lower() == "desc" else "ASC"
    page = max(page, 1)
    page_size = min(max(page_size, 1), 200)
    offset = (page - 1) * page_size

    total = int(
        db.execute(
            text(f"SELECT COUNT(*) FROM {_quote(TABLE_NAME)}{where_sql}"),
            params,
        ).scalar_one()
    )

    data_params = dict(params)
    data_params.update({"offset": offset, "page_size": page_size})
    rows = db.execute(
        text(
            f"""
            SELECT {', '.join(_quote(name) for name in selected)}
            FROM {_quote(TABLE_NAME)}
            {where_sql}
            ORDER BY {_quote(safe_sort)} {direction}
            LIMIT :page_size OFFSET :offset
            """
        ),
        data_params,
    ).mappings().all()

    return {
        "items": [dict(row) for row in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, math.ceil(total / page_size)),
        "columns": metadata,
    }


def get_distinct_values(
    db: Session,
    field: str,
    search: str | None,
    filters_json: str | None,
    limit: int,
) -> List[Dict[str, Any]]:
    metadata = _column_metadata(db)
    allowed = {item["name"] for item in metadata}
    if field not in allowed:
        raise HTTPException(
            status_code=422,
            detail="Field choose value tidak valid",
        )

    filters = _parse_filters(filters_json)
    related_filters = {
        filter_field: filter_value
        for filter_field, filter_value in filters.items()
        if filter_field != field
    }
    where_sql, params = _build_where(related_filters, allowed)

    if search:
        search_condition = f"CAST({_quote(field)} AS CHAR) LIKE :value_search"
        where_sql = (
            f"{where_sql} AND {search_condition}"
            if where_sql
            else f" WHERE {search_condition}"
        )
        params["value_search"] = f"%{search}%"

    limit = min(max(limit, 1), 200)
    params["limit"] = limit

    rows = db.execute(
        text(
            f"""
            SELECT {_quote(field)} AS value, COUNT(*) AS row_count
            FROM {_quote(TABLE_NAME)}
            {where_sql}
            GROUP BY {_quote(field)}
            ORDER BY row_count DESC, {_quote(field)} ASC
            LIMIT :limit
            """
        ),
        params,
    ).mappings().all()

    return [
        {"value": row["value"], "row_count": int(row["row_count"])}
        for row in rows
    ]


def update_rows(
    mysql_db: Session,
    audit_db: Session,
    items: List[Dict[str, Any]],
    current_user: AppUser,
) -> Dict[str, Any]:
    if not items:
        raise HTTPException(
            status_code=422,
            detail="Tidak ada perubahan yang dikirim",
        )
    if len(items) > 200:
        raise HTTPException(
            status_code=422,
            detail="Maksimal 200 row dalam satu batch",
        )

    item_ids = [int(item["id"]) for item in items]
    if len(item_ids) != len(set(item_ids)):
        raise HTTPException(
            status_code=422,
            detail="Terdapat odists_id duplikat dalam batch",
        )

    metadata = _column_metadata(mysql_db)
    editable = {item["name"] for item in metadata if item["editable"]}
    parser_name = (current_user.full_name or current_user.username).strip()
    status_upd = f"Parsed by {parser_name}"
    audit_records: List[Dict[str, Any]] = []

    try:
        for item in items:
            odist_id = int(item["id"])
            values = item.get("values") or {}
            clean_values = {
                key: value for key, value in values.items() if key in editable
            }
            if not clean_values:
                raise HTTPException(
                    status_code=422,
                    detail=f"Tidak ada field editable untuk odists_id {odist_id}",
                )

            old_row = mysql_db.execute(
                text(
                    f"SELECT * FROM {_quote(TABLE_NAME)} "
                    "WHERE `id` = :id FOR UPDATE"
                ),
                {"id": odist_id},
            ).mappings().one_or_none()
            if old_row is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"Data ODIST {odist_id} tidak ditemukan",
                )

            changed_values: Dict[str, Any] = {}
            for changed_field, value in clean_values.items():
                normalized = None if value == "" else value
                if normalized != old_row.get(changed_field):
                    changed_values[changed_field] = normalized

            if not changed_values:
                continue

            params: Dict[str, Any] = {
                "id": odist_id,
                "updated_by": current_user.user_id,
                "status_upd": status_upd,
            }
            set_parts: List[str] = []
            for index, (changed_field, value) in enumerate(
                changed_values.items()
            ):
                key = f"value_{index}"
                set_parts.append(f"{_quote(changed_field)} = :{key}")
                params[key] = value

            set_parts.extend(
                [
                    "`updated_at` = CURRENT_TIMESTAMP",
                    "`parsed_at` = CURRENT_TIMESTAMP",
                    "`status_upd` = :status_upd",
                    "`updated_by` = :updated_by",
                ]
            )

            mysql_db.execute(
                text(
                    f"UPDATE {_quote(TABLE_NAME)} "
                    f"SET {', '.join(set_parts)} WHERE `id` = :id"
                ),
                params,
            )

            audit_records.append(
                {
                    "odist_id": odist_id,
                    "user_id": current_user.user_id,
                    "username": current_user.username,
                    "changed_fields": json.dumps(
                        list(changed_values.keys()),
                        ensure_ascii=False,
                    ),
                    "old_values": json.dumps(
                        {
                            changed_field: old_row.get(changed_field)
                            for changed_field in changed_values
                        },
                        ensure_ascii=False,
                        default=str,
                    ),
                    "new_values": json.dumps(
                        changed_values,
                        ensure_ascii=False,
                        default=str,
                    ),
                }
            )

        if not audit_records:
            mysql_db.rollback()
            return {"updated_count": 0, "updated_ids": []}

        mysql_db.commit()
    except HTTPException:
        mysql_db.rollback()
        raise
    except Exception:
        mysql_db.rollback()
        raise

    try:
        for record in audit_records:
            audit_db.execute(
                text(
                    """
                    INSERT INTO [tools].[odists_parsing_audit_log]
                        ([odist_id], [user_id], [username], [changed_fields], [old_values], [new_values])
                    VALUES
                        (:odist_id, :user_id, :username, :changed_fields, :old_values, :new_values)
                    """
                ),
                record,
            )
        audit_db.commit()
    except Exception:
        audit_db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Batch ODIST berhasil diperbarui, tetapi pencatatan audit gagal"
            ),
        )

    return {
        "updated_count": len(audit_records),
        "updated_ids": [record["odist_id"] for record in audit_records],
    }


def update_row(
    mysql_db: Session,
    audit_db: Session,
    odist_id: int,
    values: Dict[str, Any],
    current_user: AppUser,
) -> Dict[str, Any]:
    update_rows(
        mysql_db=mysql_db,
        audit_db=audit_db,
        items=[{"id": odist_id, "values": values}],
        current_user=current_user,
    )

    updated = mysql_db.execute(
        text(f"SELECT * FROM {_quote(TABLE_NAME)} WHERE `id` = :id"),
        {"id": odist_id},
    ).mappings().one_or_none()
    if updated is None:
        raise HTTPException(
            status_code=404,
            detail="Data ODIST tidak ditemukan",
        )
    return dict(updated)
