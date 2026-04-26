import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  isScannerSuggestionEnvelope,
  mergeScannerPartialIntoPilotState,
  parseScannerSuggestionsToMissionPartial,
} from '../adapters/sources/ScannerSuggestionAdapter.js'
import { gcmdConceptUrlFromUuid } from '../lib/gcmdKmsUrl.js'
import { runLensScanHeuristic } from '../lib/lensScanHeuristic.js'

/** @type {Record<string, string>} */
const KEYWORD_FACET_LABELS = {
  sciencekeywords: 'Science keywords',
  datacenters:     'Data centers',
  platforms:       'Platforms',
  instruments:     'Instruments',
  locations:       'Locations',
  projects:        'Projects',
  providers:       'Providers',
}

/**
 * @param {string} fieldPath
 */
function keywordFacetLabel(fieldPath) {
  const fp = String(fieldPath || '')
  if (!fp.startsWith('keywords.')) return fp
  const k = fp.slice('keywords.'.length)
  return KEYWORD_FACET_LABELS[k] || k
}

/**
 * @param {import('../core/registry/types.js').ScannerSuggestionEnvelope} env
 * @returns {Array<{
 *   key: string,
 *   parentIndex: number,
 *   sliceIndex: number | null,
 *   suggestion: import('../core/registry/types.js').ScannerSuggestionItem,
 *   valueSlice: unknown,
 *   lensItemMeta: { seedWord?: string, evidence?: string, confidence?: number, matchType?: string, score?: number } | null,
 * }>}
 */
function flattenSuggestionsForUi(env) {
  const rows = []
  if (!env?.suggestions?.length) return rows
  env.suggestions.forEach((s, si) => {
    const fp = String(s.fieldPath || '')
    const val = s.value
    const lens = Array.isArray(s.lensPerItem) ? s.lensPerItem : null
    const isKeywordFacetArray =
      fp.startsWith('keywords.') &&
      Array.isArray(val) &&
      val.length > 0 &&
      val.every((v) => v && typeof v === 'object' && !Array.isArray(v))
    if (isKeywordFacetArray) {
      val.forEach((item, vi) => {
        const lm = lens?.[vi]
        rows.push({
          key:         `${si}:${vi}`,
          parentIndex: si,
          sliceIndex:  vi,
          suggestion:  s,
          valueSlice:  item,
          lensItemMeta:
            lm && typeof lm === 'object' && !Array.isArray(lm)
              ? {
                  seedWord:   typeof lm.seedWord === 'string' ? lm.seedWord : undefined,
                  evidence:   typeof lm.evidence === 'string' ? lm.evidence : undefined,
                  confidence: typeof lm.confidence === 'number' ? lm.confidence : undefined,
                  matchType:  typeof lm.matchType === 'string' ? lm.matchType : undefined,
                  score:      typeof lm.score === 'number' ? lm.score : undefined,
                }
              : null,
        })
      })
    } else {
      rows.push({
        key:         `${si}:all`,
        parentIndex: si,
        sliceIndex:  null,
        suggestion:  s,
        valueSlice:  val,
        lensItemMeta: null,
      })
    }
  })
  return rows
}

/**
 * One evidence line per row (lens per-item else parent), matching the suggestion table.
 * @param {ReturnType<typeof flattenSuggestionsForUi>[number]} row
 */
function singleEvidenceForFlatRow(row) {
  const s = row.suggestion
  if (row.lensItemMeta && typeof row.lensItemMeta.evidence === 'string' && row.lensItemMeta.evidence) {
    return row.lensItemMeta.evidence.trim()
  }
  if (typeof s.evidence === 'string' && s.evidence) return s.evidence.trim()
  return ''
}

/**
 * @param {ReturnType<typeof flattenSuggestionsForUi>[number]} row
 */
function confidenceForFlatRow(row) {
  if (row.lensItemMeta && typeof row.lensItemMeta.confidence === 'number') {
    return row.lensItemMeta.confidence
  }
  const c = row.suggestion.confidence
  return typeof c === 'number' ? c : null
}

/**
 * Collapse keyword-facet slice rows with the same `fieldPath` + GCMD `uuid` (e.g. merge parents or duplicates).
 * Merged rows use key `dedupe-${fieldPath}-${uuid}` and `mergedFrom` for filter/apply. Non-keyword rows unchanged.
 * @param {ReturnType<typeof flattenSuggestionsForUi>} rows
 */
function dedupeKeywordFacetFlatRows(rows) {
  const out = []
  /** @type {Map<string, { merged: object, outIndex: number }>} */
  const byKey = new Map()
  for (const row of rows) {
    const s = row.suggestion
    const fp = String(s.fieldPath || '')
    const vs = row.valueSlice
    if (
      !fp.startsWith('keywords.') ||
      row.sliceIndex == null ||
      !vs ||
      typeof vs !== 'object' ||
      Array.isArray(vs)
    ) {
      out.push(row)
      continue
    }
    const uuid = String(/** @type {{ uuid?: unknown }} */ (vs).uuid || '').trim()
    if (!uuid) {
      out.push(row)
      continue
    }
    const dk = `dedupe-${fp}-${uuid}`
    const existing = byKey.get(dk)
    if (!existing) {
      const merged = {
        ...row,
        key:        dk,
        mergedFrom: [row],
      }
      byKey.set(dk, { merged, outIndex: out.length })
      out.push(merged)
      continue
    }
    const { merged: cur, outIndex } = existing
    const mergedFrom = [...(Array.isArray(cur.mergedFrom) ? cur.mergedFrom : []), row]
    const evParts = mergedFrom.map((r) => singleEvidenceForFlatRow(r)).filter(Boolean)
    const mergedEvidence = [...new Set(evParts)].join('; ')
    const confs = mergedFrom
      .map((r) => confidenceForFlatRow(r))
      .filter((c) => typeof c === 'number')
    const maxC = confs.length ? Math.max(...confs) : undefined
    const li = {
      ...(cur.lensItemMeta && typeof cur.lensItemMeta === 'object' ? cur.lensItemMeta : {}),
      evidence: mergedEvidence,
    }
    if (typeof maxC === 'number') {
      li.confidence = maxC
    }
    for (const r of mergedFrom) {
      const sw = r.lensItemMeta && typeof r.lensItemMeta.seedWord === 'string' ? r.lensItemMeta.seedWord : ''
      if (sw) {
        li.seedWord = sw
        break
      }
    }
    if (!li.matchType) {
      for (const r of mergedFrom) {
        const mt =
          r.lensItemMeta && typeof r.lensItemMeta.matchType === 'string' ? r.lensItemMeta.matchType.trim() : ''
        if (mt) {
          li.matchType = mt
          break
        }
      }
    }
    const next = {
      ...cur,
      key:          dk,
      lensItemMeta: li,
      mergedFrom,
    }
    byKey.set(dk, { merged: next, outIndex })
    out[outIndex] = next
  }
  return out
}

/**
 * @param {import('../core/registry/types.js').ScannerSuggestionEnvelope} env
 * @param {ReturnType<typeof flattenSuggestionsForUi>} flatRows
 * @param {Set<string>} accepted
 */
function filterEnvelopeByAccepted(env, flatRows, accepted) {
  /** @type {Map<number, unknown[]>} */
  const grouped = new Map()
  /** @type {Map<number, unknown[]>} */
  const groupedLens = new Map()
  for (const row of flatRows) {
    if (!accepted.has(row.key)) continue
    const contributions = Array.isArray(row.mergedFrom) && row.mergedFrom.length ? row.mergedFrom : [row]
    for (const c of contributions) {
      if (c.sliceIndex != null) {
        if (!grouped.has(c.parentIndex)) grouped.set(c.parentIndex, [])
        grouped.get(c.parentIndex)?.push(c.valueSlice)
        const origS = env.suggestions[c.parentIndex]
        if (origS && Array.isArray(origS.lensPerItem)) {
          if (!groupedLens.has(c.parentIndex)) groupedLens.set(c.parentIndex, [])
          groupedLens.get(c.parentIndex)?.push(c.lensItemMeta ?? null)
        }
      }
    }
  }
  const atomic = new Set()
  for (const row of flatRows) {
    if (!accepted.has(row.key)) continue
    const contributions = Array.isArray(row.mergedFrom) && row.mergedFrom.length ? row.mergedFrom : [row]
    for (const c of contributions) {
      if (c.sliceIndex == null) atomic.add(c.parentIndex)
    }
  }
  const out = []
  for (let pi = 0; pi < env.suggestions.length; pi++) {
    if (grouped.has(pi)) {
      const orig = env.suggestions[pi]
      const next = { ...orig, value: grouped.get(pi) }
      if (groupedLens.has(pi)) {
        const gl = groupedLens.get(pi) || []
        if (Array.isArray(gl) && gl.length) {
          next.lensPerItem = gl
        } else {
          delete next.lensPerItem
        }
      } else {
        delete next.lensPerItem
      }
      out.push(next)
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
 *   initialCapture?: { kind?: string, text?: string, title?: string, url?: string, contentType?: string, capturedAt?: string } | null,
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
  initialCapture = null,
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
  const lastCaptureKeyRef = useRef('')

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

  const flatRows = useMemo(
    () => (envelope ? dedupeKeywordFacetFlatRows(flattenSuggestionsForUi(envelope)) : []),
    [envelope],
  )

  useEffect(() => {
    if (!envelope) return
    const rows = dedupeKeywordFacetFlatRows(flattenSuggestionsForUi(envelope))
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

  const ingestCapturedText = useCallback(
    async (capture) => {
      const text = String(capture?.text || '').trim()
      if (!text) return
      const key = `${capture?.capturedAt || ''}:${capture?.kind || ''}:${text.length}`
      if (lastCaptureKeyRef.current === key) return
      lastCaptureKeyRef.current = key
      setPanelError('')
      setBusy(true)
      try {
        if (/^\s*\{[\s\S]*"suggestions"\s*:/.test(text)) {
          setJsonText(text)
          await ingestJsonText(text)
          return
        }
        const xmlish = /<\?xml|<gmd:|<gmi:|<MD_Metadata|<MI_Metadata/i.test(text)
        const env = await runLensScanHeuristic({
          title:      String(capture?.title || pilotState?.mission?.title || pilotState?.title || ''),
          abstract:   xmlish ? String(pilotState?.mission?.abstract || pilotState?.abstract || '') : text.slice(0, 20000),
          xmlSnippet: xmlish ? text.slice(0, 200000) : '',
          profileId:  scannerProfileId,
          uxsContext: pilotState?.mission?.uxsContext,
        })
        setJsonText(JSON.stringify(env, null, 2))
        await ingestEnvelopeFromObject(env, `extension-${capture?.kind || 'capture'}`)
      } catch (e) {
        setPanelError(e instanceof Error ? e.message : String(e))
        setEnvelope(null)
      } finally {
        setBusy(false)
      }
    },
    [ingestEnvelopeFromObject, ingestJsonText, pilotState, scannerProfileId],
  )

  useEffect(() => {
    if (!open || !initialCapture?.text) return
    void ingestCapturedText(initialCapture)
  }, [open, initialCapture, ingestCapturedText])

  const runHeuristic = useCallback(async () => {
    setBusy(true)
    setPanelError('')
    try {
      const env = await runLensScanHeuristic({
        title:     String(pilotState?.mission?.title || pilotState?.title || ''),
        abstract:  String(pilotState?.mission?.abstract || pilotState?.abstract || ''),
        profileId: scannerProfileId,
        uxsContext: pilotState?.mission?.uxsContext,
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
        uxsContext: pilotState?.mission?.uxsContext,
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
    const r = validationEngine.run({ profile, state: previewMerged, mode })
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
          host scan from the current mission title, abstract, UxS operational context, and XML snippet. Toggle rows
          before merging; validation below only lists issues on fields touched by the merge.
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
                  <th scope="col">Facet</th>
                  <th scope="col">Field</th>
                  <th scope="col">Keyword / value</th>
                  <th scope="col">Conf.</th>
                  <th scope="col">Match</th>
                  <th scope="col">KMS</th>
                  <th scope="col">Source / model</th>
                  <th scope="col">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {flatRows.map((row) => {
                  const s = row.suggestion
                  const fp = String(s.fieldPath || '')
                  const perConf =
                    row.lensItemMeta && typeof row.lensItemMeta.confidence === 'number'
                      ? row.lensItemMeta.confidence
                      : s.confidence
                  const conf = typeof perConf === 'number' ? perConf.toFixed(2) : '—'
                  const sm = [s.source, s.model].filter(Boolean).join(' · ') || '—'
                  const evRaw =
                    row.lensItemMeta && typeof row.lensItemMeta.evidence === 'string' && row.lensItemMeta.evidence
                      ? row.lensItemMeta.evidence
                      : typeof s.evidence === 'string'
                        ? s.evidence
                        : ''
                  const ev = evRaw ? `${evRaw.slice(0, 160)}${evRaw.length > 160 ? '…' : ''}` : '—'
                  const lbl = s.label ? String(s.label) : ''
                  let valueStr = ''
                  let keywordLabel = ''
                  let keywordUuid = ''
                  if (row.valueSlice && typeof row.valueSlice === 'object' && !Array.isArray(row.valueSlice)) {
                    const vs = /** @type {{ label?: unknown, prefLabel?: unknown, uuid?: unknown }} */ (row.valueSlice)
                    keywordLabel = String(vs.label || vs.prefLabel || '').trim()
                    keywordUuid = String(vs.uuid || '').trim()
                    valueStr = JSON.stringify(row.valueSlice)
                  } else if (row.valueSlice != null) {
                    valueStr = String(row.valueSlice)
                  }
                  const isKeywordFacet = fp.startsWith('keywords.')
                  const kmsHref = isKeywordFacet ? gcmdConceptUrlFromUuid(keywordUuid) : ''
                  const matchDisplay = isKeywordFacet
                    ? (row.lensItemMeta && typeof row.lensItemMeta.matchType === 'string'
                        ? row.lensItemMeta.matchType.trim() || '—'
                        : '—')
                    : '—'
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
                        {fp.startsWith('keywords.') ? <span>{keywordFacetLabel(fp)}</span> : <span className="form-text">—</span>}
                      </td>
                      <td>
                        <code>{s.fieldPath}</code>
                        {lbl ? <div className="form-text">{lbl}</div> : null}
                      </td>
                      <td>
                        {keywordLabel || keywordUuid ? (
                          <>
                            <code className="scanner-dialog__mono">{keywordLabel || '—'}</code>
                            {keywordUuid ? <div className="form-text">{keywordUuid}</div> : null}
                          </>
                        ) : (
                          <code className="scanner-dialog__mono">{valueStr.slice(0, 160)}{valueStr.length > 160 ? '…' : ''}</code>
                        )}
                      </td>
                      <td>{conf}</td>
                      <td>{matchDisplay}</td>
                      <td>
                        {kmsHref ? (
                          <a
                            className="linkish"
                            href={kmsHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open GCMD KMS concept for ${keywordLabel || keywordUuid}`}
                          >
                            Open
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td><small>{sm}</small></td>
                      <td>
                        <small title={evRaw}>{ev}</small>
                        {row.lensItemMeta?.seedWord ? (
                          <div className="form-text">seed: {row.lensItemMeta.seedWord}</div>
                        ) : null}
                      </td>
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
