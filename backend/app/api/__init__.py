from fastapi import APIRouter

from app.api.routes_dashboard import router as dashboard_router
from app.api.routes_highlights import router as highlights_router
from app.api.routes_jobs import router as jobs_router
from app.api.routes_library import router as library_router
from app.api.routes_presets import router as presets_router
from app.api.routes_publishing import router as publishing_router
from app.api.routes_settings import router as settings_router
from app.api.routes_shorts import router as shorts_router
from app.api.routes_system import router as system_router

api_router = APIRouter(prefix="/api")
api_router.include_router(dashboard_router)
api_router.include_router(library_router)
api_router.include_router(highlights_router)
api_router.include_router(jobs_router)
api_router.include_router(shorts_router)
api_router.include_router(presets_router)
api_router.include_router(publishing_router)
api_router.include_router(settings_router)
api_router.include_router(system_router)

