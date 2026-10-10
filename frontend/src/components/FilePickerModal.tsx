import React, { useEffect, useState } from 'react'
import { Folder, Film, ArrowUp, X, Check, HardDrive } from 'lucide-react'
import { api } from '../api/client'
import { FileSystemBrowserResult } from '../types'

interface FilePickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectFile: (filepath: string, copyToLibrary: boolean) => void
}

export const FilePickerModal: React.FC<FilePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectFile,
}) => {
  const [browserData, setBrowserData] = useState<FileSystemBrowserResult | null>(null)
  const [selectedPath, setSelectedPath] = useState<string>('')
  const [copyToLibrary, setCopyToLibrary] = useState<boolean>(true)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const loadDirectory = async (path?: string) => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.browseFilesystem(path)
      setBrowserData(data)
    } catch (err: any) {
      setError(err.message || 'Failed to open directory')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadDirectory()
      setSelectedPath('')
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleConfirm = () => {
    if (selectedPath) {
      onSelectFile(selectedPath, copyToLibrary)
      onClose()
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '750px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <HardDrive size={22} color="var(--accent-green)" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Import Recording from Computer</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Breadcrumbs / Path bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            {browserData?.parent_path && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => loadDirectory(browserData.parent_path!)}
                title="Go up one folder"
              >
                <ArrowUp size={16} /> Up
              </button>
            )}
            <div
              style={{
                flex: 1,
                padding: '8px 12px',
                background: 'var(--bg-base)',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.82rem',
                color: 'var(--text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {browserData?.current_path || 'Loading...'}
            </div>
          </div>

          {error && (
            <div style={{ padding: '12px', background: 'rgba(255, 77, 77, 0.1)', color: 'var(--accent-crimson)', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '0.88rem' }}>
              {error}
            </div>
          )}

          {/* Directory listing */}
          <div
            style={{
              maxHeight: '340px',
              overflowY: 'auto',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-base)',
            }}
          >
            {loading ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Reading directory contents...
              </div>
            ) : (
              <div>
                {browserData?.items.map((item) => {
                  const isSelected = selectedPath === item.path
                  return (
                    <div
                      key={item.path}
                      onClick={() => {
                        if (item.is_dir) {
                          loadDirectory(item.path)
                        } else if (item.is_video) {
                          setSelectedPath(item.path)
                        }
                      }}
                      style={{
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        cursor: item.is_dir || item.is_video ? 'pointer' : 'default',
                        background: isSelected
                          ? 'rgba(0, 240, 118, 0.12)'
                          : 'transparent',
                        borderLeft: isSelected ? '3px solid var(--accent-green)' : '3px solid transparent',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                        {item.is_dir ? (
                          <Folder size={18} color="#38bdf8" />
                        ) : (
                          <Film size={18} color="var(--accent-green)" />
                        )}
                        <span
                          style={{
                            fontSize: '0.88rem',
                            fontWeight: isSelected ? 700 : 500,
                            color: isSelected ? 'var(--accent-green)' : 'var(--text-main)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.name}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {item.is_dir ? 'Directory' : formatSize(item.size)}
                      </div>
                    </div>
                  )
                })}
                {browserData?.items.length === 0 && (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No videos or subfolders found in this directory.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Options */}
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.86rem' }}>
              <input
                type="checkbox"
                checked={copyToLibrary}
                onChange={(e) => setCopyToLibrary(e.target.checked)}
                style={{ accentColor: 'var(--accent-green)' }}
              />
              <span>
                <strong>Copy to managed storage</strong> (Original file is preserved and never modified)
              </span>
            </label>

            {selectedPath && (
              <div style={{ fontSize: '0.8rem', color: 'var(--accent-green)' }}>
                Selected: <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedPath}</span>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!selectedPath || loading}
            onClick={handleConfirm}
          >
            <Check size={18} /> Import Selected Video
          </button>
        </div>
      </div>
    </div>
  )
}
