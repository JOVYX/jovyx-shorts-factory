import asyncio
import logging
import re
import shutil
import subprocess
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from app.video.hardware import get_hardware_info
from app.video.probe import probe_video

logger = logging.getLogger(__name__)

DEFAULT_FONT = "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf"
if not Path(DEFAULT_FONT).exists():
    DEFAULT_FONT = "/usr/share/fonts/TTF/DejaVuSans.ttf"


def escape_drawtext_text(text: str) -> str:
    """Escape text for ffmpeg drawtext filter."""
    text = text.replace("\\", "\\\\")
    text = text.replace("'", "'\\''")
    text = text.replace(":", "\\:")
    text = text.replace("%", "\\%")
    return text


@dataclass
class ShortRenderConfig:
    input_path: Path
    output_path: Path
    start_time: float
    end_time: float
    layout: str = "blurred_background"  # blurred_background, center_crop, smart_crop, dual_stacked
    width: int = 1080
    height: int = 1920
    fps: int = 60
    
    branding_enabled: bool = True
    branding_text: str = "JOVYX | eFootball"
    caption_enabled: bool = False
    caption_text: str = ""
    slow_motion: bool = False
    zoom_punch: bool = False
    audio_gain: float = 1.0
    intro_text: str = ""
    outro_text: str = "Follow for more eFootball Highlights"
    color_grade: str = "vibrant"
    vignette: bool = False
    encoder_preference: str = "auto"


class VideoProcessor:
    def __init__(self):
        self.hardware = get_hardware_info()

    def build_filtergraph(
        self,
        config: ShortRenderConfig,
        has_audio: bool,
    ) -> tuple[str, Optional[str]]:
        """
        Builds the FFmpeg complex filtergraph string.
        Never stretches gameplay unnaturally.
        """
        w = config.width
        h = config.height
        duration = max(1.0, config.end_time - config.start_time)
        effective_duration = duration * 2.0 if config.slow_motion else duration

        v_filters: list[str] = []

        # 1. Base layout filter
        if config.layout == "center_crop":
            # Scale so height matches, then crop center 9:16
            layout_filter = (
                f"[0:v]scale=-2:{h},"
                f"crop={w}:{h}:(in_w-{w})/2:0[v_base]"
            )
        elif config.layout == "smart_crop":
            layout_filter = (
                f"[0:v]scale=-2:{h},"
                f"crop={w}:{h}:max(0\\,(in_w-{w})/2):0[v_base]"
            )
        elif config.layout == "dual_stacked":
            # Top half gameplay letterbox, bottom half blurred / zoomed
            half_h = h // 2
            layout_filter = (
                f"[0:v]split=2[in_top][in_bot];"
                f"[in_top]scale={w}:{half_h}:force_original_aspect_ratio=decrease,pad={w}:{half_h}:(ow-iw)/2:(oh-ih)/2:black[top];"
                f"[in_bot]scale={w}:{half_h}:force_original_aspect_ratio=increase,crop={w}:{half_h},boxblur=15:2[bot];"
                f"[top][bot]vstack[v_base]"
            )
        else:
            # Default: blurred_background (Industry gold-standard for mobile gaming)
            layout_filter = (
                f"[0:v]split=2[fg_in][bg_in];"
                f"[bg_in]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},boxblur=25:3[bg];"
                f"[fg_in]scale={w}:-2:force_original_aspect_ratio=decrease[fg];"
                f"[bg][fg]overlay=(W-w)/2:(H-h)/2[v_base]"
            )

        v_filters.append(layout_filter)
        current_node = "[v_base]"

        # 2. Slow motion speed change if enabled
        if config.slow_motion:
            next_node = "[v_slow]"
            v_filters.append(f"{current_node}setpts=2.0*PTS{next_node}")
            current_node = next_node

        # 3. Zoom punch effect (subtle cinematic pulse during the first half)
        if config.zoom_punch:
            next_node = "[v_zoom]"
            # Subtle smooth zoom punch
            v_filters.append(
                f"{current_node}scale=eval=frame:w='if(between(t,1,4),iw*1.08,iw)':h='if(between(t,1,4),ih*1.08,ih)',crop={w}:{h}{next_node}"
            )
            current_node = next_node

        # 4. Color grading
        if config.color_grade == "vibrant":
            next_node = "[v_color]"
            v_filters.append(f"{current_node}eq=contrast=1.12:brightness=0.03:saturation=1.30{next_node}")
            current_node = next_node
        elif config.color_grade == "cinematic":
            next_node = "[v_color]"
            v_filters.append(
                f"{current_node}eq=contrast=1.18:brightness=-0.02:saturation=0.94,colorbalance=rs=.08:gs=.02:bs=-.06{next_node}"
            )
            current_node = next_node

        # 5. Vignette
        if config.vignette:
            next_node = "[v_vignette]"
            v_filters.append(f"{current_node}vignette=angle=PI/5{next_node}")
            current_node = next_node

        # Font configuration
        font_arg = f":fontfile='{DEFAULT_FONT}'" if Path(DEFAULT_FONT).exists() else ""

        # 6. Jovyx Branding Watermark Overlay
        if config.branding_enabled and config.branding_text:
            escaped_brand = escape_drawtext_text(config.branding_text)
            next_node = "[v_brand]"
            v_filters.append(
                f"{current_node}drawtext=text='{escaped_brand}'{font_arg}:"
                f"fontsize=36:fontcolor=white@0.95:x=(w-text_w)/2:y=90:"
                f"box=1:boxcolor=black@0.65:boxborderw=14{next_node}"
            )
            current_node = next_node

        # 7. Intro Hook Text (First 2.5s)
        if config.intro_text.strip():
            escaped_intro = escape_drawtext_text(config.intro_text.strip())
            next_node = "[v_intro]"
            v_filters.append(
                f"{current_node}drawtext=text='{escaped_intro}'{font_arg}:"
                f"fontsize=46:fontcolor=white:x=(w-text_w)/2:y=240:"
                f"box=1:boxcolor=black@0.80:boxborderw=18:"
                f"enable='between(t,0,2.5)'{next_node}"
            )
            current_node = next_node

        # 8. Main Highlight Caption / Subtitle
        if config.caption_enabled and config.caption_text.strip():
            escaped_cap = escape_drawtext_text(config.caption_text.strip())
            next_node = "[v_cap]"
            v_filters.append(
                f"{current_node}drawtext=text='{escaped_cap}'{font_arg}:"
                f"fontsize=42:fontcolor=0xFFE600:x=(w-text_w)/2:y=h*0.78:"
                f"box=1:boxcolor=black@0.75:boxborderw=16{next_node}"
            )
            current_node = next_node

        # 9. Outro Call To Action Text (Last 2.5s)
        if config.outro_text.strip():
            escaped_outro = escape_drawtext_text(config.outro_text.strip())
            outro_start = max(0.0, effective_duration - 2.8)
            next_node = "[v_outro]"
            v_filters.append(
                f"{current_node}drawtext=text='{escaped_outro}'{font_arg}:"
                f"fontsize=32:fontcolor=white@0.9:x=(w-text_w)/2:y=h-130:"
                f"box=1:boxcolor=black@0.70:boxborderw=12:"
                f"enable='between(t,{outro_start:.2f},{effective_duration:.2f})'{next_node}"
            )
            current_node = next_node

        # Final video output node with strict fps and format
        v_filters.append(f"{current_node}fps={config.fps},format=yuv420p[v_out]")

        video_filtergraph = ";".join(v_filters)

        # Audio filtergraph
        audio_filtergraph = None
        if has_audio:
            a_filters: list[str] = []
            if config.slow_motion:
                a_filters.append("atempo=0.5")
            if abs(config.audio_gain - 1.0) > 0.01:
                a_filters.append(f"volume={config.audio_gain:.2f}")
            if a_filters:
                audio_filtergraph = f"[0:a]{','.join(a_filters)}[a_out]"
            else:
                audio_filtergraph = "[0:a]aformat=sample_rates=44100:channel_layouts=stereo[a_out]"

        return video_filtergraph, audio_filtergraph

    async def render_short(
        self,
        config: ShortRenderConfig,
        progress_callback: Optional[Callable[[float], None]] = None,
    ) -> str:
        """
        Renders the vertical short using FFmpeg.
        Uses NVENC if available and falls back to libx264 on error.
        Returns the encoder name used.
        """
        config.output_path.parent.mkdir(parents=True, exist_ok=True)
        meta = probe_video(config.input_path)
        
        duration = max(1.0, config.end_time - config.start_time)
        effective_duration = duration * 2.0 if config.slow_motion else duration

        v_filter, a_filter = self.build_filtergraph(config, meta.has_audio)

        encoder_name, enc_flags = self.hardware.get_recommended_encoder(config.encoder_preference)

        # Assemble complex filter string
        complex_filter = v_filter
        if a_filter:
            complex_filter += f";{a_filter}"

        # Base command builder
        def assemble_cmd(chosen_enc_flags: list[str]) -> list[str]:
            cmd = [
                "ffmpeg",
                "-y",
                "-ss", f"{config.start_time:.3f}",
                "-t", f"{duration:.3f}",
                "-i", str(config.input_path),
                "-filter_complex", complex_filter,
                "-map", "[v_out]",
            ]

            if meta.has_audio:
                cmd.extend(["-map", "[a_out]", "-c:a", "aac", "-b:a", "192k"])
            else:
                # Provide a silent audio stream so mobile Shorts players don't glitch
                cmd.extend([
                    "-f", "lavfi",
                    "-i", f"anullsrc=r=44100:cl=stereo",
                    "-map", "1:a",
                    "-c:a", "aac",
                    "-b:a", "96k",
                    "-shortest"
                ])

            cmd.extend(chosen_enc_flags)
            cmd.extend([
                "-movflags", "+faststart",
                "-progress", "pipe:1",
                str(config.output_path)
            ])
            return cmd

        # Try NVENC first, fallback to libx264 if needed
        encoders_to_try = [(encoder_name, enc_flags)]
        if encoder_name != "libx264":
            cpu_name, cpu_flags = self.hardware.get_recommended_encoder("cpu")
            encoders_to_try.append((cpu_name, cpu_flags))

        last_error = ""
        for enc_name, flags in encoders_to_try:
            cmd = assemble_cmd(flags)
            logger.info(f"Starting render with encoder {enc_name} on {config.output_path.name}")

            try:
                process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )

                # Monitor progress
                while True:
                    line = await process.stdout.readline()
                    if not line:
                        break
                    line_str = line.decode("utf-8", errors="ignore").strip()
                    if line_str.startswith("out_time_us="):
                        try:
                            val = line_str.split("=")[1]
                            out_us = float(val)
                            total_us = effective_duration * 1_000_000
                            pct = min(99.0, max(0.0, (out_us / total_us) * 100.0))
                            if progress_callback:
                                progress_callback(round(pct, 1))
                        except Exception:
                            pass

                _, stderr = await process.communicate()

                if process.returncode == 0:
                    if progress_callback:
                        progress_callback(100.0)
                    logger.info(f"Render completed successfully with {enc_name}")
                    return enc_name
                else:
                    err_msg = stderr.decode("utf-8", errors="ignore")
                    logger.warning(f"Render failed with {enc_name}: {err_msg[:300]}")
                    last_error = err_msg

            except Exception as e:
                logger.warning(f"Exception during render with {enc_name}: {e}")
                last_error = str(e)

        # If all encoders failed
        raise RuntimeError(f"Rendering failed: {last_error[:400]}")


video_processor = VideoProcessor()
