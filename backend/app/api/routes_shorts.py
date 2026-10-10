import shutil
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database.db import get_db
from app.database.models import Recording, Short
from app.models.schemas import ShortCreateRequest, ShortResponse, ShortUpdateRequest
from app.services.jobs import job_queue

router = APIRouter(prefix="/shorts", tags=["Shorts"])


def to_short_response(short: Short, rec_filename: Optional[str] = None) -> ShortResponse:
    video_url = f"/api/shorts/{short.id}/stream" if short.output_path and Path(short.output_path).exists() else None
    thumb_url = f"/api/library/thumbnails/{Path(short.thumbnail_path).name}" if short.thumbnail_path and Path(short.thumbnail_path).exists() else None

    return ShortResponse(
        id=short.id,
        recording_id=short.recording_id,
        recording_filename=rec_filename,
        candidate_clip_id=short.candidate_clip_id,
        preset_id=short.preset_id,
        title=short.title,
        description=short.description,
        start_time=short.start_time,
        end_time=short.end_time,
        duration=short.duration,
        layout=short.layout,
        status=short.status,
        render_progress=short.render_progress,
        output_path=short.output_path,
        video_url=video_url,
        thumbnail_url=thumb_url,
        width=short.width,
        height=short.height,
        fps=short.fps,
        branding_enabled=short.branding_enabled,
        branding_text=short.branding_text,
        caption_enabled=short.caption_enabled,
        caption_text=short.caption_text,
        slow_motion=short.slow_motion,
        zoom_punch=short.zoom_punch,
        audio_gain=short.audio_gain,
        intro_text=short.intro_text,
        outro_text=short.outro_text,
        color_grade=short.color_grade,
        vignette=short.vignette,
        encoder_used=short.encoder_used,
        error_message=short.error_message,
        created_at=short.created_at,
        updated_at=short.updated_at,
    )


@router.get("", response_model=list[ShortResponse])
async def list_shorts(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Short, Recording.filename)
        .join(Recording, Short.recording_id == Recording.id)
        .order_by(Short.created_at.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [to_short_response(s, fname) for s, fname in rows]


@router.post("", response_model=ShortResponse)
async def create_short(request: ShortCreateRequest, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Recording).where(Recording.id == request.recording_id))
    recording = res.scalar_one_or_none()
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    duration = max(1.0, request.end_time - request.start_time)
    short_id = uuid.uuid4().hex

    short = Short(
        id=short_id,
        recording_id=request.recording_id,
        candidate_clip_id=request.candidate_clip_id,
        preset_id=request.preset_id,
        title=request.title,
        description=request.description,
        start_time=request.start_time,
        end_time=request.end_time,
        layout=request.layout,
        status="draft",
        render_progress=0.0,
        duration=duration,
        width=1080,
        height=1920,
        fps=settings.default_fps,
        branding_enabled=request.branding_enabled,
        branding_text=request.branding_text,
        caption_enabled=request.caption_enabled,
        caption_text=request.caption_text,
        slow_motion=request.slow_motion,
        zoom_punch=request.zoom_punch,
        audio_gain=request.audio_gain,
        intro_text=request.intro_text,
        outro_text=request.outro_text,
        color_grade=request.color_grade,
        vignette=request.vignette,
    )
    db.add(short)
    await db.commit()
    await db.refresh(short)

    return to_short_response(short, recording.filename)


@router.get("/{short_id}", response_model=ShortResponse)
async def get_short(short_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Short, Recording.filename).join(Recording, Short.recording_id == Recording.id).where(Short.id == short_id)
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Short not found")
    short, fname = row
    return to_short_response(short, fname)


@router.patch("/{short_id}", response_model=ShortResponse)
async def update_short(short_id: str, req: ShortUpdateRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(Short, Recording.filename).join(Recording, Short.recording_id == Recording.id).where(Short.id == short_id)
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Short not found")
    short, fname = row

    for field, val in req.model_dump(exclude_unset=True).items():
        setattr(short, field, val)

    if req.start_time is not None or req.end_time is not None:
        short.duration = max(1.0, short.end_time - short.start_time)

    await db.commit()
    await db.refresh(short)
    return to_short_response(short, fname)


@router.post("/{short_id}/render")
async def trigger_render(short_id: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Short).where(Short.id == short_id))
    short = res.scalar_one_or_none()
    if not short:
        raise HTTPException(status_code=404, detail="Short not found")

    task_id = job_queue.spawn_short_render(short_id)
    return {"message": "Rendering started", "task_id": task_id, "short_id": short_id}


class StatusUpdateRequest(BaseModel):
    status: str  # draft, approved, rejected


@router.post("/{short_id}/status", response_model=ShortResponse)
async def set_short_status(short_id: str, req: StatusUpdateRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(Short, Recording.filename).join(Recording, Short.recording_id == Recording.id).where(Short.id == short_id)
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Short not found")
    short, fname = row

    if req.status not in ["draft", "rendered", "approved", "rejected", "published"]:
        raise HTTPException(status_code=400, detail="Invalid status value")

    short.status = req.status
    await db.commit()
    await db.refresh(short)
    return to_short_response(short, fname)


@router.get("/{short_id}/stream")
async def stream_short(
    short_id: str,
    range: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Short).where(Short.id == short_id))
    short = res.scalar_one_or_none()
    if not short or not short.output_path:
        raise HTTPException(status_code=404, detail="Short video not rendered yet")

    v_path = Path(short.output_path)
    if not v_path.exists():
        raise HTTPException(status_code=404, detail="Rendered video file missing")

    file_size = v_path.stat().st_size
    if not range:
        return FileResponse(v_path, media_type="video/mp4")

    range_match = range.replace("bytes=", "").split("-")
    start = int(range_match[0]) if range_match[0] else 0
    end = int(range_match[1]) if len(range_match) > 1 and range_match[1] else file_size - 1
    end = min(end, file_size - 1)
    chunk_size = end - start + 1

    def iter_file():
        with open(v_path, "rb") as f:
            f.seek(start)
            bytes_left = chunk_size
            while bytes_left > 0:
                read_size = min(bytes_left, 1024 * 1024)
                data = f.read(read_size)
                if not data:
                    break
                bytes_left -= len(data)
                yield data

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(chunk_size),
        "Content-Type": "video/mp4",
    }
    return StreamingResponse(iter_file(), status_code=206, headers=headers)


@router.post("/{short_id}/export")
async def export_short(short_id: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Short).where(Short.id == short_id))
    short = res.scalar_one_or_none()
    if not short or not short.output_path or not Path(short.output_path).exists():
        raise HTTPException(status_code=400, detail="Short has not been rendered yet")

    source_path = Path(short.output_path)
    safe_title = "".join(c for c in short.title if c.isalnum() or c in (" ", "_", "-")).rstrip()
    export_filename = f"{safe_title or 'efootball_short'}_{short.id[:6]}.mp4"
    export_dest = settings.exports_dir / export_filename

    shutil.copy2(source_path, export_dest)

    return {
        "message": "Export completed",
        "export_filename": export_filename,
        "export_path": str(export_dest),
        "download_url": f"/api/shorts/{short.id}/download",
    }


@router.get("/{short_id}/download")
async def download_short(short_id: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Short).where(Short.id == short_id))
    short = res.scalar_one_or_none()
    if not short or not short.output_path or not Path(short.output_path).exists():
        raise HTTPException(status_code=404, detail="Rendered video not found")

    v_path = Path(short.output_path)
    return FileResponse(
        v_path,
        media_type="video/mp4",
        filename=f"{short.title[:40].replace(' ', '_')}.mp4"
    )


@router.delete("/{short_id}")
async def delete_short(short_id: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Short).where(Short.id == short_id))
    short = res.scalar_one_or_none()
    if not short:
        raise HTTPException(status_code=404, detail="Short not found")

    if short.output_path and Path(short.output_path).exists():
        Path(short.output_path).unlink(missing_ok=True)
    if short.thumbnail_path and Path(short.thumbnail_path).exists():
        Path(short.thumbnail_path).unlink(missing_ok=True)

    await db.delete(short)
    await db.commit()
    return {"message": "Short deleted successfully"}
