import { useState, useMemo, useCallback, useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { searchGcmdSchemeClient } from '../../lib/gcmdClient'
import { gcmdConceptUrlFromUuid } from '../../lib/gcmdKmsUrl.js'
import { runLensScanHeuristic } from '../../lib/lensScanHeuristic.js'
import { getPilotFieldLabelFallback } from '../../lib/pilotFieldLabelFallback.js'
import {
  mergeKeywordFacetArrays,
} from '../../adapters/sources/ScannerSuggestionAdapter.js'

const FACETS = [
  { key: 'sciencekeywords', label: 'Science keywords', scheme: 'sciencekeywords' },
  { key: 'datacenters', label: 'Data centers', scheme: 'datacenters' },
  { key: 'platforms', label: 'Platforms', scheme: 'platforms' },
  { key: 'instruments', label: 'Instruments', scheme: 'instruments' },
  { key: 'locations', label: 'Locations', scheme: 'locations' },
  { key: 'projects', label: 'Projects', scheme: 'projects' },
  { key: 'providers', label: 'Providers', scheme: 'providers' },
]

/** Minimum KMS match score to auto-apply a concept UUID (bulk + per-chip). */
const KMS_RESOLVE_MIN_SCORE = 0.72

/**
 * @param {{
 *   mission?: object,
 *   keywords: Record<string, Array<{ label: string, uuid: string }>>,
 *   onKeywordsChange: (next: object) => void,
 *   issues: Array<{ field: string, message: string, severity?: string }>,
 * }} props
 */
export default function StepKeywords({ mission = {}, keywords = {}, onKeywordsChange, issues }) {
  const [queries, setQueries] = useState({})
  const [loading, setLoading] = useState({})
  const [results, setResults] = useState({})
  const [errors, setErrors] = useState({})
  const [suggestBusy, setSuggestBusy] = useState(false)
  const [suggestStatus, setSuggestStatus] = useState('')
  const [suggestionRows, setSuggestionRows] = useState([])
  const [acceptedSuggestionKeys, setAcceptedSuggestionKeys] = useState(() => new Set())
  // Chips currently animating out (keyed by `${facet}:idx:${index}`).
  // While in this set the DOM node stays mounted with the `--leaving`
  // class so CSS can play the disintegration before React unmounts it.
  const [leaving, setLeaving] = useState(() => new Set())
  const [resolveBusy, setResolveBusy] = useState(false)
  const [resolveStatus, setResolveStatus] = useState('')
  const [perChipResolveBusy, setPerChipResolveBusy] = useState(() => ({}))

  useEffect(() => {
    const onAiDone = async (e) => {
      if (e.detail?.field === 'keywords' && e.detail?.result) {
        const raw = e.detail.result
        const labels = raw.split(',').map(s => s.trim()).filter(s => s.length > 2)
        setSuggestStatus(`AI suggested ${labels.length} keywords. Resolving against GCMD KMS...`)
        
        const resolved = []
        for (const label of labels) {
          try {
            const matches = await searchGcmdSchemeClient('sciencekeywords', label, { maxMatches: 1 })
            const top = matches[0]
            if (top) {
              const alreadyPresent = Array.isArray(keywords.sciencekeywords) && keywords.sciencekeywords.some(k => k.uuid === top.uuid)
              resolved.push({
                key: `sciencekeywords:${top.uuid}`,
                facetKey: 'sciencekeywords',
                label: top.prefLabel || label,
                uuid: top.uuid,
                alreadyPresent,
                confidence: 1.0,
                matchType: 'AI/LLM',
                seedWord: label,
                evidence: 'Genkit AI suggestion',
                source: 'Gemini 1.5 Flash'
              })
            }
          } catch (err) {
            console.warn('Failed to resolve AI keyword:', label, err)
          }
        }

        if (resolved.length === 0) {
          setSuggestStatus('AI suggested keywords but none could be confidently matched to GCMD KMS.')
        } else {
          setSuggestionRows(prev => {
            // Deduplicate against existing rows
            const existingKeys = new Set(prev.map(r => r.key))
            const filtered = resolved.filter(r => !existingKeys.has(r.key))
            return [...prev, ...filtered]
          })
          setAcceptedSuggestionKeys(prev => {
            const next = new Set(prev)
            resolved.forEach(r => { if (!r.alreadyPresent) next.add(r.key) })
            return next
          })
          setSuggestStatus(`Added ${resolved.length} AI-suggested GCMD keywords to the review table below.`)
        }
      }
    }
    window.addEventListener('manta:ai-suggest-finished', onAiDone)
    return () => window.removeEventListener('manta:ai-suggest-finished', onAiDone)
  }, [keywords])

  const keywordMetadataIssues = useMemo(
    () =>
      (Array.isArray(issues) ? issues : []).filter(
        (i) => i && typeof i.field === 'string' && /^keywords\.\w+\[\d+\]\.uuid$/.test(i.field),
      ),
    [issues],
  )

  const missingKeywordUuidCount = useMemo(() => {
    let n = 0
    for (const { key } of FACETS) {
      const list = Array.isArray(keywords[key]) ? keywords[key] : []
      for (const r of list) {
        if (String(r?.label || '').trim() && !String(r?.uuid || '').trim()) n += 1
      }
    }
    return n
  }, [keywords])

  const resolveMissingKeywordUuids = useCallback(async () => {
    setResolveBusy(true)
    setResolveStatus('')
    try {
      const next = { ...keywords }
      let updated = 0
      for (const { key, scheme } of FACETS) {
        const list = Array.isArray(next[key]) ? [...next[key]] : []
        for (let i = 0; i < list.length; i += 1) {
          const row = list[i]
          const label = String(row?.label || '').trim()
          const uuid = String(row?.uuid || '').trim()
          if (!label || uuid) continue
          const matches = await searchGcmdSchemeClient(scheme, label, { maxMatches: 10, maxPages: 2 })
          const top = matches[0]
          if (top && top.score >= KMS_RESOLVE_MIN_SCORE) {
            list[i] = { label: top.prefLabel || label, uuid: top.uuid }
            updated += 1
          }
        }
        next[key] = list
      }
      onKeywordsChange(next)
      setResolveStatus(
        updated
          ? `Resolved ${updated} label-only chip(s) with KMS top match (score ≥ ${KMS_RESOLVE_MIN_SCORE}).`
          : 'No confident KMS match for missing UUIDs — refine labels or use per-facet search.',
      )
    } catch (err) {
      setResolveStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setResolveBusy(false)
    }
  }, [keywords, onKeywordsChange])

  const resolveOneKeywordChip = useCallback(
    async (facetKey, scheme, chipIndex) => {
      const sk = `${facetKey}:${chipIndex}`
      setPerChipResolveBusy((b) => ({ ...b, [sk]: true }))
      setResolveStatus('')
      try {
        const list = Array.isArray(keywords[facetKey]) ? [...keywords[facetKey]] : []
        const row = list[chipIndex]
        if (!row) return
        const label = String(row.label || '').trim()
        const uuid = String(row.uuid || '').trim()
        if (!label || uuid) return
        const matches = await searchGcmdSchemeClient(scheme, label, { maxMatches: 10, maxPages: 2 })
        const top = matches[0]
        if (top && top.score >= KMS_RESOLVE_MIN_SCORE) {
          list[chipIndex] = { label: top.prefLabel || label, uuid: top.uuid }
          onKeywordsChange({ ...keywords, [facetKey]: list })
          setResolveStatus(
            `Resolved “${label.length > 44 ? `${label.slice(0, 44)}…` : label}” (${facetKey}).`,
          )
        } else {
          setResolveStatus(
            `No confident KMS match for “${label.length > 36 ? `${label.slice(0, 36)}…` : label}” — refine the label or use the facet search.`,
          )
        }
      } catch (e) {
        setResolveStatus(e instanceof Error ? e.message : String(e))
      } finally {
        setPerChipResolveBusy((b) => {
          const n = { ...b }
          delete n[sk]
          return n
        })
      }
    },
    [keywords, onKeywordsChange],
  )

  function facetIssue(facetKey) {
    return issues.find((i) => i.field === `keywords.${facetKey}`)
  }

  function facetLabel(facetKey) {
    return FACETS.find((f) => f.key === facetKey)?.label || facetKey
  }

  /**
   * @param {string} facetKey
   * @param {number} index
   * @returns {{ field: string, message: string, severity?: string } | null}
   */
  function issueForKeywordChip(facetKey, index) {
    const path = `keywords.${facetKey}[${index}].uuid`
    const list = Array.isArray(issues) ? issues : []
    return list.find((i) => i && i.field === path) || null
  }

  async function searchFacet(facetKey, scheme) {
    const q = String(queries[facetKey] || '').trim()
    setErrors((e) => ({ ...e, [facetKey]: '' }))
    if (!q) {
      setResults((r) => ({ ...r, [facetKey]: [] }))
      return
    }
    setLoading((l) => ({ ...l, [facetKey]: true }))
    try {
      const rows = await searchGcmdSchemeClient(scheme, q, { maxMatches: 15, maxPages: 3 })
      setResults((r) => ({ ...r, [facetKey]: rows }))
    } catch (err) {
      setErrors((e) => ({
        ...e,
        [facetKey]: err instanceof Error ? err.message : 'Search failed',
      }))
      setResults((r) => ({ ...r, [facetKey]: [] }))
    } finally {
      setLoading((l) => ({ ...l, [facetKey]: false }))
    }
  }

  function addKw(facetKey, row) {
    const list = Array.isArray(keywords[facetKey]) ? keywords[facetKey] : []
    if (list.some((k) => k.uuid === row.uuid)) return
    onKeywordsChange({
      ...keywords,
      [facetKey]: [...list, { label: row.prefLabel, uuid: row.uuid }],
    })
    setResults((r) => ({ ...r, [facetKey]: [] }))
  }

  /**
   * @param {string} facetKey
   * @param {number} chipIndex
   */
  function removeKw(facetKey, chipIndex) {
    const key = `${facetKey}:idx:${chipIndex}`
    if (leaving.has(key)) return
    setLeaving((prev) => {
      const next = new Set(prev)
      next.add(key)
      return next
    })
    window.setTimeout(() => {
      const list = Array.isArray(keywords[facetKey]) ? keywords[facetKey] : []
      onKeywordsChange({
        ...keywords,
        [facetKey]: list.filter((_, i) => i !== chipIndex),
      })
      setLeaving((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }, 260)
  }

  async function suggestFromTitleAbstract() {
    setSuggestBusy(true)
    setSuggestStatus('')
    setSuggestionRows([])
    setAcceptedSuggestionKeys(new Set())
    try {
      const env = await runLensScanHeuristic({
        title:     String(mission?.title || ''),
        abstract:  String(mission?.abstract || ''),
        fileId:    String(mission?.fileId || ''),
        profileId: 'mission',
        uxsContext: mission?.uxsContext,
      })
      const rows = []
      for (const suggestion of env.suggestions || []) {
        const fieldPath = String(suggestion?.fieldPath || '')
        if (!fieldPath.startsWith('keywords.')) continue
        const facetKey = fieldPath.slice('keywords.'.length)
        const values = Array.isArray(suggestion.value) ? suggestion.value : [suggestion.value]
        const lensPM = Array.isArray(suggestion.lensPerItem) ? suggestion.lensPerItem : null
        for (let vi = 0; vi < values.length; vi += 1) {
          const value = values[vi]
          if (!value || typeof value !== 'object' || Array.isArray(value)) continue
          const label = String(value.label || value.prefLabel || '').trim()
          const uuid = String(value.uuid || '').trim()
          if (!label || !uuid) continue
          const alreadyPresent = Array.isArray(keywords[facetKey]) && keywords[facetKey].some((k) => k.uuid === uuid)
          const li = lensPM && typeof lensPM[vi] === 'object' && lensPM[vi] ? lensPM[vi] : null
          const evidence =
            li && typeof li.evidence === 'string' && li.evidence
              ? li.evidence
              : String(suggestion.evidence || '')
          const conf =
            li && typeof li.confidence === 'number'
              ? li.confidence
              : typeof suggestion.confidence === 'number'
                ? suggestion.confidence
                : null
          const matchType =
            li && typeof li.matchType === 'string' && li.matchType.trim() ? li.matchType.trim() : null
          const seedWord =
            li && typeof li.seedWord === 'string' && li.seedWord.trim()
              ? li.seedWord.trim()
              : typeof suggestion.seedWord === 'string' && suggestion.seedWord.trim()
                ? suggestion.seedWord.trim()
                : ''
          rows.push({
            key: `${facetKey}:${uuid}`,
            facetKey,
            label,
            uuid,
            alreadyPresent,
            confidence: conf,
            matchType,
            seedWord,
            evidence,
            source:     [suggestion.source, suggestion.model].filter(Boolean).join(' · '),
          })
        }
      }
      /** Deduplicate by `${facetKey}:${uuid}`: merge evidence, max confidence, any alreadyPresent. */
      const dedupeOrder = []
      /** @type {Map<string, (typeof rows)[number]>} */
        const byFacetUuid = new Map()
        for (const r of rows) {
          const k = r.key
          if (!byFacetUuid.has(k)) {
            byFacetUuid.set(k, { ...r })
            dedupeOrder.push(k)
          } else {
            const prev = byFacetUuid.get(k)
            const parts = [prev.evidence, r.evidence].filter((x) => typeof x === 'string' && x.trim())
            const mergedEvidence = parts.length ? [...new Set(parts)].join('; ') : prev.evidence
            const nums = [prev.confidence, r.confidence].filter((c) => typeof c === 'number')
            const seedMerge = [prev.seedWord, r.seedWord].filter((x) => typeof x === 'string' && x.trim())
            byFacetUuid.set(k, {
              ...prev,
              evidence:       mergedEvidence,
              confidence:     nums.length ? Math.max(...nums) : prev.confidence,
              alreadyPresent: prev.alreadyPresent || r.alreadyPresent,
              matchType:      prev.matchType || r.matchType,
              seedWord:       seedMerge.length ? [...new Set(seedMerge)].join(' · ') : prev.seedWord,
            })
          }
        }
      const dedupedRows = dedupeOrder.map((k) => byFacetUuid.get(k))
      if (!dedupedRows.length) {
        setSuggestStatus('No keyword suggestions were found from the current text fields (title, abstract, UxS context, XML).')
        return
      }
      setSuggestionRows(dedupedRows)
      setAcceptedSuggestionKeys(new Set(dedupedRows.filter((row) => !row.alreadyPresent).map((row) => row.key)))
      const newCount = dedupedRows.filter((row) => !row.alreadyPresent).length
      setSuggestStatus(
        newCount
          ? `Review ${newCount} new GCMD suggestion${newCount === 1 ? '' : 's'} before adding.`
          : 'No new GCMD suggestions to add; existing keyword chips already cover the matches.',
      )
    } catch (err) {
      setSuggestStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setSuggestBusy(false)
    }
  }

  function toggleSuggestion(key, on) {
    setAcceptedSuggestionKeys((prev) => {
      const next = new Set(prev)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  }

  function clearSuggestions() {
    setSuggestionRows([])
    setAcceptedSuggestionKeys(new Set())
    setSuggestStatus('')
  }

  function applyReviewedSuggestions() {
    const selected = suggestionRows.filter((row) => acceptedSuggestionKeys.has(row.key) && !row.alreadyPresent)
    if (!selected.length) {
      setSuggestStatus('No selected new GCMD suggestions to add.')
      return
    }
    const next = { ...keywords }
    let added = 0
    FACETS.forEach(({ key }) => {
      const incoming = selected
        .filter((row) => row.facetKey === key)
        .map((row) => ({ label: row.label, uuid: row.uuid }))
      if (!incoming.length) return
      const before = Array.isArray(next[key]) ? next[key].length : 0
      next[key] = mergeKeywordFacetArrays(Array.isArray(next[key]) ? next[key] : [], incoming)
      added += Math.max(0, next[key].length - before)
    })
    if (added === 0) {
      setSuggestStatus('No new GCMD suggestions to add; existing keyword chips already cover the matches.')
      return
    }
    onKeywordsChange(next)
    setSuggestionRows([])
    setAcceptedSuggestionKeys(new Set())
    setSuggestStatus(`Added ${added} GCMD keyword suggestion${added === 1 ? '' : 's'} from the title / abstract.`)
  }

  return (
    <>
      <p className="card-intro">
        <strong>GCMD faceted keywords</strong> — search per facet, or use <strong>Suggest from title / abstract</strong>{' '}
        for heuristic matches. Chip counts appear in the validation panel.
      </p>

      {(keywordMetadataIssues.length > 0 || missingKeywordUuidCount > 0) ? (
        <div className="keyword-metadata-bw" role="status" aria-label="Keyword metadata quality">
          <strong className="keyword-metadata-bw__title">Keyword metadata</strong>
          <p className="keyword-metadata-bw__lede">
            These warnings do not block export; they help ensure GCMD <code>gmx:Anchor</code> links resolve in the XML
            preview.
          </p>
          {keywordMetadataIssues.length > 0 ? (
            <ul className="keyword-metadata-bw__list">
              {keywordMetadataIssues.map((i, idx) => {
                const label = getPilotFieldLabelFallback(i.field)
                return (
                  <li key={`${i.field}-${idx}`}>
                    <strong>{label}</strong>
                    {label !== i.field ? (
                      <span className="keyword-metadata-bw__path">
                        <code>{i.field}</code>
                      </span>
                    ) : null}
                    <span className="keyword-metadata-bw__msg"> — {i.message}</span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="hint" style={{ marginTop: '-0.25rem' }}>
              {missingKeywordUuidCount} keyword chip{missingKeywordUuidCount === 1 ? '' : 's'} ha{missingKeywordUuidCount === 1 ? 's' : 've'} a label but no KMS concept UUID — use the button below to search GCMD and fill matches.
            </p>
          )}
          <div className="keyword-metadata-bw__actions">
            <button
              type="button"
              className="button button-secondary"
              disabled={resolveBusy || missingKeywordUuidCount === 0}
              onClick={() => void resolveMissingKeywordUuids()}
            >
              {resolveBusy ? 'Resolving…' : 'Search & resolve missing UUIDs (KMS)'}
            </button>
            {resolveStatus ? (
              <p className="draft-meta" role="status" aria-live="polite">
                {resolveStatus}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="ai-suggest panel">
        <h3 className="panel-title">Suggest GCMD keywords from title / abstract</h3>
        <p className="hint">
          Runs the same deterministic Lens scanner as the scanner dialog: title, abstract, UxS operational context (when
          filled in), and XML-derived text → GCMD KMS matches. Review and remove chips as needed.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="button button-secondary"
            disabled={suggestBusy}
            onClick={() => void suggestFromTitleAbstract()}
          >
            {suggestBusy ? 'Scanning...' : 'Heuristic Scan'}
          </button>
          <button
            type="button"
            className="mfg-ai-btn"
            disabled={suggestBusy}
            onClick={() => {
              window.dispatchEvent(new CustomEvent('manta:ai-suggest-request', { 
                detail: { field: 'keywords', value: '' } 
              }))
            }}
          >
            <Sparkles size={12} />
            AI Generate Keywords
          </button>
        </div>
        {suggestStatus ? <p className="draft-meta" role="status" aria-live="polite">{suggestStatus}</p> : null}
        {suggestionRows.length ? (
          <div className="scanner-dialog__rows">
            <h4 className="h6">Review suggested keyword chips</h4>
            <table className="table table-sm">
              <thead>
                <tr>
                  <th scope="col">Use</th>
                  <th scope="col">Facet</th>
                  <th scope="col">Keyword</th>
                  <th scope="col">Conf.</th>
                  <th scope="col">Match</th>
                  <th scope="col">Seed</th>
                  <th scope="col">KMS</th>
                  <th scope="col">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {suggestionRows.map((row) => {
                  const kmsHref = gcmdConceptUrlFromUuid(row.uuid)
                  return (
                    <tr key={row.key}>
                      <td>
                        <input
                          type="checkbox"
                          checked={acceptedSuggestionKeys.has(row.key)}
                          disabled={row.alreadyPresent}
                          onChange={(e) => toggleSuggestion(row.key, e.target.checked)}
                          aria-label={`Accept ${facetLabel(row.facetKey)} suggestion ${row.label}`}
                        />
                      </td>
                      <td>{facetLabel(row.facetKey)}</td>
                      <td>
                        <code className="scanner-dialog__mono">{row.label}</code>
                        {row.alreadyPresent ? <div className="form-text">Already selected</div> : null}
                        <div className="form-text">{row.uuid}</div>
                      </td>
                      <td>{row.confidence == null ? '—' : row.confidence.toFixed(2)}</td>
                      <td>{row.matchType || '—'}</td>
                      <td>
                        <code className="scanner-dialog__mono" title={row.seedWord || undefined}>
                          {row.seedWord ? (row.seedWord.length > 24 ? `${row.seedWord.slice(0, 24)}…` : row.seedWord) : '—'}
                        </code>
                      </td>
                      <td>
                        {kmsHref ? (
                          <a
                            className="linkish"
                            href={kmsHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open GCMD KMS concept for ${row.label}`}
                          >
                            Open
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <small title={row.evidence || row.source || undefined}>
                          {row.evidence
                            ? `${row.evidence.slice(0, 160)}${row.evidence.length > 160 ? '…' : ''}`
                            : row.source || '—'}
                        </small>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="kw-search-row">
              <button type="button" className="button button-secondary" onClick={clearSuggestions}>
                Clear suggestions
              </button>
              <button type="button" className="button" onClick={applyReviewedSuggestions}>
                Add selected suggestions
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {FACETS.map(({ key, label, scheme }) => {
        const chips = Array.isArray(keywords[key]) ? keywords[key] : []
        const iss = facetIssue(key)
        return (
          <section key={key} className="panel keyword-facet" data-pilot-field={`keywords.${key}`}>
            <h3 className="panel-title">
              {label}{' '}
              <span className="count-badge">{chips.length}</span>
            </h3>
            {iss ? <p className="field-error">{iss.message}</p> : null}
            <div className="kw-search-row">
              <div className="kw-token-field">
                <div className="kw-token-field__inner chip-row">
                  {chips.map((c, chipIndex) => {
                    const leavingKey = `${key}:idx:${chipIndex}`
                    const isLeaving = leaving.has(leavingKey)
                    const chipUuidIssue = issueForKeywordChip(key, chipIndex)
                    const removeHint = `Remove ${c.label}`
                    const hasLabel = Boolean(String(c.label || '').trim())
                    const hasUuid = Boolean(String(c.uuid || '').trim())
                    const showKms = hasLabel && !hasUuid
                    const gcmdConceptHref = hasUuid ? gcmdConceptUrlFromUuid(c.uuid) : ''
                    const chipBusyKey = `${key}:${chipIndex}`
                    const chipBusy = Boolean(perChipResolveBusy[chipBusyKey])
                    return (
                      <span
                        key={leavingKey}
                        role="group"
                        className={`kw-chip-cluster${isLeaving ? ' kw-chip-cluster--leaving' : ''}${chipUuidIssue ? ' kw-chip-cluster--uuid-warn' : ''}`}
                        data-pilot-field={`keywords.${key}[${chipIndex}].uuid`}
                        aria-label={chipUuidIssue ? `${c.label} — ${chipUuidIssue.message}` : c.label}
                        title={chipUuidIssue ? chipUuidIssue.message : undefined}
                      >
                        <span className="kw-chip-cluster__label">{c.label}</span>
                        {showKms ? (
                          <button
                            type="button"
                            className="kw-chip-cluster__kms button button-secondary"
                            disabled={chipBusy || resolveBusy}
                            onClick={() => void resolveOneKeywordChip(key, scheme, chipIndex)}
                            aria-label={`Search KMS for UUID: ${c.label}`}
                          >
                            {chipBusy ? '…' : 'KMS'}
                          </button>
                        ) : null}
                        {gcmdConceptHref ? (
                          <a
                            className="kw-chip-cluster__open linkish"
                            href={gcmdConceptHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open GCMD KMS concept for ${c.label}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            GCMD
                          </a>
                        ) : null}
                        <button
                          type="button"
                          className="kw-chip-cluster__remove"
                          onClick={() => removeKw(key, chipIndex)}
                          disabled={isLeaving}
                          aria-label={chipUuidIssue ? `${c.label} — ${chipUuidIssue.message} — ${removeHint}` : removeHint}
                          title={removeHint}
                        >
                          <span className="kw-chip-cluster__x" aria-hidden>×</span>
                        </button>
                      </span>
                    )
                  })}
                  <input
                    className="kw-token-field__input"
                    placeholder={`Search ${label}…`}
                    aria-label={`Search ${label}`}
                    value={queries[key] || ''}
                    onChange={(e) => setQueries((q) => ({ ...q, [key]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        searchFacet(key, scheme)
                      }
                    }}
                  />
                </div>
              </div>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => searchFacet(key, scheme)}
                disabled={Boolean(loading[key])}
              >
                {loading[key] ? '…' : 'Search'}
              </button>
            </div>
            {errors[key] ? <p className="field-error">{errors[key]}</p> : null}
            <ul className="kw-results">
              {(results[key] || []).map((row) => (
                <li key={row.uuid}>
                  <button type="button" className="linkish" onClick={() => addKw(key, row)}>
                    + {row.prefLabel}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </>
  )
}
