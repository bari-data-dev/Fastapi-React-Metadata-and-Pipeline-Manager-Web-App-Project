import json
import math
from datetime import date
from typing import Any, Dict, Iterable, List, Optional
from uuid import uuid4

from sqlalchemy import text
from sqlmodel import Session

from app.models.app_user import AppUser


TABLE_SQL = "[tools].[activity_audit_log]"
ACTION_INSERT = "INSERT"
ACTION_UPDATE = "UPDATE"
ACTION_DELETE = "DELETE"
VALID_ACTIONS = {ACTION_INSERT, ACTION_UPDATE, ACTION_DELETE}


def new_batch_id() -> str:
    return str(uuid4())


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def _safe_json(value: Any, fallback: Any) -> Any:
    if value is None:
        return fallback
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(str(value))
    except (TypeError, ValueError, json.JSONDecodeError):
        return fallback


def actor_name(user: AppUser) -> str:
    return (user.full_name or user.username).strip()


def record_activity(
    db: Session,
    *,
    module_key: str,
    module_label: str,
    table_name: str,
    record_id: Any,
    record_label: Optional[str],
    action: str,
    current_user: AppUser,
    changed_fields: Iterable[str],
    old_values: Dict[str, Any],
    new_values: Dict[str, Any],
    batch_id: Optional[str] = None,
    activity_source: str = "WEBAPP",
) -> None:
    normalized_action = action.upper().strip()
    if normalized_action not in VALID_ACTIONS:
        raise ValueError(f"Action audit tidak valid: {action}")

    db.execute(
        text(
            f"""
            INSERT INTO {TABLE_SQL} (
                [batch_id],
                [module_key],
                [module_label],
                [table_name],
                [record_id],
                [record_label],
                [action],
                [actor_user_id],
                [actor_username],
                [actor_full_name],
                [changed_fields],
                [old_values],
                [new_values],
                [activity_source]
            )
            VALUES (
                CONVERT(uniqueidentifier, :batch_id),
                :module_key,
                :module_label,
                :table_name,
                :record_id,
                :record_label,
                :action,
                :actor_user_id,
                :actor_username,
                :actor_full_name,
                :changed_fields,
                :old_values,
                :new_values,
                :activity_source
            )
            """
        ),
        {
            "batch_id": batch_id or new_batch_id(),
            "module_key": module_key[:100],
            "module_label": module_label[:150],
            "table_name": table_name[:256],
            "record_id": str(record_id)[:100],
            "record_label": record_label[:500] if record_label else None,
            "action": normalized_action,
            "actor_user_id": current_user.user_id,
            "actor_username": current_user.username[:100],
            "actor_full_name": actor_name(current_user)[:191],
            "changed_fields": _json(list(changed_fields)),
            "old_values": _json(old_values),
            "new_values": _json(new_values),
            "activity_source": activity_source[:50],
        },
    )


def _build_report_where(
    date_from: Optional[date],
    date_to: Optional[date],
    module_key: Optional[str],
    action: Optional[str],
    user_id: Optional[int],
    search: Optional[str],
) -> tuple[str, Dict[str, Any]]:
    parts: List[str] = []
    params: Dict[str, Any] = {}

    if date_from is not None:
        parts.append("[changed_at] >= CAST(:date_from AS DATE)")
        params["date_from"] = date_from
    if date_to is not None:
        parts.append("[changed_at] < DATEADD(DAY, 1, CAST(:date_to AS DATE))")
        params["date_to"] = date_to
    if module_key:
        parts.append("[module_key] = :module_key")
        params["module_key"] = module_key
    if action:
        normalized_action = action.upper().strip()
        if normalized_action not in VALID_ACTIONS:
            raise ValueError("Action filter tidak valid")
        parts.append("[action] = :action")
        params["action"] = normalized_action
    if user_id is not None:
        parts.append("[actor_user_id] = :user_id")
        params["user_id"] = user_id
    if search:
        parts.append(
            """
            (
                UPPER(COALESCE([actor_full_name], N'')) LIKE UPPER(:search)
                OR UPPER(COALESCE([actor_username], N'')) LIKE UPPER(:search)
                OR UPPER(COALESCE([module_label], N'')) LIKE UPPER(:search)
                OR UPPER(COALESCE([table_name], N'')) LIKE UPPER(:search)
                OR UPPER(COALESCE([record_id], N'')) LIKE UPPER(:search)
                OR UPPER(COALESCE([record_label], N'')) LIKE UPPER(:search)
                OR UPPER(COALESCE([changed_fields], N'')) LIKE UPPER(:search)
            )
            """
        )
        params["search"] = f"%{search.strip()}%"

    return (" WHERE " + " AND ".join(parts) if parts else ""), params


def get_activity_report(
    db: Session,
    *,
    page: int,
    page_size: int,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    module_key: Optional[str] = None,
    action: Optional[str] = None,
    user_id: Optional[int] = None,
    search: Optional[str] = None,
) -> Dict[str, Any]:
    safe_page = max(1, int(page))
    safe_page_size = min(max(1, int(page_size)), 200)
    where_sql, params = _build_report_where(
        date_from,
        date_to,
        module_key,
        action,
        user_id,
        search,
    )

    total = int(
        db.execute(
            text(f"SELECT COUNT(*) FROM {TABLE_SQL}{where_sql}"),
            params,
        ).scalar_one()
    )
    total_pages = max(1, math.ceil(total / safe_page_size))
    safe_page = min(safe_page, total_pages)
    offset = (safe_page - 1) * safe_page_size

    summary_row = db.execute(
        text(
            f"""
            SELECT
                COUNT(*) AS [total_actions],
                SUM(CASE WHEN [action] = N'INSERT' THEN 1 ELSE 0 END) AS [insert_count],
                SUM(CASE WHEN [action] = N'UPDATE' THEN 1 ELSE 0 END) AS [update_count],
                SUM(CASE WHEN [action] = N'DELETE' THEN 1 ELSE 0 END) AS [delete_count],
                COUNT(DISTINCT COALESCE(
                    CAST([actor_user_id] AS NVARCHAR(40)),
                    N'USERNAME:' + [actor_username]
                )) AS [active_users]
            FROM {TABLE_SQL}
            {where_sql}
            """
        ),
        params,
    ).mappings().one()

    page_params = {**params, "offset": offset, "page_size": safe_page_size}
    rows = db.execute(
        text(
            f"""
            SELECT
                [activity_id],
                CONVERT(NVARCHAR(36), [batch_id]) AS [batch_id],
                [module_key],
                [module_label],
                [table_name],
                [record_id],
                [record_label],
                [action],
                [actor_user_id],
                [actor_username],
                [actor_full_name],
                [changed_fields],
                [old_values],
                [new_values],
                [activity_source],
                [changed_at]
            FROM {TABLE_SQL}
            {where_sql}
            ORDER BY [changed_at] DESC, [activity_id] DESC
            OFFSET :offset ROWS
            FETCH NEXT :page_size ROWS ONLY
            """
        ),
        page_params,
    ).mappings().all()

    module_rows = db.execute(
        text(
            f"""
            SELECT [module_key], MAX([module_label]) AS [module_label]
            FROM {TABLE_SQL}
            GROUP BY [module_key]
            ORDER BY MAX([module_label])
            """
        )
    ).mappings().all()
    user_rows = db.execute(
        text(
            f"""
            SELECT
                [actor_user_id],
                MAX([actor_full_name]) AS [actor_full_name],
                MAX([actor_username]) AS [actor_username]
            FROM {TABLE_SQL}
            GROUP BY [actor_user_id], [actor_username]
            ORDER BY MAX([actor_full_name]), MAX([actor_username])
            """
        )
    ).mappings().all()

    items: List[Dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        item["changed_fields"] = _safe_json(item.get("changed_fields"), [])
        item["old_values"] = _safe_json(item.get("old_values"), {})
        item["new_values"] = _safe_json(item.get("new_values"), {})
        items.append(item)

    return {
        "items": items,
        "total": total,
        "page": safe_page,
        "page_size": safe_page_size,
        "total_pages": total_pages,
        "summary": {
            "total_actions": int(summary_row.get("total_actions") or 0),
            "insert_count": int(summary_row.get("insert_count") or 0),
            "update_count": int(summary_row.get("update_count") or 0),
            "delete_count": int(summary_row.get("delete_count") or 0),
            "active_users": int(summary_row.get("active_users") or 0),
        },
        "module_options": [
            {
                "value": row["module_key"],
                "label": row["module_label"] or row["module_key"],
            }
            for row in module_rows
        ],
        "user_options": [
            {
                "user_id": row["actor_user_id"],
                "full_name": row["actor_full_name"] or row["actor_username"],
                "username": row["actor_username"],
            }
            for row in user_rows
        ],
        "action_options": [ACTION_INSERT, ACTION_UPDATE, ACTION_DELETE],
    }
