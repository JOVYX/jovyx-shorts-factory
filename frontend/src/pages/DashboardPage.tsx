import React, { useEffect, useState } from 'react'
import {
  Film,
  Sparkles,
  Scissors,
  CheckSquare,
  AlertTriangle,
  Play,
  Upload,
  Cpu,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'
import { YoutubeIcon } from '../components/YoutubeIcon'
import { api } from '../api/client'
import { DashboardStats, Recording, Short } from '../types'
import { VideoModal } from '../components/VideoModal'

interface DashboardPageProps {
  onNavigate: (tab: any, params?: any) => void
  onOpenImportModal: () => void
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onOpenImportModal,
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [previewVideo, setPreviewVideo] = useState<{ url: string; title: string; isVertical: boolean } | null>(null)

  const loadStats = async () => {
    try {
      setLoading(true)
      const data = await api.getDashboardStats()
      setStats(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
    const timer = setInterval(loadStats, 5000)
    return () => clearInterval(timer)
  }, [])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">
            Dashboard
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--accent-green)', background: 'rgba(0, 240, 118, 0.1)', padding: '4px 10px', borderRadius: '12px' }}>
              Local-First Hub
            </span>
          </h2>
          <p className="page-description">
            Automated eFootball Mobile clip extraction, 9:16 Shorts rendering, and publishing suite.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={loadStats} title="Refresh metrics">
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={onOpenImportModal}>
            <Upload size={16} /> Import Recording
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '14px', background: 'rgba(255, 77, 77, 0.12)', color: 'var(--accent-crimson)', borderRadius: 'var(--radius-md)', marginBottom: '24px' }}>
          {error}
        </div>
      )}

      {/* Hardware Status Banner */}
      <div
        className="glass-card"
        style={{
          marginBottom: '28px',
          background: 'linear-gradient(135deg, rgba(18, 23, 34, 0.8) 0%, rgba(24, 31, 46, 0.4) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(0, 240, 118, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-green)',
            }}
          >
            <Cpu size={24} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{stats?.hardware.gpu_name || 'NVIDIA GeForce RTX 4050 Laptop GPU'}</span>
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: stats?.hardware.nvenc_available ? 'rgba(0, 240, 118, 0.2)' : 'rgba(255, 193, 7, 0.2)',
                  color: stats?.hardware.nvenc_available ? 'var(--accent-green)' : '#ffc107',
                  fontWeight: 700,
                }}
              >
                {stats?.hardware.nvenc_available ? 'NVENC Active' : 'CPU libx264'}
              </span>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Hardware acceleration: 1080x1920 60fps fast encoding • VRAM:{' '}
              <strong style={{ color: 'var(--text-main)' }}>
                {stats?.hardware.vram_used_mb || 4} MB / {stats?.hardware.vram_total_mb || 6141} MB
              </strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <span>FFmpeg: {stats?.hardware.ffmpeg_version.slice(0, 26) || 'Available'}</span>
        </div>
      </div>

      {/* Key Metric Counters */}
      <div className="stats-grid">
        <div className="stat-card" onClick={() => onNavigate('library')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
            <Film size={20} />
          </div>
          <div className="stat-value">{stats?.total_recordings || 0}</div>
          <div className="stat-label">Imported Recordings</div>
        </div>

        <div className="stat-card" onClick={() => onNavigate('library')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon" style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' }}>
            <RefreshCw size={20} />
          </div>
          <div className="stat-value">{stats?.waiting_processing || 0}</div>
          <div className="stat-label">Awaiting Highlight Scan</div>
        </div>

        <div className="stat-card" onClick={() => onNavigate('highlights')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon" style={{ background: 'rgba(0, 240, 118, 0.15)', color: 'var(--accent-green)' }}>
            <Sparkles size={20} />
          </div>
          <div className="stat-value">{stats?.detected_highlights || 0}</div>
          <div className="stat-label">Detected Highlights</div>
        </div>

        <div className="stat-card" onClick={() => onNavigate('review')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
            <CheckSquare size={20} />
          </div>
          <div className="stat-value">{stats?.shorts_ready_review || 0}</div>
          <div className="stat-label">Shorts Ready for Review</div>
        </div>

        <div className="stat-card" onClick={() => onNavigate('publishing')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
            <YoutubeIcon size={20} />
          </div>
          <div className="stat-value">{stats?.published_videos || 0}</div>
          <div className="stat-label">Published to YouTube</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e' }}>
            <AlertTriangle size={20} />
          </div>
          <div className="stat-value">{stats?.processing_errors || 0}</div>
          <div className="stat-label">Processing Errors</div>
        </div>
      </div>

      {/* Quick Workflow Action Banners */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="glass-card glass-card-interactive" onClick={() => onNavigate('library')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Film size={20} color="var(--accent-green)" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>1. Library & Scans</h3>
            </div>
            <ArrowRight size={18} color="var(--text-muted)" />
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            Import iPhone eFootball screen recordings and run automated motion & visual cut detection.
          </p>
        </div>

        <div className="glass-card glass-card-interactive" onClick={() => onNavigate('editor')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Scissors size={20} color="var(--accent-cyan)" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>2. 9:16 Shorts Editor</h3>
            </div>
            <ArrowRight size={18} color="var(--text-muted)" />
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            Convert 16:9 mobile recordings to 9:16 with Gaussian-blurred backdrop, branding, and captions.
          </p>
        </div>

        <div className="glass-card glass-card-interactive" onClick={() => onNavigate('review')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckSquare size={20} color="#a855f7" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>3. Review & Export</h3>
            </div>
            <ArrowRight size={18} color="var(--text-muted)" />
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            Inspect rendered Shorts, approve clips, export finished MP4s, or upload private drafts to YouTube.
          </p>
        </div>
      </div>

      {/* Recent Shorts & Recordings Lists */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '24px' }}>
        {/* Recent Rendered Shorts */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Scissors size={18} color="var(--accent-cyan)" /> Recent Shorts
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('review')}>
              View Queue
            </button>
          </div>

          {stats?.recent_shorts.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No shorts generated yet. Select a recording to create your first Short!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {stats?.recent_shorts.map((short) => (
                <div
                  key={short.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '44px',
                        height: '56px',
                        borderRadius: '6px',
                        background: '#000',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: short.video_url ? 'pointer' : 'default',
                      }}
                      onClick={() =>
                        short.video_url &&
                        setPreviewVideo({ url: short.video_url, title: short.title, isVertical: true })
                      }
                    >
                      {short.thumbnail_url ? (
                        <img src={short.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Play size={18} color="var(--text-muted)" />
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{short.title}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {formatDuration(short.duration)} • {short.layout} • {short.fps} FPS
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className={`status-pill ${short.status}`}>{short.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Imported Recordings */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Film size={18} color="var(--accent-green)" /> Recent Recordings
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('library')}>
              View Library
            </button>
          </div>

          {stats?.recent_recordings.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No recordings imported yet. Click "Import Recording" above to add your gameplay!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {stats?.recent_recordings.map((rec) => (
                <div
                  key={rec.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '64px',
                        height: '38px',
                        borderRadius: '4px',
                        background: '#000',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                      onClick={() =>
                        setPreviewVideo({
                          url: `/api/library/recordings/${rec.id}/stream`,
                          title: rec.filename,
                          isVertical: false,
                        })
                      }
                    >
                      {rec.thumbnail_url ? (
                        <img src={rec.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Play size={16} color="var(--text-muted)" />
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{rec.filename}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {formatDuration(rec.duration)} • {rec.width}x{rec.height} • {rec.fps} fps
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className={`status-pill ${rec.status}`}>{rec.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {previewVideo && (
        <VideoModal
          isOpen={true}
          title={previewVideo.title}
          videoUrl={previewVideo.url}
          isVertical={previewVideo.isVertical}
          onClose={() => setPreviewVideo(null)}
        />
      )}
    </div>
  )
}
