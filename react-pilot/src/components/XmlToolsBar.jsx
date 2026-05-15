import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { strFromU8, unzipSync } from 'fflate'
import { emitPilotAuditEvent } from '../lib/pilotAuditEvents.js'
import { downloadPilotPreviewXml } from '../lib/downloadPilotPreviewXml.js'
import { downloadPilotImportReport } from '../lib/downloadPilotImportReport.js'
import { parseProfileXmlImport } from '../lib/parseProfileXmlImport.js'
import { summarizePilotImportPopulation } from '../lib/importMergeSummary.js'
import { detectGaps } from '../lib/cometClient.js'
import ScannerSuggestionsDialog from './ScannerSuggestionsDialog.jsx'
import { GapPanel } from './UxsGapPanel.jsx'
import { getBundledMissionXmlSamples } from '../lib/missionBundledXmlSamples.js'

/**
 * Header-mounted XML tools strip.
 *
 * Portals into #pilot-header-tools-slot (below #pilot-header-steps-slot) and schema/host/preview/NCEI
 * chips into #pilot-header-meta-slot (top-right of .header-top). Primary row shows
 * Metadata label + Import / Start over / Export / Summary; paste import, scanner, gap check,
 * CoMET actions, and secondary exports live under the More overflow menu.
 *
 * Buttons automatically disable themselves when the active profile doesn't
 * support the underlying capability:
 *   - Import / paste panel       : needs at least one profile.importParsers entry.
 *   - Copy / Export / Summary    : needs profile.buildXmlPreview (Summary after an import).
 *   - GeoJSON / DCAT (server)   : capability flag + same-origin `/api/db`.
 *
 * @param {{
 *   profile: import('../core/registry/types.js').EntityProfile,
 *   pilotState: object,
 *   onPilotImport: (next: object, meta?: { importWarnings?: string[] }) => void,
 *   onBeforeApplyXmlImport?: (xmlText: string) => boolean,
 *   onStatus?: (message: string) => void,
 *   hostBridgeReady?: boolean,
 *   exportBusy?: boolean,
 *   onExportGeoJSON?: (() => void) | null,
 *   onExportDCAT?: (() => void) | null,
 *   cometUuid?: string,
 *   onPushToComet?: () => void,
 *   pushBusy?: boolean,
 *   hostBridge: import('../adapters/HostBridge.js').HostBridge,
 *   validationEngine: import('../core/validation/ValidationEngine.js').ValidationEngine,
 *   onScannerApply?: (next: object) => void,
 *   quietSurface?: boolean,
 *   onCometPull?: (() => void) | null,
 *   onClearForm?: (() => void) | null,
 *   importSampleContext?: { rawXml: string, filename?: string, warnings?: string[] } | null,
 *   onImportSampleRecorded?: ((detail: { rawXml: string, filename?: string, warnings?: string[] }) => void) | null,
 *   workspaceNav?: { onHome: () => void, onNewRecord: () => void } | null,
 * }} props
 */
function XmlToolsBar({
  profile,
  pilotState,
  onPilotImport,
  onBeforeApplyXmlImport,
  onStatus,
  hostBridgeReady = false,
  exportBusy = false,
  onExportGeoJSON,
  onExportDCAT,
  cometUuid = '',
  onPushToComet,
  pushBusy = false,
  hostBridge,
  validationEngine,
  onScannerApply,
  quietSurface = false,
  onCometPull = null,
  onClearForm = null,
  importSampleContext = null,
  onImportSampleRecorded = null,
  workspaceNav = null,
  /** When true, render inline instead of portaling to #pilot-header-tools-slot */
  inline = false,
}) {
  const cap = profile.capabilities ?? {}
  const importParsers = Array.isArray(profile.importParsers) ? profile.importParsers : []
  const canBuildXml = typeof profile.buildXmlPreview === 'function'
  const canImport = importParsers.length > 0
  const canGeoJson = Boolean(cap.geoJsonExport) && typeof onExportGeoJSON === 'function'
  const canDcat = Boolean(cap.dcatExport) && typeof onExportDCAT === 'function'
  const canCometPush = Boolean(cap.cometPush) && typeof onPushToComet === 'function'
  const canScanner =
    Boolean(cap.scannerPrefill) &&
    typeof onScannerApply === 'function' &&
    hostBridge &&
    validationEngine

  const isMission = profile.id === 'mission'
  const bundledMissionSamples = useMemo(
    () => (isMission ? getBundledMissionXmlSamples() : []),
    [isMission],
  )
  const [gaps, setGaps] = useState(null)
  const [gapBusy, setGapBusy] = useState(false)
  const [showGaps, setShowGaps] = useState(false)

  const runGapCheck = useCallback(async () => {
    setGapBusy(true)
    setShowGaps(true)
    try {
      const result = detectGaps(pilotState, 'mission')
      setGaps(result || [])
    } catch {
      setGaps(['Gap detection failed — check console.'])
    } finally {
      setGapBusy(false)
    }
  }, [pilotState])

  const xml = useMemo(
    () => (canBuildXml ? profile.buildXmlPreview(pilotState) || '' : ''),
    [canBuildXml, profile, pilotState],
  )

  const [mountEl, setMountEl] = useState(null)
  const [metaMountEl, setMetaMountEl] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')
  const [importBusy, setImportBusy] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false)
  const [extensionScannerCapture, setExtensionScannerCapture] = useState(null)
  const [importSummaryText, setImportSummaryText] = useState('')
  const importSummaryDismissRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null))

  const IMPORT_SUMMARY_DISMISS_MS = 6000

  function clearImportSummary() {
    if (importSummaryDismissRef.current) {
      clearTimeout(importSummaryDismissRef.current)
      importSummaryDismissRef.current = null
    }
    setImportSummaryText('')
  }

  useEffect(() => {
    if (!importSummaryText) return undefined
    importSummaryDismissRef.current = setTimeout(() => {
      importSummaryDismissRef.current = null
      setImportSummaryText('')
    }, IMPORT_SUMMARY_DISMISS_MS)
    return () => {
      if (importSummaryDismissRef.current) {
        clearTimeout(importSummaryDismissRef.current)
        importSummaryDismissRef.current = null
      }
    }
  }, [importSummaryText])
  /** When a zip contains multiple .xml files, list paths and let the user pick one. */
  const [zipXmlPaths, setZipXmlPaths] = useState(/** @type {string[] | null} */ (null))
  const [zipPickPath, setZipPickPath] = useState('')
  const fileInputRef = useRef(null)
  const overflowMenuRef = useRef(null)
  const extensionCaptureKeyRef = useRef('')
  const importApplyingRef = useRef(false)

  function extensionCaptureDedupeKey(capture) {
    const text = String(capture?.text || '').trim()
    return `${capture?.capturedAt || capture?.url || ''}:${capture?.kind || ''}:${text.length}`
  }

  function shouldSkipExtensionCapture(captureKey) {
    try {
      const storageKey = `manta-ext-cap:${captureKey}`
      if (sessionStorage.getItem(storageKey)) return true
      sessionStorage.setItem(storageKey, String(Date.now()))
      return false
    } catch {
      return extensionCaptureKeyRef.current === captureKey
    }
  }
  /** Map path → bytes while a multi-entry zip is open; cleared after Apply or non-zip load. */
  const zipBytesRef = useRef(/** @type {Record<string, Uint8Array> | null} */ (null))
  /** Filename from last file-picker load; cleared after a successful Apply. */
  const pendingImportMetaRef = useRef(
    /** @type {import('../core/registry/types.js').ImportParseMeta} */ ({}),
  )
  const pendingZipArchiveNameRef = useRef('')

  useEffect(() => {
    if (!overflowMenuOpen) return undefined
    function onPointerDown(e) {
      const el = overflowMenuRef.current
      if (el && !el.contains(e.target)) setOverflowMenuOpen(false)
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setOverflowMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [overflowMenuOpen])

  function clearZipImportUi() {
    zipBytesRef.current = null
    pendingZipArchiveNameRef.current = ''
    setZipXmlPaths(null)
    setZipPickPath('')
  }

  function textLooksLikeXml(text) {
    return /<\?xml|<gmd:|<gmi:|<MD_Metadata|<MI_Metadata/i.test(String(text || ''))
  }

  /**
   * @param {Uint8Array} bytes
   * @returns {string}
   */
  function decodeZipUtf8(bytes) {
    try {
      return strFromU8(bytes, false)
    } catch {
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    }
  }

  /**
   * @param {ArrayBuffer} buf
   * @returns {{ map: Record<string, Uint8Array>, xmlPaths: string[] }}
   */
  function unzipToXmlPaths(buf) {
    const u = new Uint8Array(buf)
    let map
    try {
      map = unzipSync(u)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`Could not read zip: ${msg}`)
    }
    const xmlPaths = Object.keys(map).filter(
      (p) =>
        /\.xml$/i.test(p) &&
        !p.startsWith('__MACOSX/') &&
        !/\/\._/.test(p) &&
        map[p] &&
        map[p].byteLength > 0,
    )
    xmlPaths.sort((a, b) => a.localeCompare(b))
    return { map, xmlPaths }
  }

  // Resolve the portal target after mount; also poll briefly since the slot
  // lives in App.jsx and WizardShell mounts inside it — slot should be there
  // on first render, but be defensive if re-parented by the host.
  useEffect(() => {
    const el = document.getElementById('pilot-header-tools-slot')
    if (el) {
      setMountEl(el)
      return undefined
    }
    let tries = 0
    const t = window.setInterval(() => {
      const node = document.getElementById('pilot-header-tools-slot')
      if (node) {
        setMountEl(node)
        window.clearInterval(t)
      } else if (++tries > 30) {
        window.clearInterval(t)
      }
    }, 50)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    const el = document.getElementById('pilot-header-meta-slot')
    if (el) {
      setMetaMountEl(el)
      return undefined
    }
    let tries = 0
    const t = window.setInterval(() => {
      const node = document.getElementById('pilot-header-meta-slot')
      if (node) {
        setMetaMountEl(node)
        window.clearInterval(t)
      } else if (++tries > 30) {
        window.clearInterval(t)
      }
    }, 50)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    function handleCapture(capture) {
      if (typeof window !== 'undefined' && window.__mantaWorkspaceClearing) return
      const text = String(capture?.text || '').trim()
      if (!text) return
      const captureKey = extensionCaptureDedupeKey(capture)
      if (shouldSkipExtensionCapture(captureKey)) return
      extensionCaptureKeyRef.current = captureKey
      const title = String(capture?.title || capture?.url || 'extension-capture').slice(0, 180)
      const sourceLabel = capture?.source === 'manta-desktop' ? 'desktop' : 'extension'
      if (textLooksLikeXml(text) && canImport) {
        clearZipImportUi()
        pendingImportMetaRef.current = {
          originalFilename: title,
          sourceId: capture?.url || `manta-${sourceLabel}`,
        }
        setImportError('')
        void applyImportText(text)
        onStatus?.(`Applying XML from ${sourceLabel}…`)
        return
      }
      if (canScanner) {
        setExtensionScannerCapture(capture)
        setScannerOpen(true)
        onStatus?.(`Loaded page capture from ${sourceLabel} (${text.length} chars). Review scanner suggestions before merging.`)
        return
      }
      onStatus?.(`Loaded ${sourceLabel} capture — no XML recognized.`)
    }
    function onExtensionCapture(/** @type {CustomEvent} */ event) {
      handleCapture(event.detail && typeof event.detail === 'object' ? event.detail : null)
    }
    function onExtensionMessage(/** @type {MessageEvent} */ event) {
      if (event.origin !== window.location.origin) return
      const data = event.data && typeof event.data === 'object' ? event.data : null
      if (!['manta-chrome-extension', 'manta-desktop'].includes(String(data?.source || ''))) return
      if (data?.type !== 'manta-extension-capture') return
      handleCapture(data.capture && typeof data.capture === 'object' ? data.capture : null)
    }
    window.addEventListener('manta:extension-capture', onExtensionCapture)
    window.addEventListener('message', onExtensionMessage)
    return () => {
      window.removeEventListener('manta:extension-capture', onExtensionCapture)
      window.removeEventListener('message', onExtensionMessage)
    }
  }, [canImport, canScanner, onStatus])

  useEffect(() => {
    if (!importOpen) return undefined
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        clearZipImportUi()
        setImportOpen(false)
        setImportError('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [importOpen])

  /** Core import logic — accepts text directly so file/paste paths can auto-apply without state delay. */
  async function applyImportText(xmlText) {
    if (!canImport || !xmlText) return
    if (importApplyingRef.current) return
    importApplyingRef.current = true
    setImportError('')
    clearImportSummary()
    setImportBusy(true)
    try {
      if (typeof onBeforeApplyXmlImport === 'function' && onBeforeApplyXmlImport(xmlText) === false) {
        setImportError('Import cancelled — your current record was not changed.')
        onStatus?.('Import cancelled.')
        return
      }
      let sensorLibraryRows = []
      if (hostBridgeReady && hostBridge?.listSensors) {
        try {
          const sr = await hostBridge.listSensors()
          sensorLibraryRows = sr.unexpectedShape ? [] : sr.rows
        } catch { sensorLibraryRows = [] }
      }
      const meta = {
        originalFilename: pendingImportMetaRef.current?.originalFilename,
        originalUuid:     pendingImportMetaRef.current?.originalUuid,
        sourceId:         pendingImportMetaRef.current?.sourceId,
        sensorLibraryRows,
      }
      const out = parseProfileXmlImport(profile, xmlText, meta)
      if (!out.ok) {
        setImportError(out.error || 'Import failed.')
        onStatus?.(out.error || 'Import failed.')
        return
      }
      pendingImportMetaRef.current = {}
      clearZipImportUi()
      onImportSampleRecorded?.({ rawXml: xmlText, filename: meta.originalFilename, warnings: out.warnings })
      onPilotImport(out.merged, { importWarnings: out.warnings })
      emitPilotAuditEvent({ profileId: profile.id, action: 'pilotImport', result: 'ok', sourceType: out.provenance?.sourceType ?? 'unknown', originalFilename: meta.originalFilename || null })
      const pop = summarizePilotImportPopulation(out.merged)
      const w = out.warnings?.length ? ` Parser notes: ${out.warnings.join(' · ')}` : ''
      setImportSummaryText(`${pop.summary}${w}`)
      clearZipImportUi()
    } finally {
      importApplyingRef.current = false
      setImportBusy(false)
    }
  }

  async function applyImport() { return applyImportText(importText) }

  async function pasteFromClipboard() {
    setImportError('')
    try {
      const t = await navigator.clipboard.readText()
      if (t.trim()) {
        pendingImportMetaRef.current = { originalFilename: 'clipboard-paste' }
        void applyImportText(t)
      }
    } catch {
      setImportError('Clipboard read blocked — grant clipboard permission or use Import to load a file.')
      onStatus?.('Clipboard read blocked.')
    }
  }

  function onXmlFileChosen(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setImportError('')
    clearImportSummary()
    const lower = file.name.toLowerCase()
    const looksZip = lower.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed'

    if (looksZip) {
      const reader = new FileReader()
      reader.onload = () => {
        const buf = reader.result
        if (!(buf instanceof ArrayBuffer)) {
          setImportError('Zip read produced no data.')
          onStatus?.('Zip read produced no data.')
          return
        }
        try {
          const { map, xmlPaths } = unzipToXmlPaths(buf)
          if (!xmlPaths.length) {
            clearZipImportUi()
            setImportError('No .xml entries found in that zip (skipped __MACOSX).')
            onStatus?.('Zip contained no XML files.')
            return
          }
          zipBytesRef.current = map
          pendingZipArchiveNameRef.current = file.name
          if (xmlPaths.length === 1) {
            clearZipImportUi()
            const path = xmlPaths[0]
            const text = decodeZipUtf8(map[path])
            pendingImportMetaRef.current = { originalFilename: `${file.name}#${path}` }
            void applyImportText(text)
            return
          }
          // Multi-file zip: open panel so user can pick
          setImportOpen(true)
          setZipXmlPaths(xmlPaths)
          const first = xmlPaths[0]
          setZipPickPath(first)
          const text = decodeZipUtf8(map[first])
          setImportText(text)
          pendingImportMetaRef.current = { originalFilename: `${file.name}#${first}` }
          onStatus?.(`Zip ${file.name}: ${xmlPaths.length} XML files — select one from the list.`)
        } catch (err) {
          clearZipImportUi()
          setImportError(err instanceof Error ? err.message : String(err))
          onStatus?.('Zip import failed.')
        }
      }
      reader.onerror = () => {
        setImportError('Could not read that zip file.')
        onStatus?.('File read failed.')
      }
      reader.readAsArrayBuffer(file)
      return
    }

    clearZipImportUi()
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      pendingImportMetaRef.current = { originalFilename: file.name }
      void applyImportText(text)
    }
    reader.onerror = () => {
      setImportError('Could not read that file.')
      onStatus?.('File read failed.')
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function copyPreviewToClipboard() {
    if (!canBuildXml) return
    setImportError('')
    try {
      await navigator.clipboard.writeText(xml)
      onStatus?.('Preview XML copied to clipboard.')
    } catch {
      onStatus?.('Copy blocked — select the preview text manually.')
    }
  }

  function downloadPreviewXml() {
    if (!canBuildXml) return
    downloadPilotPreviewXml(profile, pilotState, onStatus)
  }

  function downloadImportReport() {
    downloadPilotImportReport({
      profile,
      pilotState,
      validationEngine,
      importContext: importSampleContext,
      onStatus,
    })
  }

  const showLegacyMeta = canBuildXml || isMission
  const nceiUxSUrl = 'https://www.ncei.noaa.gov/products/uncrewed-system-metadata-templates'

  const legacyMetaBlock = showLegacyMeta ? (
    <div className="pilot-xml-tools__legacy-meta" aria-label="Export format and host status">
      {canBuildXml ? (
        <span className="pilot-xml-tools__schema-line">
          <span className="pilot-xml-tools__schema-kicker">Target schema</span>
          <span className="pilot-xml-tools__schema-value">ISO 19115-2</span>
        </span>
      ) : null}
      <span
        className={`pilot-xml-tools__host-pill${hostBridgeReady ? ' pilot-xml-tools__host-pill--on' : ''}`}
        title={
          hostBridgeReady
            ? 'Same-origin /api/db is reachable (catalog, GeoJSON, DCAT, server checks).'
            : 'Host bridge offline — use npm run dev:netlify or deploy for /api/db features.'
        }
      >
        <span className="pilot-xml-tools__host-dot" aria-hidden />
        {hostBridgeReady ? 'Host connected' : 'Host offline'}
      </span>
      <span className="pilot-xml-tools__preview-hint" title="Live XML preview updates when you edit the form">
        Preview updates live
      </span>
      {isMission ? (
        <a
          href={nceiUxSUrl}
          className="pilot-xml-tools__ncei-link"
          target="_blank"
          rel="noopener noreferrer"
          title="NCEI Uncrewed Systems metadata templates (opens new tab)"
        >
          NCEI UxS templates
        </a>
      ) : null}
    </div>
  ) : null

  const metaPortal =
    legacyMetaBlock && metaMountEl ? createPortal(legacyMetaBlock, metaMountEl) : null

  const bar = (
    <div className="pilot-xml-tools" data-profile={profile.id}>
      <div className="pilot-xml-tools__row">
        <span className="pilot-xml-tools__label">
          <span className="pilot-xml-tools__label-text">Metadata</span>
        </span>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xml,.XML,.zip,.ZIP,text/xml,application/xml,application/zip,application/x-zip-compressed"
          className="pilot-xml-tools__file-input"
          aria-hidden
          tabIndex={-1}
          onChange={onXmlFileChosen}
        />
        <button
          type="button"
          className="button button-tiny pilot-xml-tools__action pilot-xml-tools__action--primary"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            fileInputRef.current?.click()
          }}
          disabled={!canImport || importBusy}
          title={
            canImport
              ? 'Choose a metadata file (.xml) or a zip folder that contains XML — we merge it into your form'
              : 'This profile does not support file import yet'
          }
        >
          Import
        </button>
        {typeof onClearForm === 'function' ? (
          <button
            type="button"
            className="button button-secondary button-tiny pilot-xml-tools__clear-form pilot-xml-tools__action"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onClearForm()
            }}
            title="Reset the form to a fresh start (your browser draft is cleared too)"
          >
            Start over
          </button>
        ) : null}
        <button
          type="button"
          className="button button-tiny pilot-xml-tools__action pilot-xml-tools__action--primary"
          onClick={downloadPreviewXml}
          disabled={!canBuildXml}
          title={
            canBuildXml
              ? 'Download your metadata as a standard XML file you can archive or share'
              : 'No preview export for this profile'
          }
        >
          Export
        </button>
        <button
          type="button"
          className="button button-secondary button-tiny pilot-xml-tools__action pilot-xml-tools__action--quiet"
          onClick={downloadImportReport}
          disabled={!importSampleContext?.rawXml?.trim()}
          title={
            importSampleContext?.rawXml?.trim()
              ? 'Download a friendly summary: what filled in, checks, and how it compares to your upload'
              : 'Available after you import a file — summarizes changes and checks'
          }
        >
          Summary
        </button>

        <div className="pilot-xml-tools__overflow-wrap" ref={overflowMenuRef}>
          <button
            type="button"
            className="button button-secondary button-tiny pilot-xml-tools__overflow-trigger pilot-xml-tools__action--quiet"
            onClick={() => setOverflowMenuOpen((o) => !o)}
            aria-expanded={overflowMenuOpen}
            aria-haspopup="menu"
            aria-label="More metadata options"
            title="Paste text, copy to clipboard, maps & catalog exports, and more"
          >
            More
          </button>
          {overflowMenuOpen ? (
            <div className="pilot-xml-tools__overflow-menu" role="menu">
              {workspaceNav ? (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className="button button-secondary button-tiny pilot-xml-tools__overflow-item"
                    onClick={() => {
                      setOverflowMenuOpen(false)
                      workspaceNav.onHome()
                    }}
                  >
                    ← Workspace home
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="button button-secondary button-tiny pilot-xml-tools__overflow-item"
                    onClick={() => {
                      setOverflowMenuOpen(false)
                      workspaceNav.onNewRecord()
                    }}
                  >
                    + New record
                  </button>
                </>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className="button button-secondary button-tiny pilot-xml-tools__overflow-item"
                onClick={() => {
                  setOverflowMenuOpen(false)
                  void pasteFromClipboard()
                }}
                disabled={!canImport}
                title={canImport ? 'Read XML from clipboard and import' : 'This profile does not support import'}
              >
                Paste from clipboard
              </button>
              {isMission && canImport && bundledMissionSamples.length > 0 ? (
                <>
                  <span className="pilot-xml-tools__overflow-heading" role="presentation">
                    Import templates
                  </span>
                  <label className="pilot-xml-tools__overflow-item pilot-xml-tools__bundled-template-select-label">
                    <span className="visually-hidden">Load a bundled XML template into the import box</span>
                    <select
                      className="form-control pilot-xml-tools__bundled-template-select"
                      aria-label="Bundled import template"
                      defaultValue=""
                      onChange={(e) => {
                        const file = e.target.value
                        e.target.value = ''
                        if (!file) return
                        const hit = bundledMissionSamples.find((s) => s.file === file)
                        if (!hit) return
                        clearZipImportUi()
                        pendingImportMetaRef.current = { originalFilename: hit.file }
                        setImportError('')
                        setOverflowMenuOpen(false)
                        void applyImportText(hit.xml)
                        onStatus?.(`Applying bundled template ${hit.file}…`)
                      }}
                    >
                      <option value="">Bundled template…</option>
                      {bundledMissionSamples.map((s) => (
                        <option key={s.file} value={s.file}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className="button button-secondary button-tiny pilot-xml-tools__overflow-item"
                onClick={() => {
                  setOverflowMenuOpen(false)
                  setScannerOpen(true)
                }}
                disabled={!canScanner}
                title={
                  canScanner
                    ? 'Open suggestions to help fill fields from pasted notes or JSON'
                    : 'Suggestions need scanner wiring for this workspace'
                }
              >
                Field suggestions…
              </button>
              {isMission ? (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className="button button-secondary button-tiny pilot-xml-tools__overflow-item"
                    disabled={gapBusy}
                    onClick={() => {
                      setOverflowMenuOpen(false)
                      void runGapCheck()
                    }}
                    title="Run UxS-specific gap detection using CoMET detectGaps()"
                  >
                    {gapBusy ? '⟳ Checking…' : quietSurface ? '🔍 Gaps' : '🔍 UxS gap check'}
                  </button>
                  {typeof onCometPull === 'function' ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="button button-secondary button-tiny pilot-xml-tools__overflow-item"
                      onClick={() => {
                        setOverflowMenuOpen(false)
                        onCometPull()
                      }}
                    >
                      ↓ CoMET pull
                    </button>
                  ) : null}
                  {canCometPush ? (
                    <button
                      type="button"
                      role="menuitem"
                      className={`button button-tiny pilot-xml-tools__overflow-item pilot-xml-tools__comet-push${
                        cometUuid ? '' : ' button-secondary'
                      }`}
                      onClick={() => {
                        setOverflowMenuOpen(false)
                        void onPushToComet?.()
                      }}
                      disabled={pushBusy}
                      aria-busy={pushBusy}
                      title={
                        pushBusy
                          ? 'Pushing to CoMET…'
                          : cometUuid
                            ? `Push draft ISO XML to CoMET record ${cometUuid.slice(0, 8)}…`
                            : 'Push draft metadata to CoMET'
                      }
                    >
                      {pushBusy ? '⟳ Pushing…' : '↑ Push DRAFT'}
                    </button>
                  ) : null}
                </>
              ) : null}
              {!isMission && canCometPush ? (
                <button
                  type="button"
                  role="menuitem"
                  className={`button button-tiny pilot-xml-tools__overflow-item pilot-xml-tools__comet-push${
                    cometUuid ? '' : ' button-secondary'
                  }`}
                  onClick={() => {
                    setOverflowMenuOpen(false)
                    void onPushToComet?.()
                  }}
                  disabled={!cometUuid || pushBusy}
                  aria-busy={pushBusy}
                  title={
                    !cometUuid
                      ? 'Pull a CoMET record in the side CoMET tab or Manta Ray assistant first'
                      : pushBusy
                        ? 'Pushing to CoMET…'
                        : `Push refined ISO 19115-2 XML to CoMET record ${cometUuid.slice(0, 8)}…`
                  }
                >
                  {pushBusy ? 'Pushing…' : cometUuid ? 'Push to CoMET' : 'Push to CoMET (no record)'}
                </button>
              ) : null}
              <span className="pilot-xml-tools__overflow-heading" role="presentation">
                Also export
              </span>
              <button
                type="button"
                role="menuitem"
                className="button button-secondary button-tiny pilot-xml-tools__overflow-item"
                onClick={() => {
                  setOverflowMenuOpen(false)
                  void copyPreviewToClipboard()
                }}
                disabled={!canBuildXml}
                title={
                  canBuildXml ? 'Copy the current metadata XML to your clipboard' : 'No preview export for this profile'
                }
              >
                Copy XML to clipboard
              </button>
              <button
                type="button"
                role="menuitem"
                className="button button-secondary button-tiny pilot-xml-tools__overflow-item"
                onClick={() => {
                  setOverflowMenuOpen(false)
                  onExportGeoJSON?.()
                }}
                disabled={!canGeoJson || !hostBridgeReady || exportBusy}
                aria-busy={exportBusy}
                title={
                  !canGeoJson
                    ? 'This profile does not support server GeoJSON export'
                    : !hostBridgeReady
                      ? 'Server GeoJSON needs a reachable /api/db (same origin as this app)'
                      : 'Generate GeoJSON on the server'
                }
              >
                {exportBusy ? 'Export…' : isMission ? 'GeoJSON' : 'GeoJSON (server)'}
              </button>
              <button
                type="button"
                role="menuitem"
                className="button button-secondary button-tiny pilot-xml-tools__overflow-item"
                onClick={() => {
                  setOverflowMenuOpen(false)
                  onExportDCAT?.()
                }}
                disabled={!canDcat || !hostBridgeReady || exportBusy}
                aria-busy={exportBusy}
                title={
                  !canDcat
                    ? 'This profile does not support server DCAT export'
                    : !hostBridgeReady
                      ? 'Server DCAT needs a reachable /api/db (same origin as this app)'
                      : 'Generate DCAT JSON-LD on the server'
                }
              >
                {exportBusy ? 'Export…' : isMission ? 'DCAT' : 'DCAT JSON-LD (server)'}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {isMission && showGaps ? (
        <div className="pilot-xml-tools__gaps">
          <GapPanel gaps={gaps} onClose={() => setShowGaps(false)} />
        </div>
      ) : null}

      {importSummaryText ? (
        <div className="xml-import-summary-toast pilot-xml-tools__import-summary" role="status" aria-live="polite">
          <p className="xml-import-summary hint">{importSummaryText}</p>
          <button
            type="button"
            className="xml-import-summary-dismiss"
            aria-label="Dismiss import summary"
            onClick={clearImportSummary}
          >
            ×
          </button>
        </div>
      ) : null}

      {canImport && (importBusy || importError || (zipXmlPaths && zipXmlPaths.length > 1)) ? (
        <div className="xml-import-panel pilot-xml-tools__import" style={{ padding: '0.5rem 0.75rem' }}>
          {zipXmlPaths && zipXmlPaths.length > 1 ? (
            <label className="xml-import-zip-pick">
              <span className="xml-import-zip-pick__label">Multiple XML files in zip — pick one:</span>
              <select
                className="form-control"
                value={zipPickPath}
                onChange={(e) => {
                  const path = e.target.value
                  setZipPickPath(path)
                  const map = zipBytesRef.current
                  if (!map?.[path]) return
                  const text = decodeZipUtf8(map[path])
                  const arc = pendingZipArchiveNameRef.current || 'archive.zip'
                  pendingImportMetaRef.current = { originalFilename: `${arc}#${path}` }
                  void applyImportText(text)
                }}
                aria-label="Choose XML file inside zip"
              >
                {zipXmlPaths.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
          ) : null}
          {importBusy ? <p className="hint" role="status">Importing…</p> : null}
          {importError ? <p className="field-error" role="alert">{importError}</p> : null}
        </div>
      ) : null}
    </div>
  )

  if (inline) {
    return (
      <>
        {bar}
        {metaPortal}
        {canScanner
          ? createPortal(
              <ScannerSuggestionsDialog
                open={scannerOpen}
                onClose={() => setScannerOpen(false)}
                profile={profile}
                pilotState={pilotState}
                hostBridge={hostBridge}
                validationEngine={validationEngine}
                onApply={onScannerApply}
              />,
              document.body,
            )
          : null}
      </>
    )
  }

  if (!mountEl) return null
  return (
    <>
      {createPortal(bar, mountEl)}
      {metaPortal}
      {canScanner
        ? createPortal(
            <ScannerSuggestionsDialog
              open={scannerOpen}
              onClose={() => setScannerOpen(false)}
              profile={profile}
              pilotState={pilotState}
              hostBridge={hostBridge}
              validationEngine={validationEngine}
              onApply={onScannerApply}
              initialCapture={extensionScannerCapture}
            />,
            document.body,
          )
        : null}
    </>
  )
}

export default memo(XmlToolsBar)
