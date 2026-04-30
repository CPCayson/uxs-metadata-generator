import { useEffect, useState, useCallback } from 'react'
import './App.css'
import './pilot-ui.css'
import './futuristic.css'
import EmbeddableShell from './shell/EmbeddableShell'
import WizardShell from './shell/WizardShell'
import FieldXmlTether from './components/FieldXmlTether'
import MantaProfileWizardTest from './testing/MantaProfileWizardTest'
import IntakeScreen from './features/intake/IntakeScreen'
import MissionStatusFooter from './components/MissionStatusFooter'
import MantaVoiceBar from './components/MantaVoiceBar'
import MantaTutorialDropdown from './components/MantaTutorialDropdown'
import OERPipelineDashboard from './features/oer/OERPipelineDashboard'
import LibrariesView from './features/libraries/LibrariesView'
import ArchiveInventoryView from './features/archive/ArchiveInventoryView'
import OneStopCatalogStrip from './features/dashboard/OneStopCatalogStrip.jsx'
import { createHttpHostAdapter } from './adapters/http/HttpHostAdapter'
import { missionProfile } from './profiles/mission/missionProfile'
import { collectionProfile } from './profiles/collection/collectionProfile'
import { bediCollectionProfile } from './profiles/bedi/bediCollectionProfile'
import { bediGranuleProfile } from './profiles/bedi/bediGranuleProfile'
import { registerProfile, hasProfile } from './core/registry/ProfileRegistry'
import { writePilotSessionPayloadNow } from './lib/pilotSessionStorage'
import { defaultPilotState } from './lib/pilotValidation'

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

// ── Sidebar nav ───────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'dashboard',  label: 'Dashboard' },
  { id: 'newRecord',  label: 'New Record' },
  { id: 'inventory',  label: 'Archive Inventory' },
  { id: 'libraries',  label: 'Libraries' },
]

function wizardNavLabel(activeProfileId, platformHint) {
  if (activeProfileId === 'mission') {
    return platformHint === 'surface' ? 'SUMD / Surface' : 'UxS / Mission PED'
  }
  if (activeProfileId === 'bediGranule')    return 'BEDI Granule'
  if (activeProfileId === 'bediCollection') return 'BEDI Collection'
  if (activeProfileId === 'collection')     return 'Collection record'
  return 'Wizard'
}

function AppNav({ navItem, onNav, activeProfileId, platformHint }) {
  const isWizard = navItem === 'wizard'
  return (
    <nav
      aria-label="Main navigation"
      style={{
        width: 192,
        flexShrink: 0,
        borderRight: '1px solid var(--border-color, #e2e8f0)',
        padding: '1rem 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        background: 'var(--sidebar-bg, #f8fafc)',
      }}
    >
      {NAV_ITEMS.map(({ id, label }) => {
        const isActive = navItem === id || (id === 'newRecord' && isWizard)
        const displayLabel = id === 'newRecord' && isWizard
          ? wizardNavLabel(activeProfileId, platformHint)
          : label
        return (
          <button
            key={id}
            type="button"
            onClick={() => onNav(id === 'newRecord' && isWizard ? 'newRecord' : id)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '0.5rem 1.25rem',
              border: 'none',
              borderRadius: 0,
              background: isActive ? 'var(--nav-active-bg, #e0f2fe)' : 'transparent',
              color: isActive ? 'var(--nav-active-color, #0369a1)' : 'var(--text-color, inherit)',
              fontWeight: isActive ? 600 : 400,
              fontSize: '0.88rem',
              cursor: 'pointer',
              borderLeft: isActive ? '3px solid var(--nav-active-color, #0369a1)' : '3px solid transparent',
            }}
            aria-current={isActive ? 'page' : undefined}
          >
            {displayLabel}
          </button>
        )
      })}
    </nav>
  )
}

// ── Dashboard data (static placeholders until live UxS records exist) ─────────

const WORKFLOWS = [
  {
    name: 'Mission / PED',
    status: 'ready',
    score: 92,
    count: 12,
    errors: 1,
    warnings: 6,
    daysOpen: 5,
    trend: 4,
    isoExports: 9,
    swarmPass: 88,
  },
  {
    name: 'BEDI Granules',
    status: 'in-progress',
    score: 74,
    count: 8,
    errors: 5,
    warnings: 11,
    daysOpen: 12,
    trend: -2,
    isoExports: 4,
    swarmPass: 62,
  },
  {
    name: 'UxS Metadata',
    status: 'in-progress',
    score: 61,
    count: 5,
    errors: 8,
    warnings: 14,
    daysOpen: 21,
    trend: 1,
    isoExports: 2,
    swarmPass: 55,
  },
  {
    name: 'CoMET Cleanup',
    status: 'blocked',
    score: 48,
    count: 3,
    errors: 14,
    warnings: 9,
    daysOpen: 34,
    trend: -6,
    isoExports: 1,
    swarmPass: 41,
  },
]

const STUCK_RECORDS = [
  {
    title: 'OER Expedition EX-2601 Mission Record',
    profile: 'Mission / PED',
    state: 'CoMET Ready',
    score: 92,
    blockers: 0,
    errors: 0,
    warnings: 4,
    daysIdle: 1,
    lastTouch: '2h ago',
    step: 'Distribution',
    uuidShort: 'a3f9…8c21',
  },
  {
    title: 'KABR NEXRAD Level-II Archive 2026-01-01 04Z',
    profile: 'DigiCat',
    state: 'Index Needed',
    score: 68,
    blockers: 2,
    errors: 7,
    warnings: 3,
    daysIdle: 6,
    lastTouch: '1d ago',
    step: 'Spatial',
    uuidShort: '—',
  },
  {
    title: 'Dive 07 BEDI Granule Image Set',
    profile: 'BEDI Granule',
    state: 'Needs Keywords',
    score: 76,
    blockers: 1,
    errors: 2,
    warnings: 9,
    daysIdle: 3,
    lastTouch: '4h ago',
    step: 'Keywords',
    uuidShort: 'd102…e441',
  },
]

const WORKFLOW_STATUS_COLOR = {
  ready:        { text: '#16a34a', bg: 'color-mix(in srgb,#16a34a 12%,var(--card-bg))', border: 'color-mix(in srgb,#16a34a 30%,var(--border-color))', label: 'Ready' },
  'in-progress':{ text: '#d97706', bg: 'color-mix(in srgb,#d97706 10%,var(--card-bg))', border: 'color-mix(in srgb,#d97706 25%,var(--border-color))', label: 'In progress' },
  blocked:      { text: '#dc2626', bg: 'color-mix(in srgb,#dc2626 10%,var(--card-bg))', border: 'color-mix(in srgb,#dc2626 25%,var(--border-color))', label: 'Blocked' },
  unknown:      { text: 'var(--text-muted)', bg: 'var(--card-bg)', border: 'var(--border-color)', label: '—' },
}

// ── Dashboard sub-components ─────────────────────────────────────────────────

function StatCard({ label, value, accent, hint }) {
  return (
    <div className="pilot-dash-kpi">
      <div className="pilot-dash-kpi__value" style={{ color: accent ?? 'var(--primary-color)' }}>
        {value}
      </div>
      <div className="pilot-dash-kpi__label">{label}</div>
      {hint ? <div className="pilot-dash-kpi__hint">{hint}</div> : null}
    </div>
  )
}

function ScoreBar({ score }) {
  const pct = Math.max(0, Math.min(100, Number(score) || 0))
  const color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 3 }}>
        <span>Readiness</span><span>{pct}%</span>
      </div>
      <div style={{ height: 5, borderRadius: 99, background: 'color-mix(in srgb,var(--text-muted) 18%,var(--card-bg))' }}>
        <div style={{ height: 5, borderRadius: 99, width: `${pct}%`, background: color, transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

function WorkflowCard({ wf }) {
  const s = WORKFLOW_STATUS_COLOR[wf.status] ?? WORKFLOW_STATUS_COLOR.unknown
  const tr = typeof wf.trend === 'number' ? wf.trend : 0
  const trendUp = tr > 0
  const trendLabel = tr === 0 ? '±0 pts' : `${trendUp ? '+' : ''}${tr} pts wk`
  return (
    <div
      className="pilot-dash-project"
      style={{
        borderColor: s.border,
        background: s.bg,
      }}
    >
      <div className="pilot-dash-project__head">
        <span className="pilot-dash-project__title">{wf.name}</span>
        <span className="pilot-dash-project__badge" style={{ color: s.text }}>{s.label}</span>
      </div>
      <ScoreBar score={wf.score} />
      <div className="pilot-dash-project__metrics" aria-label="Lane metrics">
        <div className="pilot-dash-metric">
          <span className="pilot-dash-metric__val">{wf.count}</span>
          <span className="pilot-dash-metric__lbl">active</span>
        </div>
        <div className="pilot-dash-metric">
          <span className="pilot-dash-metric__val pilot-dash-metric__val--err">{wf.errors}</span>
          <span className="pilot-dash-metric__lbl">errors</span>
        </div>
        <div className="pilot-dash-metric">
          <span className="pilot-dash-metric__val pilot-dash-metric__val--wrn">{wf.warnings}</span>
          <span className="pilot-dash-metric__lbl">warnings</span>
        </div>
        <div className="pilot-dash-metric">
          <span className="pilot-dash-metric__val">{wf.daysOpen}d</span>
          <span className="pilot-dash-metric__lbl">in queue</span>
        </div>
        <div className="pilot-dash-metric">
          <span className="pilot-dash-metric__val">{wf.isoExports}/{wf.count}</span>
          <span className="pilot-dash-metric__lbl">ISO out</span>
        </div>
        <div className="pilot-dash-metric">
          <span className="pilot-dash-metric__val">{wf.swarmPass}%</span>
          <span className="pilot-dash-metric__lbl">swarm OK</span>
        </div>
      </div>
      <div className="pilot-dash-project__foot">
        <span className={`pilot-dash-trend ${trendUp ? 'pilot-dash-trend--up' : tr < 0 ? 'pilot-dash-trend--down' : ''}`}>
          {trendLabel}
        </span>
        <span className="pilot-dash-project__hint">Avg readiness {wf.score}% · catalog lane</span>
      </div>
    </div>
  )
}

function StuckCard({ rec }) {
  const stateColor = rec.blockers === 0 ? '#16a34a' : rec.blockers >= 2 ? '#dc2626' : '#d97706'
  return (
    <div className="pilot-dash-queue-card">
      <div className="pilot-dash-queue-card__head">
        <span className="pilot-dash-queue-card__title">{rec.title}</span>
        <span className="pilot-dash-queue-card__state" style={{ color: stateColor }}>{rec.state}</span>
      </div>
      <div className="pilot-dash-queue-card__meta">
        <span>{rec.profile}</span>
        {rec.uuidShort !== '—' ? <span className="pilot-dash-queue-card__mono" title="Record id">{rec.uuidShort}</span> : null}
      </div>
      <ScoreBar score={rec.score} />
      <div className="pilot-dash-project__metrics pilot-dash-project__metrics--compact" aria-label="Record signals">
        <div className="pilot-dash-metric">
          <span className="pilot-dash-metric__val pilot-dash-metric__val--err">{rec.errors}</span>
          <span className="pilot-dash-metric__lbl">err</span>
        </div>
        <div className="pilot-dash-metric">
          <span className="pilot-dash-metric__val pilot-dash-metric__val--wrn">{rec.warnings}</span>
          <span className="pilot-dash-metric__lbl">wrn</span>
        </div>
        <div className="pilot-dash-metric">
          <span className="pilot-dash-metric__val">{rec.daysIdle}d</span>
          <span className="pilot-dash-metric__lbl">idle</span>
        </div>
        <div className="pilot-dash-metric">
          <span className="pilot-dash-metric__val" style={{ fontSize: '0.7rem' }}>{rec.lastTouch}</span>
          <span className="pilot-dash-metric__lbl">touched</span>
        </div>
        <div className="pilot-dash-metric pilot-dash-metric--wide">
          <span className="pilot-dash-metric__val" style={{ fontSize: '0.72rem' }}>{rec.step}</span>
          <span className="pilot-dash-metric__lbl">wizard step</span>
        </div>
      </div>
      <span className={`pilot-dash-queue-card__blockers ${rec.blockers > 0 ? 'pilot-dash-queue-card__blockers--bad' : ''}`}>
        {rec.blockers === 0 ? 'No blockers' : `${rec.blockers} blocker${rec.blockers > 1 ? 's' : ''}`}
      </span>
    </div>
  )
}

// ── Dashboard dual-panel ──────────────────────────────────────────────────────

function UxSDashboardPanel({ onNewRecord }) {
  const totalActive = WORKFLOWS.reduce((s, w) => s + w.count, 0)
  const ready       = WORKFLOWS.filter(w => w.status === 'ready').reduce((s, w) => s + w.count, 0)
  const blocked     = WORKFLOWS.filter(w => w.status === 'blocked').reduce((s, w) => s + w.count, 0)
  const totalErr    = WORKFLOWS.reduce((s, w) => s + w.errors, 0)
  const avgReadiness = Math.round(WORKFLOWS.reduce((s, w) => s + w.score, 0) / WORKFLOWS.length)

  return (
    <aside className="pilot-dashboard__rail" aria-label="UxS mission overview">
      <div className="pilot-dashboard__rail-head">
        <div>
          <h2 className="pilot-dashboard__rail-title">UxS / SUMD</h2>
          <p className="pilot-dashboard__rail-sub">Mission metadata · validation lanes</p>
        </div>
        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onNewRecord('mission')}>
          + New record
        </button>
      </div>

      <OneStopCatalogStrip />

      <div className="pilot-dashboard__kpi-grid">
        <StatCard label="Active records" value={totalActive} hint="Across lanes" />
        <StatCard label="Ready lane" value={ready} accent="#16a34a" hint="Shippable" />
        <StatCard label="Blocked lane" value={blocked} accent="#dc2626" hint="Needs action" />
        <StatCard label="Open errors" value={totalErr} accent="#f87171" hint="Validator" />
        <StatCard label="Avg readiness" value={`${avgReadiness}%`} accent="var(--primary-color)" hint="Weighted mock" />
      </div>

      <section className="pilot-dashboard__section">
        <h3 className="pilot-dashboard__section-title">Workflow lanes</h3>
        <div className="pilot-dashboard__stack">
          {WORKFLOWS.map(wf => <WorkflowCard key={wf.name} wf={wf} />)}
        </div>
      </section>

      <section className="pilot-dashboard__section">
        <h3 className="pilot-dashboard__section-title">Attention queue</h3>
        <p className="pilot-dashboard__section-desc">Records with blockers or stale edits (sample data)</p>
        <div className="pilot-dashboard__stack">
          {STUCK_RECORDS.map(r => <StuckCard key={r.title} rec={r} />)}
        </div>
      </section>
    </aside>
  )
}

function DashboardView({ onNewRecord, onLaunch }) {
  const today = new Date()
  const dateStr = today.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="pilot-dashboard">
      <header className="pilot-dashboard__header">
        <div>
          <h1 className="pilot-dashboard__h1">Command center</h1>
          <p className="pilot-dashboard__lede">
            UxS readiness on the left · OER expedition pipeline on the right ·{' '}
            <span className="pilot-dashboard__date">{dateStr}</span>
          </p>
        </div>
        <div className="pilot-dashboard__header-chips" aria-hidden="true">
          <span className="pilot-dashboard__chip">Live validator</span>
          <span className="pilot-dashboard__chip pilot-dashboard__chip--accent">Swarm rules</span>
          <span className="pilot-dashboard__chip">Catalog mode</span>
        </div>
      </header>
      <div className="pilot-dashboard__body">
        <UxSDashboardPanel onNewRecord={onNewRecord} />
        <main className="pilot-dashboard__main">
          <OERPipelineDashboard onLaunch={onLaunch} />
        </main>
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  const [theme, setTheme]     = useState(resolveInitialTheme)
  const [isDirty, setIsDirty] = useState(false)
  const [navItem, setNavItem] = useState('dashboard')

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

  const [activeProfileId, setActiveProfileId]   = useState('mission')
  const [platformHint, setPlatformHint]         = useState(null)

  function handleNewRecord(nextProfileId, nextPlatformHint = null) {
    if (nextProfileId) {
      setActiveProfileId(nextProfileId)
      setPlatformHint(nextPlatformHint)
      setNavItem('wizard')
      return
    }
    setNavItem('newRecord')
  }

  const handleLaunch = useCallback((launchProfileId, launchPlatformHint) => {
    if (launchProfileId === 'oerDashboard') {
      setNavItem('dashboard')
      return
    }
    // Prefill platform type via sessionStorage so missionInitState picks it up.
    if (launchProfileId === 'mission' && launchPlatformHint) {
      const platformType = launchPlatformHint === 'surface' ? 'USV' : 'AUV'
      const prefill = { ...defaultPilotState(), platform: { ...defaultPilotState().platform, platformType } }
      writePilotSessionPayloadNow(prefill)
    }
    setActiveProfileId(launchProfileId)
    setPlatformHint(launchPlatformHint ?? null)
    setNavItem('wizard')
  }, [])

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
        {/* XmlToolsBar portals its buttons into this slot */}
        <div
          id="pilot-header-tools-slot"
          className="pilot-header-tools-slot"
          role="toolbar"
          aria-label="XML tools"
        />
        <MantaVoiceBar profileId={activeProfileId} />
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: 'calc(100vh - var(--header-height, 120px) - var(--footer-height, 40px))' }}>
        <AppNav navItem={navItem} onNav={setNavItem} activeProfileId={activeProfileId} platformHint={platformHint} />

        <main id="pilot-main" tabIndex={-1} style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {navItem === 'dashboard' && (
            <DashboardView onNewRecord={handleNewRecord} onLaunch={handleLaunch} />
          )}

          {navItem === 'newRecord' && (
            <div style={{ padding: '1.5rem', flex: 1 }}>
              <div className="pilot-intake-surface">
                <IntakeScreen onLaunch={handleLaunch} />
              </div>
            </div>
          )}

          {navItem === 'inventory' && (
            <ArchiveInventoryView
              onOpenRecord={() => {
                // Route seam for next phase: inventory row actions can relaunch wizard/intake.
                setNavItem('newRecord')
              }}
            />
          )}
          {navItem === 'libraries' && (
            <LibrariesView hostBridge={hostBridge} onLaunch={handleLaunch} />
          )}

          {navItem === 'wizard' && (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 1.25rem',
                borderBottom: '1px solid var(--border-color, #e2e8f0)',
                fontSize: '0.82rem', color: 'var(--text-muted)',
                background: 'var(--sidebar-bg, #f8fafc)',
                flexShrink: 0,
              }}>
                <button
                  type="button"
                  onClick={() => setNavItem('newRecord')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    border: 'none', background: 'transparent',
                    cursor: 'pointer', color: 'var(--text-muted)',
                    padding: '0 4px', fontSize: '0.82rem',
                  }}
                  aria-label="Back to intake"
                >
                  ← New Record
                </button>
                <button
                  type="button"
                  onClick={() => setNavItem('dashboard')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    border: 'none', background: 'transparent',
                    cursor: 'pointer', color: 'var(--text-muted)',
                    padding: '0 4px', fontSize: '0.82rem',
                  }}
                  aria-label="Back to workbench dashboard"
                >
                  Workbench
                </button>
                <span aria-hidden="true">·</span>
                <span style={{ color: 'var(--text-color, inherit)', fontWeight: 500 }}>
                  {wizardNavLabel(activeProfileId, platformHint)}
                </span>
              </div>
              <EmbeddableShell
                key={activeProfileId + (platformHint ?? '')}
                mode="full"
                includeFloatingManta
                profileId={activeProfileId}
                hostBridge={hostBridge}
              >
                <WizardShell onDirtyChange={setIsDirty} />
              </EmbeddableShell>
            </>
          )}
        </main>
      </div>

      <MissionStatusFooter isDirty={isDirty} appVersion={appVersion} />

      {/* HUD tether: draws a neon line from the focused field to its XML line */}
      <FieldXmlTether />
    </>
  )
}

export default App
