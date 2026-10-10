from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.db import get_db
from app.database.models import JobRecord
from app.models.schemas import JobResponse
from app.services.jobs import job_queue

router = APIRouter(prefix="/jobs", tags=["Jobs"])


@router.get("", response_model=list[JobResponse])
async def list_jobs(
    status: Optional[str] = None,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(JobRecord).order_by(desc(JobRecord.created_at)).limit(limit)
    if status:
        stmt = stmt.where(JobRecord.status == status)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/active", response_model=list[JobResponse])
async def list_active_jobs(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(JobRecord)
        .where(JobRecord.status.in_(["running", "pending"]))
        .order_by(desc(JobRecord.created_at))
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(JobRecord).where(JobRecord.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/{job_id}/cancel")
async def cancel_job(job_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(JobRecord).where(JobRecord.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    cancelled = await job_queue.cancel_job(job_id)
    return {
        "job_id": job_id,
        "cancelled": cancelled,
        "message": "Job cancellation requested",
    }
