import asyncio
from pathlib import Path
import sys
import uuid
import pytest
from httpx import AsyncClient, ASGITransport

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.main import app
from app.database.db import init_db, AsyncSessionLocal
from app.services.jobs import job_queue
from app.database.models import JobRecord, utc_now


@pytest.fixture(scope="session", autouse=True)
def init_test_db():
    async def _setup():
        await init_db()
    asyncio.run(_setup())


@pytest.mark.asyncio
async def test_job_record_crud():
    job_id = f"test_job_{uuid.uuid4().hex[:8]}"
    async with AsyncSessionLocal() as session:
        job = JobRecord(
            id=job_id,
            job_type="highlight_scan",
            target_id="rec_test_123",
            status="running",
            progress=25.0,
            stage="Analyzing frames",
            started_at=utc_now(),
        )
        session.add(job)
        await session.commit()

    # Query via API
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(f"/api/jobs/{job_id}")
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == job_id
        assert data["job_type"] == "highlight_scan"
        assert data["progress"] == 25.0
        assert data["status"] == "running"

        # List active jobs
        active_res = await ac.get("/api/jobs/active")
        assert active_res.status_code == 200
        active_ids = [j["id"] for j in active_res.json()]
        assert job_id in active_ids

        # Cancel job via API
        cancel_res = await ac.post(f"/api/jobs/{job_id}/cancel")
        assert cancel_res.status_code == 200
        assert cancel_res.json()["cancelled"] is True

        # Verify job is cancelled
        res_after = await ac.get(f"/api/jobs/{job_id}")
        assert res_after.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_highlight_detector_with_progress():
    fixture_path = Path(__file__).resolve().parent / "fixtures" / "sample_efootball.mp4"
    from app.highlights.detector import highlight_detector

    progresses = []

    def on_progress(pct: float, stage: str):
        progresses.append((pct, stage))

    candidates = await highlight_detector.extract_candidates(
        video_path=fixture_path,
        target_clip_duration=2.0,
        sensitivity=0.35,
        max_candidates=3,
        progress_callback=on_progress,
    )
    assert len(candidates) >= 1
    assert candidates[0].duration > 0
