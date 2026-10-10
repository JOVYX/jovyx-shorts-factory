import React from 'react'
import { X } from 'lucide-react'

interface VideoModalProps {
  isOpen: boolean
  title: string
  videoUrl: string
  onClose: () => void
  isVertical?: boolean
}

export const VideoModal: React.FC<VideoModalProps> = ({
  isOpen,
  title,
  videoUrl,
  onClose,
  isVertical = false,
}) => {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: isVertical ? '420px' : '900px',
          background: '#000',
          border: '1px solid rgba(255, 255, 255, 0.15)',
        }}
      >
        <div
          style={{
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <span
            style={{
              fontSize: '0.95rem',
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '16px',
            background: '#000',
          }}
        >
          <video
            src={videoUrl}
            controls
            autoPlay
            style={{
              maxWidth: '100%',
              maxHeight: isVertical ? '680px' : '520px',
              borderRadius: isVertical ? '20px' : '8px',
              aspectRatio: isVertical ? '9 / 16' : '16 / 9',
              objectFit: 'contain',
              background: '#0a0a0a',
            }}
          />
        </div>
      </div>
    </div>
  )
}
