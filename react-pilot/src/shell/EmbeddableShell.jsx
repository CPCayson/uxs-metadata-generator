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
import AssistantShell from './AssistantShell.jsx'
import { getProfile } from '../core/registry/ProfileRegistry.js'
import { WorkflowEngine } from '../core/workflow/WorkflowEngine.js'
import { ValidationEngine } from '../core/validation/ValidationEngine.js'
import { EnrichmentService } from '../core/enrichment/EnrichmentService.js'
import { ExportEngine } from '../core/export/ExportEngine.js'
import { isoXmlAdapter } from '../core/export/adapters/isoXmlAdapter.js'
import { readPilotSessionPayload } from '../lib/pilotSessionStorage.js'
import { defaultPilotState } from '../lib/pilotValidation.js'

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
  children,
}) {
  const mantaFloatActive = mode === 'widget' || (mode === 'full' && includeFloatingManta)
  const [widgetOpen,     setWidgetOpen]     = useState(false)
  const [lensMode,       setLensMode]       = useState(false)
  const [lensTarget,     setLensTarget]     = useState('split')
  const [triggerScore,   setTriggerScore]   = useState(null)   // null | number
  const [triggerPulse,   setTriggerPulse]   = useState(false)  // brief highlight on score update
  const [cometUuid,      setCometUuid]      = useState('')     // UUID of the CoMET record being edited
  const [cometPending,   setCometPending]   = useState(null)   // { parsed, uuid, gaps } awaiting wizard load

  function toggleLens() {
    setLensMode((v) => {
      if (!v) setWidgetOpen(false)   // close popup when entering lens
      return !v
    })
  }

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
  }, [mantaFloatActive])

  // ── Keyboard shortcut: Cmd/Ctrl+Shift+M toggles widget ──────────────────
  useEffect(() => {
    if (!mantaFloatActive) return
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'M') {
        e.preventDefault()
        setWidgetOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mantaFloatActive])

  // ── Live score on trigger button ────────────────────────────────────────
  // Reads sessionStorage on mount, on wizard persist (`manta:pilot-session-updated`), and every 12s.
  useEffect(() => {
    if (!mantaFloatActive) return

    function refresh() {
      try {
        const payload = readPilotSessionPayload()
        const state   = payload?.pilot ?? defaultPilotState()
        const result  = validationEngine.runForPilotState(state, 'lenient')
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
  }, [mantaFloatActive, validationEngine])

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

  const mantaWidgetSurface = (
    <>
      {!widgetOpen && !lensMode && (
        <button
          type="button"
          className={`manta-widget-trigger manta-widget-trigger--arc${triggerPulse ? ' manta-widget-trigger--pulse' : ''}`}
          onClick={() => setWidgetOpen(true)}
          aria-label="Open Manta — metadata and scanner"
          title="Manta — metadata and scanner"
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
      )}
      {(widgetOpen || lensMode) && (
        <AssistantShell
          onClose={() => { setWidgetOpen(false); setLensMode(false) }}
          onOpenEditor={() => { setWidgetOpen(false); setLensMode(false) }}
          onToggleLens={toggleLens}
          lensMode={lensMode}
          lensTarget={lensTarget}
          onLensTargetChange={setLensTarget}
        />
      )}
    </>
  )

  return (
    <MetadataEngineCtx.Provider value={ctx}>
      {mode === 'full' && includeFloatingManta ? (
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
    </MetadataEngineCtx.Provider>
  )
}
