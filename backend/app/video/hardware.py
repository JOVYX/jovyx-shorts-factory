import json
import logging
import shutil
import subprocess
from functools import lru_cache

logger = logging.getLogger(__name__)


class HardwareInfo:
    def __init__(self):
        self.nvenc_available = False
        self.gpu_name = None
        self.vram_total_mb = None
        self.vram_used_mb = None
        self.ffmpeg_version = "Unknown"
        self.cuda_detected = False
        self._detect()

    def _detect(self):
        # 1. Detect ffmpeg version
        try:
            res = subprocess.run(
                ["ffmpeg", "-version"],
                capture_output=True,
                text=True,
                check=False
            )
            if res.returncode == 0:
                first_line = res.stdout.splitlines()[0] if res.stdout else "ffmpeg available"
                self.ffmpeg_version = first_line.split("Copyright")[0].strip()
        except Exception as e:
            logger.warning(f"Failed to detect ffmpeg: {e}")
            self.ffmpeg_version = "Unavailable"

        # 2. Check if ffmpeg has h264_nvenc encoder
        try:
            res = subprocess.run(
                ["ffmpeg", "-encoders"],
                capture_output=True,
                text=True,
                check=False
            )
            if res.returncode == 0 and "h264_nvenc" in res.stdout:
                self.nvenc_available = True
        except Exception as e:
            logger.warning(f"Failed to check ffmpeg encoders: {e}")

        # 3. Detect NVIDIA GPU via nvidia-smi
        if shutil.which("nvidia-smi"):
            try:
                res = subprocess.run(
                    [
                        "nvidia-smi",
                        "--query-gpu=name,memory.total,memory.used",
                        "--format=csv,noheader,nounits",
                    ],
                    capture_output=True,
                    text=True,
                    check=False
                )
                if res.returncode == 0 and res.stdout.strip():
                    line = res.stdout.strip().splitlines()[0]
                    parts = [p.strip() for p in line.split(",")]
                    if len(parts) >= 3:
                        self.gpu_name = parts[0]
                        self.vram_total_mb = int(parts[1])
                        self.vram_used_mb = int(parts[2])
                        self.cuda_detected = True
            except Exception as e:
                logger.warning(f"Failed to query nvidia-smi: {e}")

    def get_recommended_encoder(self, preference: str = "auto") -> tuple[str, list[str]]:
        """
        Returns (encoder_name, encoder_flags).
        Safe fallback to libx264 if NVENC is unavailable or preference is cpu.
        """
        if preference == "cpu" or not self.nvenc_available:
            return "libx264", ["-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p"]
        
        # NVENC configuration tuned for RTX 4050 6GB VRAM (high quality, low VRAM footprint)
        return "h264_nvenc", [
            "-c:v", "h264_nvenc",
            "-preset", "p4",           # balanced high quality / fast
            "-cq", "20",               # Constant quality
            "-b:v", "12M",             # High bitrate for 1080x1920 @ 60fps Shorts
            "-maxrate", "16M",
            "-bufsize", "24M",
            "-pix_fmt", "yuv420p"
        ]


@lru_cache(maxsize=1)
def get_hardware_info() -> HardwareInfo:
    return HardwareInfo()
