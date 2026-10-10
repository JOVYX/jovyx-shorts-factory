import asyncio
from pathlib import Path
import sys
import pytest
from httpx import AsyncClient, ASGITransport

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.main import app
from app.database.db import init_db, AsyncSessionLocal
from app.services.presets import seed_presets


@pytest.fixture(scope="session", autouse=True)
def init_test_database():
    """Session-level database setup."""
    async def _setup():
        await init_db()
        async with AsyncSessionLocal() as session:
            await seed_presets(session)
    asyncio.run(_setup())


@pytest.mark.asyncio
async def test_health_check():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_presets_api():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/presets")
        assert response.status_code == 200
        presets = response.json()
        preset_ids = [p["id"] for p in presets]
        assert "player_card" in preset_ids
        assert "gameplay_highlights" in preset_ids
        assert "cinematic_football" in preset_ids


@pytest.mark.asyncio
async def test_dashboard_stats_api():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        assert "hardware" in data
        assert "total_recordings" in data
        assert "shorts_ready_review" in data


@pytest.mark.asyncio
async def test_import_and_short_workflow():
    fixture_path = Path(__file__).resolve().parent / "fixtures" / "sample_efootball.mp4"
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Import recording
        res = await ac.post("/api/library/import", json={
            "filepath": str(fixture_path),
            "copy_to_library": False
        })
        assert res.status_code == 200
        rec_data = res.json()
        assert rec_data["filename"] == "sample_efootball.mp4"
        rec_id = rec_data["id"]

        # Create Short
        short_res = await ac.post("/api/shorts", json={
            "recording_id": rec_id,
            "title": "Test Goal Header",
            "start_time": 0.0,
            "end_time": 2.5,
            "layout": "blurred_background",
            "branding_enabled": True
        })
        assert short_res.status_code == 200
        short_data = short_res.json()
        assert short_data["title"] == "Test Goal Header"
        assert short_data["status"] == "draft"

        # Update Short status
        status_res = await ac.post(f"/api/shorts/{short_data['id']}/status", json={
            "status": "approved"
        })
        assert status_res.status_code == 200
        assert status_res.json()["status"] == "approved"
