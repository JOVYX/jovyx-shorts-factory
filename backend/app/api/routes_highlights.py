from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database.db import get_db
from app.database.models import CandidateClip, Recording
from app.models.schemas import CandidateClipFeedbackRequest, CandidateClipResponse, HighlightScanRequest
from app.services.jobs import job_queue

router = APIRouter(prefix="/highlights", tags=["Highlights"])


@router.post("/scan/{recording_id}")
async def trigger_highlight_scan(
    recording_id: str,
    request: HighlightScanRequest = HighlightScanRequest(),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Recording).where(Recording.id == recording_id))
    recording = res.scalar_one_or_none()
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    clip_dur = request.clip_duration or settings.default_clip_duration
    sens = request.sensitivity or settings.highlight_sensitivity

    task_id = job_queue.spawn_highlight_scan(
        recording_id=recording_id,
        target_clip_duration=clip_dur,
        sensitivity=sens,
        max_candidates=request.max_candidates,
    )

    return {
        "message": "Highlight detection started",
        "task_id": task_id,
        "recording_id": recording_id,
    }


@router.get("/clips/{recording_id}", response_model=list[CandidateClipResponse])
async def get_candidate_clips(recording_id: str, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(CandidateClip)
        .where(CandidateClip.recording_id == recording_id)
        .order_by(CandidateClip.rank.asc())
    )
    result = await db.execute(stmt)
    clips = result.scalars().all()

    response: list[CandidateClipResponse] = []
    for c in clips:
        thumb_url = None
        if c.thumbnail_path and Path(c.thumbnail_path).exists():
            thumb_url = f"/api/library/thumbnails/{Path(c.thumbnail_path).name}"

        response.append(
            CandidateClipResponse(
                id=c.id,
                recording_id=c.recording_id,
                start_time=c.start_time,
                end_time=c.end_time,
                duration=c.duration,
                score=c.score,
                rank=c.rank,
                thumbnail_url=thumb_url,
                user_feedback=c.user_feedback,
                detection_method=c.detection_method,
                notes=c.notes,
                created_at=c.created_at,
            )
        )
    return response


@router.post("/clips/{clip_id}/feedback", response_model=CandidateClipResponse)
async def submit_clip_feedback(
    clip_id: str,
    feedback_req: CandidateClipFeedbackRequest,
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(CandidateClip).where(CandidateClip.id == clip_id))
    clip = res.scalar_one_or_none()
    if not clip:
        raise HTTPException(status_code=404, detail="Candidate clip not found")

    if feedback_req.user_feedback not in ["good", "bad", None]:
        raise HTTPException(status_code=400, detail="Feedback must be 'good', 'bad', or null")

    clip.user_feedback = feedback_req.user_feedback
    await db.commit()
    await db.refresh(clip)

    thumb_url = f"/api/library/thumbnails/{Path(clip.thumbnail_path).name}" if clip.thumbnail_path else None
    return CandidateClipResponse(
        id=clip.id,
        recording_id=clip.recording_id,
        start_time=clip.start_time,
        end_time=clip.end_time,
        duration=clip.duration,
        score=clip.score,
        rank=clip.rank,
        thumbnail_url=thumb_url,
        user_feedback=clip.user_feedback,
        detection_method=clip.detection_method,
        notes=clip.notes,
        created_at=clip.created_at,
    )
