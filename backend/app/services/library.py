import logging
import os
import shutil
import uuid
from pathlib import Path
from typing import Optional

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database.models import CandidateClip, Recording
from app.models.schemas import RecordingResponse
from app.video.preview import generate_thumbnail
from app.video.probe import probe_video

logger = logging.getLogger(__name__)


def validate_video_file_path(path_str: str) -> Path:
    """
    Validates user-supplied file path for video import.
    Prevents path traversal and checks that the file exists and is supported.
    """
    raw_path = Path(path_str).expanduser()
    if not raw_path.is_absolute():
        raw_path = raw_path.resolve()

    if not raw_path.exists():
        raise FileNotFoundError(f"Source video file not found at: {raw_path}")

    if not raw_path.is_file():
        raise ValueError(f"Specified path is not a file: {raw_path}")

    ext = raw_path.suffix.lower()
    if ext not in settings.supported_extensions:
        raise ValueError(
            f"Unsupported video format '{ext}'. Supported formats: {', '.join(settings.supported_extensions)}"
        )

    return raw_path


async def import_recording(
    db: AsyncSession,
    file_path_str: str,
    copy_to_library: bool = True
) -> Recording:
    """
    Imports a video file into the library.
    Preserves original recordings: never deletes or overwrites source videos.
    """
    source_path = validate_video_file_path(file_path_str)

    rec_id = uuid.uuid4().hex
    target_filename = f"{rec_id}_{source_path.name}"
    
    if copy_to_library:
        target_path = settings.originals_dir / target_filename
        # Copy file preserving metadata, NEVER touch source file
        logger.info(f"Copying video {source_path.name} to {target_path}")
        shutil.copy2(source_path, target_path)
        actual_path = target_path
    else:
        # Reference existing file in-place
        actual_path = source_path
        existing_res = await db.execute(select(Recording).where(Recording.filepath == str(actual_path)))
        existing_rec = existing_res.scalar_one_or_none()
        if existing_rec:
            return existing_rec

    # Extract metadata using FFprobe
    try:
        meta = probe_video(actual_path)
    except Exception as e:
        logger.error(f"FFprobe metadata inspection failed: {e}")
        # Clean up copied file if failed
        if copy_to_library and actual_path.exists():
            actual_path.unlink()
        raise RuntimeError(f"Could not read video metadata: {e}")

    # Generate thumbnail
    thumb_filename = f"thumb_{rec_id}.jpg"
    thumb_path = settings.thumbnails_dir / thumb_filename
    thumb_rel_url = f"/api/library/thumbnails/{thumb_filename}"

    try:
        generate_thumbnail(
            video_path=actual_path,
            output_image_path=thumb_path,
            timestamp_sec=min(1.0, max(0.1, meta.duration / 2.0)),
        )
    except Exception as e:
        logger.warning(f"Failed to generate initial thumbnail: {e}")
        thumb_rel_url = None

    recording = Recording(
        id=rec_id,
        filename=source_path.name,
        filepath=str(actual_path),
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
    return recording


async def get_all_recordings(db: AsyncSession) -> list[RecordingResponse]:
    """Retrieve all recordings with clip count."""
    stmt = (
        select(
            Recording,
            func.count(CandidateClip.id).label("clips_count")
        )
        .outerjoin(CandidateClip, Recording.id == CandidateClip.recording_id)
        .group_by(Recording.id)
        .order_by(Recording.imported_at.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    recordings: list[RecordingResponse] = []
    for rec, count in rows:
        thumb_url = None
        if rec.thumbnail_path and Path(rec.thumbnail_path).exists():
            thumb_url = f"/api/library/thumbnails/{Path(rec.thumbnail_path).name}"

        recordings.append(
            RecordingResponse(
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
                candidate_clips_count=count,
            )
        )
    return recordings
