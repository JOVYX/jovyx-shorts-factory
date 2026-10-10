import React, { useEffect, useState } from 'react'
import {
  Sparkles,
  Play,
  ThumbsUp,
  ThumbsDown,
  Scissors,
  Sliders,
  Clock,
  Film,
  AlertCircle,
  Check,
  RefreshCw,
} from 'lucide-react'
import { api } from '../api/client'
import { CandidateClip, Job, Recording } from '../types'
import { VideoModal } from '../components/VideoModal'

interface HighlightsPageProps {
  initialRecordingId?: string | null
  onSendToEditor: (recordingId: string, clip: CandidateClip) => void
}

export const HighlightsPage: React.FC<HighlightsPageProps> = ({
  initialRecordingId,
  onSendToEditor,
}) => {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [selectedRecId, setSelectedRecId] = useState<string>(initialRecordingId || '')
  const [clips, setClips] = useState<CandidateClip[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [scanning, setScanning] = useState<boolean>(false)
  const [activeJob, setActiveJob] = useState<Job | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Detection parameters
  const [clipDuration, setClipDuration] = useState<number>(25)
  const [sensitivity, setSensitivity] = useState<number>(0.35)
  const [maxCandidates, setMaxCandidates] = useState<number>(8)

  const [previewVideo, setPreviewVideo] = useState<{ url: string; title: string } | null>(null)

  useEffect(() => {
    loadRecordings()
  }, [])

  useEffect(() => {
    if (initialRecordingId) {
      setSelectedRecId(initialRecordingId)
    }
  }, [initialRecordingId])

  useEffect(() => {
    if (selectedRecId) {
      loadClips(selectedRecId)
    } else {
      setClips([])
    }
  }, [selectedRecId])

  // Resilient background scan polling: automatically resumes if recording status is 'analyzing'
  useEffect(() => {
    const selectedRec = recordings.find((r) => r.id === selectedRecId)
    const isAnalyzing = selectedRec?.status === 'analyzing' || scanning

    if (!selectedRecId || !isAnalyzing) {
      return
    }

    setScanning(true)

    const pollTimer = setInterval(async () => {
      try {
        // Poll active jobs to display granular progress
        const activeJobs = await api.getActiveJobs()
        const matchJob = activeJobs.find(
          (j) => j.target_id === selectedRecId && j.job_type === 'highlight_scan'
        )
        if (matchJob) {
          setActiveJob(matchJob)
        }

        const freshRecordings = await api.getRecordings()
        setRecordings(freshRecordings)
        const current = freshRecordings.find((r) => r.id === selectedRecId)

        if (current?.status === 'analyzed' || current?.status === 'error' || current?.status === 'imported') {
          clearInterval(pollTimer)
          setScanning(false)
          setActiveJob(null)
          if (current.status === 'analyzed') {
            await loadClips(selectedRecId)
          } else if (current.status === 'error' && current.error_message) {
            setError(current.error_message)
          }
        }
      } catch {
        // ignore transient poll errors
      }
    }, 1200)

    return () => clearInterval(pollTimer)
  }, [selectedRecId, scanning, recordings.find((r) => r.id === selectedRecId)?.status])

  const loadRecordings = async () => {
    try {
      const data = await api.getRecordings()
      setRecordings(data)
      if (!selectedRecId && data.length > 0) {
        setSelectedRecId(data[0].id)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load recordings')
    }
  }

  const loadClips = async (recId: string) => {
    try {
      setLoading(true)
      const data = await api.getCandidateClips(recId)
      setClips(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load candidate clips')
    } finally {
      setLoading(false)
    }
  }

  const handleStartScan = async () => {
    if (!selectedRecId) return
    try {
      setScanning(true)
      setError(null)
      const res = await api.scanHighlights(selectedRecId, {
        clip_duration: clipDuration,
        sensitivity: sensitivity,
        max_candidates: maxCandidates,
      })

      // Fetch immediate job state
      if (res.task_id) {
        const job = await api.getJob(res.task_id).catch(() => null)
        if (job) setActiveJob(job)
      }
      await loadRecordings()
    } catch (err: any) {
      setScanning(false)
      setActiveJob(null)
      setError(err.message || 'Failed to start highlight scan')
    }
  }

  const handleCancelScan = async () => {
    if (activeJob?.id) {
      try {
        await api.cancelJob(activeJob.id)
      } catch {
        // ignore
      }
    }
    setScanning(false)
    setActiveJob(null)
    await loadRecordings()
  }

  const handleFeedback = async (clipId: string, currentFeedback: 'good' | 'bad' | null | undefined, newFeedback: 'good' | 'bad') => {
    const feedbackToSend = currentFeedback === newFeedback ? null : newFeedback
    try {
      const updated = await api.submitFeedback(clipId, feedbackToSend)
      setClips((prev) => prev.map((c) => (c.id === clipId ? updated : c)))
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback')
    }
  }

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  const selectedRecording = recordings.find((r) => r.id === selectedRecId)

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">
            <Sparkles size={28} color="var(--accent-green)" />
            Highlight Detector
          </h2>
          <p className="page-description">
            Visual scene and motion-energy clustering. Feedback improves future candidate scoring.
          </p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '14px', background: 'rgba(255, 77, 77, 0.12)', color: 'var(--accent-crimson)', borderRadius: 'var(--radius-md)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Control Banner */}
      <div className="glass-card" style={{ marginBottom: '28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', alignItems: 'flex-end' }}>
          {/* Video Selector */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Target Gameplay Recording</label>
            <select
              className="form-select"
              value={selectedRecId}
              onChange={(e) => setSelectedRecId(e.target.value)}
              disabled={scanning}
            >
              {recordings.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.filename} ({Math.round(r.duration)}s)
                </option>
              ))}
              {recordings.length === 0 && <option value="">No recordings available</option>}
            </select>
          </div>

          {/* Clip Duration */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              Target Duration: <strong style={{ color: 'var(--accent-green)' }}>{clipDuration} seconds</strong>
            </label>
            <input
              type="range"
              min="10"
              max="60"
              step="5"
              value={clipDuration}
              onChange={(e) => setClipDuration(Number(e.target.value))}
              disabled={scanning}
              style={{ width: '100%', accentColor: 'var(--accent-green)' }}
            />
          </div>

          {/* Sensitivity */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              Visual Sensitivity: <strong style={{ color: 'var(--accent-cyan)' }}>{Math.round(sensitivity * 100)}%</strong>
            </label>
            <input
              type="range"
              min="0.1"
              max="0.8"
              step="0.05"
              value={sensitivity}
              onChange={(e) => setSensitivity(Number(e.target.value))}
              disabled={scanning}
              style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
            />
          </div>

          {/* Scan Button & Progress */}
          <div>
            {scanning ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, height: '42px' }}
                  disabled={true}
                >
                  <RefreshCw size={16} className="animate-spin" /> {activeJob?.progress ? `${Math.round(activeJob.progress)}%` : 'Analyzing'}
                </button>
                <button
                  className="btn btn-danger"
                  style={{ height: '42px', padding: '0 16px' }}
                  onClick={handleCancelScan}
                  title="Cancel Scan"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className="btn btn-primary"
                style={{ width: '100%', height: '42px' }}
                onClick={handleStartScan}
                disabled={scanning || !selectedRecId}
              >
                <Sparkles size={16} /> Scan for Highlights
              </button>
            )}
          </div>
        </div>

        {/* Live Scan Progress Banner */}
        {scanning && (
          <div style={{ marginTop: '16px', background: 'rgba(0, 240, 255, 0.08)', border: '1px solid rgba(0, 240, 255, 0.25)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
                ⚡ {activeJob?.stage || 'Scanning gameplay highlights with hardware acceleration...'}
              </span>
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
                {activeJob?.progress ? `${Math.round(activeJob.progress)}%` : 'Running'}
              </span>
            </div>
            <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.max(5, activeJob?.progress || 10)}%`,
                  height: '100%',
                  background: 'var(--gradient-accent)',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Realistic Note */}
        <div style={{ marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
          💡 Note: Visual scene and motion clustering detects dynamic action spikes and replays. Use thumbs up/down feedback to guide ranking.
        </div>
      </div>

      {/* Candidate Clips Grid */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
          Candidate Clips {clips.length > 0 && `(${clips.length} Extracted)`}
        </h3>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading candidate highlights...
        </div>
      ) : clips.length === 0 ? (
        scanning ? (
          <div className="glass-card" style={{ padding: '50px', textAlign: 'center' }}>
            <RefreshCw size={42} color="var(--accent-cyan)" className="animate-spin" style={{ marginBottom: '16px' }} />
            <h4 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px', color: 'var(--accent-cyan)' }}>
              Analyzing Gameplay Highlights
            </h4>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', maxWidth: '460px', margin: '0 auto 16px' }}>
              {activeJob?.stage || 'Extracting motion timeline and detecting dynamic moments...'}
            </p>
            <div style={{ maxWidth: '360px', margin: '0 auto 20px', height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.max(5, activeJob?.progress || 10)}%`,
                  height: '100%',
                  background: 'var(--gradient-accent)',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handleCancelScan}>
              Cancel Scan
            </button>
          </div>
        ) : (
          <div className="glass-card" style={{ padding: '50px', textAlign: 'center' }}>
            <Sparkles size={40} color="var(--text-muted)" style={{ marginBottom: '14px' }} />
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>No Highlights Scanned Yet</h4>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '18px', maxWidth: '420px', margin: '0 auto 18px' }}>
              Click "Scan for Highlights" above to automatically analyze visual changes and action bursts.
            </p>
          </div>
        )
      ) : (
        <div className="video-grid">
          {clips.map((clip) => {
            const isGood = clip.user_feedback === 'good'
            const isBad = clip.user_feedback === 'bad'

            return (
              <div key={clip.id} className="video-card">
                <div
                  className="video-thumb-container"
                  onClick={() =>
                    selectedRecording &&
                    setPreviewVideo({
                      url: `/api/library/recordings/${selectedRecording.id}/stream#t=${clip.start_time},${clip.end_time}`,
                      title: `Highlight #${clip.rank} (${formatTimestamp(clip.start_time)} - ${formatTimestamp(clip.end_time)})`,
                    })
                  }
                  style={{ cursor: 'pointer' }}
                >
                  {clip.thumbnail_url ? (
                    <img src={clip.thumbnail_url} alt="" />
                  ) : (
                    <Play size={28} color="var(--text-muted)" />
                  )}
                  <div
                    style={{
                      position: 'absolute',
                      top: '8px',
                      left: '8px',
                      background: 'rgba(0, 0, 0, 0.85)',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      color: 'var(--accent-green)',
                      border: '1px solid var(--accent-green)',
                    }}
                  >
                    Rank #{clip.rank} • Score {clip.score}
                  </div>
                  <div className="video-card-badge">{Math.round(clip.duration)}s</div>
                </div>

                <div className="video-card-body">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.96rem' }}>
                      {formatTimestamp(clip.start_time)} ➔ {formatTimestamp(clip.end_time)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {clip.notes || clip.detection_method}
                    </div>
                  </div>

                  {/* Feedback Controls & Editor Action */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        className={`btn btn-sm ${isGood ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleFeedback(clip.id, clip.user_feedback, 'good')}
                        title="Mark clip as Good highlight"
                      >
                        <ThumbsUp size={14} /> Good
                      </button>
                      <button
                        className={`btn btn-sm ${isBad ? 'btn-danger' : 'btn-secondary'}`}
                        onClick={() => handleFeedback(clip.id, clip.user_feedback, 'bad')}
                        title="Mark clip as Bad / boring"
                      >
                        <ThumbsDown size={14} /> Bad
                      </button>
                    </div>

                    <button
                      className="btn btn-cyan btn-sm"
                      onClick={() => selectedRecId && onSendToEditor(selectedRecId, clip)}
                      title="Load into 9:16 Shorts Editor"
                    >
                      <Scissors size={14} /> Create Short
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
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
