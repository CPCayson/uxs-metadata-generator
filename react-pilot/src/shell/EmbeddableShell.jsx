/**
 * EmbeddableShell — top-level shell container.
 *
 * Sets up the MetadataEngineContext from props and renders the appropriate
 * sub-shell based on `mode`. This is the single mount point for the app
 * regardless of where it is embedded.
 *
 * Modes:
 *   'full'    → full-page WizardShell (current App.jsx behavior)
 *   'sidebar' → WizardShell in a fixed-width sidebar panel
 *   'panel'   → WizardShell embedded inline with no outer chrome
 *   'widget'  → AssistantShell (Manta Ray floating card) only — e.g. standalone embeds
 *
 * When `includeFloatingManta` is true with `mode="full"`, the wizard and the
 * Manta FAB share one MetadataEngineContext (host bridge, validation engine,
 * CoMET state, profile). Validation / forms / tutorial still sync via
 * `sessionStorage` + `manta:*` window events as before.
 *
 * Usage:
 *   import { createHttpHostAdapter } from '../adapters/http/HttpHostAdapter.js'
 *   <EmbeddableShell mode="full" includeFloatingManta profileId="mission" hostBridge={createHttpHostAdapter()}>
 *     <WizardShell />
 *   </EmbeddableShell>
 */

import { useMemo, useState, useEffect, useCallback, Suspense } from 'react'
import { MetadataEngineCtx } from './context.js'
import { CometWorkbenchBridgeProvider } from './CometWorkbenchBridge.jsx'
import AssistantShell from './AssistantShell.jsx'
import { getProfile } from '../core/registry/ProfileRegistry.js'
import { WorkflowEngine } from '../core/workflow/WorkflowEngine.js'
import { ValidationEngine } from '../core/validation/ValidationEngine.js'
import { EnrichmentService } from '../core/enrichment/EnrichmentService.js'
import { ExportEngine } from '../core/export/ExportEngine.js'
import { isoXmlAdapter } from '../core/export/adapters/isoXmlAdapter.js'
import { readPilotSessionPayload } from '../lib/pilotSessionStorage.js'
import { defaultPilotState } from '../lib/pilotValidation.js'
import { WorkbenchChromeProvider } from './WorkbenchChromeProvider.jsx'

const WORKSPACE_DENSITY_SS_KEY = 'manta-workspace-density-v1'

function readWorkspaceDensity() {
  try {
    const r = sessionStorage.getItem(WORKSPACE_DENSITY_SS_KEY)
    if (r === 'simple' || r === 'granular') return r
  } catch {
    /* */
  }
  return 'simple'
}

/** True when session payload looks like real metadata (import or filled wizard), not an empty shell. */
function sessionLooksParsed() {
  try {
    const payload = readPilotSessionPayload()
    const p = payload?.pilot
    if (!p?.mission) return false
    const m = p.mission
    if (String(m.missionTitle || m.title || '').trim().length > 1) return true
    if (String(m.abstract || '').trim().length > 12) return true
    if (String(p.ident?.fileIdentifier || '').trim().length > 3) return true
    if (String(m.contactEmail || '').includes('@')) return true
    return false
  } catch {
    return false
  }
}

/**
 * @param {{
 *   mode?: import('./context.js').ShellMode,
 *   profileId?: string,
 *   hostBridge: import('../adapters/HostBridge.js').HostBridge,
 *   hostContext?: import('./context.js').HostContext,
 *   onRecordSaved?: (entity: object) => void,
 *   onValidationComplete?: (result: object) => void,
 *   onPublish?: (entity: object) => void,
 *   onCancel?: () => void,
 *   initialEntity?: object,
 *   readOnly?: boolean,
 *   theme?: 'light'|'dark'|'system',
 *   includeFloatingManta?: boolean,
 *   assistantLayout?: 'floating' | 'left' | 'split-float',
 *   mantaToolsEnabled?: boolean,
 *   children?: import('react').ReactNode,
 * }} props
 */
export default function EmbeddableShell({
  mode = 'full',
  profileId = 'mission',
  hostBridge,
  hostContext = {},
  onRecordSaved,
  onPublish,
  onCometLoad,
  readOnly = false,
  includeFloatingManta = false,
  assistantLayout = 'floating',
  mantaToolsEnabled = true,
  children,
}) {
  const mantaFloatActive = mode === 'widget' || (mode === 'full' && includeFloatingManta)
  const [widgetOpen,     setWidgetOpen]     = useState(false)

  /** Open lens when metadata looks parsed or after import merge (EmbeddableShell sets true). */
  const [lensMode,       setLensMode]       = useState(false)
  const [lensTarget,     setLensTarget]     = useState('form')
  const [triggerScore,   setTriggerScore]   = useState(null)   // null | number
  const [triggerPulse,   setTriggerPulse]   = useState(false)  // brief highlight on score update
  const [cometUuid,      setCometUuid]      = useState('')     // UUID of the CoMET record being edited
  const [cometPending,   setCometPending]   = useState(null)   // { parsed, uuid, gaps } awaiting wizard load

  /** simple = minimal wizard chrome when Lens is on; granular = full helper copy on the surface */
  const [workspaceDensity, setWorkspaceDensityState] = useState(readWorkspaceDensity)

  const setWorkspaceDensity = useCallback((d) => {
    if (d !== 'simple' && d !== 'granular') return
    setWorkspaceDensityState(d)
  }, [])

  useEffect(() => {
    if (mantaToolsEnabled) return
    setLensMode(false)
    setWidgetOpen(false)
  }, [mantaToolsEnabled])

  useEffect(() => {
    try {
      sessionStorage.setItem(WORKSPACE_DENSITY_SS_KEY, workspaceDensity)
    } catch {
      /* */
    }
  }, [workspaceDensity])

  function toggleLens() {
    setLensMode((v) => {
      if (!v) setWidgetOpen(false)   // close popup when entering lens
      return !v
    })
  }

  /** Open the workspace lens directly (no Manta card) — FAB + StepNav stream. */
  function openLensOnly() {
    setWidgetOpen(false)
    setLensMode(true)
  }

  /** Full Manta panel (VALIDATE / ASK / SEARCH / LIVE / CoMET) — Lens mode hides this UI. */
  const openMantaAssistantPanel = useCallback(() => {
    setLensMode(false)
    setWidgetOpen(true)
    queueMicrotask(() => {
      window.dispatchEvent(new CustomEvent('manta:assistant-tab', { detail: { tab: 'ask' } }))
    })
  }, [])

  const profile = useMemo(() => {
    try {
      return getProfile(profileId)
    } catch {
      // Profile not yet registered (happens during tests or early mount).
      return null
    }
  }, [profileId])

  const workflowEngine = useMemo(
    () => (profile ? new WorkflowEngine(profile.steps) : null),
    [profile],
  )

  const validationEngine = useMemo(() => new ValidationEngine(), [])

  const enrichmentService = useMemo(() => new EnrichmentService(), [])

  const exportEngine = useMemo(() => new ExportEngine([isoXmlAdapter]), [])

  // Voice / custom events: open scanner lens without the floating card expanded
  useEffect(() => {
    if (!mantaFloatActive) return
    function onOpen() {
      if (!mantaToolsEnabled) return
      setWidgetOpen(false)
      setLensMode(true)
    }
    function onClose() {
      setLensMode(false)
    }
    window.addEventListener('manta:open-lens', onOpen)
    window.addEventListener('manta:close-lens', onClose)
    return () => {
      window.removeEventListener('manta:open-lens', onOpen)
      window.removeEventListener('manta:close-lens', onClose)
    }
  }, [mantaFloatActive, mantaToolsEnabled])

  useEffect(() => {
    if (!mantaFloatActive) return
    function onWidgetEvent(/** @type {CustomEvent} */ e) {
      if (!mantaToolsEnabled) return
      const action = e?.detail?.action
      if (action === 'open') {
        setLensMode(false)
        setWidgetOpen(true)
      } else if (action === 'close') {
        setWidgetOpen(false)
        setLensMode(false)
      } else if (action === 'toggle') {
        setLensMode(false)
        setWidgetOpen((v) => !v)
      }
    }
    function onLensTarget(/** @type {CustomEvent} */ e) {
      if (!mantaToolsEnabled) return
      const target = e?.detail?.target
      if (target !== 'xml' && target !== 'form' && target !== 'split') return
      setLensTarget(target)
      setWidgetOpen(false)
      setLensMode(true)
    }
    window.addEventListener('manta:widget', onWidgetEvent)
    window.addEventListener('manta:lens-target', onLensTarget)
    return () => {
      window.removeEventListener('manta:widget', onWidgetEvent)
      window.removeEventListener('manta:lens-target', onLensTarget)
    }
  }, [mantaFloatActive, mantaToolsEnabled])

  // ── Keyboard shortcut: Cmd/Ctrl+Shift+M toggles widget ──────────────────
  useEffect(() => {
    if (!mantaFloatActive || !mantaToolsEnabled) return
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'M') {
        e.preventDefault()
        setWidgetOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mantaFloatActive, mantaToolsEnabled])

  // ── Live score on trigger button ────────────────────────────────────────
  // Reads sessionStorage on mount, on wizard persist (`manta:pilot-session-updated`), and every 12s.
  useEffect(() => {
    if (!mantaFloatActive) return

    function refresh() {
      try {
        const payload = readPilotSessionPayload()
        const state   = payload?.pilot ?? defaultPilotState()
        const result  = validationEngine.run({ profile, state, mode: 'lenient' })
        setTriggerScore((prev) => {
          if (prev !== result.score) {
            setTriggerPulse(true)
            setTimeout(() => setTriggerPulse(false), 1200)
          }
          return result.score
        })
      } catch {
        // Ignore errors during background refresh
      }
    }

    window.addEventListener('manta:pilot-session-updated', refresh)
    refresh()
    const id = setInterval(refresh, 12000)
    return () => {
      window.removeEventListener('manta:pilot-session-updated', refresh)
      clearInterval(id)
    }
  }, [mantaFloatActive, validationEngine, profile])

  useEffect(() => {
    if (!mantaFloatActive || !mantaToolsEnabled) return
    function onImportMerged() {
      setLensMode(true)
    }
    window.addEventListener('manta:metadata-import-merged', onImportMerged)
    return () => window.removeEventListener('manta:metadata-import-merged', onImportMerged)
  }, [mantaFloatActive, mantaToolsEnabled])

  useEffect(() => {
    if (!mantaFloatActive || assistantLayout !== 'split-float' || !mantaToolsEnabled) return
    if (sessionLooksParsed()) setLensMode(true)
  }, [mantaFloatActive, assistantLayout, profileId, mantaToolsEnabled])

  // onCometLoad is called by AssistantShell's COMET tab when the user clicks
  // "Load into Wizard". It stores the pending load so WizardShell can react.
  const handleCometLoad = useCallback((parsed, uuid, gaps) => {
    setCometUuid(uuid)
    setCometPending({ parsed, uuid, gaps })
    onCometLoad?.(parsed, uuid, gaps)
  }, [onCometLoad])

  // WizardShell calls this after it has consumed the pending load.
  const clearCometPending = useCallback(() => setCometPending(null), [])

  /** @type {import('./context.js').MetadataEngineContextValue | null} */
  const ctx = useMemo(() => {
    if (!profile || !workflowEngine) return null
    return {
      profile,
      workflowEngine,
      validationEngine,
      enrichmentService,
      exportEngine,
      hostBridge,
      hostContext,
      mode,
      readOnly,
      onRecordSaved,
      onPublish,
      onCometLoad: handleCometLoad,
      clearCometPending,
      cometUuid,
      cometPending,
    }
  }, [
    profile,
    workflowEngine,
    validationEngine,
    enrichmentService,
    exportEngine,
    hostBridge,
    hostContext,
    mode,
    readOnly,
    onRecordSaved,
    onPublish,
    handleCometLoad,
    clearCometPending,
    cometUuid,
    cometPending,
  ])

  if (!ctx) {
    return (
      <div className="embeddable-shell embeddable-shell--loading">
        Loading metadata engine…
      </div>
    )
  }

  const fabCluster =
    mantaToolsEnabled && !widgetOpen && !lensMode && assistantLayout === 'floating' ? (
      <div className="manta-fab-cluster" role="group" aria-label="Manta Lens and assistant">
        <button
          type="button"
          className="manta-lens-fab"
          onClick={openLensOnly}
          aria-label="Open Manta Lens — validation scanner over workspace"
          title="Lens — scan form and XML for issues (Esc to close)"
        >
          <span className="manta-lens-fab__glyph" aria-hidden="true">
            ⌕
          </span>
        </button>
        <button
          type="button"
          className={`manta-widget-trigger manta-widget-trigger--arc${triggerPulse ? ' manta-widget-trigger--pulse' : ''}`}
          onClick={() => setWidgetOpen(true)}
          aria-label="Open Manta — metadata assistant"
          title="Manta — metadata assistant and tools"
        >
          {triggerScore !== null && (
            <span
              className="manta-widget-trigger__score manta-widget-trigger__score--arc"
              style={{
                color: triggerScore >= 80
                  ? 'var(--manta-success,#4ade80)'
                  : triggerScore >= 50
                    ? 'var(--manta-warning,#fbbf24)'
                    : 'var(--manta-error,#f87171)',
              }}
            >
              {triggerScore}
            </span>
          )}
        </button>
      </div>
    ) : null

  const assistantProps = {
    onClose: () => { setWidgetOpen(false); setLensMode(false) },
    onOpenEditor: () => { setWidgetOpen(false); setLensMode(false) },
    onToggleLens: toggleLens,
    onOpenMantaAssistant: mantaFloatActive ? openMantaAssistantPanel : undefined,
    lensMode,
    lensTarget,
    onLensTargetChange: setLensTarget,
    onCloseLens: () => setLensMode(false),
    onOpenLensOnly: openLensOnly,
  }

  const mantaWidgetSurface = (
    <>
      {fabCluster}
      {(widgetOpen || lensMode) && assistantLayout === 'floating' && mantaToolsEnabled && (
        <AssistantShell
          {...assistantProps}
        />
      )}
    </>
  )

  const splitFloatAssistant =
    assistantLayout === 'split-float' && mantaFloatActive && mantaToolsEnabled ? (
      <AssistantShell
        {...assistantProps}
        layoutVariant="split-float"
      />
    ) : null

  return (
    <MetadataEngineCtx.Provider value={ctx}>
      <CometWorkbenchBridgeProvider>
      <WorkbenchChromeProvider
        assistantLayout={assistantLayout}
        lensActive={Boolean(mantaToolsEnabled && lensMode)}
        workspaceDensity={workspaceDensity}
        setWorkspaceDensity={setWorkspaceDensity}
      >
      {mode === 'full' && includeFloatingManta && assistantLayout === 'split-float' ? (
        <>
          <div
            className="embeddable-shell embeddable-shell--full embeddable-shell--split-float-main"
            data-shell-mode="full"
            data-assistant-layout="split-float"
            data-profile={profileId}
          >
            <Suspense fallback={<div className="embeddable-shell__loading">Loading…</div>}>
              {children}
            </Suspense>
          </div>
          <div
            className="embeddable-shell embeddable-shell--widget embeddable-shell--widget-split-float"
            data-shell-mode="widget"
            data-manta-bridged="true"
            data-profile={profileId}
          >
            {splitFloatAssistant}
          </div>
        </>
      ) : mode === 'full' && includeFloatingManta ? (
        <>
          <div
            className="embeddable-shell embeddable-shell--full"
            data-shell-mode="full"
            data-profile={profileId}
          >
            <Suspense fallback={<div className="embeddable-shell__loading">Loading…</div>}>
              {children}
            </Suspense>
          </div>
          <div
            className="embeddable-shell embeddable-shell--widget"
            data-shell-mode="widget"
            data-manta-bridged="true"
            data-profile={profileId}
          >
            {mantaWidgetSurface}
          </div>
        </>
      ) : mode === 'widget' ? (
        <div
          className="embeddable-shell embeddable-shell--widget"
          data-shell-mode="widget"
          data-profile={profileId}
        >
          {mantaWidgetSurface}
        </div>
      ) : (
        <div
          className={`embeddable-shell embeddable-shell--${mode}`}
          data-shell-mode={mode}
          data-profile={profileId}
        >
          <Suspense fallback={<div className="embeddable-shell__loading">Loading…</div>}>
            {children}
          </Suspense>
        </div>
      )}
      </WorkbenchChromeProvider>
      </CometWorkbenchBridgeProvider>
    </MetadataEngineCtx.Provider>
  )
}
