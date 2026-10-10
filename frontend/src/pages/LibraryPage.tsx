import React, { useEffect, useState } from 'react'
import {
  Film,
  Upload,
  Sparkles,
  Scissors,
  Trash2,
  Play,
  Clock,
  Maximize2,
  Calendar,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { api } from '../api/client'
import { Recording } from '../types'
import { VideoModal } from '../components/VideoModal'

interface LibraryPageProps {
  onOpenImportModal: () => void
  onSelectForHighlights: (recId: string) => void
  onSelectForEditor: (recId: string) => void
}

export const LibraryPage: React.FC<LibraryPageProps> = ({
  onOpenImportModal,
  onSelectForHighlights,
  onSelectForEditor,
}) => {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [previewVideo, setPreviewVideo] = useState<{ url: string; title: string } | null>(null)
  const [dragOver, setDragOver] = useState<boolean>(false)
  const [uploading, setUploading] = useState<boolean>(false)

  const loadRecordings = async () => {
    try {
      setLoading(true)
      const data = await api.getRecordings()
      setRecordings(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load library recordings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecordings()
  }, [])

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      try {
        setUploading(true)
        setError(null)
        await api.uploadRecording(file)
        await loadRecordings()
      } catch (err: any) {
        setError(err.message || 'Failed to upload video')
      } finally {
        setUploading(false)
      }
    }
  }

  const handleDelete = async (recId: string) => {
    if (confirm('Remove this recording from the library? Original source files are preserved.')) {
      try {
        await api.deleteRecording(recId)
        await loadRecordings()
      } catch (err: any) {
        setError(err.message || 'Failed to delete recording')
      }
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">
            <Film size={28} color="var(--accent-green)" />
            Video Library
          </h2>
          <p className="page-description">
            Imported eFootball Mobile recordings with FFprobe stream inspection. Original files are never modified.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={loadRecordings}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={onOpenImportModal}>
            <Upload size={16} /> Import from System
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '14px',
            background: 'rgba(255, 77, 77, 0.12)',
            color: 'var(--accent-crimson)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragOver ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
          background: dragOver ? 'rgba(0, 240, 118, 0.05)' : 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px',
          textAlign: 'center',
          marginBottom: '28px',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
        }}
        onClick={onOpenImportModal}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <Upload size={32} color={dragOver ? 'var(--accent-green)' : 'var(--text-muted)'} />
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>
            {uploading ? 'Uploading & inspecting recording...' : 'Drag & drop iPhone MOV / MP4 recordings here'}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            or click to browse your Linux computer • Supports HEVC, H.264, 60fps & 120fps screen recordings
          </div>
        </div>
      </div>

      {/* Recordings Grid */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Inspecting library recordings...
        </div>
      ) : recordings.length === 0 ? (
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
          <Film size={48} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>Your Video Library is Empty</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', maxWidth: '480px', margin: '0 auto 20px' }}>
            Import your iPhone recordings of eFootball matches to detect highlights and generate vertical Shorts.
          </p>
          <button className="btn btn-primary" onClick={onOpenImportModal}>
            <Upload size={16} /> Select Video File
          </button>
        </div>
      ) : (
        <div className="video-grid">
          {recordings.map((rec) => (
            <div key={rec.id} className="video-card">
              <div
                className="video-thumb-container"
                onClick={() =>
                  setPreviewVideo({
                    url: `/api/library/recordings/${rec.id}/stream`,
                    title: rec.filename,
                  })
                }
                style={{ cursor: 'pointer' }}
              >
                {rec.thumbnail_url ? (
                  <img src={rec.thumbnail_url} alt="" />
                ) : (
                  <Play size={32} color="var(--text-muted)" />
                )}
                <div className="video-card-badge">{formatDuration(rec.duration)}</div>
              </div>

              <div className="video-card-body">
                <div className="video-card-title" title={rec.filename}>
                  {rec.filename}
                </div>

                <div className="video-card-meta">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Maximize2 size={13} /> {rec.width}x{rec.height}
                  </span>
                  <span>{rec.fps} fps</span>
                  <span>{rec.codec_name.toUpperCase()}</span>
                  <span>{formatBytes(rec.file_size)}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                  <span className={`status-pill ${rec.status}`}>{rec.status}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {rec.candidate_clips_count} {rec.candidate_clips_count === 1 ? 'clip' : 'clips'} found
                  </span>
                </div>

                {/* Card Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => onSelectForHighlights(rec.id)}
                    title="Run highlight detector"
                  >
                    <Sparkles size={14} /> Detect Highlights
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onSelectForEditor(rec.id)}
                    title="Open directly in Shorts Editor"
                  >
                    <Scissors size={14} /> Edit
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(rec.id)}
                    title="Remove from library"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {previewVideo && (
        <VideoModal
          isOpen={true}
          title={previewVideo.title}
          videoUrl={previewVideo.url}
          onClose={() => setPreviewVideo(null)}
        />
      )}
    </div>
  )
}
