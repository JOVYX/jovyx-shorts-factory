import json
import logging
import os
import subprocess
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)


class VideoMetadata:
    def __init__(
        self,
        duration: float,
        width: int,
        height: int,
        fps: float,
        codec_name: str,
        audio_codec: str,
        has_audio: bool,
        file_size: int,
        rotation: int = 0,
        raw_info: Optional[dict[str, Any]] = None,
    ):
        self.duration = duration
        self.width = width
        self.height = height
        self.fps = fps
        self.codec_name = codec_name
        self.audio_codec = audio_codec
        self.has_audio = has_audio
        self.file_size = file_size
        self.rotation = rotation
        self.raw_info = raw_info or {}

    def to_dict(self) -> dict[str, Any]:
        return {
            "duration": round(self.duration, 2),
            "width": self.width,
            "height": self.height,
            "fps": round(self.fps, 2),
            "codec_name": self.codec_name,
            "audio_codec": self.audio_codec,
            "has_audio": self.has_audio,
            "file_size": self.file_size,
            "rotation": self.rotation,
        }


def parse_fps(fps_str: str) -> float:
    """Safely parse frame rate fraction like '60/1' or '60000/1001'."""
    try:
        if "/" in fps_str:
            num, den = fps_str.split("/")
            den_val = float(den)
            return float(num) / den_val if den_val != 0 else 30.0
        return float(fps_str)
    except Exception:
        return 30.0


def probe_video(filepath: str | Path) -> VideoMetadata:
    """
    Inspects video file metadata using ffprobe.
    Validates file existence and avoids shell injection by using argument lists.
    """
    path = Path(filepath).resolve()
    if not path.exists():
        raise FileNotFoundError(f"Video file not found at: {path}")
    if not path.is_file():
        raise ValueError(f"Path is not a regular file: {path}")

    file_size = path.stat().st_size
    if file_size == 0:
        raise ValueError(f"Video file is empty: {path}")

    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_format",
        "-show_streams",
        "-of", "json",
        str(path)
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(result.stdout)
    except subprocess.CalledProcessError as e:
        error_msg = e.stderr.strip() if e.stderr else str(e)
        logger.error(f"FFprobe failed on {path}: {error_msg}")
        raise RuntimeError(f"FFprobe could not read video metadata: {error_msg}")
    except json.JSONDecodeError as e:
        logger.error(f"Failed to decode FFprobe output: {e}")
        raise RuntimeError("Invalid ffprobe response")

    streams = data.get("streams", [])
    format_info = data.get("format", {})

    video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)

    if not video_stream:
        raise ValueError(f"No video stream found in {path.name}")

    # Determine duration
    duration = 0.0
    if "duration" in video_stream:
        try:
            duration = float(video_stream["duration"])
        except (ValueError, TypeError):
            pass
    if duration <= 0 and "duration" in format_info:
        try:
            duration = float(format_info["duration"])
        except (ValueError, TypeError):
            pass

    width = int(video_stream.get("width", 0))
    height = int(video_stream.get("height", 0))
    codec_name = str(video_stream.get("codec_name", ""))
    
    fps_raw = video_stream.get("r_frame_rate", video_stream.get("avg_frame_rate", "30/1"))
    fps = parse_fps(fps_raw)

    # Detect rotation metadata (common on iPhone recordings)
    rotation = 0
    side_data = video_stream.get("side_data_list", [])
    for sd in side_data:
        if "rotation" in sd:
            rotation = int(sd["rotation"])
            break
    tags = video_stream.get("tags", {})
    if not rotation and "rotate" in tags:
        try:
            rotation = int(tags["rotate"])
        except ValueError:
            pass

    # If rotated 90 or 270, adjust perceived width and height
    if abs(rotation) in (90, 270):
        width, height = height, width

    has_audio = audio_stream is not None
    audio_codec = str(audio_stream.get("codec_name", "")) if audio_stream else ""

    return VideoMetadata(
        duration=duration,
        width=width,
        height=height,
        fps=fps,
        codec_name=codec_name,
        audio_codec=audio_codec,
        has_audio=has_audio,
        file_size=file_size,
        rotation=rotation,
        raw_info=data
    )
