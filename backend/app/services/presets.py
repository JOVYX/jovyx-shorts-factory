import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import Preset

logger = logging.getLogger(__name__)

DEFAULT_PRESETS = [
    {
        "id": "player_card",
        "name": "Player Card",
        "description": "Showcase standout individual plays with focused 9:16 blurred framing, sharp title hook, and subtle vignette.",
        "layout": "blurred_background",
        "branding_enabled": True,
        "branding_text": "JOVYX | eFootball",
        "badge_style": "fut_card",
        "vignette": True,
        "color_grade": "vibrant",
        "slow_motion": False,
        "zoom_punch": True,
        "caption_default": "Insane Solo Goal! ⚽🔥",
        "is_custom": False,
    },
    {
        "id": "gameplay_highlights",
        "name": "Gameplay Highlights",
        "description": "Crisp 60fps presentation with blurred gameplay backdrop, vibrant color grading, and Jovyx branding bar.",
        "layout": "blurred_background",
        "branding_enabled": True,
        "branding_text": "JOVYX | eFootball Mobile",
        "badge_style": "scoreboard",
        "vignette": False,
        "color_grade": "vibrant",
        "slow_motion": False,
        "zoom_punch": False,
        "caption_default": "Smooth Team Play & Finish! 🎯",
        "is_custom": False,
    },
    {
        "id": "cinematic_football",
        "name": "Cinematic Football",
        "description": "Dramatic mood with warm cinematic color grade, half-speed slow motion, vignette, and outro subscription banner.",
        "layout": "blurred_background",
        "branding_enabled": True,
        "branding_text": "JOVYX | Cinematic eFootball",
        "badge_style": "minimal",
        "vignette": True,
        "color_grade": "cinematic",
        "slow_motion": True,
        "zoom_punch": False,
        "caption_default": "Pure Class Finish in Slow-Mo ✨",
        "is_custom": False,
    },
]


async def seed_presets(db: AsyncSession) -> None:
    """Ensure the three default presets exist in the database."""
    for p_data in DEFAULT_PRESETS:
        result = await db.execute(select(Preset).where(Preset.id == p_data["id"]))
        existing = result.scalar_one_or_none()
        if not existing:
            preset = Preset(**p_data)
            db.add(preset)
    await db.commit()
