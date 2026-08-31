from typing import Any, Dict, Iterable, List, Tuple

from app.services import produk_distributor_service as base_service


def save_changes(
    connection: Any,
    creates: Iterable[Dict[str, Any]],
    updates: Iterable[Dict[str, Any]],
    deletes: Iterable[int],
) -> Dict[str, Any]:
    prepared_creates = [
        base_service._normalize_create_values(values)
        for values in creates
    ]

    delete_ids: List[int] = []
    seen_delete_ids = set()
    for raw_id in deletes:
        record_id = int(raw_id)
        if record_id <= 0:
            raise ValueError("ID delete tidak valid")
        if record_id in seen_delete_ids:
            continue
        if base_service._fetch_one_by_id(connection, record_id) is None:
            raise LookupError(
                f"Produk Distributor ID {record_id} tidak ditemukan"
            )
        seen_delete_ids.add(record_id)
        delete_ids.append(record_id)

    prepared_updates: List[Tuple[int, Dict[str, Any]]] = []
    for item in updates:
        record_id = int(item["id"])
        if record_id in seen_delete_ids:
            raise ValueError(
                f"Produk Distributor ID {record_id} tidak boleh di-update dan di-delete sekaligus"
            )
        if base_service._fetch_one_by_id(connection, record_id) is None:
            raise LookupError(
                f"Produk Distributor ID {record_id} tidak ditemukan"
            )
        prepared_updates.append(
            (record_id, base_service._normalize_values(item["values"]))
        )

    if not prepared_creates and not prepared_updates and not delete_ids:
        raise ValueError("Tidak ada perubahan yang dikirim")

    insert_columns = ", ".join(
        base_service._column_sql(field)
        for field in base_service.EDITABLE_FIELDS
    )
    insert_placeholders = ", ".join(
        "?" for _ in base_service.EDITABLE_FIELDS
    )

    created_ids: List[int] = []
    updated_ids: List[int] = []
    deleted_ids: List[int] = []

    cursor = connection.cursor()
    try:
        for values in prepared_creates:
            cursor.execute(
                f"INSERT INTO {base_service._table_sql()} ({insert_columns}) "
                f"VALUES ({insert_placeholders})",
                [
                    values[field]
                    for field in base_service.EDITABLE_FIELDS
                ],
            )
            cursor.execute("SELECT CAST(SCOPE_IDENTITY() AS INT)")
            inserted_row = cursor.fetchone()
            if not inserted_row:
                raise RuntimeError("Gagal mendapatkan ID hasil insert")
            created_ids.append(int(inserted_row[0]))

        for record_id, values in prepared_updates:
            assignments = ", ".join(
                f"{base_service._column_sql(field)} = ?"
                for field in values.keys()
            )
            cursor.execute(
                f"UPDATE {base_service._table_sql()} "
                f"SET {assignments} WHERE [id] = ?",
                [*values.values(), record_id],
            )
            updated_ids.append(record_id)

        for record_id in delete_ids:
            cursor.execute(
                f"DELETE FROM {base_service._table_sql()} WHERE [id] = ?",
                [record_id],
            )
            deleted_ids.append(record_id)

        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()

    return {
        "created_count": len(created_ids),
        "created_ids": created_ids,
        "updated_count": len(updated_ids),
        "updated_ids": updated_ids,
        "deleted_count": len(deleted_ids),
        "deleted_ids": deleted_ids,
    }
