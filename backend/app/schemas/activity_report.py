from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class ActivitySummary(BaseModel):
    total_actions: int
    insert_count: int
    update_count: int
    delete_count: int
    active_users: int


class ActivityModuleOption(BaseModel):
    value: str
    label: str


class ActivityUserOption(BaseModel):
    user_id: Optional[int] = None
    full_name: str
    username: str


class ActivityRecord(BaseModel):
    activity_id: int
    batch_id: str
    module_key: str
    module_label: str
    table_name: str
    record_id: str
    record_label: Optional[str] = None
    action: str
    actor_user_id: Optional[int] = None
    actor_username: str
    actor_full_name: str
    changed_fields: List[str]
    old_values: Dict[str, Any]
    new_values: Dict[str, Any]
    activity_source: str
    changed_at: datetime


class ActivityReportPage(BaseModel):
    items: List[ActivityRecord]
    total: int
    page: int
    page_size: int
    total_pages: int
    summary: ActivitySummary
    module_options: List[ActivityModuleOption]
    user_options: List[ActivityUserOption]
    action_options: List[str]
