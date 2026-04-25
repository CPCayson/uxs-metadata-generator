import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { strFromU8, unzipSync } from 'fflate'
import { emitPilotAuditEvent } from '../lib/pilotAuditEvents.js'
import ScannerSuggestionsDialog from './ScannerSuggestionsDialog.jsx'

/**
 * Header-mounted XML tools strip.
 *
 * Portals into #pilot-header-tools-slot (rendered inside <header>) so every
 * profile surfaces Import / Copy / Download / GeoJSON / DCAT next to the
 * profile picker, regardless of which dropdown template is selected.
 *
 * Buttons automatically disable themselves when the active profile doesn't
 * support the underlying capability:
 *   - Import XML / zip / Paste import : needs at least one profile.importParsers entry.
 *   - Copy / Download preview   : needs profile.buildXmlPreview.
 *   - GeoJSON / DCAT (server)   : capability flag + same-origin `/api/db`.
 *
 * @param {{
 *   profile: import('../core/registry/types.js').EntityProfile,
 *   pilotState: object,
 *   onPilotImport: (next: object) => void,
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
 * }} props
 */
function XmlToolsBar({
  profile,
  pilotState,
  onPilotImport,
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

  const xml = useMemo(
    () => (canBuildXml ? profile.buildXmlPreview(pilotState) || '' : ''),
    [canBuildXml, profile, pilotState],
  )

  const [mountEl, setMountEl] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')
  const [importBusy, setImportBusy] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  /** When a zip contains multiple .xml files, list paths and let the user pick one. */
  const [zipXmlPaths, setZipXmlPaths] = useState(/** @type {string[] | null} */ (null))
  const [zipPickPath, setZipPickPath] = useState('')
  const fileInputRef = useRef(null)
  /** Map path → bytes while a multi-entry zip is open; cleared after Apply or non-zip load. */
  const zipBytesRef = useRef(/** @type {Record<string, Uint8Array> | null} */ (null))
  /** Filename from last file-picker load; cleared after a successful Apply. */
  const pendingImportMetaRef = useRef(
    /** @type {import('../core/registry/types.js').ImportParseMeta} */ ({}),
  )
  const pendingZipArchiveNameRef = useRef('')

  function clearZipImportUi() {
    zipBytesRef.current = null
    pendingZipArchiveNameRef.current = ''
    setZipXmlPaths(null)
    setZipPickPath('')
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

  function applyImport() {
    if (!canImport) return
    setImportError('')
    setImportBusy(true)
    try {
      let result = null
      const meta = {
        originalFilename: pendingImportMetaRef.current?.originalFilename,
        originalUuid:     pendingImportMetaRef.current?.originalUuid,
        sourceId:         pendingImportMetaRef.current?.sourceId,
      }
      for (const parser of importParsers) {
        try {
          const r = parser?.parse?.(importText, meta)
          if (r) {
            result = r
            if (r.ok) break
          }
        } catch (err) {
          result = {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
            warnings: [],
          }
        }
      }
      if (!result) {
        const msg = 'No import parser is available for this profile.'
        setImportError(msg)
        onStatus?.(msg)
        return
      }
      if (!result.ok) {
        setImportError(result.error || 'Import failed.')
        onStatus?.(result.error || 'Import failed.')
        return
      }
      const payload = { ...result.partial }
      if (result.provenance) payload.sourceProvenance = result.provenance
      const merged = profile.mergeLoaded
        ? profile.mergeLoaded(payload)
        : { ...profile.defaultState(), ...payload }
      pendingImportMetaRef.current = {}
      clearZipImportUi()
      onPilotImport(merged)
      emitPilotAuditEvent({
        profileId: profile.id,
        action: 'pilotImport',
        result: 'ok',
        sourceType: result.provenance?.sourceType ?? 'unknown',
        originalFilename: meta.originalFilename || null,
      })
      const w = result.warnings?.length ? ` (${result.warnings.join(' ')})` : ''
      onStatus?.(`Imported fields from XML.${w}`)
      setImportOpen(false)
      setImportText('')
    } finally {
      setImportBusy(false)
    }
  }

  async function pasteFromClipboard() {
    setImportError('')
    try {
      const t = await navigator.clipboard.readText()
      setImportText(t)
      onStatus?.('Pasted from clipboard.')
    } catch {
      setImportError('Clipboard read blocked — paste manually (Cmd+V / Ctrl+V).')
    }
  }

  function onXmlFileChosen(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setImportError('')
    setImportOpen(true)
    const lower = file.name.toLowerCase()
    const looksZip = lower.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed'

    if (looksZip) {
      const reader = new FileReader()
      reader.onload = () => {
        const buf = reader.result
        if (!(buf instanceof ArrayBuffer)) {
          setImportError('Zip read produced no data.')
          return
        }
        try {
          const { map, xmlPaths } = unzipToXmlPaths(buf)
          if (!xmlPaths.length) {
            clearZipImportUi()
            setImportText('')
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
            setImportText(text)
            onStatus?.(`Loaded ${path} from ${file.name} (${text.length} chars). Apply to merge into the form.`)
            return
          }
          setZipXmlPaths(xmlPaths)
          const first = xmlPaths[0]
          setZipPickPath(first)
          const text = decodeZipUtf8(map[first])
          setImportText(text)
          pendingImportMetaRef.current = { originalFilename: `${file.name}#${first}` }
          onStatus?.(
            `Zip ${file.name}: ${xmlPaths.length} XML files — pick one below, then Apply.`,
          )
        } catch (err) {
          clearZipImportUi()
          setImportText('')
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
      setImportText(text)
      onStatus?.(`Loaded ${file.name} (${text.length} chars). Review and click Apply to form.`)
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
    const baseId = profile.getExportId?.(pilotState) ?? 'metadata'
    const id = String(baseId || 'metadata').replace(/[^\w.-]+/g, '_') || 'metadata'
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${id}-preview.xml`
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    onStatus?.('Preview XML download started.')
  }

  const bar = (
    <div className="pilot-xml-tools" data-profile={profile.id}>
      <div className="pilot-xml-tools__row">
        <span className="pilot-xml-tools__label" aria-hidden>
          XML
        </span>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xml,.XML,.zip,.ZIP,text/xml,application/xml,application/zip,application/x-zip-compressed"
          className="visually-hidden"
          aria-hidden
          tabIndex={-1}
          onChange={onXmlFileChosen}
        />
        <button
          type="button"
          className="button button-secondary button-tiny"
          onClick={() => fileInputRef.current?.click()}
          disabled={!canImport}
          title={
            canImport
              ? 'Load a metadata .xml file or a .zip that contains one or more .xml files'
              : 'No import parser for this profile'
          }
        >
          Import XML / zip…
        </button>
        <button
          type="button"
          className="button button-secondary button-tiny"
          onClick={() => setImportOpen((o) => !o)}
          aria-expanded={importOpen}
          disabled={!canImport}
          title={canImport ? 'Paste XML to merge into the form' : 'No import parser for this profile'}
        >
          {importOpen ? 'Hide import' : 'Paste import…'}
        </button>
        <button
          type="button"
          className="button button-secondary button-tiny"
          onClick={() => setScannerOpen(true)}
          disabled={!canScanner}
          title={
            canScanner
              ? 'Lens Scanner: paste JSON, run heuristic, merge suggestions'
              : 'Scanner suggestions require scannerPrefill and host/validation wiring'
          }
        >
          Scanner suggestions…
        </button>
        <button
          type="button"
          className="button button-secondary button-tiny"
          onClick={() => void copyPreviewToClipboard()}
          disabled={!canBuildXml}
          title={canBuildXml ? 'Copy the current XML preview to the clipboard' : 'No XML preview builder for this profile'}
        >
          Copy preview XML
        </button>
        <button
          type="button"
          className="button button-secondary button-tiny"
          onClick={downloadPreviewXml}
          disabled={!canBuildXml}
          title={canBuildXml ? 'Download the current XML preview' : 'No XML preview builder for this profile'}
        >
          Download preview
        </button>
        <button
          type="button"
          className="button button-secondary button-tiny"
          onClick={() => onExportGeoJSON?.()}
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
          {exportBusy ? 'Export…' : 'GeoJSON (server)'}
        </button>
        <button
          type="button"
          className="button button-secondary button-tiny"
          onClick={() => onExportDCAT?.()}
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
          {exportBusy ? 'Export…' : 'DCAT JSON-LD (server)'}
        </button>

        <button
          type="button"
          className={`button button-tiny pilot-xml-tools__comet-push${cometUuid ? '' : ' button-secondary'}`}
          onClick={() => void onPushToComet?.()}
          disabled={!canCometPush || !cometUuid || pushBusy}
          aria-busy={pushBusy}
          title={
            !canCometPush
              ? 'This profile does not support CoMET push'
              : !cometUuid
                ? 'Pull a CoMET record in the side CoMET tab or Manta Ray assistant first'
                : pushBusy
                  ? 'Pushing to CoMET…'
                  : `Push refined ISO 19115-2 XML to CoMET record ${cometUuid.slice(0, 8)}…`
          }
        >
          {pushBusy ? 'Pushing…' : cometUuid ? 'Push to CoMET' : 'Push to CoMET (no record)'}
        </button>
      </div>

      {(canGeoJson || canDcat) && !hostBridgeReady ? (
        <p className="pilot-xml-tools__hint">
          Server GeoJSON / DCAT need the host bridge: deploy with a same-origin <code>/api/db</code> (e.g. Netlify), or run{' '}
          <code>netlify dev</code> locally.
        </p>
      ) : null}

      {canImport && importOpen ? (
        <div className="xml-import-panel pilot-xml-tools__import">
          <p className="xml-import-hint">
            Paste XML, load a single <code>.xml</code> file, or a <code>.zip</code> of shared metadata (multiple
            XML files show a picker). Merges into the <strong>{profile.label}</strong> form; unrecognized elements are
            ignored. Press <kbd>Esc</kbd> to close.
          </p>
          {zipXmlPaths && zipXmlPaths.length > 1 ? (
            <label className="xml-import-zip-pick">
              <span className="xml-import-zip-pick__label">XML inside zip</span>
              <select
                className="form-control"
                value={zipPickPath}
                onChange={(e) => {
                  const path = e.target.value
                  setZipPickPath(path)
                  const map = zipBytesRef.current
                  if (!map?.[path]) return
                  const text = decodeZipUtf8(map[path])
                  setImportText(text)
                  const arc = pendingZipArchiveNameRef.current || 'archive.zip'
                  pendingImportMetaRef.current = { originalFilename: `${arc}#${path}` }
                  onStatus?.(`Switched import to ${path} (${text.length} chars).`)
                }}
                aria-label="Choose XML file inside zip"
              >
                {zipXmlPaths.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <textarea
            className="form-control xml-import-textarea"
            rows={6}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            spellCheck={false}
            placeholder="Paste XML here…"
            aria-label="XML to import"
          />
          <div className="xml-import-actions">
            <button
              type="button"
              className="button button-secondary button-tiny"
              onClick={() => void pasteFromClipboard()}
            >
              Read clipboard
            </button>
            <button
              type="button"
              className="button button-tiny"
              onClick={applyImport}
              disabled={importBusy || !importText.trim()}
            >
              Apply to form
            </button>
          </div>
          {importError ? (
            <p className="field-error" role="alert">
              {importError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )

  if (!mountEl) return null
  return (
    <>
      {createPortal(bar, mountEl)}
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

export default memo(XmlToolsBar)
