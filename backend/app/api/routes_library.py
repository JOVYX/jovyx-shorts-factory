import os
import shutil
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Header, Query, UploadFile, status
from fastapi.responses import FileResponse, Response, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database.db import get_db
from app.database.models import Recording
from app.models.schemas import RecordingImportRequest, RecordingResponse
from app.services.library import get_all_recordings, import_recording
from app.video.preview import generate_thumbnail
from app.video.probe import probe_video

router = APIRouter(prefix="/library", tags=["Library"])


@router.get("/recordings", response_model=list[RecordingResponse])
async def list_recordings(db: AsyncSession = Depends(get_db)):
    return await get_all_recordings(db)


@router.post("/import", response_model=RecordingResponse)
async def import_video(request: RecordingImportRequest, db: AsyncSession = Depends(get_db)):
    try:
        rec = await import_recording(
            db=db,
            file_path_str=request.filepath,
            copy_to_library=request.copy_to_library,
        )
        thumb_url = f"/api/library/thumbnails/{Path(rec.thumbnail_path).name}" if rec.thumbnail_path else None
        return RecordingResponse(
            id=rec.id,
            filename=rec.filename,
            filepath=rec.filepath,
            file_size=rec.file_size,
            duration=rec.duration,
            width=rec.width,
            height=rec.height,
            fps=rec.fps,
            codec_name=rec.codec_name,
            audio_codec=rec.audio_codec,
            has_audio=rec.has_audio,
            status=rec.status,
            error_message=rec.error_message,
            thumbnail_url=thumb_url,
            imported_at=rec.imported_at,
            candidate_clips_count=0,
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/upload", response_model=RecordingResponse)
async def upload_video_file(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Directly upload a video file from browser."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename missing")

    ext = Path(file.filename).suffix.lower()
    if ext not in settings.supported_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{ext}'. Supported: {', '.join(settings.supported_extensions)}",
        )

    rec_id = uuid.uuid4().hex
    target_path = settings.originals_dir / f"{rec_id}_{file.filename}"

    with open(target_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        meta = probe_video(target_path)
    except Exception as e:
        target_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Invalid video file: {e}")

    thumb_filename = f"thumb_{rec_id}.jpg"
    thumb_path = settings.thumbnails_dir / thumb_filename
    thumb_url = f"/api/library/thumbnails/{thumb_filename}"
    try:
        generate_thumbnail(
            video_path=target_path,
            output_image_path=thumb_path,
            timestamp_sec=min(1.0, max(0.1, meta.duration / 2.0)),
        )
    except Exception:
        thumb_url = None

    recording = Recording(
        id=rec_id,
        filename=file.filename,
        filepath=str(target_path),
        file_size=meta.file_size,
        duration=meta.duration,
        width=meta.width,
        height=meta.height,
        fps=meta.fps,
        codec_name=meta.codec_name,
        audio_codec=meta.audio_codec,
        has_audio=meta.has_audio,
        status="imported",
        thumbnail_path=str(thumb_path) if thumb_path.exists() else None,
    )
    db.add(recording)
    await db.commit()
    await db.refresh(recording)

    return RecordingResponse(
        id=recording.id,
        filename=recording.filename,
        filepath=recording.filepath,
        file_size=recording.file_size,
        duration=recording.duration,
        width=recording.width,
        height=recording.height,
        fps=recording.fps,
        codec_name=recording.codec_name,
        audio_codec=recording.audio_codec,
        has_audio=recording.has_audio,
        status=recording.status,
        error_message=recording.error_message,
        thumbnail_url=thumb_url,
        imported_at=recording.imported_at,
        candidate_clips_count=0,
    )


@router.get("/thumbnails/{filename}")
async def get_thumbnail(filename: str):
    """Serve thumbnail image safely."""
    safe_name = Path(filename).name
    file_path = settings.thumbnails_dir / safe_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    return FileResponse(file_path, media_type="image/jpeg")


@router.get("/recordings/{recording_id}/stream")
async def stream_recording(
    recording_id: str,
    range: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Stream video with HTTP 206 Partial Content support for fast HTML5 scrubbing.
    """
    res = await db.execute(select(Recording).where(Recording.id == recording_id))
    recording = res.scalar_one_or_none()
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    video_path = Path(recording.filepath)
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Underlying video file is missing")

    file_size = video_path.stat().st_size
    content_type = "video/mp4"
    if video_path.suffix.lower() == ".mov":
        content_type = "video/quicktime"

    if not range:
        return FileResponse(video_path, media_type=content_type)

    # Parse byte range header
    range_match = range.replace("bytes=", "").split("-")
    start = int(range_match[0]) if range_match[0] else 0
    end = int(range_match[1]) if len(range_match) > 1 and range_match[1] else file_size - 1
    end = min(end, file_size - 1)
    chunk_size = end - start + 1

    def iter_file():
        with open(video_path, "rb") as f:
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
        "Content-Type": content_type,
    }

    return StreamingResponse(iter_file(), status_code=206, headers=headers)


@router.delete("/recordings/{recording_id}")
async def delete_recording(recording_id: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Recording).where(Recording.id == recording_id))
    recording = res.scalar_one_or_none()
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    # If the file was in originals_dir, remove it. Never delete external referenced source files!
    file_path = Path(recording.filepath)
    if settings.originals_dir in file_path.parents and file_path.exists():
        file_path.unlink(missing_ok=True)

    if recording.thumbnail_path and Path(recording.thumbnail_path).exists():
        Path(recording.thumbnail_path).unlink(missing_ok=True)

    await db.delete(recording)
    await db.commit()
    return {"message": "Recording removed from library successfully"}
