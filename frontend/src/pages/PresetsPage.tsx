import React, { useEffect, useState } from 'react'
import {
  Sliders,
  Sparkles,
  Save,
  Check,
  RefreshCw,
  Search,
  Clock,
  Layers,
  Flame,
  ArrowRight,
} from 'lucide-react'
import { api } from '../api/client'
import { Preset, Recording } from '../types'

export const PresetsPage: React.FC = () => {
  const [presets, setPresets] = useState<Preset[]>([])
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [selectedRefRecId, setSelectedRefRecId] = useState<string>('')
  const [analyzingRef, setAnalyzingRef] = useState<boolean>(false)
  const [refProfile, setRefProfile] = useState<any | null>(null)

  const [loading, setLoading] = useState<boolean>(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      const [prs, recs] = await Promise.all([api.getPresets(), api.getRecordings()])
      setPresets(prs)
      setRecordings(recs)
      if (!selectedRefRecId && recs.length > 0) {
        setSelectedRefRecId(recs[0].id)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleChange = (id: string, field: keyof Preset, value: any) => {
    setPresets((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    )
  }

  const handleSave = async (preset: Preset) => {
    try {
      setSavingId(preset.id)
      await api.updatePreset(preset.id, {
        name: preset.name,
        description: preset.description,
        layout: preset.layout,
        branding_enabled: preset.branding_enabled,
        branding_text: preset.branding_text,
        badge_style: preset.badge_style,
        vignette: preset.vignette,
        color_grade: preset.color_grade,
        slow_motion: preset.slow_motion,
        zoom_punch: preset.zoom_punch,
        caption_default: preset.caption_default,
      })
      setMessage(`Preset "${preset.name}" updated successfully!`)
      setTimeout(() => setMessage(null), 3000)
    } catch (err: any) {
      alert(`Failed to save preset: ${err.message}`)
    } finally {
      setSavingId(null)
    }
  }

  const handleAnalyzeReference = async () => {
    if (!selectedRefRecId) return
    try {
      setAnalyzingRef(true)
      setRefProfile(null)
      const res = await api.analyzeReference({
        recording_id: selectedRefRecId,
        save_as_preset: true,
      })
      setRefProfile(res.profile)
      if (res.created_preset) {
        setPresets((prev) => [res.created_preset!, ...prev])
        setMessage(`New preset created: "${res.created_preset.name}"!`)
      }
    } catch (err: any) {
      alert(`Reference analysis failed: ${err.message}`)
    } finally {
      setAnalyzingRef(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">
            <Sliders size={28} color="var(--accent-green)" />
            Style Presets & Creator Style Cloner
          </h2>
          <p className="page-description">
            Reverse-engineer how top YouTubers edit their eFootball Shorts, or customize your own templates.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={loadData}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {message && (
        <div style={{ padding: '14px', background: 'rgba(0, 240, 118, 0.15)', color: 'var(--accent-green)', borderRadius: 'var(--radius-md)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Check size={18} />
          <span>{message}</span>
        </div>
      )}

      {/* REVERSE-ENGINEER REFERENCE VIDEO SECTION */}
      <div
        className="glass-card"
        style={{
          marginBottom: '32px',
          background: 'linear-gradient(135deg, rgba(18, 23, 34, 0.85) 0%, rgba(0, 240, 118, 0.05) 100%)',
          border: '1px solid rgba(0, 240, 118, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(0, 240, 118, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-green)',
            }}
          >
            <Sparkles size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Analyze Creator / Reference Short</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Pick any reference Short from a creator you admire. Jovyx Shorts Factory will analyze their shot cut pace, framing, and color grading to build a matching preset.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', alignItems: 'flex-end', marginTop: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Reference Video / Match</label>
            <select
              className="form-select"
              value={selectedRefRecId}
              onChange={(e) => setSelectedRefRecId(e.target.value)}
              disabled={analyzingRef}
            >
              {recordings.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.filename} ({Math.round(r.duration)}s)
                </option>
              ))}
              {recordings.length === 0 && <option value="">No videos in library yet</option>}
            </select>
          </div>

          <div>
            <button
              className="btn btn-primary"
              style={{ width: '100%', height: '42px' }}
              onClick={handleAnalyzeReference}
              disabled={analyzingRef || !selectedRefRecId}
            >
              {analyzingRef ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> Reverse-Engineering Editing Formula...
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Analyze Style & Generate Preset
                </>
              )}
            </button>
          </div>
        </div>

        {/* Extracted Style Profile Breakdown */}
        {refProfile && (
          <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Flame size={18} color="var(--accent-gold)" />
              <strong style={{ fontSize: '1rem' }}>Extracted Creator Style Breakdown</strong>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
              <div style={{ background: 'var(--bg-base)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Shot Pace (Avg Cut)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-green)' }}>
                  {refProfile.avg_shot_duration}s per cut
                </div>
              </div>

              <div style={{ background: 'var(--bg-base)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Detected Framing</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                  {refProfile.detected_layout === 'blurred_background' ? 'Blurred Backdrop' : 'Center Crop 9:16'}
                </div>
              </div>

              <div style={{ background: 'var(--bg-base)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Color Tone</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                  {refProfile.color_grading.toUpperCase()}
                </div>
              </div>

              <div style={{ background: 'var(--bg-base)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Recommended Length</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>
                  {refProfile.recommended_duration}s
                </div>
              </div>
            </div>

            {/* Editing Formula */}
            <div style={{ background: 'var(--bg-base)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '14px' }}>
              <div style={{ fontSize: '0.84rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-secondary)' }}>
                Timeline Editing Formula:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {refProfile.editing_formula?.map((step: string, idx: number) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem' }}>
                    <ArrowRight size={14} color="var(--accent-green)" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* EXISTING PRESETS LIST */}
      <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '18px' }}>Available Editing Presets</h3>

      {loading ? (
        <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading presets...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
          {presets.map((preset) => (
            <div key={preset.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>{preset.name}</h3>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      background: preset.is_custom ? 'rgba(0, 210, 255, 0.15)' : 'rgba(0, 240, 118, 0.15)',
                      color: preset.is_custom ? 'var(--accent-cyan)' : 'var(--accent-green)',
                      fontWeight: 700,
                    }}
                  >
                    {preset.is_custom ? 'Custom Clone' : 'Official Preset'}
                  </span>
                </div>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {preset.description}
                </p>
              </div>

              {/* Layout */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Layout Mode</label>
                <select
                  className="form-select"
                  value={preset.layout}
                  onChange={(e) => handleChange(preset.id, 'layout', e.target.value)}
                >
                  <option value="blurred_background">Blurred Background Fill</option>
                  <option value="center_crop">Center Crop 9:16</option>
                  <option value="dual_stacked">Dual Stacked</option>
                </select>
              </div>

              {/* Color Grade */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Color Grading</label>
                <select
                  className="form-select"
                  value={preset.color_grade}
                  onChange={(e) => handleChange(preset.id, 'color_grade', e.target.value)}
                >
                  <option value="vibrant">Vibrant eFootball (High Saturation & Contrast)</option>
                  <option value="cinematic">Cinematic Football (Warm Filmic Tone)</option>
                  <option value="natural">Natural Pass-through</option>
                </select>
              </div>

              {/* Branding Text */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Branding Watermark</label>
                <input
                  className="form-input"
                  type="text"
                  value={preset.branding_text}
                  onChange={(e) => handleChange(preset.id, 'branding_text', e.target.value)}
                />
              </div>

              {/* Default Caption */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Default Hook Caption</label>
                <input
                  className="form-input"
                  type="text"
                  value={preset.caption_default}
                  onChange={(e) => handleChange(preset.id, 'caption_default', e.target.value)}
                  placeholder="Caption text"
                />
              </div>

              {/* Toggles */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={preset.vignette}
                    onChange={(e) => handleChange(preset.id, 'vignette', e.target.checked)}
                    style={{ accentColor: 'var(--accent-green)' }}
                  />
                  <span>Vignette</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={preset.slow_motion}
                    onChange={(e) => handleChange(preset.id, 'slow_motion', e.target.checked)}
                    style={{ accentColor: 'var(--accent-green)' }}
                  />
                  <span>Slow-Mo</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={preset.zoom_punch}
                    onChange={(e) => handleChange(preset.id, 'zoom_punch', e.target.checked)}
                    style={{ accentColor: 'var(--accent-green)' }}
                  />
                  <span>Zoom Punch</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={preset.branding_enabled}
                    onChange={(e) => handleChange(preset.id, 'branding_enabled', e.target.checked)}
                    style={{ accentColor: 'var(--accent-green)' }}
                  />
                  <span>Branding Bar</span>
                </label>
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ width: '100%' }}
                  onClick={() => handleSave(preset)}
                  disabled={savingId === preset.id}
                >
                  <Save size={14} /> {savingId === preset.id ? 'Saving Changes...' : 'Save Preset'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
