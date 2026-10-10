import React, { useEffect, useState } from 'react'
import {
  Key,
  ExternalLink,
  ShieldCheck,
  UploadCloud,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  Play,
  Lock,
} from 'lucide-react'
import { YoutubeIcon } from '../components/YoutubeIcon'
import { api } from '../api/client'
import { PublishingRecord, Short } from '../types'

interface PublishingPageProps {
  initialShort?: Short | null
  onNavigateToSettings: () => void
}

export const PublishingPage: React.FC<PublishingPageProps> = ({
  initialShort,
  onNavigateToSettings,
}) => {
  const [status, setStatus] = useState<{
    configured: boolean
    authenticated: boolean
    channel_title?: string | null
    channel_id?: string | null
    redirect_uri: string
  } | null>(null)

  const [history, setHistory] = useState<PublishingRecord[]>([])
  const [approvedShorts, setApprovedShorts] = useState<Short[]>([])
  const [selectedShortId, setSelectedShortId] = useState<string>(initialShort?.id || '')
  const [uploading, setUploading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const loadData = async () => {
    try {
      const [st, hist, allShorts] = await Promise.all([
        api.getPublishingStatus(),
        api.getPublishingHistory(),
        api.getShorts(),
      ])
      setStatus(st)
      setHistory(hist)
      const approved = allShorts.filter((s) => s.status === 'approved' || s.status === 'rendered')
      setApprovedShorts(approved)
      if (!selectedShortId && approved.length > 0) {
        setSelectedShortId(approved[0].id)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load publishing data')
    }
  }

  useEffect(() => {
    loadData()
    // Listen for OAuth popup completion
    const handleMessage = (e: MessageEvent) => {
      if (e.data === 'yt_oauth_success') {
        setSuccessMsg('YouTube Account successfully connected!')
        loadData()
      } else if (e.data === 'yt_oauth_error') {
        setError('YouTube authorization failed')
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const handleConnectOAuth = async () => {
    try {
      setError(null)
      const res = await api.getYouTubeAuthUrl()
      const width = 600
      const height = 700
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2
      window.open(
        res.authorization_url,
        'YouTubeOAuth',
        `width=${width},height=${height},top=${top},left=${left}`
      )
    } catch (err: any) {
      setError(err.message || 'Could not initiate OAuth')
    }
  }

  const handlePublishShort = async () => {
    if (!selectedShortId) return
    try {
      setUploading(true)
      setError(null)
      setSuccessMsg(null)
      await api.publishToYouTube({
        short_id: selectedShortId,
      })
      setSuccessMsg('Short queued for private YouTube upload!')
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Failed to publish to YouTube')
    } finally {
      setUploading(false)
    }
  }

  const selectedShort = approvedShorts.find((s) => s.id === selectedShortId)

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">
            <YoutubeIcon size={28} color="#ef4444" />
            YouTube Publishing
          </h2>
          <p className="page-description">
            Official YouTube Data API v3 OAuth integration. All uploads are strictly private by default.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={loadData}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {error && (
        <div style={{ padding: '14px', background: 'rgba(255, 77, 77, 0.12)', color: 'var(--accent-crimson)', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {successMsg && (
        <div style={{ padding: '14px', background: 'rgba(0, 240, 118, 0.12)', color: 'var(--accent-green)', borderRadius: 'var(--radius-md)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* OAuth Connection Status Banner */}
      <div className="glass-card" style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: 'var(--radius-md)',
                background: status?.authenticated ? 'rgba(0, 240, 118, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: status?.authenticated ? 'var(--accent-green)' : '#ef4444',
              }}
            >
              <YoutubeIcon size={26} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>
                  {status?.authenticated
                    ? `Connected: ${status.channel_title || 'YouTube Channel'}`
                    : 'YouTube Account Disconnected'}
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: status?.authenticated ? 'rgba(0, 240, 118, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: status?.authenticated ? 'var(--accent-green)' : '#ef4444',
                    fontWeight: 700,
                  }}
                >
                  {status?.authenticated ? 'OAuth Authenticated' : 'Not Connected'}
                </span>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {status?.authenticated
                  ? 'Ready to publish approved vertical Shorts directly to your channel.'
                  : status?.configured
                  ? 'OAuth credentials found. Click below to sign in with your Google account.'
                  : 'Google OAuth Client ID & Secret must be added in Settings.'}
              </div>
            </div>
          </div>

          <div>
            {!status?.configured ? (
              <button className="btn btn-primary btn-sm" onClick={onNavigateToSettings}>
                <Key size={16} /> Configure OAuth in Settings
              </button>
            ) : !status?.authenticated ? (
              <button className="btn btn-primary" onClick={handleConnectOAuth}>
                <ExternalLink size={16} /> Connect with Google
              </button>
            ) : (
              <button className="btn btn-secondary btn-sm" onClick={handleConnectOAuth}>
                Switch Channel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Upload Workbench */}
      <div className="glass-card" style={{ marginBottom: '28px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UploadCloud size={20} color="var(--accent-green)" /> Publish Approved Short
        </h3>

        {approvedShorts.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No approved shorts ready for publishing. Head to Review Queue to approve a rendered Short first.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Select Approved Short</label>
              <select
                className="form-select"
                value={selectedShortId}
                onChange={(e) => setSelectedShortId(e.target.value)}
              >
                {approvedShorts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({Math.round(s.duration)}s • {s.status})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                <Lock size={14} color="var(--accent-green)" />
                <span>
                  Privacy Status: <strong style={{ color: 'var(--accent-green)' }}>Private</strong> (Required initial setting)
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Videos are safely uploaded as private drafts. You can change visibility anytime on YouTube Studio.
              </div>
            </div>

            <div>
              <button
                className="btn btn-primary"
                style={{ width: '100%', height: '42px' }}
                onClick={handlePublishShort}
                disabled={uploading || !status?.authenticated || !selectedShortId}
              >
                {uploading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Uploading Resumable Video...
                  </>
                ) : (
                  <>
                    <UploadCloud size={18} /> Publish Privately to YouTube
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Publishing History */}
      <div className="glass-card">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={18} color="var(--text-muted)" /> Publishing History & Logs
        </h3>

        {history.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No publishing activity yet. Uploaded videos will appear here with live links and statuses.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {history.map((record) => (
              <div
                key={record.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.94rem' }}>
                    {record.video_url ? (
                      <a
                        href={record.video_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#38bdf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        {record.video_url} <ExternalLink size={14} />
                      </a>
                    ) : (
                      `Upload ID: ${record.id.slice(0, 8)}`
                    )}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Platform: YouTube • Privacy: {record.privacy_status} •{' '}
                    {record.published_at ? new Date(record.published_at).toLocaleString() : 'In progress'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className={`status-pill ${record.status}`}>{record.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
