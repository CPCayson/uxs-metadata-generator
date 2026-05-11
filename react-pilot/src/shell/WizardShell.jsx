/**
 * WizardShell — the multi-step metadata wizard UI.
 *
 * Profile-agnostic: all rendering and navigation decisions derive from
 * `profile` (steps, capabilities, methods). Host-backed actions are exposed
 * through profile-neutral hooks and gated by profile capabilities.
 *
 * Props:
 *   onDirtyChange  — callback(isDirty: boolean) to lift dirty state up to App.jsx
 *
 * @module shell/WizardShell
 */

import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, Suspense } from 'react'
import { flushSync, createPortal } from 'react-dom'
import StepNav from '../components/StepNav'
import ValidationPanel from '../components/ValidationPanel'
import ReadinessStrip from '../components/ReadinessStrip.jsx'
import XmlPreviewPanel from '../components/XmlPreviewPanel'
import XmlToolsBar from '../components/XmlToolsBar'
import DebugLogPanel from '../components/DebugLogPanel'
import {
  schedulePersistPilotSession,
  writePilotSessionPayloadNow,
  readPilotSessionPayload,
  readInitialValidationPrimed,
} from '../lib/pilotSessionStorage'
import { applyPilotAutoFixes } from '../lib/pilotAutoFix.js'
import { computeReadinessBundles, computeReadinessSnapshot } from '../lib/readinessSummary.js'
import { computeCertificationBundles } from '../lib/certificationSummary.js'
import { scrollToField } from '../core/registry/FieldRegistry.js'
import { pushPilotDebug } from '../lib/pilotDebugLog'
import { useMetadataEngine } from './context.js'
import { useCometWorkbenchBridge } from './CometWorkbenchBridge.jsx'
import { useProfileHostActions } from './hooks/useProfileHostActions.js'
import { useCometActionsForProfile } from '../features/comet/useCometActionsForProfile.js'
import CometPushPanel from '../features/comet/CometPushPanel.jsx'
import { isoXmlAdapter } from '../core/export/adapters/isoXmlAdapter.js'
import { getPilotFieldLabelFallback } from '../lib/pilotFieldLabelFallback.js'
import { emitPilotAuditEvent } from '../lib/pilotAuditEvents.js'
import { setPilotFieldPath } from '../lib/pilotStateFieldSet.js'
import MantaMissionCapabilityStrip from '../components/MantaMissionCapabilityStrip.jsx'
import MissionWizardStepPills from '../components/MissionWizardStepPills.jsx'
import ImportReviewPanel from '../components/ImportReviewPanel.jsx'
import WizardStartChoiceModal from '../components/WizardStartChoiceModal.jsx'
import { diffPilotStates, applyDecisions } from '../core/fragments/diffPilotStates.js'
import { summarizePilotImportPopulation } from '../lib/importMergeSummary.js'
import { useWorkbenchChrome } from './useWorkbenchChrome.js'
import { defaultPilotState } from '../lib/pilotValidation.js'

const IDLE_VALIDATION_RESULT = Object.freeze({
  issues: [],
  score: 100,
  maxScore: 100,
  errCount: 0,
  warnCount: 0,
})

const IDLE_READINESS_SNAPSHOT = Object.freeze({
  lenient: IDLE_VALIDATION_RESULT,
  strict: IDLE_VALIDATION_RESULT,
  catalog: IDLE_VALIDATION_RESULT,
})

/** Narrow rail column when collapsed — fits drag strip + prominent collapse control */
const RAIL_COLLAPSED_TRACK_PX = 44

/**
 * @param {{
 *   onDirtyChange: (isDirty: boolean) => void,
 * }} props
 */
export default function WizardShell({ onDirtyChange, breadcrumb }) {
  const { workspaceDensity, assistantLayout } = useWorkbenchChrome()
  const splitFloatWorkbench = assistantLayout === 'split-float'
  /** Simple workspace density → less rail copy, collapsed field-hint controls, calmer step pills (Lens optional) */
  const quietSurface = workspaceDensity === 'simple'

  const {
    profile,
    workflowEngine,
    validationEngine,
    hostBridge,
    onPublish,
  } = useMetadataEngine()

  const { registerCometWorkbench } = useCometWorkbenchBridge()

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
  const [showAllErrors, setShowAllErrors] = useState(false)
  const canProfileImport = Array.isArray(profile.importParsers) && profile.importParsers.length > 0
  const [wizardStartOpen, setWizardStartOpen] = useState(false)
  const [sidePanelTab, setSidePanelTab] = useState('xml')
  const [xmlExpanded, setXmlExpanded] = useState(false)
  const [leftCollapsed, setLeftCollapsed] = useState(
    () => assistantLayout === 'split-float' && !readInitialValidationPrimed(),
  )
  /** Left rail Validation accordion — open by default */
  const [validationRailOpen, setValidationRailOpen] = useState(true)
  const [rightCollapsed, setRightCollapsed] = useState(
    () => assistantLayout === 'split-float' && !readInitialValidationPrimed(),
  )
  const [leftW, setLeftW] = useState(280)
  const [rightW, setRightW] = useState(360)
  /** Header slot next to XML tools — mission step pills portal target */
  const [missionStepsSlotEl, setMissionStepsSlotEl] = useState(/** @type {HTMLElement | null} */ (null))

  const startRailDrag = useCallback((e, side) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = side === 'left' ? leftW : rightW
    const setW = side === 'left' ? setLeftW : setRightW
    document.body.style.userSelect = 'none'
    function onMove(ev) {
      const dx = ev.clientX - startX
      setW(Math.max(180, Math.min(600, startW + (side === 'left' ? dx : -dx))))
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.userSelect = ''
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [leftW, rightW])

  const [statusMessage, setStatusMessage] = useState('Ready')
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState({ platforms: 'not checked', templates: 'not checked' })

  // Import review — holds pending import state until user accepts/rejects conflicts
  const [pendingImport, setPendingImport] = useState(/** @type {{ changes: any[], next: object, sourceType: string, filename?: string, importedAt?: string } | null} */ (null))

  /** Raw XML + meta from last XmlToolsBar “Apply” — drives downloadable import report */
  const [importSampleContext, setImportSampleContext] = useState(
    /** @type {{ rawXml: string, filename?: string, warnings?: string[] } | null} */ (null),
  )

  /** Bumping remounts XmlToolsBar so paste/import textarea + zip UI reset when clearing the form */
  const [xmlToolsBarResetKey, setXmlToolsBarResetKey] = useState(0)

  /** False after Clear workspace until import, template load, draft load, or user edits (persisted in session). */
  const [validationPrimed, setValidationPrimed] = useState(readInitialValidationPrimed)

  const pilotRef = useRef(pilotState)
  pilotRef.current = pilotState

  const hostBridgeReady = hostBridge.isAvailable()
  const hostRuntimeLabel = hostBridgeReady ? 'Postgres API (HTTP /api/db)' : 'Host bridge not connected'

  // Called by profile host actions after any save/load that should reset dirty state.
  const onStateLoaded = useCallback((cleanState) => {
    baselineSerialized.current = JSON.stringify(cleanState)
    setIsDirty(false)
    onDirtyChange(false)
  }, [onDirtyChange])

  /** Import / scanner merge replaces the whole form — treat merged state as the new clean baseline (not “unsaved edits”). */
  const syncBaselineAfterExternalMerge = useCallback(
    (cleanState) => {
      onStateLoaded(cleanState)
      try {
        setLastSavedXmlPreview(buildXml(cleanState))
      } catch {
        setLastSavedXmlPreview('')
      }
    },
    [onStateLoaded, buildXml],
  )

  const ma = useProfileHostActions({
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

  const comet = useCometActionsForProfile({
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

  const applySheetTemplatePrimed = useCallback(
    async (name) => {
      await ma.applySheetTemplateByName(name)
      setValidationPrimed(true)
    },
    [ma],
  )

  const loadPilotDraftPrimed = useCallback(async () => {
    await ma.loadPilotDraft()
    setValidationPrimed(true)
  }, [ma])

  useEffect(() => {
    if (!showCometPanel) {
      registerCometWorkbench(null)
      return () => registerCometWorkbench(null)
    }
    registerCometWorkbench({ cometUuid, ...comet })
    return () => registerCometWorkbench(null)
  }, [showCometPanel, cometUuid, comet, registerCometWorkbench])

  useEffect(() => {
    if (!showCometPanel && sidePanelTab === 'comet') setSidePanelTab('xml')
  }, [showCometPanel, sidePanelTab])

  useEffect(() => {
    const el = document.getElementById('pilot-header-steps-slot')
    if (el) {
      setMissionStepsSlotEl(el)
      return undefined
    }
    let tries = 0
    const id = window.setInterval(() => {
      const node = document.getElementById('pilot-header-steps-slot')
      if (node) {
        setMissionStepsSlotEl(node)
        window.clearInterval(id)
      } else if (++tries > 40) {
        window.clearInterval(id)
      }
    }, 50)
    return () => window.clearInterval(id)
  }, [])

  /** Lens portal aligns with `.workspace-grid` top (nav + XML tools). Spans form + side rail. */
  const lensStackRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  /** Center column — scroll container for continuous wizard sections */
  const mainColumnRef = useRef(/** @type {HTMLElement | null} */ (null))
  /** Skip IntersectionObserver updates while programmatically scrolling to a section */
  const wizardNavSuppressObserverRef = useRef(false)
  useLayoutEffect(() => {
    const root = lensStackRef.current
    if (!root) return

    // Bound html+body to viewport height — overflow:hidden alone only hides the scrollbar,
    // the body still grows to content height. height:100dvh caps it so the flex chain works.
    const prevBodyOverflow = document.body.style.overflow
    const prevHtmlOverflow = document.documentElement.style.overflow
    const prevBodyHeight = document.body.style.height
    const prevHtmlHeight = document.documentElement.style.height
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    document.body.style.height = '100dvh'
    document.documentElement.style.height = '100dvh'

    function measure() {
      const grid = root.querySelector('.workspace-grid')
      if (!grid) return
      const rootRect = root.getBoundingClientRect()
      const gridRect = grid.getBoundingClientRect()
      const top = Math.max(0, Math.round(gridRect.top - rootRect.top))
      root.style.setProperty('--pilot-lens-inset-top', `${top}px`)
    }

    measure()
    const ro = new ResizeObserver(measure)
    const nav = root.querySelector('.pilot-step-nav')
    const missionStrip = root.querySelector('.pilot-mission-capability-strip')
    const xml = root.querySelector('.pilot-xml-tools')
    if (nav) ro.observe(nav)
    if (missionStrip) ro.observe(missionStrip)
    if (xml) ro.observe(xml)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
      document.body.style.overflow = prevBodyOverflow
      document.documentElement.style.overflow = prevHtmlOverflow
      document.body.style.height = prevBodyHeight
      document.documentElement.style.height = prevHtmlHeight
    }
  }, [])

  // Lens opens over the full workspace grid: surface Live XML on the right rail (left rail stays visible).
  useEffect(() => {
    function onLensOpened() {
      setXmlExpanded(false)
      setSidePanelTab('xml')
    }
    window.addEventListener('manta:lens-opened', onLensOpened)
    return () => window.removeEventListener('manta:lens-opened', onLensOpened)
  }, [])

  // Defer validation (and step-status) off the keystroke hot path. React
  // renders the form inputs first, then reconciles the validator/XML tree
  // when idle, keeping typing snappy even with large rule sets.
  const deferredPilotState = useDeferredValue(pilotState)

  const validation = useMemo(() => {
    if (!validationPrimed) return IDLE_VALIDATION_RESULT
    return validationEngine.run({
      profile,
      state: deferredPilotState,
      mode: deferredPilotState.mode || 'lenient',
    })
  }, [validationPrimed, validationEngine, profile, deferredPilotState])

  // Split-float: idle validation (cleared / session) → collapse rails so the center form is the focus.
  useEffect(() => {
    if (!splitFloatWorkbench || validationPrimed) return
    setLeftCollapsed(true)
    setRightCollapsed(true)
  }, [splitFloatWorkbench, validationPrimed])

  // Surface blocking issues automatically by expanding the validation rail.
  useEffect(() => {
    if (!splitFloatWorkbench) return
    if (validation.errCount > 0 || validation.warnCount > 0) setLeftCollapsed(false)
  }, [splitFloatWorkbench, validation.errCount, validation.warnCount])

  // Import / merge completed → show both rails again (preview + checks).
  useEffect(() => {
    if (!splitFloatWorkbench) return
    function onMerged() {
      setLeftCollapsed(false)
      setRightCollapsed(false)
    }
    window.addEventListener('manta:metadata-import-merged', onMerged)
    return () => window.removeEventListener('manta:metadata-import-merged', onMerged)
  }, [splitFloatWorkbench])

  const readinessSnapshot = useMemo(() => {
    if (!validationPrimed) return IDLE_READINESS_SNAPSHOT
    return computeReadinessSnapshot(deferredPilotState, validationEngine, profile)
  }, [validationPrimed, deferredPilotState, validationEngine, profile])

  const readinessBundles = useMemo(() => {
    if (!validationPrimed) return []
    return computeReadinessBundles(readinessSnapshot, {
      preflightSummary: comet.preflightSummary,
      isDirty,
    })
  }, [validationPrimed, readinessSnapshot, comet.preflightSummary, isDirty])

  const certificationXml = useMemo(() => {
    try {
      const xml = buildXml(deferredPilotState)
      return typeof xml === 'string' ? xml : ''
    } catch {
      return ''
    }
  }, [buildXml, deferredPilotState])

  const certificationBundles = useMemo(() => {
    if (!validationPrimed) return []
    return computeCertificationBundles(deferredPilotState, {
      xml: certificationXml,
      readinessSnapshot,
      preflightSummary: comet.preflightSummary,
      cometUuid,
      isDirty,
    })
  }, [
    validationPrimed,
    deferredPilotState,
    certificationXml,
    readinessSnapshot,
    comet.preflightSummary,
    cometUuid,
    isDirty,
  ])

  const readinessAndCertificationBundles = useMemo(
    () => [...readinessBundles, ...certificationBundles],
    [readinessBundles, certificationBundles],
  )

  /** Suppress Draft / ISO-ready / CoMET cert lanes while tuning XML→form import (see .env.example). */
  const hideReadinessGoalBundles =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_HIDE_READINESS_BUNDLES === 'true'

  const stepStatuses = useMemo(() => {
    const fromIssues = workflowEngine.stepCompletionFromIssues(validation.issues)
    /** @type {Record<string, 'ok'|'warn'|'err'|'pending'>} */
    const out = { ...fromIssues }
    const touchedKeys = Object.keys(touched)

    for (const step of profile.steps) {
      const hasTouched = touchedKeys.some((key) =>
        (step.ownedFieldPrefixes || []).some((prefix) => key === prefix || key.startsWith(prefix)),
      )
      // Keep untouched steps as "Not reviewed" to avoid flashing red status
      // before the user has interacted with that section.
      if (!hasTouched) out[step.id] = 'pending'
    }
    return out
  }, [workflowEngine, validation.issues, touched, profile.steps])

  const activeStepMeta = profile.steps.find((s) => s.id === activeStep) ?? profile.steps[0]

  const wizardStepProps = {
    pilotState,
    setPilotState,
    touched,
    onTouched: setTouchedKey,
    showAllErrors,
    issues: validation.issues,
    mission: pilotState.mission,
    onMissionPatch: (patch) => setPilotState((p) => ({ ...p, mission: { ...p.mission, ...patch } })),
    onSourceProvenanceClear: () => setPilotState((p) => ({
      ...p,
      sourceProvenance: { sourceType: 'manual', sourceId: '', importedAt: '', originalFilename: '', originalUuid: '' },
    })),
    onLoadDraft: loadPilotDraftPrimed,
    onSaveDraft: ma.savePilotDraft,
    loadDisabled: ma.pilotBusy || !hostBridgeReady,
    saveDisabled: ma.pilotBusy || !hostBridgeReady,
    draftStatus: ma.draftStatus,
    hostBridgeReady,
    templateCatalogRows: ma.templateCatalogRows,
    templateCatalogLoading: ma.templateCatalogLoading,
    templateCatalogError: ma.templateCatalogError,
    onRefreshTemplateCatalog: ma.refreshTemplateCatalog,
    onApplySheetTemplate: applySheetTemplatePrimed,
    templateApplyDisabled: ma.templateApplyDisabled,
    platform: pilotState.platform,
    onPlatformPatch: (patch) => setPilotState((p) => ({ ...p, platform: { ...p.platform, ...patch } })),
    platformLibraryRows: ma.platformLibraryRows,
    platformLibraryLoading: ma.platformLibraryLoading,
    platformLibraryError: ma.platformLibraryError,
    onRefreshPlatformLibrary: ma.refreshPlatformLibrary,
    onApplyPlatformFromLibrary: ma.applyPlatformFromLibraryKey,
    onSavePlatformToSheets: ma.saveCurrentPlatformToSheets,
    platformSaveBusy: ma.platformSaveBusy,
    sensors: pilotState.sensors,
    onSetSensors: (next) => setPilotState((p) => ({ ...p, sensors: next })),
    spatial: pilotState.spatial,
    onSpatialPatch: (patch) => setPilotState((p) => ({ ...p, spatial: { ...p.spatial, ...patch } })),
    keywords: pilotState.keywords,
    onKeywordsChange: (next) => setPilotState((p) => ({ ...p, keywords: next })),
    distribution: pilotState.distribution,
    onDistPatch: (patch) => setPilotState((p) => ({ ...p, distribution: { ...p.distribution, ...patch } })),
    onSaveSheetTemplate: ma.saveNamedSheetTemplate,
    sheetTemplateSaveDisabled: ma.sheetTemplateSaveDisabled,
  }

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
    const raf = window.requestAnimationFrame(() =>
      schedulePersistPilotSession(pilotState, { validationPrimed }),
    )
    return () => window.cancelAnimationFrame(raf)
  }, [pilotState, validationPrimed])

  useEffect(() => {
    function onImportMerged() {
      setValidationPrimed(true)
    }
    window.addEventListener('manta:metadata-import-merged', onImportMerged)
    return () => window.removeEventListener('manta:metadata-import-merged', onImportMerged)
  }, [])

  useEffect(() => {
    if (Object.keys(touched).length > 0) setValidationPrimed(true)
  }, [touched])

  // Manta widget / Lens "Fix Issues" — apply safe auto-fixes to live wizard state
  useEffect(() => {
    function runValidationCount(state, mode) {
      return validationEngine.run({ profile, state, mode }).issues.length
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
      setValidationPrimed(true)
      writePilotSessionPayloadNow(next, { validationPrimed: true })
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
        setValidationPrimed(true)
        writePilotSessionPayloadNow(san, { validationPrimed: true })
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

  // Keep Manta widget quality mode in sync when the user changes mode in the validation panel
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

  const selectWizardStep = useCallback((id) => {
    const ok = profile.steps?.some((s) => s.id === id)
    if (!ok) return
    wizardNavSuppressObserverRef.current = true
    setActiveStep(id)
    requestAnimationFrame(() => {
      document.getElementById(`pilot-wizard-section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      window.setTimeout(() => {
        wizardNavSuppressObserverRef.current = false
      }, 700)
    })
  }, [profile.steps])

  const navigateToPilotField = useCallback((field) => {
    const step = workflowEngine.stepForField(field)
    wizardNavSuppressObserverRef.current = true
    flushSync(() => {
      setActiveStep(step)
    })
    requestAnimationFrame(() => {
      document.getElementById(`pilot-wizard-section-${step}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      window.setTimeout(() => {
        wizardNavSuppressObserverRef.current = false
      }, 700)

      const tryFocus = () => scrollToField(field)
      if (tryFocus()) return

      let attempts = 0
      /** ~2s of animation frames — enough for most paints; Suspense steps may need longer */
      const maxAttempts = 120
      const tick = () => {
        if (tryFocus()) return
        attempts += 1
        if (attempts >= maxAttempts) {
          const gapsMs = [80, 200, 550, 1400]
          let gi = 0
          const delayed = () => {
            if (tryFocus()) return
            if (gi >= gapsMs.length) {
              setStatusMessage(`Could not find a control for "${field}". Open the matching step manually if needed.`)
              return
            }
            const wait = gapsMs[gi]
            gi += 1
            window.setTimeout(() => {
              if (tryFocus()) return
              delayed()
            }, wait)
          }
          delayed()
          return
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
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
      if (ok) selectWizardStep(id)
    }
    function onRelativeStep(/** @type {CustomEvent} */ e) {
      const delta = e?.detail?.delta
      if (delta !== -1 && delta !== 1) return
      const steps = profile.steps ?? []
      if (!steps.length) return
      const idx = Math.max(0, steps.findIndex((s) => s.id === activeStep))
      const next = Math.min(steps.length - 1, Math.max(0, idx + delta))
      const nextId = steps[next]?.id
      if (nextId) selectWizardStep(nextId)
    }
    window.addEventListener('manta:goto-step', onGotoStep)
    window.addEventListener('manta:step-relative', onRelativeStep)
    return () => {
      window.removeEventListener('manta:goto-step', onGotoStep)
      window.removeEventListener('manta:step-relative', onRelativeStep)
    }
  }, [profile.steps, activeStep, selectWizardStep])

  /** Keep step tabs / Lens step scope aligned with the section nearest the viewport center */
  useEffect(() => {
    const root = mainColumnRef.current
    if (!root || !profile.steps?.length) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (wizardNavSuppressObserverRef.current) return
        const crossing = entries
          .filter((e) => e.isIntersecting && e.intersectionRatio > 0)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (!crossing.length) return
        const id = crossing[0].target.getAttribute('data-wizard-step')
        if (typeof id === 'string' && id) setActiveStep(id)
      },
      { root, rootMargin: '-10% 0px -55% 0px', threshold: [0, 0.05, 0.15, 0.35, 0.55] },
    )
    for (const s of profile.steps) {
      const el = document.getElementById(`pilot-wizard-section-${s.id}`)
      if (el) obs.observe(el)
    }
    return () => obs.disconnect()
  }, [profile.steps, profile.id])

  // Surface savedAt from session storage in the status bar
  const [savedAt, setSavedAt] = useState(() => {
    try {
      const p = readPilotSessionPayload()
      return p?.savedAt ? new Date(p.savedAt).toLocaleTimeString() : null
    } catch {
      return null
    }
  })
  useEffect(() => {
    function onSessionWrite(/** @type {CustomEvent} */ e) {
      const at = e?.detail?.savedAt ?? e?.detail?.payload?.savedAt
      if (at) setSavedAt(new Date(at).toLocaleTimeString())
    }
    window.addEventListener('manta:pilot-session-updated', onSessionWrite)
    return () => window.removeEventListener('manta:pilot-session-updated', onSessionWrite)
  }, [])

  const handleClearForm = useCallback(() => {
    if (!window.confirm('Clear saved workspace data and reset this wizard to defaults? Unsaved edits will be lost.')) return
    const raw = typeof profile.defaultState === 'function' ? profile.defaultState() : defaultPilotState()
    const fresh = profile.sanitize(raw)
    baselineSerialized.current = JSON.stringify(fresh)
    setPilotState(fresh)
    setValidationPrimed(false)
    setCometUuid('')
    setSummary({ platforms: 'not checked', templates: 'not checked' })
    writePilotSessionPayloadNow(fresh, { validationPrimed: false })
    setTouched({})
    setShowAllErrors(false)
    setPendingImport(null)
    setImportSampleContext(null)
    setXmlToolsBarResetKey((k) => k + 1)
    setActiveStep(profile.steps[0]?.id ?? 'mission')
    setIsDirty(false)
    onDirtyChange(false)
    try {
      setLastSavedXmlPreview(buildXml(fresh))
    } catch {
      setLastSavedXmlPreview('')
    }
    setStatusMessage(
      'Workspace cleared — defaults loaded. Validation stays idle until you import XML, apply a template, load a draft, or edit a field.',
    )
    if (assistantLayout === 'split-float') {
      setLeftCollapsed(true)
      setRightCollapsed(true)
    }
    emitPilotAuditEvent({ profileId: profile.id, action: 'clearForm', result: 'ok' })
  }, [profile, buildXml, onDirtyChange, assistantLayout])

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

  /**
   * @param {object} next Merged pilot state from XML import
   * @param {{ importWarnings?: string[] }} [meta] Parser warnings from {@link parseProfileXmlImport}
   */
  function handlePilotImport(next, meta = {}) {
    const importWarnings = Array.isArray(meta.importWarnings) ? meta.importWarnings : []
    const changes = diffPilotStates(pilotState, next, next.sourceProvenance?.sourceType ?? 'rawIso')
    if (changes.length === 0) {
      const clean = profile.sanitize(next)
      syncBaselineAfterExternalMerge(clean)
      setPilotState(clean)
      setTouched({})
      setShowAllErrors(false)
      const pop = summarizePilotImportPopulation(clean)
      const w = importWarnings.length ? ` Parser notes: ${importWarnings.join(' · ')}` : ''
      setStatusMessage(
        `${pop.summary}${w ? `.${w}` : ''}` +
          ' Review any remaining checks in the Validation panel.',
      )
      window.dispatchEvent(new CustomEvent('manta:metadata-import-merged'))
      return
    }
    const conflicts = changes.filter((c) => c.isConflict).length
    setStatusMessage(
      conflicts > 0
        ? `Import parsed (${changes.length} updates, ${conflicts} conflict${conflicts !== 1 ? 's' : ''}). Finish in the Review import overlay — resolve each conflict, then click Apply.`
        : `Import parsed (${changes.length} update${changes.length !== 1 ? 's' : ''}). Confirm in the Review import overlay, then click Apply.`,
    )
    setPendingImport({
      changes,
      next,
      sourceType: next.sourceProvenance?.sourceType ?? 'rawIso',
      filename: next.sourceProvenance?.originalFilename,
      importedAt: next.sourceProvenance?.importedAt,
    })
  }

  return (
    <>
      {wizardStartOpen && canProfileImport && (
        <WizardStartChoiceModal
          profile={profile}
          onStartFresh={() => {
            setWizardStartOpen(false)
            setShowAllErrors(false)
            setTouched({})
          }}
          onPilotImportMerged={(merged, importMeta) => {
            setWizardStartOpen(false)
            handlePilotImport(merged, importMeta)
          }}
          onImportSampleRecorded={(d) => {
            setImportSampleContext({
              rawXml: d.rawXml,
              filename: d.filename,
              warnings: d.warnings || [],
            })
          }}
          onStatus={setStatusMessage}
        />
      )}

      {/* Import review overlay — shown when an import has fields to review */}
      {pendingImport && (
        <ImportReviewPanel
          changes={pendingImport.changes}
          sourceType={pendingImport.sourceType}
          filename={pendingImport.filename}
          importedAt={pendingImport.importedAt}
          onApply={(decisions) => {
            const resolved = applyDecisions(pilotState, pendingImport.next, decisions)
            const clean = profile.sanitize(resolved)
            syncBaselineAfterExternalMerge(clean)
            setPilotState(clean)
            setTouched({})
            setShowAllErrors(false)
            setPendingImport(null)
            setStatusMessage(
              'Import applied — merged state is the new baseline. Review checks in the Validation panel.',
            )
            window.dispatchEvent(new CustomEvent('manta:metadata-import-merged'))
          }}
          onCancel={() => setPendingImport(null)}
        />
      )}

      <div ref={lensStackRef} className="pilot-wizard-lens-stack manta-workspace-lens-anchor">
        {isDirty ? (
          <div className="pilot-dirty-session-banner" role="status">
            You have unsaved edits in this wizard. The pilot autosaves to browser storage — reloading usually restores your
            work.{' '}
            {hostBridgeReady
              ? 'Use Save draft on the Mission step or Cmd/Ctrl+S to write a server draft when connected.'
              : 'Connect the host bridge (same-origin /api/db) to enable Save draft / Cmd+S to the server.'}
          </div>
        ) : null}
        {profile.id !== 'mission' ? (
          <>
            {breadcrumb && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.28rem 1rem',
                borderBottom: '1px solid var(--border-color, #e2e8f0)',
                background: 'var(--card-bg, #fff)',
                fontSize: '0.78rem', flexShrink: 0,
              }}>
                <button type="button" onClick={breadcrumb.onHome} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 2px', fontSize: '0.78rem' }} aria-label="Back to home">← Home</button>
                <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>·</span>
                <span style={{ color: 'var(--text-color)', fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{breadcrumb.label}</span>
                <button type="button" onClick={breadcrumb.onNewRecord} style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 5, background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: '1px 7px', fontSize: '0.72rem' }} title="Start a new record or switch profile">+ New record</button>
              </div>
            )}
            <StepNav
              steps={profile.steps}
              activeStep={activeStep}
              onSelect={selectWizardStep}
              stepStatus={stepStatuses}
            />
          </>
        ) : null}

        {/* XmlToolsBar portals into #pilot-header-tools-slot under step pills (mission + other profiles) */}
        <XmlToolsBar
          key={xmlToolsBarResetKey}
          profile={profile}
          workspaceNav={
            profile.id === 'mission' && breadcrumb
              ? { onHome: breadcrumb.onHome, onNewRecord: breadcrumb.onNewRecord }
              : null
          }
          pilotState={pilotState}
          importSampleContext={importSampleContext}
          onImportSampleRecorded={(d) => {
            setImportSampleContext({
              rawXml: d.rawXml,
              filename: d.filename,
              warnings: d.warnings || [],
            })
          }}
          onPilotImport={handlePilotImport}
          onScannerApply={(next) => {
            const s = profile.sanitize(next)
            syncBaselineAfterExternalMerge(s)
            setPilotState(s)
            setTouched({})
            setShowAllErrors(false)
            setStatusMessage('Scanner suggestions merged. Review any new items in the Validation panel.')
            window.dispatchEvent(new CustomEvent('manta:metadata-import-merged'))
          }}
          onStatus={setStatusMessage}
          hostBridgeReady={hostBridgeReady}
          exportBusy={ma.exportBusy}
          onExportGeoJSON={cap.geoJsonExport ? ma.exportGeoJSONFromServer : null}
          onExportDCAT={cap.dcatExport ? ma.exportDCATFromServer : null}
          cometUuid={cometUuid}
          onPushToComet={cap.cometPush ? comet.pushDraftToComet : null}
          pushBusy={comet.pushBusy}
          hostBridge={hostBridge}
          validationEngine={validationEngine}
          quietSurface={quietSurface}
          onCometPull={
            profile.id === 'mission' && cap.cometPull
              ? () => window.dispatchEvent(new CustomEvent('manta:comet-load'))
              : null
          }
          onClearForm={handleClearForm}
        />

        {profile.id === 'mission' && missionStepsSlotEl
          ? createPortal(
              <MissionWizardStepPills
                wizardSteps={profile.steps.map((s) => ({ id: s.id, label: s.label }))}
                activeWizardStep={activeStep}
                onWizardStepSelect={selectWizardStep}
                stepStatuses={stepStatuses}
                quietSurface={quietSurface}
              />,
              missionStepsSlotEl,
            )
          : null}

        {/* Mission: breadcrumb + score/mode when shown — step pills port to header */}
        {profile.id === 'mission' && (
          <MantaMissionCapabilityStrip
            validationMode={pilotState.mode || 'lenient'}
            onSetMode={(m) => { setMode(m); setShowAllErrors(true) }}
            errCount={validation.errCount}
            score={validation.score}
          />
        )}

        {/* Lens host sits after grid — overlays form + left/right rails (dual surface). */}
        <section
          className="workspace-grid workspace-grid--split"
          data-quiet-surface={quietSurface ? 'true' : undefined}
          data-workspace-rails-collapsed={
            splitFloatWorkbench && leftCollapsed && rightCollapsed ? 'true' : undefined
          }
          style={{
            gridTemplateColumns: `${leftCollapsed ? `${RAIL_COLLAPSED_TRACK_PX}px` : `${leftW}px`} 8px minmax(0, 1fr) 8px ${rightCollapsed ? `${RAIL_COLLAPSED_TRACK_PX}px` : `${rightW}px`}`,
          }}
        >
        <aside
          className={`workspace-side-stack workspace-side-stack--left-rail${leftCollapsed ? ' workspace-side-stack--collapsed' : ''}`}
          aria-label="Validation and scores"
        >
          <div className={`card workspace-side workspace-side--tabbed workspace-side--left-rail-card pilot-rail-curved pilot-rail-curved--left${leftCollapsed ? ' rail-card--hidden' : ''}`}>
            <details
              className="workspace-rail-validation-accordion"
              open={validationRailOpen}
              onToggle={(e) => setValidationRailOpen(e.currentTarget.open)}
            >
              <summary className="workspace-rail-validation-accordion__summary">
                <span className="workspace-rail-validation-accordion__summary-main">
                  <h2 className="workspace-rail-validation-head__title">Validation</h2>
                  <div className="workspace-rail-validation-head__counts">
                    <span className="chip chip-err">{validation.errCount} error{validation.errCount !== 1 ? 's' : ''}</span>
                    <span className="chip chip-warn">{validation.warnCount} warning{validation.warnCount !== 1 ? 's' : ''}</span>
                  </div>
                </span>
              </summary>
              <div className="workspace-rail-validation-accordion__body">
                {/* Issues first so they sit directly under “Validation” + counts */}
                <ValidationPanel
                  hideSurfaceIntro
                  hideModePills
                  hideScoreChips
                  collapseConnectionTools
                  collapseFieldHints
                  quietSurface={quietSurface}
                  railIntroProfileLabel={profile.id === 'mission' ? 'UxS / Mission PED' : ''}
                  validationIdle={!validationPrimed}
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
                <ReadinessStrip
                  hideSectionHead
                  className="readiness-strip--rail-after-issues"
                  idleHint={
                    !validationPrimed
                      ? 'Readiness scores stay idle until you import XML, apply a sheet template, load a draft, or edit the form.'
                      : ''
                  }
                  snapshot={readinessSnapshot}
                  bundles={hideReadinessGoalBundles ? [] : readinessAndCertificationBundles}
                  activeMode={pilotState.mode || 'lenient'}
                  onSelectMode={(m) => {
                    setMode(m)
                    setShowAllErrors(true)
                  }}
                />
              </div>
            </details>
          </div>
        </aside>

        <div
          className="rail-drag-handle rail-drag-handle--left"
          onPointerDown={(e) => startRailDrag(e, 'left')}
        >
          <button
            type="button"
            className="rail-collapse-btn"
            onClick={() => setLeftCollapsed(c => !c)}
            title={leftCollapsed ? 'Expand' : 'Collapse'}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {leftCollapsed ? '▶' : '◀'}
          </button>
        </div>

        <article
          ref={mainColumnRef}
          className="card workspace-main pilot-step pilot-step--continuous"
          data-active-step={activeStep}
        >
          {/* Mission: section titles + step pills already identify the step — avoid repeating activeStep label here */}
          {profile.id === 'mission' ? (
            savedAt ? (
              <div style={{ marginBottom: '0.45rem', fontSize: '0.64rem', fontWeight: 500, color: 'var(--text-muted)', opacity: 0.85 }}>
                Draft saved {savedAt}
              </div>
            ) : null
          ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{activeStepMeta.label}</h2>
            {!splitFloatWorkbench ? (
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <span style={{
                  fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em',
                  background: validation.errCount === 0 ? '#dcfce7' : '#fee2e2',
                  color: validation.errCount === 0 ? '#14532d' : '#7f1d1d',
                  border: `1px solid ${validation.errCount === 0 ? '#16a34a44' : '#dc262644'}`,
                  padding: '2px 8px', borderRadius: 9999,
                }}>
                  {validation.errCount === 0 ? '✓ No errors' : `✗ ${validation.errCount} error${validation.errCount !== 1 ? 's' : ''}`}
                </span>
                {validation.warnCount > 0 && (
                  <span style={{
                    fontSize: '0.68rem', fontWeight: 700,
                    background: '#fefce8', color: '#713f12',
                    border: '1px solid #ca8a0444',
                    padding: '2px 8px', borderRadius: 9999,
                  }}>
                    ⚠ {validation.warnCount}
                  </span>
                )}
                <span style={{
                  fontSize: '0.68rem', fontWeight: 700,
                  background: 'var(--card-bg)', color: 'var(--text-muted)',
                  border: '1px solid var(--border-color)',
                  padding: '2px 8px', borderRadius: 9999,
                }}>
                  {Math.round(validation.score ?? 0)}% ready
                </span>
                {savedAt && (
                  <span style={{
                    fontSize: '0.64rem', fontWeight: 500,
                    color: 'var(--text-muted)', opacity: 0.7,
                  }}>
                    saved {savedAt}
                  </span>
                )}
              </div>
            ) : savedAt ? (
              <span style={{
                fontSize: '0.64rem', fontWeight: 500,
                color: 'var(--text-muted)', opacity: 0.7,
              }}>
                saved {savedAt}
              </span>
            ) : null}
          </div>
          )}

          {profile.steps.map((stepMeta) => {
            const StepComp = stepMeta.component
            if (!StepComp) return null
            return (
              <section
                key={stepMeta.id}
                id={`pilot-wizard-section-${stepMeta.id}`}
                data-wizard-step={stepMeta.id}
                className={`pilot-wizard-section pilot-step--${stepMeta.id}`}
                aria-labelledby={`pilot-wizard-heading-${stepMeta.id}`}
              >
                <h2 className="pilot-wizard-section__title" id={`pilot-wizard-heading-${stepMeta.id}`}>
                  {stepMeta.label}
                </h2>
                <Suspense fallback={<div className="pilot-step-loading">Loading section…</div>}>
                  <StepComp
                    {...wizardStepProps}
                    {...(stepMeta.id === 'mission'
                      ? { guidedMissionIntro: workspaceDensity === 'simple' }
                      : {})}
                  />
                </Suspense>
              </section>
            )
          })}

          {/* Manta Lens: optional portal host (issues are inline on fields; keep for layout grid hooks). */}
          <div
            id="manta-lens-step-footer-host"
            className="manta-lens-step-footer-host"
            data-manta-lens-step-footer-host
          />
        </article>

        <div
          className="rail-drag-handle rail-drag-handle--right"
          onPointerDown={(e) => startRailDrag(e, 'right')}
        >
          <button
            type="button"
            className="rail-collapse-btn"
            onClick={() => setRightCollapsed(c => !c)}
            title={rightCollapsed ? 'Expand' : 'Collapse'}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {rightCollapsed ? '◀' : '▶'}
          </button>
        </div>

        <aside
          className={`workspace-side-stack workspace-side-stack--right-rail${xmlExpanded ? ' workspace-side-stack--xml-full' : ''}${rightCollapsed ? ' workspace-side-stack--collapsed' : ''}`}
          aria-label="Preview and output"
        >
          <div
            className={`card workspace-side workspace-side--tabbed pilot-rail-curved pilot-rail-curved--right${xmlExpanded ? ' workspace-side--xml-full' : ''}${rightCollapsed ? ' rail-card--hidden' : ''}`}
          >
            {!xmlExpanded ? (
              <div className="workspace-side-preview-toolbar">
                <span className="workspace-side-preview-toolbar__title">Preview</span>
                <ul
                  className="nav nav-tabs metadata-tabs pilot-metadata-tabs workspace-side-tablist workspace-side-tablist--toolbar"
                  role="tablist"
                  aria-label="Preview tabs"
                >
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
                      XML
                    </button>
                  </li>
                  <li className="nav-item" role="presentation">
                    <button
                      type="button"
                      role="tab"
                      id="side-tab-schema"
                      aria-selected={sidePanelTab === 'schema'}
                      aria-controls="side-panel-schema"
                      tabIndex={sidePanelTab === 'schema' ? 0 : -1}
                      className={`nav-link${sidePanelTab === 'schema' ? ' active' : ''}`}
                      onClick={() => setSidePanelTab('schema')}
                    >
                      Schema
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
              </div>
            ) : null}

            <div
              id="side-panel-xml"
              role="tabpanel"
              aria-labelledby="side-tab-xml"
              hidden={!xmlExpanded && sidePanelTab !== 'xml'}
              className="workspace-side-tabpanel workspace-side-tabpanel--xml"
            >
              {/* Same key as XmlToolsBar — remount so deferred preview paint cannot lag behind a cleared pilotState */}
              <XmlPreviewPanel
                key={xmlToolsBarResetKey}
                pilotState={pilotState}
                buildXml={buildXml}
                lastSavedXmlPreview={lastSavedXmlPreview}
                expanded={xmlExpanded}
                onToggleExpand={setXmlExpanded}
                compactRailHeader={!xmlExpanded}
                railHideFieldPill={!xmlExpanded}
              />
              {/* Action footer — always visible in XML tab */}
              <div style={{
                display: 'flex', gap: 6, padding: '0.5rem 0.5rem 0.25rem',
                borderTop: '1px solid var(--border-color, #e2e8f0)',
                background: 'var(--card-bg, #fff)',
                flexWrap: 'wrap',
              }}>
                <button
                  type="button"
                  onClick={comet.pushDraftToComet}
                  disabled={comet.pushBusy}
                  style={{
                    flex: 1, minWidth: 120, padding: '0.35rem 0.7rem',
                    fontSize: '0.76rem', fontWeight: 700,
                    background: 'var(--primary-color, #006994)', color: '#fff',
                    border: 'none', borderRadius: 5, cursor: comet.pushBusy ? 'wait' : 'pointer',
                    opacity: comet.pushBusy ? 0.6 : 1,
                  }}
                >
                  {comet.pushBusy ? 'Pushing…' : '↑ Push draft to CoMET'}
                </button>
                <button
                  type="button"
                  onClick={ma.exportBusy ? null : ma.exportGeoJSONFromServer}
                  disabled={ma.exportBusy || !cap.geoJsonExport}
                  style={{
                    padding: '0.35rem 0.7rem',
                    fontSize: '0.76rem', fontWeight: 700,
                    background: 'var(--card-bg)', color: 'var(--text-color)',
                    border: '1px solid var(--border-color)', borderRadius: 5,
                    cursor: 'pointer', opacity: cap.geoJsonExport ? 1 : 0.4,
                  }}
                  title="Export XML"
                >
                  ↓ Export XML
                </button>
              </div>
            </div>

            {/* Schema info tab */}
            {!xmlExpanded && (
              <div
                id="side-panel-schema"
                role="tabpanel"
                aria-labelledby="side-tab-schema"
                hidden={sidePanelTab !== 'schema'}
                className="workspace-side-tabpanel workspace-side-tabpanel--schema"
              >
                <div style={{ padding: '0.75rem', fontSize: '0.8rem' }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Active Schema</div>
                  <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '0.5rem 0.75rem', marginBottom: 8 }}>
                    <div style={{ fontWeight: 600 }}>ISO 19115-2:2019</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: 2 }}>+ NOAA Extensions — gmi:MI_Metadata</div>
                  </div>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Conformance</div>
                  <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '0.5rem 0.75rem', marginBottom: 8 }}>
                    <div style={{ fontWeight: 600, color: 'var(--primary-color)' }}>UxS-Marine-Core</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                      <div style={{ flex: 1, height: 6, background: 'var(--border-color)', borderRadius: 3 }}>
                        <div style={{ width: `${Math.round(validation.score ?? 0)}%`, height: '100%', background: 'var(--primary-color)', borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary-color)' }}>{Math.round(validation.score ?? 0)}%</span>
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>SWARM rules</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    152 compiled rules · {validation.errCount ?? 0} blocking · {validation.warnCount ?? 0} warnings
                  </div>
                </div>
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
                  similarUuidCandidates={comet.similarUuidCandidates}
                  capPull={comet.capPull}
                  capPreflight={comet.capPreflight}
                  capPush={comet.capPush}
                  pullBusy={comet.pullBusy}
                  pushBusy={comet.pushBusy}
                  preflightBusy={comet.preflightBusy}
                  metaserverBusy={comet.metaserverBusy}
                  preflightSummary={comet.preflightSummary}
                  metaserverSummary={comet.metaserverSummary}
                  onPull={comet.pullFromComet}
                  onPreflight={comet.runPreflightChain}
                  onMetaserverValidate={comet.runMetaserverValidate}
                  onPush={comet.pushDraftToComet}
                  cometUsername={comet.cometUsername}
                  setCometUsername={comet.setCometUsername}
                  cometPassword={comet.cometPassword}
                  setCometPassword={comet.setCometPassword}
                  authBusy={comet.authBusy}
                  authStatus={comet.authStatus}
                  onRefreshAuthStatus={comet.refreshAuthStatus}
                  onCometLogin={comet.runCometLogin}
                  onMetaserverLogin={comet.runMetaserverLogin}
                  onClearAuth={comet.clearAuthSessions}
                />
              </div>
            ) : null}
          </div>
        </aside>
      </section>
      <div
        id="manta-scanner-host"
        className="manta-scanner-host manta-scanner-host--lens-stack"
        data-manta-scanner-host
        aria-hidden="true"
      />
      </div>

      <DebugLogPanel />
    </>
  )
}
