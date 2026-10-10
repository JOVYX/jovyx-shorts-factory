import datetime

def utc_now():
    return datetime.datetime.now(datetime.timezone.utc)
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database.db import Base


class Recording(Base):
    __tablename__ = "recordings"

    id = Column(String(36), primary_key=True)
    filename = Column(String(255), nullable=False)
    filepath = Column(String(1024), nullable=False)
    file_size = Column(Integer, default=0)
    duration = Column(Float, default=0.0)
    width = Column(Integer, default=0)
    height = Column(Integer, default=0)
    fps = Column(Float, default=0.0)
    codec_name = Column(String(64), default="")
    audio_codec = Column(String(64), default="")
    has_audio = Column(Boolean, default=True)
    status = Column(String(32), default="imported")  # imported, analyzing, analyzed, error
    error_message = Column(Text, nullable=True)
    thumbnail_path = Column(String(1024), nullable=True)
    imported_at = Column(DateTime, default=utc_now)

    # Relationships
    candidate_clips = relationship("CandidateClip", back_populates="recording", cascade="all, delete-orphan")
    shorts = relationship("Short", back_populates="recording", cascade="all, delete-orphan")


class CandidateClip(Base):
    __tablename__ = "candidate_clips"

    id = Column(String(36), primary_key=True)
    recording_id = Column(String(36), ForeignKey("recordings.id", ondelete="CASCADE"), nullable=False)
    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=False)
    duration = Column(Float, nullable=False)
    score = Column(Float, default=0.0)
    rank = Column(Integer, default=1)
    thumbnail_path = Column(String(1024), nullable=True)
    user_feedback = Column(String(16), nullable=True)  # 'good', 'bad', or None
    detection_method = Column(String(64), default="scene_change")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    recording = relationship("Recording", back_populates="candidate_clips")


class Short(Base):
    __tablename__ = "shorts"

    id = Column(String(36), primary_key=True)
    recording_id = Column(String(36), ForeignKey("recordings.id", ondelete="CASCADE"), nullable=False)
    candidate_clip_id = Column(String(36), nullable=True)
    preset_id = Column(String(64), nullable=True)
    
    title = Column(String(255), nullable=False, default="eFootball Mobile Highlight")
    description = Column(Text, default="#shorts #efootball #efootballmobile #gaming")
    
    start_time = Column(Float, nullable=False, default=0.0)
    end_time = Column(Float, nullable=False, default=15.0)
    layout = Column(String(32), default="blurred_background")  # blurred_background, center_crop, smart_crop, dual_stacked
    
    status = Column(String(32), default="draft")  # draft, rendering, rendered, approved, rejected, uploading, published, error
    render_progress = Column(Float, default=0.0)
    output_path = Column(String(1024), nullable=True)
    thumbnail_path = Column(String(1024), nullable=True)
    
    duration = Column(Float, default=15.0)
    width = Column(Integer, default=1080)
    height = Column(Integer, default=1920)
    fps = Column(Integer, default=60)
    
    branding_enabled = Column(Boolean, default=True)
    branding_text = Column(String(64), default="JOVYX | eFootball")
    caption_enabled = Column(Boolean, default=False)
    caption_text = Column(String(255), default="")
    slow_motion = Column(Boolean, default=False)
    zoom_punch = Column(Boolean, default=False)
    audio_gain = Column(Float, default=1.0)
    intro_text = Column(String(128), default="")
    outro_text = Column(String(128), default="Follow for more eFootball Highlights")
    color_grade = Column(String(32), default="vibrant")  # vibrant, cinematic, natural
    vignette = Column(Boolean, default=False)
    
    encoder_used = Column(String(32), nullable=True)
    error_message = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    recording = relationship("Recording", back_populates="shorts")
    publishing_records = relationship("PublishingRecord", back_populates="short", cascade="all, delete-orphan")


class Preset(Base):
    __tablename__ = "presets"

    id = Column(String(64), primary_key=True)
    name = Column(String(128), nullable=False)
    description = Column(Text, nullable=False)
    layout = Column(String(32), default="blurred_background")
    branding_enabled = Column(Boolean, default=True)
    branding_text = Column(String(64), default="JOVYX | eFootball")
    badge_style = Column(String(32), default="fut_card")
    vignette = Column(Boolean, default=False)
    color_grade = Column(String(32), default="vibrant")
    slow_motion = Column(Boolean, default=False)
    zoom_punch = Column(Boolean, default=False)
    caption_default = Column(String(255), default="")
    is_custom = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)


class PublishingRecord(Base):
    __tablename__ = "publishing_records"

    id = Column(String(36), primary_key=True)
    short_id = Column(String(36), ForeignKey("shorts.id", ondelete="CASCADE"), nullable=False)
    platform = Column(String(32), default="youtube")
    video_id = Column(String(64), nullable=True)
    video_url = Column(String(255), nullable=True)
    privacy_status = Column(String(16), default="private")  # private, unlisted, public
    status = Column(String(32), default="pending")  # pending, uploading, published, failed
    upload_progress = Column(Float, default=0.0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    published_at = Column(DateTime, nullable=True)

    short = relationship("Short", back_populates="publishing_records")


class OAuthToken(Base):
    __tablename__ = "oauth_tokens"

    id = Column(String(32), primary_key=True)  # e.g. "youtube"
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=True)
    token_uri = Column(String(255), default="https://oauth2.googleapis.com/token")
    client_id = Column(String(255), default="")
    client_secret = Column(String(255), default="")
    scopes = Column(Text, default="")
    expiry = Column(DateTime, nullable=True)
    channel_title = Column(String(255), nullable=True)
    channel_id = Column(String(64), nullable=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)


class JobRecord(Base):
    __tablename__ = "jobs"

    id = Column(String(64), primary_key=True)
    job_type = Column(String(32), nullable=False)  # highlight_scan, short_render, youtube_upload, style_analysis, auto_edit
    target_id = Column(String(64), nullable=True)  # recording_id, short_id, etc.
    status = Column(String(32), default="pending")  # pending, running, completed, failed, cancelled
    progress = Column(Float, default=0.0)  # 0.0 to 100.0
    stage = Column(String(128), default="Queued")
    error_message = Column(Text, nullable=True)
    result_data = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
