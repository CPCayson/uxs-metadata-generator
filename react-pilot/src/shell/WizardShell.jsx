/**
 * WizardShell — the multi-step metadata wizard UI.
 *
 * Profile-agnostic: all rendering and navigation decisions derive from
 * `profile` (steps, capabilities, methods). Mission-specific host-backed actions
 * live in `useMissionActions`; they are unavailable for profiles that
 * declare the corresponding capability as `false`.
 *
 * Props:
 *   onDirtyChange  — callback(isDirty: boolean) to lift dirty state up to App.jsx
 *
 * @module shell/WizardShell
 */

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, Suspense } from 'react'
import StepNav from '../components/StepNav'
import ValidationPanel from '../components/ValidationPanel'
import ReadinessStrip from '../components/ReadinessStrip.jsx'
import XmlPreviewPanel from '../components/XmlPreviewPanel'
import XmlToolsBar from '../components/XmlToolsBar'
import DebugLogPanel from '../components/DebugLogPanel'
import { schedulePersistPilotSession, writePilotSessionPayloadNow } from '../lib/pilotSessionStorage'
import { applyPilotAutoFixes } from '../lib/pilotAutoFix.js'
import { computeReadinessBundles, computeReadinessSnapshot } from '../lib/readinessSummary.js'
import { scrollToField } from '../core/registry/FieldRegistry.js'
import { pushPilotDebug } from '../lib/pilotDebugLog'
import { useMetadataEngine } from './context.js'
import { useMissionActions } from './hooks/useMissionActions.js'
import { useMissionCometActions } from '../profiles/mission/useMissionCometActions.js'
import CometPushPanel from '../features/comet/CometPushPanel.jsx'
import { isoXmlAdapter } from '../core/export/adapters/isoXmlAdapter.js'
import { getPilotFieldLabelFallback } from '../lib/pilotFieldLabelFallback.js'
import { emitPilotAuditEvent } from '../lib/pilotAuditEvents.js'
import { setPilotFieldPath } from '../lib/pilotStateFieldSet.js'

/**
 * @param {{
 *   onDirtyChange: (isDirty: boolean) => void,
 * }} props
 */
export default function WizardShell({ onDirtyChange }) {
  const {
    profile,
    workflowEngine,
    validationEngine,
    hostBridge,
    onPublish,
  } = useMetadataEngine()

  // Local CoMET state — owned here, populated via cross-context window event.
  const [cometUuid, setCometUuid] = useState('')
  const cap = profile.capabilities ?? {}
  const showCometPanel = Boolean(cap.cometPull || cap.cometPreflight || cap.cometPush)

  // Every profile gets a live XML tab. Use the profile's own builder when
  // available; fall back to the shared isoXmlAdapter so all profiles render
  // something real rather than hiding the preview entirely.
  const buildXml = useMemo(
    () => (typeof profile.buildXmlPreview === 'function'
      ? profile.buildXmlPreview.bind(profile)
      : (state) => isoXmlAdapter.generate(state)),
    [profile],
  )

  const baselineSerialized = useRef('')
  const [activeStep, setActiveStep] = useState(() => profile.steps[0]?.id ?? 'mission')

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('manta:wizard-active-step', { detail: { stepId: activeStep } }),
    )
  }, [activeStep])

  const [pilotState, setPilotState] = useState(() => {
    // Profiles that declare initState() get seeded + session-restored state.
    // All others start from a clean defaultState().
    const s = profile.initState?.() ?? profile.defaultState()
    baselineSerialized.current = JSON.stringify(profile.sanitize(s))
    return s
  })

  const setMode = useCallback(
    (mode) => {
      setPilotState((p) => ({ ...p, mode }))
      emitPilotAuditEvent({
        profileId: profile.id,
        action: 'validationMode',
        result: 'set',
        mode,
      })
    },
    [profile.id],
  )

  const [isDirty, setIsDirty] = useState(false)
  const [lastSavedXmlPreview, setLastSavedXmlPreview] = useState('')
  const [touched, setTouched] = useState({})
  const [showAllErrors, setShowAllErrors] = useState(true)
  const [sidePanelTab, setSidePanelTab] = useState('validator')
  const [xmlExpanded, setXmlExpanded] = useState(false)
  const [statusMessage, setStatusMessage] = useState('Ready')
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState({ platforms: 'not checked', templates: 'not checked' })

  const pilotRef = useRef(pilotState)
  pilotRef.current = pilotState

  const hostBridgeReady = hostBridge.isAvailable()
  const hostRuntimeLabel = hostBridgeReady ? 'Postgres API (HTTP /api/db)' : 'Host bridge not connected'

  // Called by useMissionActions after any save/load that should reset dirty state.
  const onStateLoaded = useCallback((cleanState) => {
    baselineSerialized.current = JSON.stringify(cleanState)
    setIsDirty(false)
    onDirtyChange(false)
  }, [onDirtyChange])

  const ma = useMissionActions({
    profile,
    pilotState,
    setPilotState,
    hostBridge,
    hostBridgeReady,
    activeStep,
    setStatusMessage,
    setTouched,
    setShowAllErrors,
    onStateLoaded,
    onXmlPreviewUpdate: setLastSavedXmlPreview,
  })

  const comet = useMissionCometActions({
    profile,
    pilotState,
    buildXml,
    cometUuid,
    setCometUuid,
    setPilotState,
    setTouched,
    setShowAllErrors,
    setMode,
    baselineSerializedRef: baselineSerialized,
    onStatus: setStatusMessage,
    onPublish,
    capabilities: cap,
  })

  useEffect(() => {
    if (!showCometPanel && sidePanelTab === 'comet') setSidePanelTab('validator')
  }, [showCometPanel, sidePanelTab])

  // Defer validation (and step-status) off the keystroke hot path. React
  // renders the form inputs first, then reconciles the validator/XML tree
  // when idle, keeping typing snappy even with large rule sets.
  const deferredPilotState = useDeferredValue(pilotState)

  const validation = useMemo(
    () =>
      profile.validationRuleSets?.length
        ? validationEngine.runProfileRules(deferredPilotState, deferredPilotState.mode || 'lenient', profile)
        : validationEngine.runForPilotState(deferredPilotState, deferredPilotState.mode || 'lenient'),
    [validationEngine, profile, deferredPilotState],
  )

  const readinessSnapshot = useMemo(
    () => computeReadinessSnapshot(deferredPilotState, validationEngine, profile),
    [deferredPilotState, validationEngine, profile],
  )

  const readinessBundles = useMemo(
    () => computeReadinessBundles(readinessSnapshot, {
      preflightSummary: comet.preflightSummary,
      isDirty,
    }),
    [readinessSnapshot, comet.preflightSummary, isDirty],
  )

  const stepStatuses = useMemo(
    () => workflowEngine.stepCompletionFromIssues(validation.issues),
    [workflowEngine, validation.issues],
  )

  const activeStepMeta = profile.steps.find((s) => s.id === activeStep) ?? profile.steps[0]
  const ActiveStep = activeStepMeta?.component ?? null

  // ── Dirty tracking (debounced: JSON.stringify is expensive) ─────────────
  useEffect(() => {
    const t = window.setTimeout(() => {
      const cur = JSON.stringify(profile.sanitize(pilotState))
      const dirty = cur !== baselineSerialized.current
      setIsDirty(dirty)
      onDirtyChange(dirty)
    }, 160)
    return () => window.clearTimeout(t)
  }, [pilotState, profile, onDirtyChange])

  // ── Session persistence (already throttled internally; now also waits
  //    one paint so the keystroke lands first) ──────────────────────────
  useEffect(() => {
    const raf = window.requestAnimationFrame(() => schedulePersistPilotSession(pilotState))
    return () => window.cancelAnimationFrame(raf)
  }, [pilotState])

  // Manta widget / Lens "Fix Issues" — apply safe auto-fixes to live wizard state
  useEffect(() => {
    function runValidationCount(state, mode) {
      return profile.validationRuleSets?.length
        ? validationEngine.runProfileRules(state, mode, profile).issues.length
        : validationEngine.runForPilotState(state, mode).issues.length
    }
    function onAutoFixRequest(/** @type {CustomEvent} */ e) {
      const raw = e?.detail?.mode
      const mode = raw === 'strict' || raw === 'catalog' ? raw : 'lenient'
      const cur = pilotRef.current
      const before = runValidationCount(cur, mode)
      const { pilot: patched, applied } = applyPilotAutoFixes(mode, cur)
      const next = profile.sanitize(patched)
      if (applied.length === 0) {
        setStatusMessage('No automatic fixes were applicable. Trim, ordering, and default language are already OK, or fields need real data.')
        return
      }
      const after = runValidationCount(next, mode)
      setPilotState(next)
      writePilotSessionPayloadNow(next)
      setShowAllErrors(true)
      const preview = applied.length > 6 ? `${applied.slice(0, 6).join('; ')}…` : applied.join('; ')
      setStatusMessage(`Auto-fix (${applied.length}): ${preview} — issues ${before}→${after}`)
    }
    window.addEventListener('manta:pilot-auto-fix-request', onAutoFixRequest)
    return () => window.removeEventListener('manta:pilot-auto-fix-request', onAutoFixRequest)
  }, [profile, validationEngine])

  // Lens chip "apply value" / quick set — merges into live wizard state
  useEffect(() => {
    function onSetField(/** @type {CustomEvent} */ e) {
      const field = e?.detail?.field
      const { value } = e.detail ?? {}
      if (typeof field !== 'string' || !field.trim()) return
      try {
        const next = setPilotFieldPath(pilotRef.current, field, value)
        const san = profile.sanitize(next)
        setPilotState(san)
        writePilotSessionPayloadNow(san)
        setShowAllErrors(true)
        setStatusMessage(`Updated ${field} from Manta lens quick action.`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setStatusMessage(`Could not set ${field}: ${msg}`)
      }
    }
    window.addEventListener('manta:set-pilot-field', onSetField)
    return () => window.removeEventListener('manta:set-pilot-field', onSetField)
  }, [profile, setPilotState, setStatusMessage])

  // Metadata widget — sync validation mode when user taps Readiness / mode controls there
  useEffect(() => {
    function onSetValidationMode(/** @type {CustomEvent} */ e) {
      const raw = e?.detail?.mode
      if (raw !== 'lenient' && raw !== 'strict' && raw !== 'catalog') return
      setMode(raw)
      setShowAllErrors(true)
      setStatusMessage(`Validation mode set to ${raw} (from Metadata widget).`)
    }
    window.addEventListener('manta:set-validation-mode', onSetValidationMode)
    return () => window.removeEventListener('manta:set-validation-mode', onSetValidationMode)
  }, [setMode])

  // Keep Manta widget quality mode in sync when the user changes mode in the Validator panel
  useEffect(() => {
    const m = pilotState.mode
    if (m !== 'lenient' && m !== 'strict' && m !== 'catalog') return
    window.dispatchEvent(new CustomEvent('manta:wizard-validation-mode-changed', { detail: { mode: m } }))
  }, [pilotState.mode])

  // ── Unload guard ─────────────────────────────────────────────────────────
  useEffect(() => {
    function onBeforeUnload(e) {
      if (!isDirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  // ── Cmd/Ctrl+S shortcut ──────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        if (!hostBridgeReady) return
        e.preventDefault()
        void ma.savePilotDraft()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hostBridgeReady, ma])

  function setTouchedKey(key) {
    setTouched((prev) => ({ ...prev, [key]: true }))
  }

  const navigateToPilotField = useCallback((field) => {
    const step = workflowEngine.stepForField(field)
    setActiveStep(step)
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const ok = scrollToField(field)
        if (!ok) setStatusMessage(`Could not find a control for "${field}". Open the matching step manually if needed.`)
      })
    })
  }, [workflowEngine])

  useEffect(() => {
    function onLensGoto(/** @type {CustomEvent} */ e) {
      const field = e?.detail?.field
      if (typeof field !== 'string' || !field.trim()) return
      navigateToPilotField(field)
    }
    window.addEventListener('manta:lens-goto-field', onLensGoto)
    return () => window.removeEventListener('manta:lens-goto-field', onLensGoto)
  }, [navigateToPilotField])

  useEffect(() => {
    function onGotoStep(/** @type {CustomEvent} */ e) {
      const id = e?.detail?.stepId
      if (typeof id !== 'string' || !id.trim()) return
      const ok = profile.steps?.some((s) => s.id === id)
      if (ok) setActiveStep(id)
    }
    window.addEventListener('manta:goto-step', onGotoStep)
    return () => window.removeEventListener('manta:goto-step', onGotoStep)
  }, [profile.steps])

  async function runServerCheck() {
    setLoading(true)
    setStatusMessage('Checking database connection…')
    try {
      const [pRes, tRes] = await Promise.all([hostBridge.listPlatforms(), hostBridge.listTemplates()])
      setSummary({
        platforms: pRes.unexpectedShape ? 'unknown payload' : `${pRes.rows.length} rows`,
        templates: tRes.unexpectedShape ? 'unknown payload' : `${tRes.rows.length} rows`,
      })
      setStatusMessage('Bridge check succeeded.')
      pushPilotDebug({ kind: 'bridgeCheck', ok: true, detail: `${pRes.rows?.length ?? 0} platforms / ${tRes.rows?.length ?? 0} templates` })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      setStatusMessage(`Bridge check failed: ${msg}`)
      pushPilotDebug({ kind: 'bridgeCheck', ok: false, detail: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <StepNav steps={profile.steps} activeStep={activeStep} onSelect={setActiveStep} stepStatus={stepStatuses} />

      <XmlToolsBar
        profile={profile}
        pilotState={pilotState}
        onPilotImport={(next) => {
          const s = profile.sanitize(next)
          setPilotState(s)
          setTouched({})
          setShowAllErrors(false)
        }}
        onScannerApply={(next) => {
          const s = profile.sanitize(next)
          setPilotState(s)
          setTouched({})
          setShowAllErrors(true)
          setStatusMessage('Scanner suggestions merged. Review the validation panel for any new issues.')
        }}
        onStatus={setStatusMessage}
        hostBridgeReady={hostBridgeReady}
        exportBusy={ma.exportBusy}
        onExportGeoJSON={cap.geoJsonExport ? ma.exportGeoJSONFromServer : null}
        onExportDCAT={cap.dcatExport ? ma.exportDCATFromServer : null}
        cometUuid={cometUuid}
        onPushToComet={comet.pushDraftToComet}
        pushBusy={comet.pushBusy}
        hostBridge={hostBridge}
        validationEngine={validationEngine}
      />

      {/* layout: left = form, right = Validator / Live XML / CoMET tabbed card */}
      <section className="workspace-grid">
        <article className={`card workspace-main pilot-step pilot-step--${activeStep}`}>
          <h2>{activeStepMeta.label}</h2>

          {ActiveStep && (
            <Suspense fallback={<div className="pilot-step-loading">Loading step…</div>}>
              <ActiveStep
                // ── shared base (every step) ──────────────────────────────
                pilotState={pilotState}
                setPilotState={setPilotState}
                touched={touched}
                onTouched={setTouchedKey}
                showAllErrors={showAllErrors}
                issues={validation.issues}
                // ── mission step ──────────────────────────────────────────
                mission={pilotState.mission}
                onMissionPatch={(patch) => setPilotState((p) => ({ ...p, mission: { ...p.mission, ...patch } }))}
                onLoadDraft={ma.loadPilotDraft}
                onSaveDraft={ma.savePilotDraft}
                loadDisabled={ma.pilotBusy || !hostBridgeReady}
                saveDisabled={ma.pilotBusy || !hostBridgeReady}
                draftStatus={ma.draftStatus}
                hostBridgeReady={hostBridgeReady}
                templateCatalogRows={ma.templateCatalogRows}
                templateCatalogLoading={ma.templateCatalogLoading}
                templateCatalogError={ma.templateCatalogError}
                onRefreshTemplateCatalog={ma.refreshTemplateCatalog}
                onApplySheetTemplate={ma.applySheetTemplateByName}
                templateApplyDisabled={ma.templateApplyDisabled}
                // ── platform step ─────────────────────────────────────────
                platform={pilotState.platform}
                onPlatformPatch={(patch) => setPilotState((p) => ({ ...p, platform: { ...p.platform, ...patch } }))}
                platformLibraryRows={ma.platformLibraryRows}
                platformLibraryLoading={ma.platformLibraryLoading}
                platformLibraryError={ma.platformLibraryError}
                onRefreshPlatformLibrary={ma.refreshPlatformLibrary}
                onApplyPlatformFromLibrary={ma.applyPlatformFromLibraryKey}
                onSavePlatformToSheets={ma.saveCurrentPlatformToSheets}
                platformSaveBusy={ma.platformSaveBusy}
                // ── sensors step ──────────────────────────────────────────
                sensors={pilotState.sensors}
                onSetSensors={(next) => setPilotState((p) => ({ ...p, sensors: next }))}
                // ── spatial step ──────────────────────────────────────────
                spatial={pilotState.spatial}
                onSpatialPatch={(patch) => setPilotState((p) => ({ ...p, spatial: { ...p.spatial, ...patch } }))}
                // ── keywords step ─────────────────────────────────────────
                keywords={pilotState.keywords}
                onKeywordsChange={(next) => setPilotState((p) => ({ ...p, keywords: next }))}
                // ── distribution step ─────────────────────────────────────
                distribution={pilotState.distribution}
                onDistPatch={(patch) => setPilotState((p) => ({ ...p, distribution: { ...p.distribution, ...patch } }))}
                onSaveSheetTemplate={ma.saveNamedSheetTemplate}
                sheetTemplateSaveDisabled={ma.sheetTemplateSaveDisabled}
              />
            </Suspense>
          )}
        </article>

        <aside
          className={`workspace-side-stack${xmlExpanded ? ' workspace-side-stack--xml-full' : ''}`}
          aria-label="Side panel"
        >
          {/* Lens portals here so the HUD wraps this card only (same box as Validator / XML preview). */}
          <div
            id="manta-scanner-host"
            className="manta-scanner-host manta-scanner-host--side-rail"
            data-manta-scanner-host
          >
          <div
            className={`card workspace-side workspace-side--tabbed${xmlExpanded ? ' workspace-side--xml-full' : ''}`}
          >
            {!xmlExpanded && (
              <ul
                className="nav nav-tabs metadata-tabs pilot-metadata-tabs workspace-side-tablist"
                role="tablist"
                aria-label="Side panel views"
              >
                <li className="nav-item" role="presentation">
                  <button
                    type="button"
                    role="tab"
                    id="side-tab-validator"
                    aria-selected={sidePanelTab === 'validator'}
                    aria-controls="side-panel-validator"
                    tabIndex={sidePanelTab === 'validator' ? 0 : -1}
                    className={`nav-link${sidePanelTab === 'validator' ? ' active' : ''}`}
                    onClick={() => setSidePanelTab('validator')}
                  >
                    Validator
                  </button>
                </li>
                <li className="nav-item" role="presentation">
                  <button
                    type="button"
                    role="tab"
                    id="side-tab-xml"
                    aria-selected={sidePanelTab === 'xml'}
                    aria-controls="side-panel-xml"
                    tabIndex={sidePanelTab === 'xml' ? 0 : -1}
                    className={`nav-link${sidePanelTab === 'xml' ? ' active' : ''}`}
                    onClick={() => setSidePanelTab('xml')}
                  >
                    Live XML preview
                  </button>
                </li>
                {showCometPanel ? (
                  <li className="nav-item" role="presentation">
                    <button
                      type="button"
                      role="tab"
                      id="side-tab-comet"
                      aria-selected={sidePanelTab === 'comet'}
                      aria-controls="side-panel-comet"
                      tabIndex={sidePanelTab === 'comet' ? 0 : -1}
                      className={`nav-link${sidePanelTab === 'comet' ? ' active' : ''}`}
                      onClick={() => setSidePanelTab('comet')}
                    >
                      CoMET
                    </button>
                  </li>
                ) : null}
              </ul>
            )}

            <div
              id="side-panel-xml"
              role="tabpanel"
              aria-labelledby="side-tab-xml"
              hidden={!xmlExpanded && sidePanelTab !== 'xml'}
              className="workspace-side-tabpanel workspace-side-tabpanel--xml"
            >
              <XmlPreviewPanel
                pilotState={pilotState}
                buildXml={buildXml}
                lastSavedXmlPreview={lastSavedXmlPreview}
                expanded={xmlExpanded}
                onToggleExpand={setXmlExpanded}
              />
            </div>

            {!xmlExpanded && (
              <div
                id="side-panel-validator"
                role="tabpanel"
                aria-labelledby="side-tab-validator"
                hidden={sidePanelTab !== 'validator'}
                className="workspace-side-tabpanel workspace-side-tabpanel--validator"
              >
                <ReadinessStrip
                  snapshot={readinessSnapshot}
                  bundles={readinessBundles}
                  activeMode={pilotState.mode || 'lenient'}
                  onSelectMode={(m) => {
                    setMode(m)
                    setSidePanelTab('validator')
                    setShowAllErrors(true)
                  }}
                />
                <ValidationPanel
                  mode={pilotState.mode}
                  onModeChange={setMode}
                  score={validation.score}
                  maxScore={validation.maxScore}
                  errCount={validation.errCount}
                  warnCount={validation.warnCount}
                  issues={validation.issues}
                  hostBridgeReady={hostBridgeReady}
                  hostRuntimeLabel={hostRuntimeLabel}
                  summary={summary}
                  loading={loading}
                  onBridgeCheck={runServerCheck}
                  inlineEverywhere={showAllErrors}
                  onInlineEverywhereChange={setShowAllErrors}
                  onServerRulesValidate={cap.serverValidate ? ma.runServerRulesValidation : null}
                  serverRulesBusy={ma.serverRulesBusy}
                  serverRulesSummary={ma.serverRulesSummary}
                  statusMessage={statusMessage}
                  onIssueNavigate={navigateToPilotField}
                  getFieldLabel={
                    typeof profile.getFieldLabel === 'function' ? profile.getFieldLabel.bind(profile) : getPilotFieldLabelFallback
                  }
                />
              </div>
            )}

            {!xmlExpanded && showCometPanel ? (
              <div
                id="side-panel-comet"
                role="tabpanel"
                aria-labelledby="side-tab-comet"
                hidden={sidePanelTab !== 'comet'}
                className="workspace-side-tabpanel workspace-side-tabpanel--comet"
              >
                <CometPushPanel
                  cometUuid={cometUuid}
                  localUuidInput={comet.localUuidInput}
                  setLocalUuidInput={comet.setLocalUuidInput}
                  capPull={comet.capPull}
                  capPreflight={comet.capPreflight}
                  capPush={comet.capPush}
                  pullBusy={comet.pullBusy}
                  pushBusy={comet.pushBusy}
                  preflightBusy={comet.preflightBusy}
                  preflightSummary={comet.preflightSummary}
                  onPull={comet.pullFromComet}
                  onPreflight={comet.runPreflightChain}
                  onPush={comet.pushDraftToComet}
                />
              </div>
            ) : null}
          </div>
          </div>
        </aside>
      </section>

      <section className="card pilot-notes">
        <h2>Pilot notes</h2>
        <ol>
          <li>GCMD and ROR calls run in the browser with defensive error handling.</li>
          <li>
            With the host bridge (<code>POST /api/db</code> → your Postgres): Mission draft + template picker; Distribution{' '}
            <strong>Save as template</strong>; platform + sensor library — <code>getTemplate</code> / <code>saveTemplate</code> /{' '}
            <code>savePlatform</code> / <code>saveSensorsBatch</code>, etc. Same JSON contract as the historical HTML wizard for
            interoperability.
          </li>
          <li>
            <strong>Server rules validate</strong> and <strong>GeoJSON</strong> / <strong>DCAT JSON-LD</strong> use{' '}
            <code>pilotStateToLegacyFormData</code> then <code>/api/db</code> (<code>validateOnServer</code>,{' '}
            <code>generateGeoJSON</code>, <code>generateDCAT</code>).
          </li>
        </ol>
      </section>

      <DebugLogPanel />
    </>
  )
}
