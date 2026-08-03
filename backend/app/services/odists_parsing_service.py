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
        raise HTTPException(status_code=422, detail="Format filters harus berupa JSON object") from exc
    if not isinstance(filters, dict):
        raise HTTPException(status_code=422, detail="Format filters harus berupa JSON object")
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

    return (" WHERE " + " AND ".join(where_parts) if where_parts else "", params)


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

    requested = [part.strip() for part in (columns_csv or "").split(",") if part.strip()]
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
    limit: int,
) -> List[Dict[str, Any]]:
    metadata = _column_metadata(db)
    allowed = {item["name"] for item in metadata}
    if field not in allowed:
        raise HTTPException(status_code=422, detail="Field choose value tidak valid")

    limit = min(max(limit, 1), 200)
    params: Dict[str, Any] = {"limit": limit}
    where_sql = ""
    if search:
        where_sql = f"WHERE CAST({_quote(field)} AS CHAR) LIKE :search"
        params["search"] = f"%{search}%"

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


def update_row(
    mysql_db: Session,
    audit_db: Session,
    odist_id: int,
    values: Dict[str, Any],
    current_user: AppUser,
) -> Dict[str, Any]:
    metadata = _column_metadata(mysql_db)
    editable = {item["name"] for item in metadata if item["editable"]}
    clean_values = {key: value for key, value in values.items() if key in editable}
    if not clean_values:
        raise HTTPException(status_code=422, detail="Tidak ada field editable yang dikirim")

    old_row = mysql_db.execute(
        text(f"SELECT * FROM {_quote(TABLE_NAME)} WHERE `id` = :id"),
        {"id": odist_id},
    ).mappings().one_or_none()
    if old_row is None:
        raise HTTPException(status_code=404, detail="Data ODIST tidak ditemukan")

    changed_values: Dict[str, Any] = {}
    for field, value in clean_values.items():
        normalized = None if value == "" else value
        if normalized != old_row.get(field):
            changed_values[field] = normalized

    if not changed_values:
        return dict(old_row)

    params: Dict[str, Any] = {
        "id": odist_id,
        "updated_by": current_user.user_id,
    }
    set_parts: List[str] = []
    for index, (field, value) in enumerate(changed_values.items()):
        key = f"value_{index}"
        set_parts.append(f"{_quote(field)} = :{key}")
        params[key] = value

    set_parts.extend(
        [
            "`updated_at` = CURRENT_TIMESTAMP",
            "`parsed_at` = CURRENT_TIMESTAMP",
            "`status_upd` = 'UPDATED'",
            "`updated_by` = :updated_by",
        ]
    )

    try:
        mysql_db.execute(
            text(
                f"UPDATE {_quote(TABLE_NAME)} SET {', '.join(set_parts)} WHERE `id` = :id"
            ),
            params,
        )
        mysql_db.commit()
    except Exception:
        mysql_db.rollback()
        raise

    old_values = {field: old_row.get(field) for field in changed_values}
    try:
        audit_db.execute(
            text(
                """
                INSERT INTO [tools].[odists_parsing_audit_log]
                    ([odist_id], [user_id], [username], [changed_fields], [old_values], [new_values])
                VALUES
                    (:odist_id, :user_id, :username, :changed_fields, :old_values, :new_values)
                """
            ),
            {
                "odist_id": odist_id,
                "user_id": current_user.user_id,
                "username": current_user.username,
                "changed_fields": json.dumps(list(changed_values.keys()), ensure_ascii=False),
                "old_values": json.dumps(old_values, ensure_ascii=False, default=str),
                "new_values": json.dumps(changed_values, ensure_ascii=False, default=str),
            },
        )
        audit_db.commit()
    except Exception:
        audit_db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Data ODIST berhasil diperbarui, tetapi pencatatan audit gagal",
        )

    updated = mysql_db.execute(
        text(f"SELECT * FROM {_quote(TABLE_NAME)} WHERE `id` = :id"),
        {"id": odist_id},
    ).mappings().one()
    return dict(updated)
