import React, { useEffect, useState } from 'react'
import {
  CheckSquare,
  Play,
  Download,
  ThumbsUp,
  ThumbsDown,
  Edit2,
  Trash2,
  RefreshCw,
  Scissors,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import { YoutubeIcon } from '../components/YoutubeIcon'
import { api } from '../api/client'
import { Short } from '../types'
import { VideoModal } from '../components/VideoModal'

interface ReviewQueuePageProps {
  onNavigateToEditor: (short: Short) => void
  onNavigateToPublishing: (short: Short) => void
}

export const ReviewQueuePage: React.FC<ReviewQueuePageProps> = ({
  onNavigateToEditor,
  onNavigateToPublishing,
}) => {
  const [shorts, setShorts] = useState<Short[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [previewShort, setPreviewShort] = useState<Short | null>(null)
  const [editingShortId, setEditingShortId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState<string>('')
  const [editDesc, setEditDesc] = useState<string>('')

  const loadShorts = async () => {
    try {
      setLoading(true)
      const data = await api.getShorts()
      setShorts(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load shorts queue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadShorts()
  }, [])

  const handleSetStatus = async (shortId: string, status: 'approved' | 'rejected') => {
    try {
      const updated = await api.setShortStatus(shortId, status)
      setShorts((prev) => prev.map((s) => (s.id === shortId ? updated : s)))
    } catch (err: any) {
      setError(err.message || 'Failed to update status')
    }
  }

  const handleSaveEdit = async (shortId: string) => {
    try {
      const updated = await api.updateShort(shortId, {
        title: editTitle,
        description: editDesc,
      })
      setShorts((prev) => prev.map((s) => (s.id === shortId ? updated : s)))
      setEditingShortId(null)
    } catch (err: any) {
      setError(err.message || 'Failed to save changes')
    }
  }

  const handleExport = async (short: Short) => {
    try {
      const res = await api.exportShort(short.id)
      // Trigger download
      const a = document.createElement('a')
      a.href = res.download_url
      a.download = res.export_filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err: any) {
      setError(err.message || 'Failed to export Short')
    }
  }

  const handleDelete = async (shortId: string) => {
    if (confirm('Delete this generated Short?')) {
      try {
        await api.deleteShort(shortId)
        await loadShorts()
      } catch (err: any) {
        setError(err.message || 'Failed to delete Short')
      }
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">
            <CheckSquare size={28} color="#a855f7" />
            Review Queue
          </h2>
          <p className="page-description">
            Inspect rendered vertical Shorts, approve clips, export finished MP4s, or upload to YouTube.
          </p>
        </div>
        <div>
          <button className="btn btn-secondary" onClick={loadShorts}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '14px', background: 'rgba(255, 77, 77, 0.12)', color: 'var(--accent-crimson)', borderRadius: 'var(--radius-md)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading review queue...
        </div>
      ) : shorts.length === 0 ? (
        <div className="glass-card" style={{ padding: '50px', textAlign: 'center' }}>
          <CheckSquare size={44} color="var(--text-muted)" style={{ marginBottom: '14px' }} />
          <h4 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '6px' }}>Review Queue is Empty</h4>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto 16px' }}>
            Render a 9:16 vertical video from the Shorts Editor or Highlight Detector to inspect it here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '24px' }}>
          {shorts.map((short) => {
            const isEditing = editingShortId === short.id
            const canPublish = short.status === 'approved' || short.status === 'rendered'

            return (
              <div key={short.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                {/* 9:16 Video Thumbnail Container */}
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '16 / 9',
                    background: '#000',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    position: 'relative',
                    cursor: short.video_url ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px',
                  }}
                  onClick={() => short.video_url && setPreviewShort(short)}
                >
                  {short.thumbnail_url ? (
                    <img src={short.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Play size={32} color="var(--text-muted)" />
                  )}

                  <div className="video-card-badge">{formatDuration(short.duration)}</div>

                  <div
                    style={{
                      position: 'absolute',
                      top: '8px',
                      left: '8px',
                    }}
                  >
                    <span className={`status-pill ${short.status}`}>{short.status}</span>
                  </div>
                </div>

                {/* Card Body */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <input
                        className="form-input"
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Title"
                      />
                      <textarea
                        className="form-textarea"
                        rows={2}
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Description"
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => handleSaveEdit(short.id)}>
                          Save
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingShortId(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h4 style={{ fontWeight: 700, fontSize: '1rem' }}>{short.title}</h4>
                        <button
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                          onClick={() => {
                            setEditingShortId(short.id)
                            setEditTitle(short.title)
                            setEditDesc(short.description)
                          }}
                          title="Edit title & description"
                        >
                          <Edit2 size={15} />
                        </button>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {short.width}x{short.height} • {short.fps} fps • {short.layout} • {short.encoder_used || 'libx264'}
                      </div>
                    </div>
                  )}

                  {/* Status / Approval Controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                    <button
                      className={`btn btn-sm ${short.status === 'approved' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1 }}
                      onClick={() => handleSetStatus(short.id, 'approved')}
                      title="Approve for export or publishing"
                    >
                      <CheckCircle2 size={15} /> Approve
                    </button>
                    <button
                      className={`btn btn-sm ${short.status === 'rejected' ? 'btn-danger' : 'btn-secondary'}`}
                      style={{ flex: 1 }}
                      onClick={() => handleSetStatus(short.id, 'rejected')}
                      title="Reject Short"
                    >
                      <XCircle size={15} /> Reject
                    </button>
                  </div>

                  {/* Actions Bar */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => handleExport(short)}
                      disabled={!short.output_path}
                      title="Export and download finished MP4"
                    >
                      <Download size={14} /> Export MP4
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onNavigateToPublishing(short)}
                      disabled={!canPublish}
                      title="Publish to YouTube (OAuth)"
                    >
                      <YoutubeIcon size={14} color="#ef4444" />
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onNavigateToEditor(short)}
                      title="Regenerate in Shorts Editor"
                    >
                      <Scissors size={14} />
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(short.id)}
                      title="Delete Short"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {previewShort && (
        <VideoModal
          isOpen={true}
          title={previewShort.title}
          videoUrl={previewShort.video_url || ''}
          isVertical={true}
          onClose={() => setPreviewShort(null)}
        />
      )}
    </div>
  )
}
