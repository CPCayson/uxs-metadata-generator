/**
 * useMissionActions — encapsulates every host-backed mission-specific action
 * (HTTP `POST /api/db` → Postgres): draft save/load, named templates,
 * platform library, server-side validation, and server-side exports (GeoJSON / DCAT).
 *
 * Always called by WizardShell — hooks cannot be conditional — but acts as
 * a no-op for profiles that declare no relevant capabilities, keeping the
 * returned state values at their empty defaults.
 *
 * @module shell/hooks/useMissionActions
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { pilotModeToValidationEngineLevel, pilotStateToLegacyFormData } from '../../lib/pilotToLegacyFormData.js'
import { mapPlatformRowToPilotPatch, mapPilotPlatformToSavePlatform, platformRowKey } from '../../lib/platformSheetMapping.js'
import { pushPilotDebug } from '../../lib/pilotDebugLog.js'
import { emitPilotAuditEvent } from '../../lib/pilotAuditEvents.js'

const PILOT_DRAFT_TEMPLATE = 'react-pilot-mission-draft'

/**
 * @param {{
 *   profile:              import('../../core/registry/types.js').EntityProfile,
 *   pilotState:           object,
 *   setPilotState:        (fn: (prev: object) => object) => void,
 *   hostBridge:           import('../../core/host/HostBridge.js').HostBridge,
 *   hostBridgeReady: boolean,
 *   activeStep:           string,
 *   setStatusMessage:     (msg: string) => void,
 *   setTouched:           (fn: (prev: object) => object) => void,
 *   setShowAllErrors:     (v: boolean) => void,
 *   onStateLoaded:        (cleanState: object) => void,
 *   onXmlPreviewUpdate:   (xml: string) => void,
 * }} ctx
 */
export function useMissionActions({
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
  onXmlPreviewUpdate,
}) {
  const cap = profile.capabilities ?? {}

  // ── Draft ───────────────────────────────────────────────────────────────
  const [draftStatus, setDraftStatus] = useState({ timestamp: null, source: '' })
  const [pilotBusy, setPilotBusy] = useState(false)

  const savePilotDraft = useCallback(async () => {
    if (!hostBridgeReady) {
      setStatusMessage('Draft save needs a connected host (e.g. `netlify dev` so `/api/db` exists on the same origin).')
      pushPilotDebug({ kind: 'saveDraft', ok: false, detail: 'not-embedded' })
      return
    }
    setPilotBusy(true)
    setStatusMessage('Saving pilot draft to the database…')
    try {
      await hostBridge.saveTemplate({
        name: PILOT_DRAFT_TEMPLATE,
        category: 'react-pilot',
        data: { pilot: pilotState, updatedAt: new Date().toISOString() },
      })
      const cleanState = profile.sanitize(pilotState)
      onStateLoaded(cleanState)
      onXmlPreviewUpdate(profile.buildXmlPreview?.(pilotState) ?? '')
      setDraftStatus({ timestamp: new Date().toISOString(), source: 'saved' })
      setStatusMessage('Full pilot draft saved to the database.')
      pushPilotDebug({ kind: 'saveDraft', ok: true })
      emitPilotAuditEvent({
        profileId: profile.id,
        action: 'saveDraft',
        result: 'ok',
        mode: pilotState?.mode,
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      setStatusMessage(`Draft save failed: ${msg}`)
      pushPilotDebug({ kind: 'saveDraft', ok: false, detail: msg })
    } finally {
      setPilotBusy(false)
    }
  }, [hostBridgeReady, pilotState, hostBridge, profile, onStateLoaded, onXmlPreviewUpdate, setStatusMessage])

  const loadPilotDraft = useCallback(async () => {
    if (!hostBridgeReady) { setStatusMessage('Draft load needs a connected host (e.g. `netlify dev` for `/api/db`).'); return }
    setPilotBusy(true)
    setStatusMessage('Loading pilot draft from the database…')
    try {
      const template = await hostBridge.loadTemplate(PILOT_DRAFT_TEMPLATE)
      const data = template?.data
      let loaded = null
      if (data?.pilot && typeof data.pilot === 'object') loaded = data.pilot
      else if (data?.mission && typeof data.mission === 'object') loaded = { mission: data.mission }
      if (!loaded) {
        setStatusMessage('No saved pilot draft found.')
        pushPilotDebug({ kind: 'loadDraft', ok: false, detail: 'empty' })
        return
      }
      const merged = profile.mergeLoaded(loaded)
      const cleanState = profile.sanitize(merged)
      onStateLoaded(cleanState)
      onXmlPreviewUpdate(profile.buildXmlPreview?.(merged) ?? '')
      setPilotState(() => cleanState)
      setTouched(() => ({}))
      setShowAllErrors(false)
      setDraftStatus({
        timestamp: typeof data?.updatedAt === 'string' ? data.updatedAt : null,
        source: 'loaded',
      })
      setStatusMessage('Pilot draft loaded from the database.')
      pushPilotDebug({ kind: 'loadDraft', ok: true })
      emitPilotAuditEvent({
        profileId: profile.id,
        action: 'loadDraft',
        result: 'ok',
        mode: cleanState?.mode,
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      setStatusMessage(`Draft load failed: ${msg}`)
      pushPilotDebug({ kind: 'loadDraft', ok: false, detail: msg })
    } finally {
      setPilotBusy(false)
    }
  }, [hostBridgeReady, hostBridge, profile, setPilotState, setTouched, setShowAllErrors, onStateLoaded, onXmlPreviewUpdate, setStatusMessage])

  // ── Template catalog ─────────────────────────────────────────────────────
  const [templateCatalogRows, setTemplateCatalogRows] = useState([])
  const [templateCatalogLoading, setTemplateCatalogLoading] = useState(false)
  const [templateCatalogError, setTemplateCatalogError] = useState('')
  const templateCatalogAutoFetchRef = useRef(false)

  const refreshTemplateCatalog = useCallback(async () => {
    if (!hostBridgeReady) { setStatusMessage('Template catalog needs a connected host (`/api/db`).'); return }
    setTemplateCatalogLoading(true)
    setTemplateCatalogError('')
    setStatusMessage('Loading template catalog…')
    try {
      const res = await hostBridge.listTemplates()
      if (res.unexpectedShape) {
        setTemplateCatalogRows([])
        setTemplateCatalogError('Template response had an unexpected shape.')
        setStatusMessage('Template catalog returned an unknown payload.')
        return
      }
      const rows = res.rows
        .filter((row) => row && typeof row === 'object')
        .map((row, idx) => {
          const name = String(row.name ?? '').trim()
          return { key: name || `template_${idx + 1}`, name, category: String(row.category ?? '').trim() }
        })
        .filter((r) => r.name)
      setTemplateCatalogRows(rows)
      setStatusMessage(`Loaded ${rows.length} template(s) from the database.`)
    } catch (error) {
      setTemplateCatalogRows([])
      setTemplateCatalogError(error.message)
      setStatusMessage(`Template catalog load failed: ${error.message}`)
    } finally {
      setTemplateCatalogLoading(false)
    }
  }, [hostBridgeReady, hostBridge, setStatusMessage])

  // Auto-fetch when landing on the step that hosts the template picker.
  // The step id 'mission' is deliberately contained here, not in WizardShell.
  useEffect(() => {
    if (!cap.templateCatalog) return
    if (activeStep !== 'mission') { templateCatalogAutoFetchRef.current = false; return }
    if (!hostBridgeReady || templateCatalogLoading) return
    if (templateCatalogRows.length > 0) return
    if (templateCatalogAutoFetchRef.current) return
    templateCatalogAutoFetchRef.current = true
    void refreshTemplateCatalog()
  }, [cap.templateCatalog, activeStep, hostBridgeReady, templateCatalogLoading, templateCatalogRows.length, refreshTemplateCatalog])

  const applySheetTemplateByName = useCallback(async (name) => {
    const trimmed = String(name || '').trim()
    if (!hostBridgeReady) { setStatusMessage('Templates need a connected host (`/api/db`).'); return }
    if (!trimmed) { setStatusMessage('Select a template first.'); return }
    setPilotBusy(true)
    setStatusMessage(`Loading template "${trimmed}"…`)
    try {
      const template = await hostBridge.loadTemplate(trimmed)
      const data = template?.data
      let loaded = null
      if (data?.pilot && typeof data.pilot === 'object') loaded = data.pilot
      else if (data?.mission && typeof data.mission === 'object') loaded = { mission: data.mission }
      else if (data && typeof data === 'object') loaded = data
      if (!loaded) { setStatusMessage('Template has no recognized data payload.'); return }
      const merged = profile.mergeLoaded(loaded)
      setPilotState(() => profile.sanitize(merged))
      setTouched(() => ({}))
      setShowAllErrors(false)
      setStatusMessage(`Loaded template: ${trimmed}`)
    } catch (error) {
      setStatusMessage(`Template load failed: ${error.message}`)
    } finally {
      setPilotBusy(false)
    }
  }, [hostBridgeReady, hostBridge, profile, setPilotState, setTouched, setShowAllErrors, setStatusMessage])

  const saveNamedSheetTemplate = useCallback(async () => {
    if (!hostBridgeReady) { setStatusMessage('Saving a template needs a connected host (`/api/db`).'); return }
    const name = String(pilotState.distribution?.templateName || '').trim()
    if (!name) { setStatusMessage('Enter a template name on the Distribution step first.'); return }
    if (name.toLowerCase() === PILOT_DRAFT_TEMPLATE.toLowerCase()) {
      setStatusMessage(`Use "Save full draft" on Mission for the reserved name "${PILOT_DRAFT_TEMPLATE}".`)
      return
    }
    const category = String(pilotState.distribution?.templateCategory || '').trim()
    setPilotBusy(true)
    setStatusMessage(`Saving template "${name}"…`)
    try {
      await hostBridge.saveTemplate({
        name,
        category: category || 'react-pilot',
        data: { pilot: pilotState, updatedAt: new Date().toISOString() },
      })
      await refreshTemplateCatalog()
      setStatusMessage(`Template saved: ${name}`)
    } catch (error) {
      setStatusMessage(`Template save failed: ${error.message}`)
    } finally {
      setPilotBusy(false)
    }
  }, [hostBridgeReady, pilotState, hostBridge, refreshTemplateCatalog, setStatusMessage])

  // ── Platform library ─────────────────────────────────────────────────────
  const [platformLibraryRows, setPlatformLibraryRows] = useState([])
  const [platformLibraryLoading, setPlatformLibraryLoading] = useState(false)
  const [platformLibraryError, setPlatformLibraryError] = useState('')
  const [platformSaveBusy, setPlatformSaveBusy] = useState(false)
  const platformLibraryAutoFetchRef = useRef(false)

  const refreshPlatformLibrary = useCallback(async () => {
    if (!hostBridgeReady) { setStatusMessage('Platform library needs a connected host (`/api/db`).'); return }
    setPlatformLibraryLoading(true)
    setPlatformLibraryError('')
    setStatusMessage('Loading platform library…')
    try {
      const res = await hostBridge.listPlatforms()
      if (res.unexpectedShape) {
        setPlatformLibraryRows([])
        setPlatformLibraryError('Platform response had an unexpected shape.')
        setStatusMessage('Platform library returned an unknown payload.')
        return
      }
      const rows = res.rows
        .filter((row) => row && typeof row === 'object')
        .map((row, idx) => ({ key: platformRowKey(row, idx), row }))
      setPlatformLibraryRows(rows)
      setStatusMessage(`Loaded ${rows.length} platform row(s) from the library.`)
    } catch (error) {
      setPlatformLibraryRows([])
      setPlatformLibraryError(error.message)
      setStatusMessage(`Platform library load failed: ${error.message}`)
    } finally {
      setPlatformLibraryLoading(false)
    }
  }, [hostBridgeReady, hostBridge, setStatusMessage])

  // Auto-fetch when landing on the 'platform' step.
  useEffect(() => {
    if (!cap.platformLibrary) return
    if (activeStep !== 'platform') { platformLibraryAutoFetchRef.current = false; return }
    if (!hostBridgeReady || platformLibraryLoading) return
    if (platformLibraryRows.length > 0) return
    if (platformLibraryAutoFetchRef.current) return
    platformLibraryAutoFetchRef.current = true
    void refreshPlatformLibrary()
  }, [cap.platformLibrary, activeStep, hostBridgeReady, platformLibraryLoading, platformLibraryRows.length, refreshPlatformLibrary])

  const applyPlatformFromLibraryKey = useCallback((key) => {
    const hit = platformLibraryRows.find((r) => r.key === key)
    if (!hit) { setStatusMessage('Select a platform row first.'); return }
    const patch = mapPlatformRowToPilotPatch(hit.row)
    setPilotState((p) => ({ ...p, platform: { ...p.platform, ...patch } }))
    setTouched((prev) => ({
      ...prev,
      'platform.platformType': true,
      'platform.platformId': true,
      'platform.platformDesc': true,
    }))
    setStatusMessage(`Applied platform row: ${patch.platformName || patch.platformId || hit.key}`)
  }, [platformLibraryRows, setPilotState, setTouched, setStatusMessage])

  const saveCurrentPlatformToSheets = useCallback(async () => {
    if (!hostBridgeReady) { setStatusMessage('Saving platform needs a connected host (`/api/db`).'); return }
    setPlatformSaveBusy(true)
    setStatusMessage('Saving platform to library…')
    try {
      const payload = mapPilotPlatformToSavePlatform(pilotState.platform)
      const res = await hostBridge.savePlatform(payload)
      if (Array.isArray(res)) {
        const rows = res.filter((row) => row && typeof row === 'object').map((row, idx) => ({ key: platformRowKey(row, idx), row }))
        setPlatformLibraryRows(rows)
      } else {
        await refreshPlatformLibrary()
      }
      setStatusMessage(`Platform "${payload.id}" saved to the library.`)
    } catch (error) {
      setStatusMessage(`Platform save failed: ${error.message}`)
    } finally {
      setPlatformSaveBusy(false)
    }
  }, [hostBridgeReady, pilotState, hostBridge, refreshPlatformLibrary, setStatusMessage])

  // ── Server exports ───────────────────────────────────────────────────────
  const [exportBusy, setExportBusy] = useState(false)

  function downloadTextFile(filename, text, mime) {
    const blob = new Blob([text], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const exportGeoJSONFromServer = useCallback(async () => {
    if (!hostBridgeReady) return
    setExportBusy(true)
    setStatusMessage('Generating GeoJSON…')
    try {
      const fd = pilotStateToLegacyFormData(pilotState)
      const text = await hostBridge.generateGeoJSON(fd)
      const id = profile.getExportId?.(pilotState) ?? 'metadata'
      downloadTextFile(`${id}.geojson`, text, 'application/geo+json')
      setStatusMessage('GeoJSON downloaded.')
      pushPilotDebug({ kind: 'exportGeoJSON', ok: true })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      setStatusMessage(`GeoJSON export failed: ${msg}`)
      pushPilotDebug({ kind: 'exportGeoJSON', ok: false, detail: msg })
    } finally {
      setExportBusy(false)
    }
  }, [hostBridgeReady, pilotState, hostBridge, profile, setStatusMessage])

  const exportDCATFromServer = useCallback(async () => {
    if (!hostBridgeReady) return
    setExportBusy(true)
    setStatusMessage('Generating DCAT JSON-LD…')
    try {
      const fd = pilotStateToLegacyFormData(pilotState)
      const text = await hostBridge.generateDCAT(fd)
      const id = profile.getExportId?.(pilotState) ?? 'metadata'
      downloadTextFile(`${id}.jsonld`, text, 'application/ld+json')
      setStatusMessage('DCAT JSON-LD downloaded.')
      pushPilotDebug({ kind: 'exportDCAT', ok: true })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      setStatusMessage(`DCAT export failed: ${msg}`)
      pushPilotDebug({ kind: 'exportDCAT', ok: false, detail: msg })
    } finally {
      setExportBusy(false)
    }
  }, [hostBridgeReady, pilotState, hostBridge, profile, setStatusMessage])

  // ── Server validation ────────────────────────────────────────────────────
  const [serverRulesBusy, setServerRulesBusy] = useState(false)
  const [serverRulesSummary, setServerRulesSummary] = useState('')

  const runServerRulesValidation = useCallback(async () => {
    if (!hostBridgeReady) {
      setStatusMessage('Server validation needs a connected host (e.g. `netlify dev` so `/api/db` is on the same origin).')
      return
    }
    setServerRulesBusy(true)
    setServerRulesSummary('')
    setStatusMessage('Running server validation…')
    try {
      const fd = pilotStateToLegacyFormData(pilotState)
      const level = pilotModeToValidationEngineLevel(pilotState.mode)
      const res = await hostBridge.validateOnServer(fd, level)
      const srv = typeof res?.summary === 'string' ? res.summary : JSON.stringify(res?.summary ?? res ?? {})
      setServerRulesSummary(srv)
      setStatusMessage('Server rules validation finished.')
      pushPilotDebug({ kind: 'serverRules', ok: true, detail: srv.slice(0, 120) })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      setServerRulesSummary('')
      setStatusMessage(`Server validation failed: ${msg}`)
      pushPilotDebug({ kind: 'serverRules', ok: false, detail: msg })
    } finally {
      setServerRulesBusy(false)
    }
  }, [hostBridgeReady, pilotState, hostBridge, setStatusMessage])

  return {
    // draft
    draftStatus,
    pilotBusy,
    savePilotDraft,
    loadPilotDraft,
    // template catalog
    templateCatalogRows,
    templateCatalogLoading,
    templateCatalogError,
    refreshTemplateCatalog,
    applySheetTemplateByName,
    saveNamedSheetTemplate,
    templateApplyDisabled: pilotBusy || !hostBridgeReady,
    sheetTemplateSaveDisabled: pilotBusy || !hostBridgeReady,
    // platform library
    platformLibraryRows,
    platformLibraryLoading,
    platformLibraryError,
    refreshPlatformLibrary,
    applyPlatformFromLibraryKey,
    saveCurrentPlatformToSheets,
    platformSaveBusy,
    // server exports
    exportBusy,
    exportGeoJSONFromServer,
    exportDCATFromServer,
    // server validation
    serverRulesBusy,
    serverRulesSummary,
    runServerRulesValidation,
  }
}
