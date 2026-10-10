import React, { useEffect, useRef, useState } from 'react'
import {
  Scissors,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Volume2,
  Sliders,
  Type,
  Layers,
  CheckCircle,
  Video,
  Cpu,
  AlertCircle,
  Clock,
} from 'lucide-react'
import { api } from '../api/client'
import { CandidateClip, Preset, Recording, Short } from '../types'

interface ShortsEditorPageProps {
  initialRecordingId?: string | null
  initialClip?: CandidateClip | null
  onRenderSuccess?: (shortId: string) => void
}

export const ShortsEditorPage: React.FC<ShortsEditorPageProps> = ({
  initialRecordingId,
  initialClip,
  onRenderSuccess,
}) => {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [presets, setPresets] = useState<Preset[]>([])
  const [selectedRecId, setSelectedRecId] = useState<string>(initialRecordingId || '')

  // Editor states
  const [title, setTitle] = useState<string>('eFootball Mobile Highlight')
  const [description, setDescription] = useState<string>(
    '#shorts #efootball #efootballmobile #gaming'
  )
  const [startTime, setStartTime] = useState<number>(initialClip?.start_time || 0.0)
  const [endTime, setEndTime] = useState<number>(initialClip?.end_time || 15.0)
  const [layout, setLayout] = useState<'blurred_background' | 'center_crop' | 'smart_crop' | 'dual_stacked'>(
    'blurred_background'
  )
  const [selectedPresetId, setSelectedPresetId] = useState<string>('gameplay_highlights')

  // Effects & branding
  const [brandingEnabled, setBrandingEnabled] = useState<boolean>(true)
  const [brandingText, setBrandingText] = useState<string>('JOVYX | eFootball')
  const [captionEnabled, setCaptionEnabled] = useState<boolean>(false)
  const [captionText, setCaptionText] = useState<string>('')
  const [slowMotion, setSlowMotion] = useState<boolean>(false)
  const [zoomPunch, setZoomPunch] = useState<boolean>(false)
  const [audioGain, setAudioGain] = useState<number>(1.0)
  const [introText, setIntroText] = useState<string>('')
  const [outroText, setOutroText] = useState<string>('Follow for more eFootball Highlights')
  const [colorGrade, setColorGrade] = useState<'vibrant' | 'cinematic' | 'natural'>('vibrant')
  const [vignette, setVignette] = useState<boolean>(false)

  // Rendering & progress
  const [rendering, setRendering] = useState<boolean>(false)
  const [renderProgress, setRenderProgress] = useState<number>(0)
  const [renderedShort, setRenderedShort] = useState<Short | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generatingAI, setGeneratingAI] = useState<boolean>(false)

  // Player state
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [currentTime, setCurrentTime] = useState<number>(0)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (initialRecordingId) setSelectedRecId(initialRecordingId)
  }, [initialRecordingId])

  useEffect(() => {
    if (initialClip) {
      setStartTime(initialClip.start_time)
      setEndTime(initialClip.end_time)
    }
  }, [initialClip])

  const loadData = async () => {
    try {
      const [recs, prs] = await Promise.all([api.getRecordings(), api.getPresets()])
      setRecordings(recs)
      setPresets(prs)
      if (!selectedRecId && recs.length > 0) {
        setSelectedRecId(recs[0].id)
        setEndTime(Math.min(15.0, recs[0].duration))
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load editor resources')
    }
  }

  const selectedRecording = recordings.find((r) => r.id === selectedRecId)

  // Preset switch
  const applyPreset = (presetId: string) => {
    setSelectedPresetId(presetId)
    const p = presets.find((item) => item.id === presetId)
    if (!p) return

    setLayout(p.layout as any)
    setBrandingEnabled(p.branding_enabled)
    setBrandingText(p.branding_text)
    setVignette(p.vignette)
    setColorGrade(p.color_grade as any)
    setSlowMotion(p.slow_motion)
    setZoomPunch(p.zoom_punch)
    if (p.caption_default) {
      setCaptionEnabled(true)
      setCaptionText(p.caption_default)
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const t = videoRef.current.currentTime
      setCurrentTime(t)
      if (t >= endTime) {
        videoRef.current.currentTime = startTime
      }
    }
  }

  const togglePlay = () => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
      setIsPlaying(false)
    } else {
      if (videoRef.current.currentTime < startTime || videoRef.current.currentTime >= endTime) {
        videoRef.current.currentTime = startTime
      }
      videoRef.current.play()
      setIsPlaying(true)
    }
  }

  const seekTo = (sec: number) => {
    if (videoRef.current) {
      const safeTime = Math.max(0, Math.min(sec, selectedRecording?.duration || 100))
      videoRef.current.currentTime = safeTime
      setCurrentTime(safeTime)
    }
  }

  const handleGenerateAIMetadata = async () => {
    try {
      setGeneratingAI(true)
      const presetName = presets.find((p) => p.id === selectedPresetId)?.name || 'Gameplay Highlights'
      const data = await api.generateMetadata(presetName, title)
      setTitle(data.title)
      setDescription(data.description)
    } catch (err: any) {
      setError(err.message || 'Failed to generate metadata')
    } finally {
      setGeneratingAI(false)
    }
  }

  const handleStartRender = async () => {
    if (!selectedRecId) return
    try {
      setRendering(true)
      setRenderProgress(0)
      setError(null)
      setRenderedShort(null)

      // 1. Create Short record in backend
      const shortRecord = await api.createShort({
        recording_id: selectedRecId,
        candidate_clip_id: initialClip?.id,
        preset_id: selectedPresetId,
        title,
        description,
        start_time: startTime,
        end_time: endTime,
        layout,
        branding_enabled: brandingEnabled,
        branding_text: brandingText,
        caption_enabled: captionEnabled,
        caption_text: captionText,
        slow_motion: slowMotion,
        zoom_punch: zoomPunch,
        audio_gain: audioGain,
        intro_text: introText,
        outro_text: outroText,
        color_grade: colorGrade,
        vignette,
      })

      // 2. Trigger async background render job
      await api.renderShort(shortRecord.id)

      // 3. Poll render progress
      const pollTimer = setInterval(async () => {
        try {
          const updated = await api.getShort(shortRecord.id)
          setRenderProgress(updated.render_progress)

          if (updated.status === 'rendered') {
            clearInterval(pollTimer)
            setRendering(false)
            setRenderedShort(updated)
            if (onRenderSuccess) onRenderSuccess(updated.id)
          } else if (updated.status === 'error') {
            clearInterval(pollTimer)
            setRendering(false)
            setError(updated.error_message || 'Rendering failed')
          }
        } catch {
          // ignore transient poll error
        }
      }, 1000)
    } catch (err: any) {
      setRendering(false)
      setError(err.message || 'Failed to start rendering')
    }
  }

  const duration = Math.max(1.0, endTime - startTime)
  const maxDuration = selectedRecording?.duration || 60

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">
            <Scissors size={28} color="var(--accent-cyan)" />
            Shorts Editor (9:16 Vertical)
          </h2>
          <p className="page-description">
            Mobile layout adaptation, framing without unnatural stretch, branding, and hardware-accelerated export.
          </p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '14px', background: 'rgba(255, 77, 77, 0.12)', color: 'var(--accent-crimson)', borderRadius: 'var(--radius-md)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Editor Grid: Left Preview, Right Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '32px', alignItems: 'start' }}>
        {/* LEFT COLUMN: 9:16 Mobile Mockup & Playback */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="shorts-phone-frame">
            <div className="shorts-phone-notch" />

            {selectedRecording ? (
              <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
                {/* Background (simulating blurred background if layout is blurred) */}
                {layout === 'blurred_background' && (
                  <video
                    src={`/api/library/recordings/${selectedRecording.id}/stream`}
                    muted
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      filter: 'blur(22px) brightness(0.65)',
                      transform: 'scale(1.2)',
                    }}
                  />
                )}

                {/* Foreground Video */}
                <video
                  ref={videoRef}
                  src={`/api/library/recordings/${selectedRecording.id}/stream`}
                  onTimeUpdate={handleTimeUpdate}
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    objectFit: layout === 'center_crop' || layout === 'smart_crop' ? 'cover' : 'contain',
                    zIndex: 2,
                    filter:
                      colorGrade === 'vibrant'
                        ? 'contrast(1.1) saturate(1.25)'
                        : colorGrade === 'cinematic'
                        ? 'contrast(1.15) saturate(0.95) sepia(0.15)'
                        : 'none',
                  }}
                  playsInline
                />

                {/* Vignette Overlay Emulation */}
                {vignette && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      boxShadow: 'inset 0 0 70px rgba(0,0,0,0.85)',
                      pointerEvents: 'none',
                      zIndex: 3,
                    }}
                  />
                )}

                {/* Jovyx Branding Watermark */}
                {brandingEnabled && brandingText && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '36px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'rgba(0, 0, 0, 0.7)',
                      padding: '4px 12px',
                      borderRadius: '16px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#fff',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      zIndex: 4,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {brandingText}
                  </div>
                )}

                {/* Intro Hook Emulation */}
                {introText && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '80px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'rgba(0,0,0,0.85)',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      textAlign: 'center',
                      width: '85%',
                      zIndex: 4,
                    }}
                  >
                    {introText}
                  </div>
                )}

                {/* Caption / Hook Emulation */}
                {captionEnabled && captionText && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '90px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'rgba(0,0,0,0.75)',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      color: '#FFE600',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      textAlign: 'center',
                      width: '85%',
                      zIndex: 4,
                    }}
                  >
                    {captionText}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>
                Select a recording to preview
              </div>
            )}
          </div>

          {/* Quick Playback Bar under phone */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => seekTo(startTime)}>
              <RotateCcw size={14} /> To In-Point
            </button>
            <button className="btn btn-primary btn-sm" onClick={togglePlay}>
              {isPlaying ? <Pause size={14} /> : <Play size={14} />} {isPlaying ? 'Pause' : 'Play Clip'}
            </button>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {currentTime.toFixed(1)}s / {endTime.toFixed(1)}s
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Controls Workbench */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Preset Selector Banner */}
          <div className="glass-card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sliders size={20} color="var(--accent-green)" />
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Style Preset:</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {presets.map((p) => (
                  <button
                    key={p.id}
                    className={`btn btn-sm ${selectedPresetId === p.id ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => applyPreset(p.id)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Recording & Timeline Scrubber */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} color="var(--accent-green)" /> Timeline & Range Trimming
            </h3>

            {/* Video Selector */}
            <div className="form-group">
              <label className="form-label">Source Recording</label>
              <select
                className="form-select"
                value={selectedRecId}
                onChange={(e) => {
                  setSelectedRecId(e.target.value)
                  const r = recordings.find((x) => x.id === e.target.value)
                  if (r) {
                    setStartTime(0)
                    setEndTime(Math.min(15, r.duration))
                  }
                }}
              >
                {recordings.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.filename} ({Math.round(r.duration)}s • {r.width}x{r.height})
                  </option>
                ))}
              </select>
            </div>

            {/* Range Scrubber Sliders */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
              <div>
                <label className="form-label">
                  Start (In-Point): <strong style={{ color: 'var(--accent-green)' }}>{startTime.toFixed(1)}s</strong>
                </label>
                <input
                  type="range"
                  min="0"
                  max={Math.max(1, (selectedRecording?.duration || 60) - 1)}
                  step="0.1"
                  value={startTime}
                  onChange={(e) => {
                    const val = Number(e.target.value)
                    setStartTime(val)
                    if (val >= endTime) setEndTime(Math.min(val + 5, selectedRecording?.duration || 60))
                    seekTo(val)
                  }}
                  style={{ width: '100%', accentColor: 'var(--accent-green)' }}
                />
                <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => seekTo(startTime - 1)}>
                    -1s
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => seekTo(startTime - 0.1)}>
                    -0.1s
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => seekTo(startTime + 0.1)}>
                    +0.1s
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => seekTo(startTime + 1)}>
                    +1s
                  </button>
                </div>
              </div>

              <div>
                <label className="form-label">
                  End (Out-Point): <strong style={{ color: 'var(--accent-cyan)' }}>{endTime.toFixed(1)}s</strong>
                </label>
                <input
                  type="range"
                  min="1"
                  max={selectedRecording?.duration || 60}
                  step="0.1"
                  value={endTime}
                  onChange={(e) => {
                    const val = Number(e.target.value)
                    setEndTime(val)
                    if (val <= startTime) setStartTime(Math.max(0, val - 5))
                    seekTo(val)
                  }}
                  style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
                />
                <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => seekTo(endTime - 1)}>
                    -1s
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => seekTo(endTime - 0.1)}>
                    -0.1s
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => seekTo(endTime + 0.1)}>
                    +0.1s
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => seekTo(endTime + 1)}>
                    +1s
                  </button>
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Target Clip Duration: <strong style={{ color: 'var(--text-main)' }}>{duration.toFixed(1)} seconds</strong>{' '}
              {slowMotion && <span style={{ color: 'var(--accent-cyan)' }}>(x2 in slow-mo = {(duration * 2).toFixed(1)}s)</span>}
            </div>
          </div>

          {/* Layout & Framing */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="var(--accent-cyan)" /> 9:16 Framing & Layout (No Stretched Gameplay)
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <label
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${layout === 'blurred_background' ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                  background: layout === 'blurred_background' ? 'rgba(0, 240, 118, 0.08)' : 'var(--bg-base)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <input
                  type="radio"
                  name="layout"
                  checked={layout === 'blurred_background'}
                  onChange={() => setLayout('blurred_background')}
                  style={{ display: 'none' }}
                />
                <strong style={{ fontSize: '0.9rem' }}>✨ Blurred Backdrop</strong>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Mobile gaming gold standard. Center 16:9 gameplay with Gaussian-blurred fill.
                </span>
              </label>

              <label
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${layout === 'center_crop' ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                  background: layout === 'center_crop' ? 'rgba(0, 240, 118, 0.08)' : 'var(--bg-base)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <input
                  type="radio"
                  name="layout"
                  checked={layout === 'center_crop'}
                  onChange={() => setLayout('center_crop')}
                  style={{ display: 'none' }}
                />
                <strong style={{ fontSize: '0.9rem' }}>🎯 Center Crop</strong>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Full screen vertical crop focused on center pitch action.
                </span>
              </label>

              <label
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${layout === 'dual_stacked' ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                  background: layout === 'dual_stacked' ? 'rgba(0, 240, 118, 0.08)' : 'var(--bg-base)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <input
                  type="radio"
                  name="layout"
                  checked={layout === 'dual_stacked'}
                  onChange={() => setLayout('dual_stacked')}
                  style={{ display: 'none' }}
                />
                <strong style={{ fontSize: '0.9rem' }}>⚡ Dual Stacked</strong>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Top main wide angle, bottom zoomed accent view.
                </span>
              </label>
            </div>
          </div>

          {/* Visual Effects & Audio */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="var(--accent-gold)" /> Visual Effects & Audio
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Color Grading</label>
                <select
                  className="form-select"
                  value={colorGrade}
                  onChange={(e) => setColorGrade(e.target.value as any)}
                >
                  <option value="vibrant">Vibrant eFootball (Enhanced saturation & contrast)</option>
                  <option value="cinematic">Cinematic Football (Warm filmic tone)</option>
                  <option value="natural">Natural (Original camera color)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Audio Volume: <strong style={{ color: 'var(--accent-green)' }}>{Math.round(audioGain * 100)}%</strong>
                </label>
                <input
                  type="range"
                  min="0.2"
                  max="2.0"
                  step="0.1"
                  value={audioGain}
                  onChange={(e) => setAudioGain(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-green)' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem' }}>
                <input
                  type="checkbox"
                  checked={vignette}
                  onChange={(e) => setVignette(e.target.checked)}
                  style={{ accentColor: 'var(--accent-green)' }}
                />
                <span>Cinematic Vignette</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem' }}>
                <input
                  type="checkbox"
                  checked={slowMotion}
                  onChange={(e) => setSlowMotion(e.target.checked)}
                  style={{ accentColor: 'var(--accent-green)' }}
                />
                <span>Slow Motion (0.5x speed)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem' }}>
                <input
                  type="checkbox"
                  checked={zoomPunch}
                  onChange={(e) => setZoomPunch(e.target.checked)}
                  style={{ accentColor: 'var(--accent-green)' }}
                />
                <span>Zoom Punch on Climax</span>
              </label>
            </div>
          </div>

          {/* Text, Captions & Branding */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Type size={18} color="var(--accent-green)" /> Branding & Text Overlays
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">
                  <input
                    type="checkbox"
                    checked={brandingEnabled}
                    onChange={(e) => setBrandingEnabled(e.target.checked)}
                    style={{ accentColor: 'var(--accent-green)', marginRight: '6px' }}
                  />
                  Jovyx Branding Watermark
                </label>
                <input
                  className="form-input"
                  type="text"
                  value={brandingText}
                  onChange={(e) => setBrandingText(e.target.value)}
                  placeholder="JOVYX | eFootball"
                  disabled={!brandingEnabled}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <input
                    type="checkbox"
                    checked={captionEnabled}
                    onChange={(e) => setCaptionEnabled(e.target.checked)}
                    style={{ accentColor: 'var(--accent-green)', marginRight: '6px' }}
                  />
                  Highlight Caption / Subtitle
                </label>
                <input
                  className="form-input"
                  type="text"
                  value={captionText}
                  onChange={(e) => setCaptionText(e.target.value)}
                  placeholder="Insane Curler Finish! ⚽🔥"
                  disabled={!captionEnabled}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Intro Hook Text (0 - 2.5s)</label>
                <input
                  className="form-input"
                  type="text"
                  value={introText}
                  onChange={(e) => setIntroText(e.target.value)}
                  placeholder="Wait for the curve..."
                />
              </div>

              <div className="form-group">
                <label className="form-label">Outro Banner (Final 2.5s)</label>
                <input
                  className="form-input"
                  type="text"
                  value={outroText}
                  onChange={(e) => setOutroText(e.target.value)}
                  placeholder="Follow for more eFootball Highlights"
                />
              </div>
            </div>
          </div>

          {/* Video Metadata (Title & Description) + AI Generation */}
          <div className="glass-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>YouTube Metadata</h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleGenerateAIMetadata}
                disabled={generatingAI}
                title="Generate high-CTR title & description"
              >
                <Sparkles size={14} color="var(--accent-green)" />
                {generatingAI ? 'Generating...' : 'Auto-Generate Metadata'}
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Short Title</label>
              <input
                className="form-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Description & Hashtags</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Render Action & Progress Bar */}
          <div className="glass-card" style={{ background: 'linear-gradient(135deg, var(--bg-surface) 0%, rgba(0, 240, 118, 0.05) 100%)' }}>
            {rendering && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                  <span>
                    Rendering 9:16 Vertical Short with <strong>NVENC / FFmpeg</strong>...
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{renderProgress}%</span>
                </div>
                <div className="progress-bar-track">
                  <div className="progress-bar-fill" style={{ width: `${renderProgress}%` }} />
                </div>
              </div>
            )}

            {renderedShort && (
              <div style={{ padding: '12px', background: 'rgba(0, 240, 118, 0.12)', borderRadius: 'var(--radius-md)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle size={20} color="var(--accent-green)" />
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                  Render completed successfully ({renderedShort.encoder_used})! Ready in Review Queue.
                </span>
              </div>
            )}

            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              onClick={handleStartRender}
              disabled={rendering || !selectedRecId}
            >
              <Video size={20} />
              {rendering ? `Rendering in Progress (${renderProgress}%)...` : 'Render 9:16 Vertical Short (NVENC / FFmpeg)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
