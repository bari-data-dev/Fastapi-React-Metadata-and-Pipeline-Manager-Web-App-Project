import json
import math
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from app.db.crm_database import get_crm_schema


FIELD_DEFS: Dict[str, Dict[str, Any]] = {
    "id": {
        "data_type": "int",
        "nullable": False,
        "max_length": None,
        "editable": False,
    },
    "Kode_Dist": {
        "data_type": "varchar",
        "nullable": False,
        "max_length": 15,
        "editable": True,
    },
    "Kode_Produk_Dist": {
        "data_type": "varchar",
        "nullable": False,
        "max_length": 80,
        "editable": True,
    },
    "Kode_Produk_GPL": {
        "data_type": "varchar",
        "nullable": True,
        "max_length": 15,
        "editable": True,
    },
    "Konversi_Unit": {
        "data_type": "int",
        "nullable": True,
        "max_length": None,
        "editable": True,
    },
    "Nama_Produk_GPL": {
        "data_type": "varchar",
        "nullable": True,
        "max_length": 100,
        "editable": True,
    },
    "Nama_Produk_Dist": {
        "data_type": "varchar",
        "nullable": True,
        "max_length": 100,
        "editable": True,
    },
    "Produk_Paket": {
        "data_type": "int",
        "nullable": True,
        "max_length": None,
        "editable": True,
    },
    "temp": {
        "data_type": "varchar",
        "nullable": True,
        "max_length": 50,
        "editable": True,
    },
}

COLUMNS = list(FIELD_DEFS.keys())
EDITABLE_FIELDS = [name for name in COLUMNS if FIELD_DEFS[name]["editable"]]
INTEGER_FIELDS = {
    name for name, definition in FIELD_DEFS.items() if definition["data_type"] == "int"
}


def _table_sql() -> str:
    return f"[{get_crm_schema()}].[Produk_Distributor]"


def _column_sql(name: str) -> str:
    if name not in FIELD_DEFS:
        raise ValueError(f"Kolom tidak dikenal: {name}")
    return f"[{name}]"


def get_columns() -> List[Dict[str, Any]]:
    result: List[Dict[str, Any]] = []
    for name in COLUMNS:
        definition = FIELD_DEFS[name]
        result.append(
            {
                "name": name,
                "label": name.replace("_", " ").upper(),
                "data_type": definition["data_type"],
                "is_nullable": definition["nullable"],
                "max_length": definition["max_length"],
                "editable": definition["editable"],
            }
        )
    return result


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
        if value is None:
            continue
        result[key] = str(value)
    return result


def _coerce_filter_value(field: str, value: Any) -> Any:
    if value is None:
        return None
    if field in INTEGER_FIELDS:
        try:
            return int(value)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Filter {field} harus berupa angka") from exc
    return str(value)


def _build_where(
    filters: Dict[str, str],
    exclude_field: Optional[str] = None,
) -> Tuple[str, List[Any]]:
    clauses: List[str] = []
    params: List[Any] = []

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

            non_null = [
                _coerce_filter_value(field, value)
                for value in selected
                if value is not None
            ]
            has_null = any(value is None for value in selected)
            parts: List[str] = []

            if non_null:
                placeholders = ", ".join("?" for _ in non_null)
                parts.append(f"{column} IN ({placeholders})")
                params.extend(non_null)
            if has_null:
                parts.append(f"{column} IS NULL")
            if parts:
                clauses.append("(" + " OR ".join(parts) + ")")
            continue

        clauses.append(f"UPPER(CAST({column} AS VARCHAR(4000))) LIKE UPPER(?)")
        params.append(f"%{raw_value}%")

    if not clauses:
        return "", params
    return " WHERE " + " AND ".join(clauses), params


def _normalize_db_value(field: str, value: Any) -> Any:
    if value is None:
        return None
    if field in INTEGER_FIELDS:
        return int(value)
    return str(value)


def _row_to_dict(row: Sequence[Any], column_names: Sequence[str]) -> Dict[str, Any]:
    return {
        name: _normalize_db_value(name, value)
        for name, value in zip(column_names, row)
    }


def _fetch_one_by_id(connection: Any, record_id: int) -> Optional[Dict[str, Any]]:
    cursor = connection.cursor()
    try:
        select_columns = ", ".join(_column_sql(name) for name in COLUMNS)
        cursor.execute(
            f"SELECT {select_columns} FROM {_table_sql()} WHERE [id] = ?",
            [record_id],
        )
        row = cursor.fetchone()
        if row is None:
            return None
        return _row_to_dict(row, COLUMNS)
    finally:
        cursor.close()


def get_page(
    connection: Any,
    page: int,
    page_size: int,
    filters_json: Optional[str],
    sort_by: str,
    sort_dir: str,
) -> Dict[str, Any]:
    if sort_by not in FIELD_DEFS:
        raise ValueError("Kolom sorting tidak valid")
    direction = sort_dir.lower()
    if direction not in ("asc", "desc"):
        raise ValueError("Arah sorting tidak valid")

    filters = _parse_filters(filters_json)
    where_sql, params = _build_where(filters)
    table = _table_sql()
    sort_column = _column_sql(sort_by)
    select_columns = ", ".join(_column_sql(name) for name in COLUMNS)

    cursor = connection.cursor()
    try:
        cursor.execute(
            f"SELECT COUNT(*) FROM {table}{where_sql}",
            params,
        )
        count_row = cursor.fetchone()
        total = int(count_row[0]) if count_row else 0

        total_pages = max(1, math.ceil(total / page_size))
        safe_page = min(max(1, page), total_pages)
        row_start = (safe_page - 1) * page_size + 1
        row_end = safe_page * page_size

        order_sql = f"{sort_column} {direction.upper()}"
        if sort_by != "id":
            order_sql += ", [id] ASC"

        sql = f"""
            SELECT {select_columns}
            FROM (
                SELECT
                    ROW_NUMBER() OVER (ORDER BY {order_sql}) AS [__row_number],
                    {select_columns}
                FROM {table}
                {where_sql}
            ) AS [paged]
            WHERE [__row_number] BETWEEN ? AND ?
            ORDER BY [__row_number]
        """
        cursor.execute(sql, [*params, row_start, row_end])
        rows = cursor.fetchall()
        items = [_row_to_dict(row, COLUMNS) for row in rows]

        return {
            "items": items,
            "total": total,
            "page": safe_page,
            "page_size": page_size,
            "total_pages": total_pages,
            "columns": get_columns(),
        }
    finally:
        cursor.close()


def get_distinct_values(
    connection: Any,
    field: str,
    search: Optional[str],
    limit: int,
    filters_json: Optional[str],
) -> List[Dict[str, Any]]:
    if field not in FIELD_DEFS:
        raise ValueError("Kolom filter tidak valid")

    safe_limit = min(max(1, int(limit)), 200)
    filters = _parse_filters(filters_json)
    where_sql, params = _build_where(filters, exclude_field=field)
    column = _column_sql(field)

    search_clause = ""
    if search:
        search_clause = (
            "UPPER(CAST(" + column + " AS VARCHAR(4000))) LIKE UPPER(?)"
        )
        if where_sql:
            where_sql += " AND " + search_clause
        else:
            where_sql = " WHERE " + search_clause
        params.append(f"%{search}%")

    sql = f"""
        SELECT TOP {safe_limit}
            {column} AS [value],
            COUNT(*) AS [row_count]
        FROM {_table_sql()}
        {where_sql}
        GROUP BY {column}
        ORDER BY
            CASE WHEN {column} IS NULL THEN 0 ELSE 1 END,
            {column}
    """

    cursor = connection.cursor()
    try:
        cursor.execute(sql, params)
        result: List[Dict[str, Any]] = []
        for value, row_count in cursor.fetchall():
            result.append(
                {
                    "value": _normalize_db_value(field, value),
                    "row_count": int(row_count),
                }
            )
        return result
    finally:
        cursor.close()


def _normalize_write_value(field: str, value: Any) -> Any:
    if field not in EDITABLE_FIELDS:
        raise ValueError(f"Kolom tidak dapat diedit: {field}")

    definition = FIELD_DEFS[field]
    nullable = bool(definition["nullable"])

    if field in INTEGER_FIELDS:
        if value is None or value == "":
            if nullable:
                return None
            raise ValueError(f"{field} tidak boleh NULL")
        try:
            return int(value)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"{field} harus berupa integer") from exc

    if value is None:
        if nullable:
            return None
        raise ValueError(f"{field} tidak boleh NULL")

    text = str(value)
    if text == "" and nullable:
        return None

    max_length = definition["max_length"]
    if max_length is not None and len(text) > int(max_length):
        raise ValueError(f"{field} maksimal {max_length} karakter")
    return text


def _normalize_values(values: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(values, dict) or not values:
        raise ValueError("Tidak ada perubahan yang dikirim")
    return {
        field: _normalize_write_value(field, value)
        for field, value in values.items()
    }


def create_record(connection: Any, values: Dict[str, Any]) -> Dict[str, Any]:
    normalized: Dict[str, Any] = {}
    for field in EDITABLE_FIELDS:
        normalized[field] = _normalize_write_value(field, values.get(field))

    columns_sql = ", ".join(_column_sql(field) for field in EDITABLE_FIELDS)
    placeholders = ", ".join("?" for _ in EDITABLE_FIELDS)
    params = [normalized[field] for field in EDITABLE_FIELDS]

    cursor = connection.cursor()
    try:
        cursor.execute(
            f"INSERT INTO {_table_sql()} ({columns_sql}) VALUES ({placeholders})",
            params,
        )
        cursor.execute("SELECT CAST(SCOPE_IDENTITY() AS INT)")
        inserted_row = cursor.fetchone()
        if not inserted_row:
            raise RuntimeError("Gagal mendapatkan ID hasil insert")
        record_id = int(inserted_row[0])
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()

    created = _fetch_one_by_id(connection, record_id)
    if created is None:
        raise RuntimeError("Data hasil insert tidak ditemukan")
    return created


def update_record(
    connection: Any,
    record_id: int,
    values: Dict[str, Any],
) -> Dict[str, Any]:
    if _fetch_one_by_id(connection, record_id) is None:
        raise LookupError("Produk Distributor tidak ditemukan")

    normalized = _normalize_values(values)
    assignments = ", ".join(
        f"{_column_sql(field)} = ?" for field in normalized.keys()
    )
    params = [*normalized.values(), record_id]

    cursor = connection.cursor()
    try:
        cursor.execute(
            f"UPDATE {_table_sql()} SET {assignments} WHERE [id] = ?",
            params,
        )
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()

    updated = _fetch_one_by_id(connection, record_id)
    if updated is None:
        raise RuntimeError("Data hasil update tidak ditemukan")
    return updated


def update_batch(
    connection: Any,
    items: Iterable[Dict[str, Any]],
) -> Dict[str, Any]:
    prepared: List[Tuple[int, Dict[str, Any]]] = []
    for item in items:
        record_id = int(item["id"])
        if _fetch_one_by_id(connection, record_id) is None:
            raise LookupError(f"Produk Distributor ID {record_id} tidak ditemukan")
        normalized = _normalize_values(item["values"])
        prepared.append((record_id, normalized))

    updated_ids: List[int] = []
    cursor = connection.cursor()
    try:
        for record_id, values in prepared:
            assignments = ", ".join(
                f"{_column_sql(field)} = ?" for field in values.keys()
            )
            cursor.execute(
                f"UPDATE {_table_sql()} SET {assignments} WHERE [id] = ?",
                [*values.values(), record_id],
            )
            updated_ids.append(record_id)
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()

    return {
        "updated_count": len(updated_ids),
        "updated_ids": updated_ids,
    }


def delete_record(connection: Any, record_id: int) -> Dict[str, int]:
    if _fetch_one_by_id(connection, record_id) is None:
        raise LookupError("Produk Distributor tidak ditemukan")

    cursor = connection.cursor()
    try:
        cursor.execute(
            f"DELETE FROM {_table_sql()} WHERE [id] = ?",
            [record_id],
        )
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()

    return {"deleted_id": record_id}
