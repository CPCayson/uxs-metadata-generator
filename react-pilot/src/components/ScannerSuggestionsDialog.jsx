import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  isScannerSuggestionEnvelope,
  mergeScannerPartialIntoPilotState,
  parseScannerSuggestionsToMissionPartial,
} from '../adapters/sources/ScannerSuggestionAdapter.js'
import { runLensScanHeuristic } from '../lib/lensScanHeuristic.js'

/**
 * @param {import('../core/registry/types.js').ScannerSuggestionEnvelope} env
 * @returns {Array<{
 *   key: string,
 *   parentIndex: number,
 *   sliceIndex: number | null,
 *   suggestion: import('../core/registry/types.js').ScannerSuggestionItem,
 *   valueSlice: unknown,
 * }>}
 */
function flattenSuggestionsForUi(env) {
  const rows = []
  if (!env?.suggestions?.length) return rows
  env.suggestions.forEach((s, si) => {
    const fp = String(s.fieldPath || '')
    const val = s.value
    const isKeywordFacetArray =
      fp.startsWith('keywords.') &&
      Array.isArray(val) &&
      val.length > 0 &&
      val.every((v) => v && typeof v === 'object' && !Array.isArray(v))
    if (isKeywordFacetArray) {
      val.forEach((item, vi) => {
        rows.push({
          key:         `${si}:${vi}`,
          parentIndex: si,
          sliceIndex:  vi,
          suggestion:  s,
          valueSlice:  item,
        })
      })
    } else {
      rows.push({
        key:         `${si}:all`,
        parentIndex: si,
        sliceIndex:  null,
        suggestion:  s,
        valueSlice:  val,
      })
    }
  })
  return rows
}

/**
 * @param {import('../core/registry/types.js').ScannerSuggestionEnvelope} env
 * @param {ReturnType<typeof flattenSuggestionsForUi>} flatRows
 * @param {Set<string>} accepted
 */
function filterEnvelopeByAccepted(env, flatRows, accepted) {
  /** @type {Map<number, unknown[]>} */
  const grouped = new Map()
  for (const row of flatRows) {
    if (!accepted.has(row.key)) continue
    if (row.sliceIndex != null) {
      if (!grouped.has(row.parentIndex)) grouped.set(row.parentIndex, [])
      grouped.get(row.parentIndex)?.push(row.valueSlice)
    }
  }
  const atomic = new Set()
  for (const row of flatRows) {
    if (!accepted.has(row.key)) continue
    if (row.sliceIndex == null) atomic.add(row.parentIndex)
  }
  const out = []
  for (let pi = 0; pi < env.suggestions.length; pi++) {
    if (grouped.has(pi)) {
      const orig = env.suggestions[pi]
      out.push({ ...orig, value: grouped.get(pi) })
    } else if (atomic.has(pi)) {
      out.push(env.suggestions[pi])
    }
  }
  return { ...env, suggestions: out }
}

/**
 * @param {string} field
 * @param {string[]} roots
 */
function issueTouchesRoots(field, roots) {
  return roots.some((r) => field === r || field.startsWith(`${r}.`))
}

/**
 * @param {Record<string, unknown> | null | undefined} partial
 */
function partialRoots(partial) {
  if (!partial || typeof partial !== 'object') return []
  return Object.keys(partial).filter((k) => partial[k] != null)
}

/**
 * Lens Scanner ingest: paste JSON, run heuristic or server scan, accept/reject rows,
 * preview validation on merged fields, then apply.
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   profile: import('../core/registry/types.js').EntityProfile,
 *   pilotState: object,
 *   hostBridge: import('../adapters/HostBridge.js').HostBridge,
 *   validationEngine: import('../core/validation/ValidationEngine.js').ValidationEngine,
 *   onApply: (nextState: object) => void,
 * }} props
 */
export default function ScannerSuggestionsDialog({
  open,
  onClose,
  profile,
  pilotState,
  hostBridge,
  validationEngine,
  onApply,
}) {
  const [jsonText, setJsonText] = useState('')
  const [panelError, setPanelError] = useState('')
  const [busy, setBusy] = useState(false)
  /** @type {import('../core/registry/types.js').ScannerSuggestionEnvelope | null} */
  const [envelope, setEnvelope] = useState(null)
  const [acceptedKeys, setAcceptedKeys] = useState(() => new Set())
  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)
  const openerRef = useRef(null)

  const adapters = useMemo(
    () => (Array.isArray(profile.scannerSuggestionAdapters) ? profile.scannerSuggestionAdapters : []),
    [profile.scannerSuggestionAdapters],
  )
  const scannerProfileId = useMemo(() => String(profile.entityType || profile.id || 'mission'), [profile.entityType, profile.id])
  const canServerScan = typeof hostBridge?.lensScan === 'function'

  useEffect(() => {
    if (!open) return
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setJsonText('')
    setPanelError('')
    setEnvelope(null)
    setAcceptedKeys(new Set())
    window.requestAnimationFrame(() => closeButtonRef.current?.focus())
    return () => {
      openerRef.current?.focus?.()
      openerRef.current = null
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = [...dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter((el) => !el.disabled && !el.getAttribute('aria-hidden'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const flatRows = useMemo(() => (envelope ? flattenSuggestionsForUi(envelope) : []), [envelope])

  useEffect(() => {
    if (!envelope) return
    const rows = flattenSuggestionsForUi(envelope)
    setAcceptedKeys(new Set(rows.map((r) => r.key)))
  }, [envelope])

  const ingestEnvelopeFromObject = useCallback(
    async (parsed, sourceId) => {
      setPanelError('')
      if (!isScannerSuggestionEnvelope(parsed)) {
        setPanelError('Not a scanner suggestion envelope (needs a suggestions array).')
        setEnvelope(null)
        return
      }
      const env = /** @type {import('../core/registry/types.js').ScannerSuggestionEnvelope} */ (parsed)
      for (const ad of adapters) {
        if (!ad.canParse(env)) continue
        const r = await ad.parseExternal(env, { sourceId })
        if (!r.ok) setPanelError(r.error || 'Parser could not turn suggestions into mission fields.')
        break
      }
      setEnvelope(env)
    },
    [adapters],
  )

  const ingestJsonText = useCallback(
    async (trimmed) => {
      setPanelError('')
      let parsed
      try {
        parsed = JSON.parse(trimmed || '{}')
      } catch (e) {
        setPanelError(e instanceof Error ? e.message : 'Invalid JSON.')
        setEnvelope(null)
        return
      }
      await ingestEnvelopeFromObject(parsed, 'scanner-dialog-paste')
    },
    [ingestEnvelopeFromObject],
  )

  const parseJsonToEnvelope = useCallback(() => void ingestJsonText(jsonText.trim()), [jsonText, ingestJsonText])

  const runHeuristic = useCallback(async () => {
    setBusy(true)
    setPanelError('')
    try {
      const env = await runLensScanHeuristic({
        title:     String(pilotState?.mission?.title || pilotState?.title || ''),
        abstract:  String(pilotState?.mission?.abstract || pilotState?.abstract || ''),
        profileId: scannerProfileId,
      })
      setJsonText(JSON.stringify(env, null, 2))
      await ingestEnvelopeFromObject(env, 'scanner-dialog-heuristic')
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : String(e))
      setEnvelope(null)
    } finally {
      setBusy(false)
    }
  }, [pilotState, scannerProfileId, ingestEnvelopeFromObject])

  const runServerScan = useCallback(async () => {
    if (!canServerScan) return
    setBusy(true)
    setPanelError('')
    try {
      const env = await hostBridge.lensScan({
        title:     String(pilotState?.mission?.title || pilotState?.title || ''),
        abstract:  String(pilotState?.mission?.abstract || pilotState?.abstract || ''),
        profileId: scannerProfileId,
      })
      setJsonText(JSON.stringify(env, null, 2))
      await ingestEnvelopeFromObject(env, 'scanner-dialog-host')
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : String(e))
      setEnvelope(null)
    } finally {
      setBusy(false)
    }
  }, [canServerScan, hostBridge, pilotState, scannerProfileId, ingestEnvelopeFromObject])

  const filteredEnvelope = useMemo(() => {
    if (!envelope || flatRows.length === 0) return null
    return filterEnvelopeByAccepted(envelope, flatRows, acceptedKeys)
  }, [envelope, flatRows, acceptedKeys])

  const parsePreview = useMemo(() => {
    if (!filteredEnvelope?.suggestions?.length) return null
    return parseScannerSuggestionsToMissionPartial(filteredEnvelope, { sourceId: 'scanner-dialog-preview' })
  }, [filteredEnvelope])

  const previewMerged = useMemo(() => {
    if (!parsePreview?.ok || !parsePreview.partial) return null
    return mergeScannerPartialIntoPilotState(pilotState, /** @type {Record<string, unknown>} */ (parsePreview.partial))
  }, [parsePreview, pilotState])

  const previewIssues = useMemo(() => {
    if (!previewMerged || !parsePreview?.ok) return []
    const mode = String(previewMerged.mode || 'lenient')
    const roots = partialRoots(/** @type {Record<string, unknown>} */ (parsePreview.partial))
    const r = profile.validationRuleSets?.length
      ? validationEngine.runProfileRules(previewMerged, mode, profile)
      : validationEngine.runForPilotState(previewMerged, mode)
    return (r.issues || []).filter((i) => issueTouchesRoots(i.field, roots))
  }, [previewMerged, parsePreview, validationEngine, profile])

  function toggleKey(key, on) {
    setAcceptedKeys((prev) => {
      const next = new Set(prev)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const onJsonFile = useCallback(
    (ev) => {
      const f = ev.target.files?.[0]
      ev.target.value = ''
      if (!f) return
      const reader = new FileReader()
      reader.onload = () => {
        const t = typeof reader.result === 'string' ? reader.result : ''
        setJsonText(t)
        setPanelError('')
        void ingestJsonText(t.trim())
      }
      reader.onerror = () => setPanelError('Could not read that file.')
      reader.readAsText(f, 'UTF-8')
    },
    [ingestJsonText],
  )

  function applyMerge() {
    setPanelError('')
    if (!parsePreview?.ok) {
      setPanelError(parsePreview?.error || 'Nothing valid to merge.')
      return
    }
    let next = mergeScannerPartialIntoPilotState(pilotState, /** @type {Record<string, unknown>} */ (parsePreview.partial))
    const prov = parsePreview.provenance
    if (prov && typeof prov === 'object') {
      next = {
        ...next,
        sourceProvenance: {
          ...(next.sourceProvenance && typeof next.sourceProvenance === 'object' ? next.sourceProvenance : {}),
          ...prov,
        },
      }
    }
    onApply(profile.sanitize(next))
    onClose()
  }

  if (!open) return null

  return (
    <div className="scanner-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className="scanner-dialog card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scanner-dialog-title"
        aria-describedby="scanner-dialog-description"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="scanner-dialog__head">
          <h3 id="scanner-dialog-title">Apply scanner suggestions</h3>
          <button ref={closeButtonRef} type="button" className="button button-secondary button-tiny" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="form-text" id="scanner-dialog-description">
          Paste a <code>ScannerSuggestionEnvelope</code>, pick a JSON file (parsed automatically), or run the heuristic /
          host scan from the current mission title and abstract. Toggle rows before merging; validation below only lists
          issues on fields touched by the merge.
        </p>

        <div className="scanner-dialog__actions">
          <input
            type="file"
            accept=".json,application/json"
            className="visually-hidden"
            id="scanner-json-file"
            onChange={onJsonFile}
          />
          <label htmlFor="scanner-json-file" className="button button-secondary button-tiny" style={{ cursor: 'pointer' }}>
            JSON file…
          </label>
          <button type="button" className="button button-secondary button-tiny" disabled={busy} onClick={() => void runHeuristic()}>
            Run heuristic (browser)
          </button>
          <button
            type="button"
            className="button button-secondary button-tiny"
            disabled={busy || !canServerScan}
            title={
              canServerScan
                ? 'hostBridge.lensScan — POST /api/db; standalone adapter runs the same heuristic in-browser'
                : 'hostBridge.lensScan not implemented — use Run heuristic (browser)'
            }
            onClick={() => void runServerScan()}
          >
            Run server scan
          </button>
          <button
            type="button"
            className="button button-tiny"
            disabled={!jsonText.trim() || busy}
            onClick={() => void parseJsonToEnvelope()}
          >
            Parse JSON
          </button>
        </div>

        <textarea
          className="form-control xml-import-textarea"
          rows={5}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          spellCheck={false}
          placeholder='{ "suggestions": [ … ] }'
          aria-label="Scanner JSON"
        />

        {panelError ? (
          <p className="field-error" role="alert">
            {panelError}
          </p>
        ) : null}

        {envelope && flatRows.length > 0 ? (
          <div className="scanner-dialog__rows">
            <h4 className="h6">Suggestions</h4>
            <table className="table table-sm">
              <thead>
                <tr>
                  <th scope="col">Use</th>
                  <th scope="col">Field</th>
                  <th scope="col">Value</th>
                  <th scope="col">Conf.</th>
                  <th scope="col">Source / model</th>
                  <th scope="col">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {flatRows.map((row) => {
                  const s = row.suggestion
                  const conf = typeof s.confidence === 'number' ? s.confidence.toFixed(2) : '—'
                  const sm = [s.source, s.model].filter(Boolean).join(' · ') || '—'
                  const ev = typeof s.evidence === 'string' && s.evidence ? `${s.evidence.slice(0, 120)}${s.evidence.length > 120 ? '…' : ''}` : '—'
                  const lbl = s.label ? String(s.label) : ''
                  let valueStr = ''
                  if (row.valueSlice && typeof row.valueSlice === 'object') {
                    valueStr = JSON.stringify(row.valueSlice)
                  } else if (row.valueSlice != null) {
                    valueStr = String(row.valueSlice)
                  }
                  return (
                    <tr key={row.key}>
                      <td>
                        <input
                          type="checkbox"
                          checked={acceptedKeys.has(row.key)}
                          onChange={(e) => toggleKey(row.key, e.target.checked)}
                          aria-label={`Accept suggestion for ${s.fieldPath}: ${valueStr.slice(0, 80) || row.key}`}
                        />
                      </td>
                      <td>
                        <code>{s.fieldPath}</code>
                        {lbl ? <div className="form-text">{lbl}</div> : null}
                      </td>
                      <td>
                        <code className="scanner-dialog__mono">{valueStr.slice(0, 160)}{valueStr.length > 160 ? '…' : ''}</code>
                      </td>
                      <td>{conf}</td>
                      <td><small>{sm}</small></td>
                      <td><small title={typeof s.evidence === 'string' ? s.evidence : ''}>{ev}</small></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {envelope && parsePreview && !parsePreview.ok ? (
          <p className="field-error" role="status">
            {parsePreview.error}
          </p>
        ) : null}

        {parsePreview?.warnings?.length ? (
          <div className="alert alert-secondary py-2" role="status">
            <strong>Parser merge warnings</strong>
            <ul className="mb-0 small">
              {parsePreview.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {previewIssues.length > 0 ? (
          <div className="alert alert-warning py-2" role="status">
            <strong>Validation on merged scanner fields ({previewIssues.length})</strong>
            <ul className="mb-0 small">
              {previewIssues.map((it, i) => (
                <li key={i}>
                  <code>{it.field}</code> — {it.message}
                </li>
              ))}
            </ul>
          </div>
        ) : parsePreview?.ok ? (
          <p className="form-text">No validation issues on merged scanner roots for the current selection.</p>
        ) : null}

        <div className="scanner-dialog__foot">
          <button
            type="button"
            className="button button-tiny"
            disabled={!parsePreview?.ok || busy}
            onClick={applyMerge}
          >
            Merge into form
          </button>
        </div>
      </div>
    </div>
  )
}
