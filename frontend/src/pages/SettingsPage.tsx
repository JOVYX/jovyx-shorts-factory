import React, { useEffect, useState } from 'react'
import {
  Settings,
  Cpu,
  Save,
  Check,
  Key,
  Folder,
  Layers,
  Sparkles,
  HardDrive,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import { YoutubeIcon } from '../components/YoutubeIcon'
import { api } from '../api/client'
import { AppSettings, HardwareStatus } from '../types'

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [hardware, setHardware] = useState<HardwareStatus | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Form states
  const [resolution, setResolution] = useState<string>('1080x1920')
  const [fps, setFps] = useState<number>(60)
  const [clipDuration, setClipDuration] = useState<number>(30)
  const [sensitivity, setSensitivity] = useState<number>(0.35)
  const [encoderPref, setEncoderPref] = useState<string>('auto')
  const [aiProvider, setAiProvider] = useState<string>('mock')
  const [clientId, setClientId] = useState<string>('')
  const [clientSecret, setClientSecret] = useState<string>('')

  const loadSettings = async () => {
    try {
      setLoading(true)
      const [s, h] = await Promise.all([api.getSettings(), api.getHardware()])
      setSettings(s)
      setHardware(h)
      setResolution(s.output_resolution)
      setFps(s.output_fps)
      setClipDuration(s.default_clip_duration)
      setSensitivity(s.highlight_sensitivity)
      setEncoderPref(s.encoder_preference)
      setAiProvider(s.ai_provider)
    } catch (err: any) {
      setError(err.message || 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      const payload: any = {
        output_resolution: resolution,
        output_fps: fps,
        default_clip_duration: clipDuration,
        highlight_sensitivity: sensitivity,
        encoder_preference: encoderPref,
        ai_provider: aiProvider,
      }
      if (clientId.trim()) payload.youtube_client_id = clientId.trim()
      if (clientSecret.trim()) payload.youtube_client_secret = clientSecret.trim()

      const updated = await api.updateSettings(payload)
      setSettings(updated)
      setMessage('Settings saved successfully!')
      setClientId('')
      setClientSecret('')
      setTimeout(() => setMessage(null), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to update settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">
            <Settings size={28} color="var(--accent-green)" />
            Settings & System Engine
          </h2>
          <p className="page-description">
            Encoder configuration, output profiles, AI metadata provider, and YouTube API credentials.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={loadSettings}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {message && (
        <div style={{ padding: '14px', background: 'rgba(0, 240, 118, 0.15)', color: 'var(--accent-green)', borderRadius: 'var(--radius-md)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Check size={18} />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div style={{ padding: '14px', background: 'rgba(255, 77, 77, 0.12)', color: 'var(--accent-crimson)', borderRadius: 'var(--radius-md)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '24px', marginBottom: '28px' }}>
        {/* Hardware & Video Output Configuration */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={20} color="var(--accent-green)" /> Video Rendering & Hardware Acceleration
          </h3>

          <div className="form-group">
            <label className="form-label">Hardware Encoder</label>
            <select
              className="form-select"
              value={encoderPref}
              onChange={(e) => setEncoderPref(e.target.value)}
            >
              <option value="auto">
                Auto-Detect (Recommended: {hardware?.nvenc_available ? 'RTX 4050 NVENC' : 'libx264'})
              </option>
              <option value="nvenc">Force NVIDIA NVENC (h264_nvenc)</option>
              <option value="cpu">Force CPU Software Encoding (libx264)</option>
            </select>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              GPU: {hardware?.gpu_name || 'NVIDIA RTX 4050'} • VRAM: {hardware?.vram_total_mb || 6141} MB
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Default Output Resolution</label>
              <select
                className="form-select"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
              >
                <option value="1080x1920">1080x1920 (Full HD Vertical)</option>
                <option value="720x1280">720x1280 (Fast 720p)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Default Frame Rate</label>
              <select
                className="form-select"
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
              >
                <option value="60">60 FPS (Ultra Smooth Gameplay)</option>
                <option value="30">30 FPS (Standard)</option>
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              Default Clip Duration: <strong style={{ color: 'var(--accent-green)' }}>{clipDuration}s</strong>
            </label>
            <input
              type="range"
              min="10"
              max="60"
              step="5"
              value={clipDuration}
              onChange={(e) => setClipDuration(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-green)' }}
            />
          </div>
        </div>

        {/* AI & Automation Engine */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} color="var(--accent-cyan)" /> AI & Automation Engine
          </h3>

          <div className="form-group">
            <label className="form-label">AI Metadata & Vision Provider</label>
            <select
              className="form-select"
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value)}
            >
              <option value="mock">Local Smart Heuristics (Zero API keys, fast & private)</option>
              <option value="openai">OpenAI (GPT-4o mini)</option>
              <option value="gemini">Google Gemini 1.5 Flash</option>
            </select>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Generates high-CTR eFootball YouTube Shorts titles, viral descriptions, and trending tags.
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              Default Highlight Detection Sensitivity:{' '}
              <strong style={{ color: 'var(--accent-cyan)' }}>{Math.round(sensitivity * 100)}%</strong>
            </label>
            <input
              type="range"
              min="0.1"
              max="0.8"
              step="0.05"
              value={sensitivity}
              onChange={(e) => setSensitivity(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
            />
          </div>
        </div>
      </div>

      {/* YouTube Data API v3 OAuth Settings */}
      <div className="glass-card" style={{ marginBottom: '28px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <YoutubeIcon size={20} color="#ef4444" /> YouTube Data API v3 Credentials
        </h3>

        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '18px', lineHeight: '1.6' }}>
          To enable YouTube private uploads, create an <strong>OAuth 2.0 Web Application</strong> in your{' '}
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noreferrer"
            style={{ color: '#38bdf8' }}
          >
            Google Cloud Console
          </a>
          . Enter the Client ID and Secret below. Authorized redirect URI is:{' '}
          <code style={{ background: 'var(--bg-base)', padding: '2px 6px', borderRadius: '4px', color: 'var(--accent-green)' }}>
            http://localhost:8000/api/publishing/youtube/callback
          </code>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              Client ID {settings?.youtube_client_id_configured && '(Configured)'}
            </label>
            <input
              className="form-input"
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder={settings?.youtube_client_id_configured ? '••••••••••••••••.apps.googleusercontent.com' : 'Enter Client ID'}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Client Secret</label>
            <input
              className="form-input"
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="Enter Client Secret"
            />
          </div>
        </div>
      </div>

      {/* Storage Directories Overview */}
      <div className="glass-card" style={{ marginBottom: '28px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <HardDrive size={20} color="var(--accent-green)" /> Managed Storage Paths (Arch Linux)
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Original Recordings:</span>
            <span>{settings?.storage_dir}/originals</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Rendered Shorts:</span>
            <span>{settings?.output_dir}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Finished MP4 Exports:</span>
            <span>{settings?.export_dir}</span>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
        <Save size={18} /> {saving ? 'Saving Settings...' : 'Save Configuration'}
      </button>
    </div>
  )
}
