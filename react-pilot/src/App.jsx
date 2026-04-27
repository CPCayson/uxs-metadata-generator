import { useEffect, useState } from 'react'
import './App.css'
import './pilot-ui.css'
import './futuristic.css'
import EmbeddableShell from './shell/EmbeddableShell'
import WizardShell from './shell/WizardShell'
import FieldXmlTether from './components/FieldXmlTether'
import MantaProfileWizardTest from './testing/MantaProfileWizardTest'
import MissionStatusFooter from './components/MissionStatusFooter'
import MantaVoiceBar from './components/MantaVoiceBar'
import MantaTutorialDropdown from './components/MantaTutorialDropdown'
import { createHttpHostAdapter } from './adapters/http/HttpHostAdapter'
import { missionProfile } from './profiles/mission/missionProfile'
import { collectionProfile } from './profiles/collection/collectionProfile'
import { bediCollectionProfile } from './profiles/bedi/bediCollectionProfile'
import { bediGranuleProfile } from './profiles/bedi/bediGranuleProfile'
import { registerProfile, hasProfile } from './core/registry/ProfileRegistry'

// Register profiles once at module evaluation time.
// hasProfile guard prevents double-registration in React StrictMode.
if (!hasProfile('mission'))         registerProfile(missionProfile)
if (!hasProfile('collection'))      registerProfile(collectionProfile)
if (!hasProfile('bediCollection'))  registerProfile(bediCollectionProfile)
if (!hasProfile('bediGranule'))     registerProfile(bediGranuleProfile)

// Singleton — stable across renders. All persistence and server actions use POST /api/db.
const hostBridge = createHttpHostAdapter()

const THEME_KEY = 'uxsTheme'

function resolveInitialTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // Ignore storage access errors in restricted environments.
  }
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
  return 'light'
}

function App() {
  const [theme, setTheme] = useState(resolveInitialTheme)
  const [isDirty, setIsDirty] = useState(false)
  const [profileId, setProfileId] = useState('mission')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // Ignore storage access errors in restricted environments.
    }
  }, [theme])

  const appVersion =
    typeof import.meta.env !== 'undefined' && typeof import.meta.env.VITE_APP_VERSION === 'string'
      ? import.meta.env.VITE_APP_VERSION
      : 'dev'

  return (
    <>
      <a href="#pilot-main" className="pilot-skip-link">
        Skip to main content
      </a>
      <header className="header pilot-app-header pilot-app-header--fullbleed">
        <div className="header-top">
          <div className="pilot-header-brand">
            <p className="pilot-header-eyebrow">Isolated pilot</p>
            <h1>UxS Metadata React Pilot</h1>
          </div>
          <div className="pilot-header-actions">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label htmlFor="profileSelect" className="form-label mb-0" style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                Profile:
              </label>
              <select
                id="profileSelect"
                className="form-select form-select-sm"
                style={{ width: 'auto' }}
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
              >
                <option value="mission">Mission</option>
                <option value="collection">Collection</option>
                <option value="bediCollection">BEDI Collection</option>
                <option value="bediGranule">BEDI Granule</option>
                <option value="mantaProfileWizardTest">[TEST] Manta profile wizard</option>
              </select>
            </div>
            <div className="form-check form-switch mb-0 d-flex align-items-center">
              <input
                className="form-check-input"
                type="checkbox"
                id="pilotThemeToggle"
                checked={theme === 'dark'}
                onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')}
                aria-label="Toggle dark theme"
              />
              <label className="form-check-label ms-2 mb-0" htmlFor="pilotThemeToggle">
                Dark mode
              </label>
            </div>
            <MantaTutorialDropdown />
          </div>
        </div>
        {/* XmlToolsBar portals its buttons into this slot so every profile
            surfaces Import / Copy / Download / GeoJSON / DCAT alongside the
            profile picker — not buried in a side panel. */}
        <div
          id="pilot-header-tools-slot"
          className="pilot-header-tools-slot"
          role="toolbar"
          aria-label="XML tools"
        />
        <MantaVoiceBar profileId={profileId} />
      </header>

      <main id="pilot-main" tabIndex={-1} className="pilot-shell">
        {profileId === 'mantaProfileWizardTest' ? (
          <MantaProfileWizardTest />
        ) : (
          <EmbeddableShell
            key={profileId}
            mode="full"
            includeFloatingManta
            profileId={profileId}
            hostBridge={hostBridge}
          >
            <WizardShell onDirtyChange={setIsDirty} />
          </EmbeddableShell>
        )}
      </main>

      <MissionStatusFooter isDirty={isDirty} appVersion={appVersion} />

      {/* HUD tether: draws a neon line from the focused field to its XML line */}
      <FieldXmlTether />
    </>
  )
}

export default App
