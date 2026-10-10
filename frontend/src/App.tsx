import React, { useEffect, useState } from 'react'
import { Navbar, NavTab } from './components/Navbar'
import { DashboardPage } from './pages/DashboardPage'
import { LibraryPage } from './pages/LibraryPage'
import { HighlightsPage } from './pages/HighlightsPage'
import { ShortsEditorPage } from './pages/ShortsEditorPage'
import { ReviewQueuePage } from './pages/ReviewQueuePage'
import { PresetsPage } from './pages/PresetsPage'
import { PublishingPage } from './pages/PublishingPage'
import { SettingsPage } from './pages/SettingsPage'
import { FilePickerModal } from './components/FilePickerModal'
import { api } from './api/client'
import { CandidateClip, HardwareStatus, Short } from './types'

export function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard')
  const [hardware, setHardware] = useState<HardwareStatus | null>(null)
  const [isFilePickerOpen, setIsFilePickerOpen] = useState<boolean>(false)

  // Cross-page navigation context states
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(null)
  const [activeClip, setActiveClip] = useState<CandidateClip | null>(null)
  const [activeShort, setActiveShort] = useState<Short | null>(null)

  // Counters
  const [waitingCount, setWaitingCount] = useState<number>(0)
  const [reviewCount, setReviewCount] = useState<number>(0)

  const loadStatus = async () => {
    try {
      const stats = await api.getDashboardStats()
      setHardware(stats.hardware)
      setWaitingCount(stats.waiting_processing)
      setReviewCount(stats.shorts_ready_review)
    } catch {
      // ignore initial load
    }
  }

  useEffect(() => {
    loadStatus()
    const timer = setInterval(loadStatus, 6000)
    return () => clearInterval(timer)
  }, [])

  const handleSelectFileFromPicker = async (filepath: string, copyToLibrary: boolean) => {
    try {
      await api.importRecording(filepath, copyToLibrary)
      await loadStatus()
      setCurrentTab('library')
    } catch (err: any) {
      alert(`Import error: ${err.message}`)
    }
  }

  const handleSelectForHighlights = (recId: string) => {
    setActiveRecordingId(recId)
    setCurrentTab('highlights')
  }

  const handleSelectForEditor = (recId: string) => {
    setActiveRecordingId(recId)
    setActiveClip(null)
    setCurrentTab('editor')
  }

  const handleSendClipToEditor = (recId: string, clip: CandidateClip) => {
    setActiveRecordingId(recId)
    setActiveClip(clip)
    setCurrentTab('editor')
  }

  const handleNavigateToPublishing = (short: Short) => {
    setActiveShort(short)
    setCurrentTab('publishing')
  }

  const handleNavigateToEditorFromShort = (short: Short) => {
    setActiveRecordingId(short.recording_id)
    setCurrentTab('editor')
  }

  return (
    <div className="app-container">
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        hardware={hardware}
        waitingCount={waitingCount}
        reviewCount={reviewCount}
      />

      <main className="main-content">
        {currentTab === 'dashboard' && (
          <DashboardPage
            onNavigate={(tab) => setCurrentTab(tab)}
            onOpenImportModal={() => setIsFilePickerOpen(true)}
          />
        )}

        {currentTab === 'library' && (
          <LibraryPage
            onOpenImportModal={() => setIsFilePickerOpen(true)}
            onSelectForHighlights={handleSelectForHighlights}
            onSelectForEditor={handleSelectForEditor}
          />
        )}

        {currentTab === 'highlights' && (
          <HighlightsPage
            initialRecordingId={activeRecordingId}
            onSendToEditor={handleSendClipToEditor}
          />
        )}

        {currentTab === 'editor' && (
          <ShortsEditorPage
            initialRecordingId={activeRecordingId}
            initialClip={activeClip}
            onRenderSuccess={() => {
              loadStatus()
              setCurrentTab('review')
            }}
          />
        )}

        {currentTab === 'review' && (
          <ReviewQueuePage
            onNavigateToEditor={handleNavigateToEditorFromShort}
            onNavigateToPublishing={handleNavigateToPublishing}
          />
        )}

        {currentTab === 'presets' && <PresetsPage />}

        {currentTab === 'publishing' && (
          <PublishingPage
            initialShort={activeShort}
            onNavigateToSettings={() => setCurrentTab('settings')}
          />
        )}

        {currentTab === 'settings' && <SettingsPage />}
      </main>

      {/* Linux Computer File Browser Modal */}
      <FilePickerModal
        isOpen={isFilePickerOpen}
        onClose={() => setIsFilePickerOpen(false)}
        onSelectFile={handleSelectFileFromPicker}
      />
    </div>
  )
}

export default App
