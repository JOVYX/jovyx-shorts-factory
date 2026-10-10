from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database.db import get_db
from app.database.models import OAuthToken
from app.models.schemas import AppSettingsResponse, AppSettingsUpdateRequest, HardwareStatusResponse
from app.services.ai_metadata import generate_short_metadata
from app.video.hardware import get_hardware_info

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("", response_model=AppSettingsResponse)
async def get_settings(db: AsyncSession = Depends(get_db)):
    token_res = await db.execute(select(OAuthToken).where(OAuthToken.id == "youtube"))
    oauth_token = token_res.scalar_one_or_none()

    return AppSettingsResponse(
        output_resolution=settings.default_resolution,
        output_fps=settings.default_fps,
        default_clip_duration=settings.default_clip_duration,
        highlight_sensitivity=settings.highlight_sensitivity,
        encoder_preference=settings.encoder_preference,
        ai_provider=settings.ai_provider,
        storage_dir=str(settings.storage_dir),
        output_dir=str(settings.renders_dir),
        export_dir=str(settings.exports_dir),
        youtube_authenticated=oauth_token is not None,
        youtube_channel_title=oauth_token.channel_title if oauth_token else None,
        youtube_client_id_configured=bool(settings.youtube_client_id),
    )


@router.patch("", response_model=AppSettingsResponse)
async def update_settings(req: AppSettingsUpdateRequest, db: AsyncSession = Depends(get_db)):
    if req.output_resolution is not None:
        settings.default_resolution = req.output_resolution
    if req.output_fps is not None:
        settings.default_fps = req.output_fps
    if req.default_clip_duration is not None:
        settings.default_clip_duration = req.default_clip_duration
    if req.highlight_sensitivity is not None:
        settings.highlight_sensitivity = req.highlight_sensitivity
    if req.encoder_preference is not None:
        settings.encoder_preference = req.encoder_preference
    if req.ai_provider is not None:
        settings.ai_provider = req.ai_provider
    if req.youtube_client_id is not None:
        settings.youtube_client_id = req.youtube_client_id
    if req.youtube_client_secret is not None:
        settings.youtube_client_secret = req.youtube_client_secret

    return await get_settings(db=db)


@router.get("/hardware", response_model=HardwareStatusResponse)
async def get_hardware_details():
    hw = get_hardware_info()
    return HardwareStatusResponse(
        nvenc_available=hw.nvenc_available,
        encoder="h264_nvenc" if hw.nvenc_available else "libx264",
        gpu_name=hw.gpu_name,
        vram_total_mb=hw.vram_total_mb,
        vram_used_mb=hw.vram_used_mb,
        ffmpeg_version=hw.ffmpeg_version,
        cuda_detected=hw.cuda_detected,
    )


class MetadataGenRequest(BaseModel):
    preset_name: str = "Gameplay Highlights"
    user_context: str = ""


@router.post("/generate-metadata")
async def generate_metadata(req: MetadataGenRequest):
    data = await generate_short_metadata(preset_name=req.preset_name, user_context=req.user_context)
    return data
