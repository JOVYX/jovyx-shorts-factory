import uuid
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.db import get_db
from app.database.models import Preset, Recording
from app.highlights.reference_analyzer import reference_analyzer
from app.models.schemas import PresetCreateUpdateRequest, PresetResponse

router = APIRouter(prefix="/presets", tags=["Presets"])


@router.get("", response_model=list[PresetResponse])
async def list_presets(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Preset).order_by(Preset.created_at.asc()))
    presets = result.scalars().all()
    return presets


@router.get("/{preset_id}", response_model=PresetResponse)
async def get_preset(preset_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Preset).where(Preset.id == preset_id))
    preset = result.scalar_one_or_none()
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    return preset


@router.put("/{preset_id}", response_model=PresetResponse)
async def update_preset(
    preset_id: str,
    req: PresetCreateUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Preset).where(Preset.id == preset_id))
    preset = result.scalar_one_or_none()
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")

    for field, val in req.model_dump().items():
        setattr(preset, field, val)

    await db.commit()
    await db.refresh(preset)
    return preset


@router.post("", response_model=PresetResponse)
async def create_preset(
    req: PresetCreateUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    preset_id = f"custom_{uuid.uuid4().hex[:8]}"
    preset = Preset(
        id=preset_id,
        name=req.name,
        description=req.description,
        layout=req.layout,
        branding_enabled=req.branding_enabled,
        branding_text=req.branding_text,
        badge_style=req.badge_style,
        vignette=req.vignette,
        color_grade=req.color_grade,
        slow_motion=req.slow_motion,
        zoom_punch=req.zoom_punch,
        caption_default=req.caption_default,
        is_custom=True,
    )
    db.add(preset)
    await db.commit()
    await db.refresh(preset)
    return preset


class ReferenceAnalyzeRequest(BaseModel):
    recording_id: Optional[str] = None
    filepath: Optional[str] = None
    save_as_preset: bool = True


@router.post("/analyze-reference")
async def analyze_reference_video(
    req: ReferenceAnalyzeRequest,
    db: AsyncSession = Depends(get_db),
):
    video_path: Optional[Path] = None

    if req.recording_id:
        res = await db.execute(select(Recording).where(Recording.id == req.recording_id))
        rec = res.scalar_one_or_none()
        if not rec:
            raise HTTPException(status_code=404, detail="Recording not found")
        video_path = Path(rec.filepath)
    elif req.filepath:
        video_path = Path(req.filepath)

    if not video_path or not video_path.exists():
        raise HTTPException(status_code=400, detail="Reference video file not found")

    profile = await reference_analyzer.analyze(video_path)

    created_preset = None
    if req.save_as_preset and profile.preset_template:
        t = profile.preset_template
        preset_id = f"custom_{uuid.uuid4().hex[:8]}"
        preset = Preset(
            id=preset_id,
            name=t.get("name", f"Style: {video_path.stem[:18]}"),
            description=t.get("description", "Reverse-engineered editing preset"),
            layout=t.get("layout", "blurred_background"),
            branding_enabled=t.get("branding_enabled", True),
            branding_text=t.get("branding_text", "JOVYX | eFootball"),
            badge_style=t.get("badge_style", "fut_card"),
            vignette=t.get("vignette", True),
            color_grade=t.get("color_grade", "vibrant"),
            slow_motion=t.get("slow_motion", False),
            zoom_punch=t.get("zoom_punch", True),
            caption_default=t.get("caption_default", "Insane Goal! ⚽🔥"),
            is_custom=True,
        )
        db.add(preset)
        await db.commit()
        await db.refresh(preset)
        created_preset = preset

    return {
        "profile": profile,
        "created_preset": created_preset,
    }
