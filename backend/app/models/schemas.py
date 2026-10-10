from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field


# ---------------- Recording Schemas ----------------
class RecordingImportRequest(BaseModel):
    filepath: str = Field(..., description="Absolute path to the video file on host system")
    copy_to_library: bool = Field(True, description="Whether to copy to managed storage or reference in-place")


class RecordingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    filename: str
    filepath: str
    file_size: int
    duration: float
    width: int
    height: int
    fps: float
    codec_name: str
    audio_codec: str
    has_audio: bool
    status: str
    error_message: Optional[str] = None
    thumbnail_url: Optional[str] = None
    imported_at: datetime
    candidate_clips_count: int = 0


# ---------------- Candidate Clip Schemas ----------------
class CandidateClipResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    recording_id: str
    start_time: float
    end_time: float
    duration: float
    score: float
    rank: int
    thumbnail_url: Optional[str] = None
    user_feedback: Optional[str] = None
    detection_method: str
    notes: Optional[str] = None
    created_at: datetime


class CandidateClipFeedbackRequest(BaseModel):
    user_feedback: Optional[str] = Field(None, description="'good', 'bad', or null")


class HighlightScanRequest(BaseModel):
    clip_duration: Optional[float] = Field(None, ge=5.0, le=90.0, description="Target clip duration in seconds")
    sensitivity: Optional[float] = Field(None, ge=0.05, le=0.95, description="Scene detection threshold")
    max_candidates: int = Field(8, ge=1, le=25, description="Max candidate clips to extract")


# ---------------- Shorts Schemas ----------------
class ShortCreateRequest(BaseModel):
    recording_id: str
    candidate_clip_id: Optional[str] = None
    preset_id: Optional[str] = None
    title: str = Field("eFootball Mobile Highlight", max_length=255)
    description: str = Field("#shorts #efootball #efootballmobile #gaming")
    start_time: float = Field(0.0, ge=0.0)
    end_time: float = Field(15.0, gt=0.0)
    layout: str = Field("blurred_background", description="blurred_background, center_crop, smart_crop, dual_stacked")
    
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


class ShortUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    layout: Optional[str] = None
    preset_id: Optional[str] = None
    branding_enabled: Optional[bool] = None
    branding_text: Optional[str] = None
    caption_enabled: Optional[bool] = None
    caption_text: Optional[str] = None
    slow_motion: Optional[bool] = None
    zoom_punch: Optional[bool] = None
    audio_gain: Optional[float] = None
    intro_text: Optional[str] = None
    outro_text: Optional[str] = None
    color_grade: Optional[str] = None
    vignette: Optional[bool] = None
    status: Optional[str] = None


class ShortResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    recording_id: str
    recording_filename: Optional[str] = None
    candidate_clip_id: Optional[str] = None
    preset_id: Optional[str] = None
    title: str
    description: str
    start_time: float
    end_time: float
    duration: float
    layout: str
    status: str
    render_progress: float
    output_path: Optional[str] = None
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    width: int
    height: int
    fps: int
    branding_enabled: bool
    branding_text: str
    caption_enabled: bool
    caption_text: str
    slow_motion: bool
    zoom_punch: bool
    audio_gain: float
    intro_text: str
    outro_text: str
    color_grade: str
    vignette: bool
    encoder_used: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ---------------- Preset Schemas ----------------
class PresetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str
    layout: str
    branding_enabled: bool
    branding_text: str
    badge_style: str
    vignette: bool
    color_grade: str
    slow_motion: bool
    zoom_punch: bool
    caption_default: str
    is_custom: bool


class PresetCreateUpdateRequest(BaseModel):
    name: str
    description: str
    layout: str = "blurred_background"
    branding_enabled: bool = True
    branding_text: str = "JOVYX | eFootball"
    badge_style: str = "fut_card"
    vignette: bool = False
    color_grade: str = "vibrant"
    slow_motion: bool = False
    zoom_punch: bool = False
    caption_default: str = ""


# ---------------- Publishing Schemas ----------------
class YouTubePublishRequest(BaseModel):
    short_id: str
    title: Optional[str] = None
    description: Optional[str] = None
    privacy_status: str = Field("private", description="Uploads initially must be private")
    tags: list[str] = ["eFootball", "eFootballMobile", "Shorts", "Gaming", "Jovyx"]


class PublishingRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    short_id: str
    platform: str
    video_id: Optional[str] = None
    video_url: Optional[str] = None
    privacy_status: str
    status: str
    upload_progress: float
    error_message: Optional[str] = None
    created_at: datetime
    published_at: Optional[datetime] = None


# ---------------- Settings & System Schemas ----------------
class AppSettingsResponse(BaseModel):
    output_resolution: str
    output_fps: int
    default_clip_duration: int
    highlight_sensitivity: float
    encoder_preference: str
    ai_provider: str
    storage_dir: str
    output_dir: str
    export_dir: str
    youtube_authenticated: bool
    youtube_channel_title: Optional[str] = None
    youtube_client_id_configured: bool


class AppSettingsUpdateRequest(BaseModel):
    output_resolution: Optional[str] = None
    output_fps: Optional[int] = None
    default_clip_duration: Optional[int] = None
    highlight_sensitivity: Optional[float] = None
    encoder_preference: Optional[str] = None
    ai_provider: Optional[str] = None
    youtube_client_id: Optional[str] = None
    youtube_client_secret: Optional[str] = None


class HardwareStatusResponse(BaseModel):
    nvenc_available: bool
    encoder: str
    gpu_name: Optional[str] = None
    vram_total_mb: Optional[int] = None
    vram_used_mb: Optional[int] = None
    ffmpeg_version: str
    cuda_detected: bool


class DashboardStatsResponse(BaseModel):
    total_recordings: int
    waiting_processing: int
    detected_highlights: int
    shorts_ready_review: int
    published_videos: int
    processing_errors: int
    hardware: HardwareStatusResponse
    recent_shorts: list[ShortResponse]
    recent_recordings: list[RecordingResponse]


# ---------------- Background Job Schemas ----------------
class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    job_type: str
    target_id: Optional[str] = None
    status: str
    progress: float
    stage: str
    error_message: Optional[str] = None
    result_data: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
