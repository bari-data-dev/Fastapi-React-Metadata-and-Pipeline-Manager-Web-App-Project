# backend/app/core/utils.py
import re
from typing import Optional
from fastapi import HTTPException, status

VERSION_RE = re.compile(r"^v\d+(\.\d+)*$")

def validate_version_format(version: Optional[str], field_name: str) -> None:
    """
    Validate version if provided; ignore None.
    Raise HTTPException when invalid.
    """
    if version is None:
        return
    if not VERSION_RE.match(version):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{field_name} must match pattern 'v<number>[.<number>...]', e.g. v1 or v2.0"
        )
