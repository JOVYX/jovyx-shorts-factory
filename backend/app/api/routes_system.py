import os
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from app.config import settings

router = APIRouter(prefix="/system", tags=["System"])


@router.get("/browse")
async def browse_filesystem(path: Optional[str] = Query(None)):
    """
    Safely browse host filesystem directories for importing videos.
    Defaults to user home directory or /home/jovyxmc.
    """
    if not path:
        target_path = Path.home()
    else:
        target_path = Path(path).expanduser().resolve()

    if not target_path.exists():
        raise HTTPException(status_code=404, detail=f"Path not found: {target_path}")
    if not target_path.is_dir():
        raise HTTPException(status_code=400, detail=f"Path is not a directory: {target_path}")

    items = []
    try:
        entries = sorted(list(target_path.iterdir()), key=lambda p: (not p.is_dir(), p.name.lower()))
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied to access this directory")

    parent_path = str(target_path.parent) if target_path.parent != target_path else None

    for entry in entries:
        if entry.name.startswith("."):
            continue
        try:
            if entry.is_dir():
                items.append({
                    "name": entry.name,
                    "path": str(entry),
                    "is_dir": True,
                    "is_video": False,
                    "size": 0,
                })
            elif entry.is_file():
                ext = entry.suffix.lower()
                is_video = ext in settings.supported_extensions
                if is_video:
                    items.append({
                        "name": entry.name,
                        "path": str(entry),
                        "is_dir": False,
                        "is_video": True,
                        "size": entry.stat().st_size,
                    })
        except (PermissionError, FileNotFoundError):
            continue

    return {
        "current_path": str(target_path),
        "parent_path": parent_path,
        "items": items,
    }
