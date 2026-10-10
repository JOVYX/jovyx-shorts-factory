import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_BASE = BASE_DIR / "storage"

class Settings(BaseSettings):
    app_name: str = "Jovyx Shorts Factory"
    app_env: str = "development"
    debug: bool = True
    host: str = "0.0.0.0"
    port: int = 8000

    # Storage paths
    storage_dir: Path = STORAGE_BASE
    originals_dir: Path = STORAGE_BASE / "originals"
    thumbnails_dir: Path = STORAGE_BASE / "thumbnails"
    previews_dir: Path = STORAGE_BASE / "previews"
    renders_dir: Path = STORAGE_BASE / "renders"
    exports_dir: Path = STORAGE_BASE / "exports"

    # SQLite database
    database_url: str = f"sqlite+aiosqlite:///{STORAGE_BASE}/factory.db"

    # Supported video formats (common iPhone / screen recordings)
    supported_extensions: list[str] = [".mov", ".mp4", ".m4v", ".mkv", ".webm"]

    # Video defaults
    default_resolution: str = "1080x1920"
    default_fps: int = 60
    default_clip_duration: int = 30
    highlight_sensitivity: float = 0.35

    # Hardware acceleration: auto, nvenc, cpu
    encoder_preference: str = "auto"

    # AI Provider
    ai_provider: str = "mock"
    openai_api_key: str = ""
    gemini_api_key: str = ""

    # YouTube Data API
    youtube_client_id: str = ""
    youtube_client_secret: str = ""
    youtube_redirect_uri: str = "http://localhost:8000/api/publishing/youtube/callback"

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    def ensure_directories(self) -> None:
        """Ensure all storage folders exist."""
        for path in [
            self.storage_dir,
            self.originals_dir,
            self.thumbnails_dir,
            self.previews_dir,
            self.renders_dir,
            self.exports_dir,
        ]:
            path.mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_directories()
