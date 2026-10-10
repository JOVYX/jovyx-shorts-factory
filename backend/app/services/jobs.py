import asyncio
import datetime
import logging
import uuid
from pathlib import Path
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database.db import AsyncSessionLocal
from app.database.models import CandidateClip, JobRecord, OAuthToken, PublishingRecord, Recording, Short, utc_now
from app.highlights.detector import highlight_detector
from app.publishing.youtube import youtube_service
from app.video.preview import generate_thumbnail
from app.video.processor import ShortRenderConfig, video_processor

logger = logging.getLogger(__name__)


class JobQueue:
    def __init__(self):
        self._active_tasks: dict[str, asyncio.Task] = {}

    async def cleanup_stale_jobs(self) -> None:
        """Mark any jobs left running/pending from server restarts as failed/interrupted."""
        try:
            async with AsyncSessionLocal() as db:
                await db.execute(
                    update(JobRecord)
                    .where(JobRecord.status.in_(["running", "pending"]))
                    .values(
                        status="failed",
                        error_message="Server restarted while job was in progress",
                        completed_at=utc_now(),
                    )
                )
                # Also reset any recordings stuck in 'analyzing'
                await db.execute(
                    update(Recording)
                    .where(Recording.status == "analyzing")
                    .values(status="imported")
                )
                await db.commit()
                logger.info("Cleaned up any stale running jobs from previous session")
        except Exception as e:
            logger.warning(f"Could not clean up stale jobs on startup: {e}")

    def spawn_highlight_scan(
        self,
        recording_id: str,
        target_clip_duration: float = 25.0,
        sensitivity: float = 0.35,
        max_candidates: int = 8,
    ) -> str:
        task_id = f"scan_{recording_id}_{uuid.uuid4().hex[:6]}"
        task = asyncio.create_task(
            self._run_highlight_scan(
                task_id, recording_id, target_clip_duration, sensitivity, max_candidates
            )
        )
        self._active_tasks[task_id] = task
        task.add_done_callback(lambda _: self._active_tasks.pop(task_id, None))
        return task_id

    async def _run_highlight_scan(
        self,
        task_id: str,
        recording_id: str,
        target_clip_duration: float,
        sensitivity: float,
        max_candidates: int,
    ) -> None:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Recording).where(Recording.id == recording_id))
            recording = result.scalar_one_or_none()
            if not recording:
                logger.error(f"Recording {recording_id} not found for highlight scan")
                return

            recording.status = "analyzing"
            job = JobRecord(
                id=task_id,
                job_type="highlight_scan",
                target_id=recording_id,
                status="running",
                progress=0.0,
                stage="Starting highlight scan",
                started_at=utc_now(),
            )
            db.add(job)
            await db.commit()

        def sync_progress(pct: float, stage: str) -> None:
            async def _update():
                async with AsyncSessionLocal() as sub_db:
                    res = await sub_db.execute(select(JobRecord).where(JobRecord.id == task_id))
                    j = res.scalar_one_or_none()
                    if j and j.status == "running":
                        j.progress = round(pct, 1)
                        j.stage = stage
                        await sub_db.commit()

            asyncio.create_task(_update())

        try:
            candidates = await highlight_detector.extract_candidates(
                video_path=Path(recording.filepath),
                target_clip_duration=target_clip_duration,
                sensitivity=sensitivity,
                max_candidates=max_candidates,
                progress_callback=sync_progress,
            )

            async with AsyncSessionLocal() as db:
                rec_res = await db.execute(select(Recording).where(Recording.id == recording_id))
                rec = rec_res.scalar_one_or_none()

                # Clear previous clips if re-scanning
                existing_clips = await db.execute(
                    select(CandidateClip).where(CandidateClip.recording_id == recording_id)
                )
                for clip in existing_clips.scalars().all():
                    await db.delete(clip)

                for cand in candidates:
                    clip_id = uuid.uuid4().hex
                    thumb_filename = f"clip_{clip_id}.jpg"
                    thumb_path = settings.thumbnails_dir / thumb_filename

                    try:
                        generate_thumbnail(
                            video_path=rec.filepath,
                            output_image_path=thumb_path,
                            timestamp_sec=cand.representative_timestamp,
                        )
                    except Exception as e:
                        logger.warning(f"Could not generate candidate thumbnail: {e}")

                    db_clip = CandidateClip(
                        id=clip_id,
                        recording_id=recording_id,
                        start_time=cand.start_time,
                        end_time=cand.end_time,
                        duration=cand.duration,
                        score=cand.score,
                        rank=cand.rank,
                        thumbnail_path=str(thumb_path) if thumb_path.exists() else None,
                        detection_method=cand.detection_method,
                        notes=", ".join(cand.tags),
                    )
                    db.add(db_clip)

                if rec:
                    rec.status = "analyzed"
                    rec.error_message = None

                job_res = await db.execute(select(JobRecord).where(JobRecord.id == task_id))
                j = job_res.scalar_one_or_none()
                if j and j.status == "running":
                    j.status = "completed"
                    j.progress = 100.0
                    j.stage = f"Scan complete ({len(candidates)} highlights found)"
                    j.completed_at = utc_now()

                await db.commit()
                logger.info(f"Highlight scan completed for recording {recording_id}: {len(candidates)} clips found")

        except asyncio.CancelledError:
            logger.info(f"Highlight scan cancelled for recording {recording_id}")
            async with AsyncSessionLocal() as db:
                rec_res = await db.execute(select(Recording).where(Recording.id == recording_id))
                rec = rec_res.scalar_one_or_none()
                if rec:
                    rec.status = "imported"
                job_res = await db.execute(select(JobRecord).where(JobRecord.id == task_id))
                j = job_res.scalar_one_or_none()
                if j:
                    j.status = "cancelled"
                    j.stage = "Cancelled by user"
                    j.completed_at = utc_now()
                await db.commit()

        except Exception as e:
            logger.error(f"Highlight scan failed for recording {recording_id}: {e}")
            async with AsyncSessionLocal() as db:
                rec_res = await db.execute(select(Recording).where(Recording.id == recording_id))
                rec = rec_res.scalar_one_or_none()
                if rec:
                    rec.status = "error"
                    rec.error_message = f"Highlight analysis error: {e}"
                job_res = await db.execute(select(JobRecord).where(JobRecord.id == task_id))
                j = job_res.scalar_one_or_none()
                if j:
                    j.status = "failed"
                    j.error_message = str(e)
                    j.completed_at = utc_now()
                await db.commit()

    def spawn_short_render(self, short_id: str) -> str:
        task_id = f"render_{short_id}_{uuid.uuid4().hex[:6]}"
        task = asyncio.create_task(self._run_short_render(task_id, short_id))
        self._active_tasks[task_id] = task
        task.add_done_callback(lambda _: self._active_tasks.pop(task_id, None))
        return task_id

    async def _run_short_render(self, task_id: str, short_id: str) -> None:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Short, Recording).join(Recording, Short.recording_id == Recording.id).where(Short.id == short_id)
            )
            row = result.first()
            if not row:
                logger.error(f"Short {short_id} not found for render")
                return

            short, recording = row
            short.status = "rendering"
            short.render_progress = 0.0
            short.error_message = None

            job = JobRecord(
                id=task_id,
                job_type="short_render",
                target_id=short_id,
                status="running",
                progress=0.0,
                stage="Starting vertical 9:16 rendering",
                started_at=utc_now(),
            )
            db.add(job)
            await db.commit()

            output_filename = f"short_{short.id}.mp4"
            output_path = settings.renders_dir / output_filename
            thumb_filename = f"short_thumb_{short.id}.jpg"
            thumb_path = settings.thumbnails_dir / thumb_filename

            def progress_cb(pct: float) -> None:
                async def _update():
                    async with AsyncSessionLocal() as sub_db:
                        res = await sub_db.execute(select(Short).where(Short.id == short_id))
                        s = res.scalar_one_or_none()
                        if s:
                            s.render_progress = round(pct, 1)
                        j_res = await sub_db.execute(select(JobRecord).where(JobRecord.id == task_id))
                        j = j_res.scalar_one_or_none()
                        if j and j.status == "running":
                            j.progress = round(pct, 1)
                            j.stage = f"Rendering 1080x1920 Short ({int(pct)}%)"
                        await sub_db.commit()

                asyncio.create_task(_update())

            render_cfg = ShortRenderConfig(
                input_path=Path(recording.filepath),
                output_path=output_path,
                start_time=short.start_time,
                end_time=short.end_time,
                layout=short.layout,
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
                encoder_preference=settings.encoder_preference,
            )

            try:
                encoder_used = await video_processor.render_short(render_cfg, progress_callback=progress_cb)

                try:
                    generate_thumbnail(
                        video_path=output_path,
                        output_image_path=thumb_path,
                        timestamp_sec=min(1.0, (short.end_time - short.start_time) / 2.0),
                    )
                except Exception as e:
                    logger.warning(f"Failed to generate rendered thumbnail: {e}")

                short.status = "rendered"
                short.render_progress = 100.0
                short.output_path = str(output_path)
                short.thumbnail_path = str(thumb_path) if thumb_path.exists() else None
                short.encoder_used = encoder_used
                short.error_message = None

                job_res = await db.execute(select(JobRecord).where(JobRecord.id == task_id))
                j = job_res.scalar_one_or_none()
                if j and j.status == "running":
                    j.status = "completed"
                    j.progress = 100.0
                    j.stage = f"Render complete ({encoder_used})"
                    j.completed_at = utc_now()

                await db.commit()
                logger.info(f"Render completed for Short {short_id} using {encoder_used}")

            except asyncio.CancelledError:
                logger.info(f"Render cancelled for Short {short_id}")
                short.status = "draft"
                short.render_progress = 0.0
                job_res = await db.execute(select(JobRecord).where(JobRecord.id == task_id))
                j = job_res.scalar_one_or_none()
                if j:
                    j.status = "cancelled"
                    j.stage = "Cancelled by user"
                    j.completed_at = utc_now()
                await db.commit()

            except Exception as e:
                logger.error(f"Render failed for Short {short_id}: {e}")
                short.status = "error"
                short.error_message = f"Render error: {e}"
                job_res = await db.execute(select(JobRecord).where(JobRecord.id == task_id))
                j = job_res.scalar_one_or_none()
                if j:
                    j.status = "failed"
                    j.error_message = str(e)
                    j.completed_at = utc_now()
                await db.commit()

    def spawn_youtube_upload(self, publishing_record_id: str) -> str:
        task_id = f"yt_upload_{publishing_record_id}_{uuid.uuid4().hex[:6]}"
        task = asyncio.create_task(self._run_youtube_upload(task_id, publishing_record_id))
        self._active_tasks[task_id] = task
        task.add_done_callback(lambda _: self._active_tasks.pop(task_id, None))
        return task_id

    async def _run_youtube_upload(self, task_id: str, publishing_record_id: str) -> None:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(PublishingRecord, Short)
                .join(Short, PublishingRecord.short_id == Short.id)
                .where(PublishingRecord.id == publishing_record_id)
            )
            row = result.first()
            if not row:
                return

            pub_rec, short = row
            token_res = await db.execute(select(OAuthToken).where(OAuthToken.id == "youtube"))
            oauth_token = token_res.scalar_one_or_none()

            job = JobRecord(
                id=task_id,
                job_type="youtube_upload",
                target_id=publishing_record_id,
                status="running",
                progress=0.0,
                stage="Initiating YouTube upload",
                started_at=utc_now(),
            )
            db.add(job)

            if not oauth_token:
                pub_rec.status = "failed"
                pub_rec.error_message = "YouTube account is not authenticated via OAuth"
                job.status = "failed"
                job.error_message = pub_rec.error_message
                job.completed_at = utc_now()
                await db.commit()
                return

            pub_rec.status = "uploading"
            pub_rec.upload_progress = 0.0
            await db.commit()

            token_data = {
                "access_token": oauth_token.access_token,
                "refresh_token": oauth_token.refresh_token,
                "token_uri": oauth_token.token_uri,
                "client_id": oauth_token.client_id,
                "client_secret": oauth_token.client_secret,
            }

            def progress_cb(pct: float) -> None:
                async def _update():
                    async with AsyncSessionLocal() as sub_db:
                        r = await sub_db.execute(
                            select(PublishingRecord).where(PublishingRecord.id == publishing_record_id)
                        )
                        record = r.scalar_one_or_none()
                        if record:
                            record.upload_progress = round(pct, 1)
                        j_res = await sub_db.execute(select(JobRecord).where(JobRecord.id == task_id))
                        j = j_res.scalar_one_or_none()
                        if j and j.status == "running":
                            j.progress = round(pct, 1)
                            j.stage = f"Uploading to YouTube ({int(pct)}%)"
                        await sub_db.commit()

                asyncio.create_task(_update())

            try:
                video_id, video_url = await youtube_service.upload_short(
                    token_data=token_data,
                    video_path=Path(short.output_path),
                    title=short.title,
                    description=short.description,
                    privacy_status=pub_rec.privacy_status,
                    progress_callback=progress_cb,
                )

                pub_rec.status = "published"
                pub_rec.video_id = video_id
                pub_rec.video_url = video_url
                pub_rec.upload_progress = 100.0
                pub_rec.published_at = utc_now()
                short.status = "published"

                job_res = await db.execute(select(JobRecord).where(JobRecord.id == task_id))
                j = job_res.scalar_one_or_none()
                if j and j.status == "running":
                    j.status = "completed"
                    j.progress = 100.0
                    j.stage = "Published to YouTube"
                    j.completed_at = utc_now()

                await db.commit()
                logger.info(f"Published Short {short.id} to YouTube: {video_url}")

            except Exception as e:
                logger.error(f"YouTube upload failed: {e}")
                pub_rec.status = "failed"
                pub_rec.error_message = str(e)
                job_res = await db.execute(select(JobRecord).where(JobRecord.id == task_id))
                j = job_res.scalar_one_or_none()
                if j:
                    j.status = "failed"
                    j.error_message = str(e)
                    j.completed_at = utc_now()
                await db.commit()

    async def cancel_job(self, job_id: str) -> bool:
        """Cancel a running task by job ID and update its record."""
        task = self._active_tasks.get(job_id)
        if task and not task.done():
            task.cancel()
            return True

        # If not active in memory, update DB record if still running
        async with AsyncSessionLocal() as db:
            res = await db.execute(select(JobRecord).where(JobRecord.id == job_id))
            job = res.scalar_one_or_none()
            if job and job.status in ["running", "pending"]:
                job.status = "cancelled"
                job.stage = "Cancelled by user"
                job.completed_at = utc_now()
                await db.commit()
                return True
        return False


job_queue = JobQueue()
