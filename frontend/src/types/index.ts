export interface Recording {
  id: string
  filename: string
  filepath: string
  file_size: number
  duration: number
  width: number
  height: number
  fps: number
  codec_name: string
  audio_codec: string
  has_audio: boolean
  status: 'imported' | 'analyzing' | 'analyzed' | 'error'
  error_message?: string | null
  thumbnail_url?: string | null
  imported_at: string
  candidate_clips_count: number
}

export interface CandidateClip {
  id: string
  recording_id: string
  start_time: number
  end_time: number
  duration: number
  score: number
  rank: number
  thumbnail_url?: string | null
  user_feedback?: 'good' | 'bad' | null
  detection_method: string
  notes?: string | null
  created_at: string
}

export interface Short {
  id: string
  recording_id: string
  recording_filename?: string | null
  candidate_clip_id?: string | null
  preset_id?: string | null
  title: string
  description: string
  start_time: number
  end_time: number
  duration: number
  layout: 'blurred_background' | 'center_crop' | 'smart_crop' | 'dual_stacked'
  status: 'draft' | 'rendering' | 'rendered' | 'approved' | 'rejected' | 'uploading' | 'published' | 'error'
  render_progress: number
  output_path?: string | null
  video_url?: string | null
  thumbnail_url?: string | null
  width: number
  height: number
  fps: number
  branding_enabled: boolean
  branding_text: string
  caption_enabled: boolean
  caption_text: string
  slow_motion: boolean
  zoom_punch: boolean
  audio_gain: number
  intro_text: string
  outro_text: string
  color_grade: 'vibrant' | 'cinematic' | 'natural'
  vignette: boolean
  encoder_used?: string | null
  error_message?: string | null
  created_at: string
  updated_at: string
}

export interface Preset {
  id: string
  name: string
  description: string
  layout: string
  branding_enabled: boolean
  branding_text: string
  badge_style: string
  vignette: boolean
  color_grade: string
  slow_motion: boolean
  zoom_punch: boolean
  caption_default: string
  is_custom: boolean
}

export interface PublishingRecord {
  id: string
  short_id: string
  platform: string
  video_id?: string | null
  video_url?: string | null
  privacy_status: string
  status: 'pending' | 'uploading' | 'published' | 'failed'
  upload_progress: number
  error_message?: string | null
  created_at: string
  published_at?: string | null
}

export interface HardwareStatus {
  nvenc_available: boolean
  encoder: string
  gpu_name?: string | null
  vram_total_mb?: number | null
  vram_used_mb?: number | null
  ffmpeg_version: string
  cuda_detected: boolean
}

export interface DashboardStats {
  total_recordings: number
  waiting_processing: number
  detected_highlights: number
  shorts_ready_review: number
  published_videos: number
  processing_errors: number
  hardware: HardwareStatus
  recent_shorts: Short[]
  recent_recordings: Recording[]
}

export interface AppSettings {
  output_resolution: string
  output_fps: number
  default_clip_duration: number
  highlight_sensitivity: number
  encoder_preference: string
  ai_provider: string
  storage_dir: string
  output_dir: string
  export_dir: string
  youtube_authenticated: boolean
  youtube_channel_title?: string | null
  youtube_client_id_configured: boolean
}

export interface FileSystemBrowserResult {
  current_path: string
  parent_path?: string | null
  items: Array<{
    name: string
    path: string
    is_dir: boolean
    is_video: boolean
    size: number
  }>
}

export interface Job {
  id: string
  job_type: string
  target_id?: string | null
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  stage: string
  error_message?: string | null
  result_data?: string | null
  created_at: string
  started_at?: string | null
  completed_at?: string | null
}

