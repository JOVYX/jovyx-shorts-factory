from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.db import get_db
from app.database.models import CandidateClip, PublishingRecord, Recording, Short
from app.models.schemas import DashboardStatsResponse, HardwareStatusResponse, RecordingResponse, ShortResponse
from app.video.hardware import get_hardware_info

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStatsResponse)
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    hw = get_hardware_info()

    # Queries for core stats
    total_recordings = (await db.execute(select(func.count(Recording.id)))).scalar_one() or 0
    waiting_processing = (
        await db.execute(select(func.count(Recording.id)).where(Recording.status == "imported"))
    ).scalar_one() or 0
    detected_highlights = (await db.execute(select(func.count(CandidateClip.id)))).scalar_one() or 0
    shorts_ready_review = (
        await db.execute(select(func.count(Short.id)).where(Short.status == "rendered"))
    ).scalar_one() or 0
    published_videos = (
        await db.execute(
            select(func.count(PublishingRecord.id)).where(PublishingRecord.status == "published")
        )
    ).scalar_one() or 0
    processing_errors = (
        (await db.execute(select(func.count(Recording.id)).where(Recording.status == "error"))).scalar_one() or 0
        + (await db.execute(select(func.count(Short.id)).where(Short.status == "error"))).scalar_one() or 0
    )

    # Recent recordings
    rec_rows = (
        await db.execute(select(Recording).order_by(Recording.imported_at.desc()).limit(5))
    ).scalars().all()
    recent_recs = [
        RecordingResponse(
            id=r.id,
            filename=r.filename,
            filepath=r.filepath,
            file_size=r.file_size,
            duration=r.duration,
            width=r.width,
            height=r.height,
            fps=r.fps,
            codec_name=r.codec_name,
            audio_codec=r.audio_codec,
            has_audio=r.has_audio,
            status=r.status,
            error_message=r.error_message,
            thumbnail_url=f"/api/library/thumbnails/{r.id}.jpg" if r.thumbnail_path else None,
            imported_at=r.imported_at,
            candidate_clips_count=0,
        )
        for r in rec_rows
    ]

    # Recent shorts
    short_rows = (
        await db.execute(
            select(Short, Recording.filename)
            .join(Recording, Short.recording_id == Recording.id)
            .order_by(Short.created_at.desc())
            .limit(5)
        )
    ).all()
    recent_shorts = [
        ShortResponse(
            id=s.id,
            recording_id=s.recording_id,
            recording_filename=rec_fname,
            candidate_clip_id=s.candidate_clip_id,
            preset_id=s.preset_id,
            title=s.title,
            description=s.description,
            start_time=s.start_time,
            end_time=s.end_time,
            duration=s.duration,
            layout=s.layout,
            status=s.status,
            render_progress=s.render_progress,
            output_path=s.output_path,
            video_url=f"/api/shorts/{s.id}/stream" if s.output_path else None,
            thumbnail_url=f"/api/library/thumbnails/{s.id}.jpg" if s.thumbnail_path else None,
            width=s.width,
            height=s.height,
            fps=s.fps,
            branding_enabled=s.branding_enabled,
            branding_text=s.branding_text,
            caption_enabled=s.caption_enabled,
            caption_text=s.caption_text,
            slow_motion=s.slow_motion,
            zoom_punch=s.zoom_punch,
            audio_gain=s.audio_gain,
            intro_text=s.intro_text,
            outro_text=s.outro_text,
            color_grade=s.color_grade,
            vignette=s.vignette,
            encoder_used=s.encoder_used,
            error_message=s.error_message,
            created_at=s.created_at,
            updated_at=s.updated_at,
        )
        for s, rec_fname in short_rows
    ]

    hw_status = HardwareStatusResponse(
        nvenc_available=hw.nvenc_available,
        encoder="h264_nvenc" if hw.nvenc_available else "libx264",
        gpu_name=hw.gpu_name,
        vram_total_mb=hw.vram_total_mb,
        vram_used_mb=hw.vram_used_mb,
        ffmpeg_version=hw.ffmpeg_version,
        cuda_detected=hw.cuda_detected,
    )

    return DashboardStatsResponse(
        total_recordings=total_recordings,
        waiting_processing=waiting_processing,
        detected_highlights=detected_highlights,
        shorts_ready_review=shorts_ready_review,
        published_videos=published_videos,
        processing_errors=processing_errors,
        hardware=hw_status,
        recent_shorts=recent_shorts,
        recent_recordings=recent_recs,
    )
