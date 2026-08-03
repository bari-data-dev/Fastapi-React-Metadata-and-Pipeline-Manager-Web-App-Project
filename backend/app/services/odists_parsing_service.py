import json
import math
from typing import Any, Dict, List

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlmodel import Session

from app.models.app_user import AppUser


TABLE_SCHEMA = "bronze_so"
TABLE_NAME = "odists_parsing"
READ_ONLY_FIELDS = {
    "id",
    "google_url_idx",
    "updated_by",
    "parsed_at",
    "updated_at",
    "dwh_refreshed_at",
    "status_upd",
}
DEFAULT_COLUMNS = [
    "id",
    "ogal_id",
    "old_ogal_id",
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
    "batch",
    "status_upd",
    "updated_by",
    "parsed_at",
    "dwh_refreshed_at",
]


def _column_metadata(db: Session) -> List[Dict[str, Any]]:
    rows = db.execute(
        text(
            """
            SELECT
                c.COLUMN_NAME AS name,
                c.DATA_TYPE AS data_type,
                CASE WHEN c.IS_NULLABLE = 'YES' THEN 1 ELSE 0 END AS is_nullable,
                c.ORDINAL_POSITION AS ordinal_position,
                CASE WHEN cc.column_id IS NULL THEN 0 ELSE 1 END AS is_computed
            FROM INFORMATION_SCHEMA.COLUMNS c
            LEFT JOIN sys.schemas s
                ON s.name = c.TABLE_SCHEMA
            LEFT JOIN sys.tables t
                ON t.schema_id = s.schema_id
               AND t.name = c.TABLE_NAME
            LEFT JOIN sys.computed_columns cc
                ON cc.object_id = t.object_id
               AND cc.name = c.COLUMN_NAME
            WHERE c.TABLE_SCHEMA = :schema_name
              AND c.TABLE_NAME = :table_name
            ORDER BY c.ORDINAL_POSITION
            """
        ),
        {"schema_name": TABLE_SCHEMA, "table_name": TABLE_NAME},
    ).mappings().all()

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Tabel [{TABLE_SCHEMA}].[{TABLE_NAME}] tidak ditemukan",
        )

    return [
        {
            "name": row["name"],
            "data_type": row["data_type"],
            "is_nullable": bool(row["is_nullable"]),
            "ordinal_position": row["ordinal_position"],
            "editable": not bool(row["is_computed"]) and row["name"] not in READ_ONLY_FIELDS,
        }
        for row in rows
    ]


def _quote(name: str) -> str:
    return f"[{name.replace(']', ']]')}]"


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

    try:
        filters = json.loads(filters_json) if filters_json else {}
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail="Format filters harus berupa JSON object") from exc
    if not isinstance(filters, dict):
        raise HTTPException(status_code=422, detail="Format filters harus berupa JSON object")

    where_parts: List[str] = []
    params: Dict[str, Any] = {}
    filter_index = 0
    for field, raw_value in filters.items():
        if field not in allowed or raw_value is None or str(raw_value) == "":
            continue
        value = str(raw_value)
        quoted = _quote(field)
        if value == "__NULL__":
            where_parts.append(f"{quoted} IS NULL")
        elif value == "__EMPTY__":
            where_parts.append(f"ISNULL(CONVERT(NVARCHAR(MAX), {quoted}), '') = ''")
        else:
            key = f"filter_{filter_index}"
            where_parts.append(f"CONVERT(NVARCHAR(MAX), {quoted}) LIKE :{key}")
            params[key] = f"%{value}%"
            filter_index += 1

    where_sql = " WHERE " + " AND ".join(where_parts) if where_parts else ""
    safe_sort = sort_by if sort_by in allowed else "id"
    direction = "DESC" if sort_dir.lower() == "desc" else "ASC"
    page = max(page, 1)
    page_size = min(max(page_size, 1), 200)
    offset = (page - 1) * page_size

    count_sql = text(
        f"SELECT COUNT_BIG(1) FROM [{TABLE_SCHEMA}].[{TABLE_NAME}]{where_sql}"
    )
    total = int(db.execute(count_sql, params).scalar_one())

    data_params = dict(params)
    data_params.update({"offset": offset, "page_size": page_size})
    select_sql = text(
        f"""
        SELECT {', '.join(_quote(name) for name in selected)}
        FROM [{TABLE_SCHEMA}].[{TABLE_NAME}]
        {where_sql}
        ORDER BY {_quote(safe_sort)} {direction}
        OFFSET :offset ROWS FETCH NEXT :page_size ROWS ONLY
        """
    )
    items = [dict(row) for row in db.execute(select_sql, data_params).mappings().all()]

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, math.ceil(total / page_size)),
        "columns": metadata,
    }


def update_row(
    db: Session,
    odist_id: int,
    values: Dict[str, Any],
    current_user: AppUser,
) -> Dict[str, Any]:
    metadata = _column_metadata(db)
    editable = {item["name"] for item in metadata if item["editable"]}
    clean_values = {key: value for key, value in values.items() if key in editable}
    if not clean_values:
        raise HTTPException(status_code=422, detail="Tidak ada field editable yang dikirim")

    old_row = db.execute(
        text(f"SELECT * FROM [{TABLE_SCHEMA}].[{TABLE_NAME}] WHERE [id] = :id"),
        {"id": odist_id},
    ).mappings().one_or_none()
    if old_row is None:
        raise HTTPException(status_code=404, detail="Data ODIST tidak ditemukan")

    set_parts: List[str] = []
    params: Dict[str, Any] = {"id": odist_id, "updated_by": current_user.user_id}
    for index, (field, value) in enumerate(clean_values.items()):
        key = f"value_{index}"
        set_parts.append(f"{_quote(field)} = :{key}")
        params[key] = value

    set_parts.extend(
        [
            "[updated_at] = SYSDATETIME()",
            "[parsed_at] = SYSDATETIME()",
            "[status_upd] = 'UPDATED'",
            "[updated_by] = :updated_by",
        ]
    )

    try:
        db.execute(
            text(
                f"UPDATE [{TABLE_SCHEMA}].[{TABLE_NAME}] SET {', '.join(set_parts)} WHERE [id] = :id"
            ),
            params,
        )

        old_values = {field: old_row.get(field) for field in clean_values}
        new_values = clean_values
        db.execute(
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
                "changed_fields": json.dumps(list(clean_values.keys()), ensure_ascii=False),
                "old_values": json.dumps(old_values, ensure_ascii=False, default=str),
                "new_values": json.dumps(new_values, ensure_ascii=False, default=str),
            },
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    updated = db.execute(
        text(f"SELECT * FROM [{TABLE_SCHEMA}].[{TABLE_NAME}] WHERE [id] = :id"),
        {"id": odist_id},
    ).mappings().one()
    return dict(updated)
