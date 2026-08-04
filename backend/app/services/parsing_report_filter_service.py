import math
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlmodel import Session

from app.services import parsing_report_service as base


def _matches_period(
    changed_at: datetime,
    date_from: Optional[datetime],
    date_to: Optional[datetime],
) -> bool:
    if date_from is not None and changed_at < date_from:
        return False
    if date_to is not None and changed_at.date() > date_to.date():
        return False
    return True


def _effective_revert_state(
    detail: Dict[str, Any],
    audits: List[Dict[str, Any]],
    baselines: Dict[int, Dict[str, Any]],
) -> str:
    member_user_id = detail.get("member_user_id")
    if member_user_id is None:
        return "UNTRACKED"

    owned_fields = set(detail.get("owned_fields") or [])
    relevant_audits = [
        audit
        for audit in audits
        if int(audit["odist_id"]) == int(detail["odist_id"])
        and int(audit["user_id"]) == int(member_user_id)
        and owned_fields.intersection(audit.get("changed_fields_list") or [])
    ]
    if not relevant_audits:
        return "UNTRACKED"

    latest_audit = relevant_audits[-1]
    baseline_values = baselines.get(int(detail["odist_id"]), {}).get("values", {})
    return base._event_revert_state(latest_audit, baseline_values)


def get_effective_results(
    mysql_db: Session,
    audit_db: Session,
    page: int,
    page_size: int,
    odist_id: Optional[int] = None,
    user_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    revert_state: Optional[str] = None,
    search: Optional[str] = None,
) -> Dict[str, Any]:
    details, audits, baselines = base._build_effective_details(mysql_db, audit_db)
    normalized_search = base._normalize(search) if search else ""

    filtered: List[Dict[str, Any]] = []
    for source_detail in details:
        detail = dict(source_detail)
        detail["revert_state"] = _effective_revert_state(
            detail=detail,
            audits=audits,
            baselines=baselines,
        )

        if odist_id is not None and int(detail["odist_id"]) != int(odist_id):
            continue
        if user_id is not None and detail["member_user_id"] != user_id:
            continue
        if status_filter and detail["status"] != status_filter:
            continue
        if revert_state and detail["revert_state"] != revert_state:
            continue
        if normalized_search:
            haystack = " ".join(
                str(detail.get(field) or "")
                for field in [
                    "odist_id",
                    "member_name",
                    "username",
                    "status",
                    "revert_state",
                    "cust_name",
                    "address",
                    "city",
                    "province",
                ]
            )
            if normalized_search not in base._normalize(haystack):
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
    odist_id: Optional[int] = None,
    user_id: Optional[int] = None,
    change_type: Optional[str] = None,
    revert_state: Optional[str] = None,
    search: Optional[str] = None,
) -> Dict[str, Any]:
    base._ensure_schema(audit_db)
    all_audits = base._load_audits(audit_db)
    baselines = base._ensure_baselines(mysql_db, audit_db, all_audits)
    normalized_search = base._normalize(search) if search else ""

    items: List[Dict[str, Any]] = []
    for audit in reversed(all_audits):
        if not _matches_period(audit["changed_at"], date_from, date_to):
            continue
        if odist_id is not None and int(audit["odist_id"]) != int(odist_id):
            continue
        if user_id is not None and int(audit["user_id"]) != int(user_id):
            continue

        baseline_values = baselines.get(int(audit["odist_id"]), {}).get("values", {})
        audit_revert_state = base._event_revert_state(audit, baseline_values)
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
                    str(audit_change_type),
                    str(audit_revert_state),
                    " ".join(audit["changed_fields_list"]),
                ]
            )
            if normalized_search not in base._normalize(haystack):
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
                    if field in base.TRACKED_FIELDS
                ],
                "old_values": audit["old_values_dict"],
                "new_values": audit["new_values_dict"],
                "changed_at": base._iso(audit["changed_at"]),
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
