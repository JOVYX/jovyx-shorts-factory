import asyncio
import logging
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import cv2
import numpy as np

from app.video.probe import probe_video

logger = logging.getLogger(__name__)


@dataclass
class ReferenceStyleProfile:
    video_filename: str
    duration: float
    cut_count: int
    avg_shot_duration: float
    detected_layout: str  # blurred_background, center_crop, dual_stacked
    color_grading: str    # vibrant, cinematic, natural
    has_vignette: bool
    recommended_duration: float
    recommended_slow_motion: bool
    recommended_zoom_punch: bool
    branding_detected: bool
    editing_formula: list[str] = field(default_factory=list)
    preset_template: dict[str, Any] = field(default_factory=dict)


class ReferenceVideoAnalyzer:
    """
    Analyzes reference Shorts from top creators/YouTubers to reverse-engineer
    their editing style, pacing, color grade, and framing layout.
    """

    async def analyze(self, video_path: Path) -> ReferenceStyleProfile:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._analyze_sync, video_path)

    def _analyze_sync(self, video_path: Path) -> ReferenceStyleProfile:
        meta = probe_video(video_path)
        total_duration = max(1.0, meta.duration)

        # 1. Sample frames at 2 fps using FFmpeg pipe (supports AV1, HEVC, H.264, etc.)
        cmd = [
            "ffmpeg",
            "-v", "error",
            "-i", str(video_path),
            "-vf", "fps=2,scale=320:180",
            "-f", "rawvideo",
            "-pix_fmt", "bgr24",
            "pipe:1",
        ]

        frame_size = 320 * 180 * 3
        frames_bgr: list[np.ndarray] = []

        try:
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            # Sample up to 120 frames (up to 60s) to be fast
            while len(frames_bgr) < 120:
                raw = proc.stdout.read(frame_size)
                if len(raw) < frame_size:
                    break
                arr = np.frombuffer(raw, dtype=np.uint8).reshape((180, 320, 3))
                frames_bgr.append(arr)
            proc.kill()
        except Exception as e:
            logger.error(f"Reference frame sampling failed: {e}")

        # Fallback if sampling returned no frames
        if not frames_bgr:
            return self._default_profile(meta.duration, video_path.name)

        # 2. Analyze Pacing & Shot Cuts
        diffs: list[float] = []
        prev_gray = None
        for frame in frames_bgr:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            if prev_gray is not None:
                diff = float(np.mean(cv2.absdiff(gray, prev_gray))) / 255.0
                diffs.append(diff)
            prev_gray = gray

        # Scene cut threshold
        cuts = [d for d in diffs if d >= 0.22]
        cut_count = len(cuts)
        avg_shot_duration = (
            round(total_duration / (cut_count + 1), 1) if cut_count > 0 else round(total_duration, 1)
        )

        # 3. Analyze Color Grading & Saturation
        saturations: list[float] = []
        contrasts: list[float] = []
        for frame in frames_bgr[::3]:  # sample every 3rd
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            sat = float(np.mean(hsv[:, :, 1])) / 255.0
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            std_contrast = float(np.std(gray))
            saturations.append(sat)
            contrasts.append(std_contrast)

        avg_sat = float(np.mean(saturations)) if saturations else 0.4
        avg_contrast = float(np.mean(contrasts)) if contrasts else 45.0

        if avg_sat > 0.45 or avg_contrast > 52.0:
            color_grade = "vibrant"
        elif avg_sat < 0.32:
            color_grade = "cinematic"
        else:
            color_grade = "natural"

        # 4. Analyze Layout (Check for top/bottom blurred background vs full crop)
        # In 9:16 vertical videos with blurred backdrop, the top 25% and bottom 25% have high blur / low edge variance
        detected_layout = "blurred_background"
        if meta.height > meta.width:
            # It's a vertical 9:16 reference video
            top_edges: list[float] = []
            center_edges: list[float] = []
            for frame in frames_bgr[::4]:
                h, w = frame.shape[:2]
                top_strip = frame[: int(h * 0.25), :]
                center_strip = frame[int(h * 0.3) : int(h * 0.7), :]
                lap_top = float(cv2.Laplacian(top_strip, cv2.CV_64F).var())
                lap_center = float(cv2.Laplacian(center_strip, cv2.CV_64F).var())
                top_edges.append(lap_top)
                center_edges.append(lap_center)

            mean_top_edge = float(np.mean(top_edges)) if top_edges else 50.0
            mean_center_edge = float(np.mean(center_edges)) if center_edges else 100.0

            # If top is much blurrier than center, it's blurred background
            if mean_center_edge > 1.8 * mean_top_edge:
                detected_layout = "blurred_background"
            else:
                detected_layout = "center_crop"
        else:
            detected_layout = "blurred_background"

        # 5. Build Editing Formula
        recommended_duration = min(35.0, max(15.0, round(total_duration, 1)))
        slow_mo_recommended = cut_count >= 3 or avg_shot_duration < 4.0
        vignette_recommended = color_grade in ("cinematic", "vibrant")

        formula = [
            f"0.0s - 2.5s: High-Energy Hook Banner ('Wait for the curve! ⚽🔥')",
            f"2.5s - {recommended_duration - 6.0:.1f}s: Fast Paced Build-up ({avg_shot_duration}s average cut pace)",
            f"{recommended_duration - 6.0:.1f}s - {recommended_duration - 2.5:.1f}s: Goal Climax {'with 0.5x Slow-Motion' if slow_mo_recommended else ''}",
            f"{recommended_duration - 2.5:.1f}s - {recommended_duration:.1f}s: Outro Call-To-Action Banner ('Follow @Jovyx for more')",
        ]

        preset_template = {
            "name": f"Clone: {video_path.stem[:24]}",
            "description": f"Reverse-engineered style from reference video ({avg_shot_duration}s shot pace, {color_grade} grade).",
            "layout": detected_layout,
            "branding_enabled": True,
            "branding_text": "JOVYX | eFootball",
            "badge_style": "fut_card",
            "vignette": vignette_recommended,
            "color_grade": color_grade,
            "slow_motion": slow_mo_recommended,
            "zoom_punch": True,
            "caption_default": "Insane Goal! Rate 1-10 ⚽🔥",
            "is_custom": True,
        }

        return ReferenceStyleProfile(
            video_filename=video_path.name,
            duration=round(total_duration, 1),
            cut_count=cut_count,
            avg_shot_duration=avg_shot_duration,
            detected_layout=detected_layout,
            color_grading=color_grade,
            has_vignette=vignette_recommended,
            recommended_duration=recommended_duration,
            recommended_slow_motion=slow_mo_recommended,
            recommended_zoom_punch=True,
            branding_detected=True,
            editing_formula=formula,
            preset_template=preset_template,
        )

    def _default_profile(self, duration: float, filename: str) -> ReferenceStyleProfile:
        return ReferenceStyleProfile(
            video_filename=filename,
            duration=round(duration, 1),
            cut_count=2,
            avg_shot_duration=5.0,
            detected_layout="blurred_background",
            color_grading="vibrant",
            has_vignette=True,
            recommended_duration=25.0,
            recommended_slow_motion=True,
            recommended_zoom_punch=True,
            branding_detected=True,
            editing_formula=[
                "0.0s - 2.5s: Viral Hook Text Banner",
                "2.5s - 18.0s: Build-up and Skill Moves",
                "18.0s - 22.5s: Goal Climax in 0.5x Slow-Mo",
                "22.5s - 25.0s: Outro Subscribe CTA",
            ],
            preset_template={
                "name": f"Style: {filename[:20]}",
                "description": "Standard high-energy mobile gaming Shorts preset.",
                "layout": "blurred_background",
                "branding_enabled": True,
                "branding_text": "JOVYX | eFootball",
                "badge_style": "fut_card",
                "vignette": True,
                "color_grade": "vibrant",
                "slow_motion": True,
                "zoom_punch": True,
                "caption_default": "World Class Finish! ⚽🔥",
                "is_custom": True,
            },
        )


reference_analyzer = ReferenceVideoAnalyzer()
