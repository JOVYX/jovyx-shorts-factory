import React from 'react'
import {
  LayoutDashboard,
  Film,
  Sparkles,
  Scissors,
  CheckSquare,
  Sliders,
  Settings,
  Cpu,
} from 'lucide-react'
import { YoutubeIcon } from './YoutubeIcon'
import { HardwareStatus } from '../types'

export type NavTab =
  | 'dashboard'
  | 'library'
  | 'highlights'
  | 'editor'
  | 'review'
  | 'presets'
  | 'publishing'
  | 'settings'

interface NavbarProps {
  currentTab: NavTab
  onSelectTab: (tab: NavTab) => void
  hardware?: HardwareStatus | null
  waitingCount?: number
  reviewCount?: number
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  hardware,
  waitingCount = 0,
  reviewCount = 0,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'library', label: 'Video Library', icon: Film, badge: waitingCount > 0 ? waitingCount : undefined },
    { id: 'highlights', label: 'Highlight Detector', icon: Sparkles },
    { id: 'editor', label: 'Shorts Editor (9:16)', icon: Scissors },
    { id: 'review', label: 'Review Queue', icon: CheckSquare, badge: reviewCount > 0 ? reviewCount : undefined },
    { id: 'presets', label: 'Style Presets', icon: Sliders },
    { id: 'publishing', label: 'YouTube Publishing', icon: YoutubeIcon },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  return (
    <aside className="sidebar">
      <div className="brand-section">
        <div className="brand-logo-icon">⚡</div>
        <div>
          <h1 className="brand-title">Jovyx Shorts</h1>
          <div className="brand-subtitle">eFootball Mobile AI</div>
        </div>
      </div>

      <nav className="nav-menu">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = currentTab === item.id
          return (
            <button
              key={item.id}
              className={`nav-link ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(item.id as NavTab)}
            >
              <Icon size={19} />
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className="nav-badge">{item.badge}</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* GPU / Hardware Status Box */}
      <div className="sidebar-gpu-status">
        <div className="gpu-badge">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={15} color="var(--accent-green)" />
            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>
              {hardware?.encoder === 'h264_nvenc' ? 'RTX 4050 NVENC' : 'Hardware Info'}
            </span>
          </div>
          <span className="gpu-indicator" />
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
          {hardware?.gpu_name ? hardware.gpu_name : 'NVIDIA GPU Acceleration'}
        </div>
        {hardware?.vram_total_mb && (
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            VRAM: {hardware.vram_used_mb || 0} MB / {hardware.vram_total_mb} MB
          </div>
        )}
      </div>
    </aside>
  )
}
