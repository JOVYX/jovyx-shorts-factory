import {
  AppSettings,
  CandidateClip,
  DashboardStats,
  FileSystemBrowserResult,
  HardwareStatus,
  Job,
  Preset,
  PublishingRecord,
  Recording,
  Short,
} from '../types'

const BASE_URL = '/api'

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!res.ok) {
    let msg = `HTTP error ${res.status}`
    try {
      const err = await res.json()
      if (err.detail) msg = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail)
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
  return res.json()
}

export const api = {
  // Dashboard
  getDashboardStats: () => request<DashboardStats>('/dashboard/stats'),

  // Library
  getRecordings: () => request<Recording[]>('/library/recordings'),
  importRecording: (filepath: string, copy_to_library = true) =>
    request<Recording>('/library/import', {
      method: 'POST',
      body: JSON.stringify({ filepath, copy_to_library }),
    }),
  uploadRecording: async (file: File): Promise<Recording> => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${BASE_URL}/library/upload`, {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || `Upload failed with status ${res.status}`)
    }
    return res.json()
  },
  deleteRecording: (id: string) =>
    request<{ message: string }>(`/library/recordings/${id}`, { method: 'DELETE' }),

  // Highlights
  scanHighlights: (
    recordingId: string,
    opts?: { clip_duration?: number; sensitivity?: number; max_candidates?: number }
  ) =>
    request<{ message: string; task_id: string }>(`/highlights/scan/${recordingId}`, {
      method: 'POST',
      body: JSON.stringify(opts || {}),
    }),
  getCandidateClips: (recordingId: string) =>
    request<CandidateClip[]>(`/highlights/clips/${recordingId}`),
  submitFeedback: (clipId: string, user_feedback: 'good' | 'bad' | null) =>
    request<CandidateClip>(`/highlights/clips/${clipId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ user_feedback }),
    }),

  // Shorts
  getShorts: () => request<Short[]>('/shorts'),
  getShort: (id: string) => request<Short>(`/shorts/${id}`),
  createShort: (payload: Partial<Short> & { recording_id: string }) =>
    request<Short>('/shorts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateShort: (id: string, payload: Partial<Short>) =>
    request<Short>(`/shorts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  renderShort: (id: string) =>
    request<{ message: string; task_id: string }>(`/shorts/${id}/render`, {
      method: 'POST',
    }),
  setShortStatus: (id: string, status: string) =>
    request<Short>(`/shorts/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  exportShort: (id: string) =>
    request<{ message: string; export_filename: string; export_path: string; download_url: string }>(
      `/shorts/${id}/export`,
      { method: 'POST' }
    ),
  deleteShort: (id: string) =>
    request<{ message: string }>(`/shorts/${id}`, { method: 'DELETE' }),

  // Presets
  getPresets: () => request<Preset[]>('/presets'),
  updatePreset: (id: string, payload: Partial<Preset>) =>
    request<Preset>(`/presets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  createPreset: (payload: Partial<Preset>) =>
    request<Preset>('/presets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  analyzeReference: (payload: { recording_id?: string; filepath?: string; save_as_preset?: boolean }) =>
    request<{ profile: any; created_preset: Preset | null }>('/presets/analyze-reference', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Publishing
  getPublishingStatus: () =>
    request<{
      configured: boolean
      authenticated: boolean
      channel_title?: string | null
      channel_id?: string | null
      redirect_uri: string
    }>('/publishing/status'),
  getYouTubeAuthUrl: () => request<{ authorization_url: string }>('/publishing/youtube/auth-url'),
  publishToYouTube: (payload: { short_id: string; title?: string; description?: string }) =>
    request<PublishingRecord>('/publishing/youtube/upload', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getPublishingHistory: () => request<PublishingRecord[]>('/publishing/history'),

  // Settings
  getSettings: () => request<AppSettings>('/settings'),
  updateSettings: (payload: Partial<AppSettings> & { youtube_client_id?: string; youtube_client_secret?: string }) =>
    request<AppSettings>('/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  getHardware: () => request<HardwareStatus>('/settings/hardware'),
  generateMetadata: (preset_name: string, user_context = '') =>
    request<{ title: string; description: string; tags: string[] }>('/settings/generate-metadata', {
      method: 'POST',
      body: JSON.stringify({ preset_name, user_context }),
    }),

  // Jobs
  getJob: (jobId: string) => request<Job>(`/jobs/${jobId}`),
  getActiveJobs: () => request<Job[]>('/jobs/active'),
  cancelJob: (jobId: string) =>
    request<{ job_id: string; cancelled: boolean; message: string }>(`/jobs/${jobId}/cancel`, {
      method: 'POST',
    }),

  // System
  browseFilesystem: (path?: string) =>
    request<FileSystemBrowserResult>(`/system/browse${path ? `?path=${encodeURIComponent(path)}` : ''}`),
}

