import { useEffect, useState, useCallback } from 'react'
import './App.css'
import './pilot-ui.css'
import './futuristic.css'
import EmbeddableShell from './shell/EmbeddableShell'
import WizardShell from './shell/WizardShell'
import FieldXmlTether from './components/FieldXmlTether'
import IntakeScreen from './features/intake/IntakeScreen'
import MissionStatusFooter from './components/MissionStatusFooter'
import OERPipelineDashboard from './features/oer/OERPipelineDashboard'
import LibrariesView from './features/libraries/LibrariesView'
import ArchiveInventoryView from './features/archive/ArchiveInventoryView'
import { BatchLanesPanel } from './features/dashboard/BatchLanesPanel.jsx'
import { createHttpHostAdapter } from './adapters/http/HttpHostAdapter'
import { missionProfile } from './profiles/mission/missionProfile'
import { collectionProfile } from './profiles/collection/collectionProfile'
import { bediCollectionProfile } from './profiles/bedi/bediCollectionProfile'
import { bediGranuleProfile } from './profiles/bedi/bediGranuleProfile'
import { registerProfile, hasProfile } from './core/registry/ProfileRegistry'
import { writePilotSessionPayloadNow } from './lib/pilotSessionStorage'
import { defaultPilotState, mergeLoadedPilotState } from './lib/pilotValidation'
import { importPilotPartialStateFromXml } from './lib/xmlPilotImport'

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
  /* Default to dark (black-based UI); users can switch to light via header. */
  return 'dark'
}

// ── Workspace hub (forms + toggled views, no left rail) ─────────────────────

const WORKSPACE_HUB_ITEMS = [
  { id: 'intake',    title: 'Forms',          description: 'Upload XML or launch a profile wizard' },
  { id: 'dashboard', title: 'Command Center', description: 'Lanes, readiness, OER pipeline' },
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

/** Single SaaS shell: embed-style toggles + active view below (no separate picker header). */
function WorkspaceHubEmbeddableCard({ activeId, onSelect, children }) {
  return (
    <div className="pilot-workspace-hub-unified pilot-saas-card">
      <div className="pilot-workspace-hub-toggles" role="radiogroup" aria-label="Workspace views">
        {WORKSPACE_HUB_ITEMS.map((item) => {
          const isActive = activeId === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              title={item.description}
              className={`pilot-workspace-embed-toggle${isActive ? ' pilot-workspace-embed-toggle--active' : ''}`}
              onClick={() => onSelect(item.id)}
            >
              {item.title}
            </button>
          )
        })}
      </div>
      <div
        className={
          activeId === 'dashboard'
            ? 'pilot-workspace-hub-unified__body pilot-workspace-hub-unified__body--flush'
            : 'pilot-workspace-hub-unified__body'
        }
      >
        {children}
      </div>
    </div>
  )
}

// ── Dashboard data ────────────────────────────────────────────────────────────
// WORKFLOWS reflect the actual Manta v0.1.0 state as of May 2026.
// Batch lane status (PASS/CHECK/BLOCK) is loaded from localStorage when
// the user has run `npm run batch:report` and the result is stored.

const WORKFLOWS = [
  {
    name: 'Mission / PED',
    status: 'ready',
    score: 92,
    count: 8,
    errors: 1,
    warnings: 4,
    daysOpen: 3,
    trend: 6,
    isoExports: 7,
    swarmPass: 91,
  },
  {
    name: 'BEDI / OER Video',
    status: 'in-progress',
    score: 71,
    count: 107,
    errors: 4,
    warnings: 12,
    daysOpen: 18,
    trend: 3,
    isoExports: 62,
    swarmPass: 68,
  },
  {
    name: 'UxS Missions',
    status: 'in-progress',
    score: 65,
    count: 6,
    errors: 6,
    warnings: 9,
    daysOpen: 14,
    trend: 2,
    isoExports: 4,
    swarmPass: 72,
  },
  {
    name: 'NOFO Closeout',
    status: 'in-progress',
    score: 55,
    count: 2,
    errors: 3,
    warnings: 7,
    daysOpen: 8,
    trend: 0,
    isoExports: 0,
    swarmPass: 50,
  },
  {
    name: 'DigiCat / Archive',
    status: 'blocked',
    score: 38,
    count: 1,
    errors: 9,
    warnings: 5,
    daysOpen: 42,
    trend: -2,
    isoExports: 0,
    swarmPass: 30,
  },
]

const STUCK_RECORDS = [
  {
    title: 'PS2418L0 UUV-01 Norbit MBES — Gulf of Mexico',
    profile: 'UxS / Mission PED',
    state: 'CoMET Ready',
    score: 94,
    blockers: 0,
    errors: 0,
    warnings: 2,
    daysIdle: 1,
    lastTouch: 'today',
    step: 'Distribution',
    uuidShort: 'PS2418…UUV01',
  },
  {
    title: 'BIOLUM2009 VID Dive JSL2-3681 Segment',
    profile: 'BEDI Granule',
    state: 'Align On-Prod',
    score: 72,
    blockers: 1,
    errors: 3,
    warnings: 8,
    daysIdle: 4,
    lastTouch: '2d ago',
    step: 'Keywords',
    uuidShort: 'gov.noaa…3681',
  },
  {
    title: 'OER EX1811 Collection — Validation Review',
    profile: 'Collection',
    state: 'DocuComp CHECK',
    score: 79,
    blockers: 1,
    errors: 2,
    warnings: 6,
    daysIdle: 3,
    lastTouch: '1d ago',
    step: 'Distribution',
    uuidShort: 'EX1811…coll',
  },
  {
    title: 'DigiCat Archive Inventory Intake',
    profile: 'DigiCat / Archive',
    state: 'Needs Adapter',
    score: 38,
    blockers: 2,
    errors: 9,
    warnings: 5,
    daysIdle: 42,
    lastTouch: 'planned',
    step: 'Phase 5',
    uuidShort: '—',
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

function HubKpiGrid() {
  const totalActive = WORKFLOWS.reduce((s, w) => s + w.count, 0)
  const ready = WORKFLOWS.filter((w) => w.status === 'ready').reduce((s, w) => s + w.count, 0)
  const blocked = WORKFLOWS.filter((w) => w.status === 'blocked').reduce((s, w) => s + w.count, 0)
  const totalErr = WORKFLOWS.reduce((s, w) => s + w.errors, 0)
  const avgReadiness = Math.round(WORKFLOWS.reduce((s, w) => s + w.score, 0) / WORKFLOWS.length)

  return (
    <div className="pilot-dashboard__kpi-grid">
      <StatCard label="Active records" value={totalActive} hint="Across lanes" />
      <StatCard label="Ready lane" value={ready} accent="#16a34a" hint="Shippable" />
      <StatCard label="Blocked lane" value={blocked} accent="#dc2626" hint="Needs action" />
      <StatCard label="Open errors" value={totalErr} accent="#f87171" hint="Wizard validation" />
      <StatCard label="Avg readiness" value={`${avgReadiness}%`} accent="var(--primary-color)" hint="Weighted mock" />
    </div>
  )
}

function UxSDashboardPanel({ onNewRecord }) {
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

      <section className="pilot-dashboard__section">
        <h3 className="pilot-dashboard__section-title">Workflow lanes</h3>
        <div
          className="pilot-dashboard__workflow-lanes-row"
          role="region"
          aria-label="Workflow lanes — scroll horizontally"
          tabIndex={0}
        >
          {WORKFLOWS.map(wf => <WorkflowCard key={wf.name} wf={wf} />)}
        </div>
      </section>

      <section className="pilot-dashboard__section">
        <h3 className="pilot-dashboard__section-title">Attention queue</h3>
        <p className="pilot-dashboard__section-desc">Records with blockers or stale edits (sample data)</p>
        <div
          className="pilot-dashboard__attention-queue-row"
          role="region"
          aria-label="Attention queue — scroll horizontally"
          tabIndex={0}
        >
          {STUCK_RECORDS.map(r => <StuckCard key={r.title} rec={r} />)}
        </div>
      </section>

      <div className="pilot-dashboard__kpi-trail">
        <HubKpiGrid />
      </div>
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
            UxS mission hub · OER expedition pipeline ·{' '}
            <span className="pilot-dashboard__date">{dateStr}</span>
          </p>
        </div>
        <div className="pilot-dashboard__header-chips" aria-hidden="true">
          <span className="pilot-dashboard__chip">Validation</span>
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

// ── Intake hub content (Forms tab body) ──────────────────────────────────────

function IntakeHubContent({ onLaunch, onOpenRecord, hostBridge }) {
  const [archiveOpen, setArchiveOpen] = useState(false)

  return (
    <div className="pilot-intake-surface" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      <IntakeScreen onLaunch={onLaunch} />

      {/* Archive toggle */}
      <section className="pilot-saas-card" aria-label="Demo record archive">
        <button
          type="button"
          aria-expanded={archiveOpen}
          onClick={() => setArchiveOpen((v) => !v)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '0.5rem 0',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '0.88rem', fontWeight: 700,
            color: 'var(--text-color, #0f172a)',
          }}
        >
          <span>Archive — Demo records</span>
          <span aria-hidden="true" style={{ fontSize: '0.75rem', opacity: 0.6 }}>
            {archiveOpen ? '▲ Hide' : '▼ Show'}
          </span>
        </button>
        {archiveOpen && (
          <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color, #e2e8f0)', paddingTop: '1rem' }}>
            <ArchiveInventoryView onOpenRecord={onOpenRecord} />
            <div
              style={{
                marginTop: '1.25rem',
                paddingTop: '1.25rem',
                borderTop: '1px solid var(--border-color, #e2e8f0)',
              }}
              aria-label="Library — templates and curated bundles"
            >
              <p style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', color: 'var(--text-muted)', margin: '0 0 0.65rem', textTransform: 'uppercase' }}>
                Library
              </p>
              <div className="pilot-intake-surface">
                <LibrariesView hostBridge={hostBridge} onLaunch={onLaunch} />
              </div>
            </div>
            <div
              style={{
                marginTop: '1.25rem',
                paddingTop: '1.25rem',
                borderTop: '1px solid var(--border-color, #e2e8f0)',
              }}
              aria-label="Workspace readiness KPIs"
            >
              <p style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', color: 'var(--text-muted)', margin: '0 0 0.65rem', textTransform: 'uppercase' }}>
                Workspace readiness (mock)
              </p>
              <HubKpiGrid />
            </div>
          </div>
        )}
      </section>

      <section className="pilot-saas-card" aria-label="Batch audit lanes">
        <BatchLanesPanel />
      </section>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  const [theme, setTheme]     = useState(resolveInitialTheme)
  const [isDirty, setIsDirty] = useState(false)
  /** Hub tabs: intake | dashboard. Wizard overlays full pane. */
  const [workspaceHubId, setWorkspaceHubId] = useState('intake')
  /** Default to mission wizard; intake (“Start from anything”) stays reachable via header toggle / hub. */
  const [mainPane, setMainPane] = useState('wizard') // 'hub' | 'wizard'

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
  /** Bumps when starting a fresh mission so EmbeddableShell remounts from cleared session. */
  const [wizardInstanceKey, setWizardInstanceKey] = useState(0)
  /** When false, Manta FAB / split-float tools dock is hidden and lens stays off. Default off. */
  const [mantaToolsEnabled, setMantaToolsEnabled] = useState(false)

  function handleNewRecord(nextProfileId, nextPlatformHint = null) {
    if (nextProfileId) {
      setActiveProfileId(nextProfileId)
      setPlatformHint(nextPlatformHint)
      setMainPane('wizard')
      return
    }
    setWorkspaceHubId('intake')
    setMainPane('hub')
  }

  const handleLaunch = useCallback((launchProfileId, launchPlatformHint) => {
    if (launchProfileId === 'oerDashboard') {
      setWorkspaceHubId('dashboard')
      setMainPane('hub')
      return
    }
    // Prefill platform type via sessionStorage so missionInitState picks it up.
    if (launchProfileId === 'mission' && launchPlatformHint) {
      const platformType = launchPlatformHint === 'surface' ? 'USV' : 'AUV'
      const prefill = { ...defaultPilotState(), platform: { ...defaultPilotState().platform, platformType } }
      writePilotSessionPayloadNow(prefill, { validationPrimed: false })
    }
    setActiveProfileId(launchProfileId)
    setPlatformHint(launchPlatformHint ?? null)
    setMainPane('wizard')
  }, [])

  return (
    <div className="pilot-app-root">
      <a href="#pilot-main" className="pilot-skip-link">
        Skip to main content
      </a>

      <div className="pilot-body-band">
        <main
          id="pilot-main"
          tabIndex={-1}
          style={{
            flex: 1,
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <header
            className={`header pilot-app-header pilot-app-header--fullbleed${
              mainPane === 'wizard' ? ' pilot-app-header--compact-wizard' : ''
            }`}
          >
            <div className="header-top">
              <div className="pilot-header-brand">
                <p className="pilot-header-eyebrow">
                  NCEI · Ocean Exploration &amp; Research
                </p>
                <h1 className="pilot-header-title-row">
                  Manta
                  <span className="pilot-header-tagline">UxS Metadata Workbench</span>
                </h1>
              </div>
              <div
                id="pilot-header-meta-slot"
                className="pilot-header-meta-slot"
                aria-live="polite"
              />
            </div>
            <div className="pilot-header-toolbar">
              {/* Legacy-style single “work strip”: step pills + metadata tools in one light card. */}
              {mainPane === 'wizard' ? (
                <div className="pilot-header-mission-workstrip">
                  <div
                    id="pilot-header-steps-slot"
                    className="pilot-header-steps-slot"
                    aria-label="Wizard steps"
                  />
                  <div
                    id="pilot-header-tools-slot"
                    className="pilot-header-tools-slot"
                    role="toolbar"
                    aria-label="Metadata and file tools"
                  />
                </div>
              ) : (
                <>
                  <div
                    id="pilot-header-steps-slot"
                    className="pilot-header-steps-slot"
                    aria-label="Wizard steps"
                  />
                  <div
                    id="pilot-header-tools-slot"
                    className="pilot-header-tools-slot"
                    role="toolbar"
                    aria-label="Metadata and file tools"
                  />
                </>
              )}
            </div>
          </header>

          {mainPane === 'hub' && (
            <div className="pilot-workspace-hub-stack">
              <WorkspaceHubEmbeddableCard activeId={workspaceHubId} onSelect={setWorkspaceHubId}>
                {workspaceHubId === 'dashboard' && (
                  <DashboardView onNewRecord={handleNewRecord} onLaunch={handleLaunch} />
                )}

                {workspaceHubId === 'intake' && (
                  <IntakeHubContent
                    hostBridge={hostBridge}
                    onLaunch={handleLaunch}
                    onOpenRecord={({ xmlText, profileId, platformHint } = {}) => {
                      if (xmlText) {
                        try {
                          const parsed = importPilotPartialStateFromXml(xmlText)
                          if (parsed.ok) {
                            const base = defaultPilotState()
                            if (profileId === 'mission' && platformHint) {
                              const platformType = platformHint === 'surface' ? 'USV' : 'AUV'
                              base.platform = { ...base.platform, platformType }
                            }
                            const merged = mergeLoadedPilotState(base, parsed.partial)
                            writePilotSessionPayloadNow(merged, { validationPrimed: true })
                            setActiveProfileId(profileId ?? 'mission')
                            setPlatformHint(platformHint ?? null)
                          }
                        } catch {
                          /* fall through */
                        }
                      }
                      setMainPane('wizard')
                    }}
                  />
                )}
              </WorkspaceHubEmbeddableCard>
            </div>
          )}

          {mainPane === 'wizard' && (
            <div className="pilot-wizard-main-wrap" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <EmbeddableShell
                key={`${activeProfileId}:${platformHint ?? ''}:${wizardInstanceKey}`}
                mode="full"
                includeFloatingManta
                assistantLayout="split-float"
                profileId={activeProfileId}
                hostBridge={hostBridge}
                mantaToolsEnabled={mantaToolsEnabled}
              >
                <WizardShell
                  onDirtyChange={setIsDirty}
                  breadcrumb={{
                    label: wizardNavLabel(activeProfileId, platformHint),
                    onHome: () => { setWorkspaceHubId('dashboard'); setMainPane('hub') },
                    onNewRecord: () => {
                      writePilotSessionPayloadNow(defaultPilotState(), { validationPrimed: false })
                      setActiveProfileId('mission')
                      setPlatformHint(null)
                      setWizardInstanceKey((k) => k + 1)
                      setMainPane('wizard')
                    },
                  }}
                />
              </EmbeddableShell>
            </div>
          )}
        </main>
      </div>

      <MissionStatusFooter
        isDirty={isDirty}
        appVersion={appVersion}
        darkMode={theme === 'dark'}
        onDarkModeChange={(on) => setTheme(on ? 'dark' : 'light')}
        formWizard={mainPane === 'wizard'}
        onFormWizardChange={(on) => {
          if (on) {
            setActiveProfileId('mission')
            setPlatformHint(null)
            setMainPane('wizard')
          } else {
            setWorkspaceHubId('intake')
            setMainPane('hub')
          }
        }}
        lensEnabled={mantaToolsEnabled}
        onLensChange={setMantaToolsEnabled}
      />

      {/* HUD tether: draws a neon line from the focused field to its XML line */}
      <FieldXmlTether />
    </div>
  )
}

export default App
