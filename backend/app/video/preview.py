import logging
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)


def generate_thumbnail(
    video_path: str | Path,
    output_image_path: str | Path,
    timestamp_sec: float = 1.0,
    width: int = 480,
) -> Path:
    """
    Extract a representative JPEG frame using ffmpeg.
    Always uses argument lists to avoid shell injection.
    """
    v_path = Path(video_path).resolve()
    out_path = Path(output_image_path).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        "ffmpeg",
        "-y",
        "-ss", f"{max(0.0, timestamp_sec):.3f}",
        "-i", str(v_path),
        "-frames:v", "1",
        "-vf", f"scale={width}:-1",
        "-q:v", "2",
        str(out_path),
    ]

    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to generate thumbnail for {v_path.name}: {e.stderr}")
        raise RuntimeError(f"Thumbnail generation failed: {e.stderr}")

    return out_path


def generate_clip_preview(
    video_path: str | Path,
    output_preview_path: str | Path,
    start_time: float,
    duration: float = 5.0,
    width: int = 540,
) -> Path:
    """
    Extract a small preview proxy MP4 clip for quick web scrubbing.
    """
    v_path = Path(video_path).resolve()
    out_path = Path(output_preview_path).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        "ffmpeg",
        "-y",
        "-ss", f"{max(0.0, start_time):.3f}",
        "-t", f"{duration:.3f}",
        "-i", str(v_path),
        "-vf", f"scale={width}:-2",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "28",
        "-c:a", "aac",
        "-b:a", "96k",
        "-movflags", "+faststart",
        str(out_path),
    ]

    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to extract preview clip for {v_path.name}: {e.stderr}")
        raise RuntimeError(f"Preview clip extraction failed: {e.stderr}")

    return out_path
