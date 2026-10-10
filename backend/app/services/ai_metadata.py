import logging
import random
from typing import Any, Optional

from app.config import settings

logger = logging.getLogger(__name__)

FOOTBALL_HOOKS = [
    "Unreal Solo Goal in eFootball Mobile! ⚽🔥",
    "Is this the Cleanest Curler in eFootball? 🤯🚀",
    "Absolute Rocket Finish! Top Corner 💥🎯",
    "Smooth Tiki-Taka to Sensational Goal! 🪄⚽",
    "Best Long Range Goal This Season? 🤯✨",
    "Unstoppable Dribble & Clinical Finish! ⚡⚽",
    "Calculated Curler from Outside the Box! 📐🎯",
    "Cheeky Chip Goal over the Keeper! 🧤⚽",
]

DEFAULT_DESCRIPTION_TEMPLATE = """{hook}
eFootball Mobile gameplay highlight captured on iPhone.

Drop a like if you enjoyed this finish! 👍
Subscribe to @Jovyx for daily eFootball goals, tricks & tactical gameplay.

#shorts #efootball #efootballmobile #efootball2025 #gaming #footballshorts #pes #pesmobile
"""


async def generate_short_metadata(
    preset_name: str = "Gameplay Highlights",
    user_context: str = "",
) -> dict[str, Any]:
    """
    Generates high-CTR title, description, and hashtags for YouTube Shorts.
    """
    hook = random.choice(FOOTBALL_HOOKS)
    if user_context:
        title = f"{user_context.strip().title()} ⚽🔥"
    else:
        title = hook

    description = DEFAULT_DESCRIPTION_TEMPLATE.format(hook=title)
    tags = [
        "eFootball",
        "eFootball Mobile",
        "Shorts",
        "Gaming",
        "Football",
        "eFootball 2025",
        "Jovyx",
        "Best Goals",
    ]

    return {
        "title": title,
        "description": description,
        "tags": tags,
    }
