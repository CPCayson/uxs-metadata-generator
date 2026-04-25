/**
 * Heuristic Lens Scan — title + abstract → GCMD suggestions as a
 * {@link import('../core/registry/types.js').ScannerSuggestionEnvelope} (no ML).
 * Mission profile: **science** plus optional **platform**, **instrument**, **location**, **provider**, **project**, and NOAA/NCEI **datacenter** GCMD facets when matches exist (parallel KMS queries; per-scheme failures degrade to empty matches).
 *
 * Used by the scanner UI (browser) and by Netlify `lensScan` (`db.mjs`).
 *
 * @module lib/lensScanHeuristic
 */

import { searchGcmdSchemeClient } from './gcmdClient.js'

const SCIENCE_FACET = 'sciencekeywords'
const NCEI_DATACENTER_KEYWORD = {
  label: 'DOC/NOAA/NESDIS/NCEI',
  uuid:  '2f31b1f2-335f-4248-8165-215755953857',
}
const STOPWORDS = new Set([
  'about',
  'along',
  'based',
  'data',
  'dataset',
  'during',
  'from',
  'have',
  'into',
  'mission',
  'ncei',
  'noaa',
  'oer',
  'results',
  'study',
  'survey',
  'team',
  'that',
  'their',
  'these',
  'this',
  'using',
  'uxs',
  'with',
])

/**
 * @param {string} s
 */
function stripXmlToText(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * @param {unknown} raw
 * @param {string} [cap]
 */
function stringifyUxsContextForSeeds(raw, cap = 900) {
  if (!raw || typeof raw !== 'object') return ''
  const o = /** @type {Record<string, unknown>} */ (raw)
  const parts = []
  for (const k of [
    'primaryLayer',
    'narrative',
    'operationOutcome',
    'deploymentName',
    'deploymentId',
    'runName',
    'runId',
    'sortieName',
    'sortieId',
    'diveName',
    'diveId',
  ]) {
    const v = o[k]
    if (typeof v === 'string' && v.trim()) parts.push(String(v).trim())
  }
  const joined = parts.join(' ').replace(/\s+/g, ' ').trim()
  if (!joined) return ''
  return joined.length > cap ? `${joined.slice(0, cap)}…` : joined
}

/**
 * @param {string} source
 * @param {Set<string>} baseStop
 */
function extractLikelyAcronyms(source, baseStop) {
  const s = String(source || '')
  const out = new Set()
  for (const m of s.matchAll(/\b([A-Z]{2,8})\b/g)) {
    const t = m[1]
    if (baseStop.has(t.toLowerCase())) continue
    out.add(t)
  }
  return [...out]
}

/**
 * @param {string} title
 * @param {string} abstract
 * @param {string} xmlSnippet
 * @param {string} uxsText
 */
function buildSeedTerms(title, abstract, xmlSnippet, uxsText) {
  const uxs = String(uxsText || '').trim()
  const source = [
    title,
    abstract,
    stripXmlToText(xmlSnippet).slice(0, 1200),
    uxs ? uxs.slice(0, 1200) : '',
  ]
    .filter(Boolean)
    .join(' ')
  const tokens = [...new Set(
    source
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, ' ')
      .split(/\s+/)
      .map((w) => w.replace(/^-+|-+$/g, ''))
      .filter((w) => w.length > 3 && !STOPWORDS.has(w)),
  )]
  const bigrams = []
  for (let i = 0; i < tokens.length - 1 && bigrams.length < 6; i += 1) {
    bigrams.push(`${tokens[i]} ${tokens[i + 1]}`)
  }
  const acr = extractLikelyAcronyms(source, STOPWORDS)
  return [...new Set([...bigrams, ...tokens, ...acr.map((a) => a.toLowerCase())])].slice(0, 14)
}

/**
 * @param {string} seed
 */
function inferDatacenterRows(seed) {
  const text = String(seed || '').toLowerCase()
  const looksNcei =
    text.includes('ncei') ||
    text.includes('national centers for environmental information') ||
    (text.includes('noaa') && text.includes('nesdis'))
  if (!looksNcei) return []
  return [{
    ...NCEI_DATACENTER_KEYWORD,
    confidence: 0.7,
    seedWord:   'ncei',
    matchType:  'curated',
    score:      0.88,
  }]
}

/**
 * @param {{ seedWord: string, label: string, uuid: string, matchType?: string, score?: number }} row
 * @param {string} scheme
 */
function suggestionEvidence(row, scheme) {
  const parts = [
    `seed="${row.seedWord}"`,
    `match="${row.label}"`,
    `scheme="${scheme}"`,
    `uuid="${row.uuid}"`,
  ]
  if (row.matchType) parts.push(`matchType="${row.matchType}"`)
  if (typeof row.score === 'number') parts.push(`score="${row.score.toFixed(2)}"`)
  return parts.join(' | ')
}

/**
 * @param {string[]} words  lowercased tokens (already filtered)
 * @param {string} scheme   GCMD concept_scheme id (e.g. sciencekeywords, platforms, locations, providers)
 * @param {number} maxMatches per word KMS query
 * @returns {Promise<Array<{ label: string, uuid: string, confidence: number, seedWord: string, matchType?: string, score?: number }>>}
 */
async function collectGcmdRowsFromWords(words, scheme, maxMatches) {
  const collected = []
  for (const w of words) {
    const rows = await searchGcmdSchemeClient(scheme, w, { maxMatches })
    for (const r of rows) {
      const label = String(r.prefLabel || r.label || '').trim()
      const uuid = String(r.uuid || '').trim()
      if (!label || !uuid) continue
      const score = typeof r.score === 'number' ? r.score : 0.5
      collected.push({
        label,
        uuid,
        confidence: Math.min(0.84, 0.42 + score * 0.36 + Math.min(w.length, 18) * 0.005),
        seedWord: w,
        matchType: r.matchType,
        score,
      })
    }
  }
  const byUuid = new Map()
  for (const row of collected) {
    const u = row.uuid
    const prev = byUuid.get(u)
    if (!prev || row.confidence > prev.confidence) byUuid.set(u, row)
  }
  return [...byUuid.values()]
}

/**
 * Same as {@link collectGcmdRowsFromWords} but returns **`[]`** if KMS or network fails,
 * so one bad scheme does not cancel the whole mission scan.
 *
 * @param {string[]} words
 * @param {string} scheme
 * @param {number} maxMatches
 */
async function collectGcmdRowsFromWordsSafe(words, scheme, maxMatches) {
  try {
    return await collectGcmdRowsFromWords(words, scheme, maxMatches)
  } catch {
    return []
  }
}

/**
 * @param {{
 *   title?: string,
 *   abstract?: string,
 *   xmlSnippet?: string,
 *   profileId?: string,
 *   uxsContext?: unknown,
 * }} input
 * @returns {Promise<import('../core/registry/types.js').ScannerSuggestionEnvelope>}
 */
export async function runLensScanHeuristic(input) {
  const profileIdRaw = String(input?.profileId || 'mission').trim()
  const profileId =
    profileIdRaw === 'bediCollection' || profileIdRaw === 'bediGranule' ? profileIdRaw : 'mission'

  const title = String(input?.title || '').trim()
  const abstract = String(input?.abstract || '').trim()
  const xmlSnippet = String(input?.xmlSnippet || '').trim()
  const uxsText = stringifyUxsContextForSeeds(input?.uxsContext, 1000)
  const seed = [
    title,
    abstract,
    stripXmlToText(xmlSnippet).slice(0, 1200),
    uxsText ? uxsText.slice(0, 1200) : '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim()
  if (!seed) {
    throw new Error('Lens scan needs a non-empty title, abstract, UxS operational context, or XML snippet.')
  }

  const wordList = buildSeedTerms(title, abstract, xmlSnippet, uxsText)

  let uniq
  let platformUniq
  let instrumentUniq
  let locationUniq
  let datacenterUniq
  let providerUniq
  let projectUniq
  if (profileId === 'mission') {
    const MISSION_FACET_GCMD = {
      maxMatches: {
        [SCIENCE_FACET]: 5,
        platforms:      4,
        instruments:    4,
        locations:        4,
        providers:        3,
        projects:         3,
      },
      wordSlice: {
        platforms:   4,
        instruments: 3,
        locations:   3,
        providers:   2,
        projects:    2,
      },
    }
    const { maxMatches, wordSlice } = MISSION_FACET_GCMD
    ;[uniq, platformUniq, instrumentUniq, locationUniq, providerUniq, projectUniq] = await Promise.all([
      collectGcmdRowsFromWordsSafe(wordList, SCIENCE_FACET, maxMatches[SCIENCE_FACET]),
      collectGcmdRowsFromWordsSafe(wordList.slice(0, wordSlice.platforms), 'platforms', maxMatches.platforms),
      collectGcmdRowsFromWordsSafe(wordList.slice(0, wordSlice.instruments), 'instruments', maxMatches.instruments),
      collectGcmdRowsFromWordsSafe(wordList.slice(0, wordSlice.locations), 'locations', maxMatches.locations),
      collectGcmdRowsFromWordsSafe(wordList.slice(0, wordSlice.providers), 'providers', maxMatches.providers),
      collectGcmdRowsFromWordsSafe(wordList.slice(0, wordSlice.projects), 'projects', maxMatches.projects),
    ])
    datacenterUniq = inferDatacenterRows(seed)
  } else {
    uniq = await collectGcmdRowsFromWordsSafe(wordList, SCIENCE_FACET, 5)
    platformUniq = []
    instrumentUniq = []
    locationUniq = []
    datacenterUniq = []
    providerUniq = []
    projectUniq = []
  }

  if (
    !uniq.length &&
    !platformUniq.length &&
    !instrumentUniq.length &&
    !locationUniq.length &&
    !datacenterUniq.length &&
    !providerUniq.length &&
    !projectUniq.length
  ) {
    return {
      runId:       `lens-${Date.now()}`,
      profileId,
      suggestions: [],
    }
  }

  if (profileId === 'mission') {
    /** @type {import('../core/registry/types.js').ScannerSuggestionEnvelope['suggestions']} */
    const suggestions = []
    if (uniq.length) {
      const perItem = uniq.map((row) => ({
        fieldPath: `keywords.${SCIENCE_FACET}`,
        value:     { label: row.label, uuid: row.uuid },
        confidence: row.confidence,
        label:      `GCMD keyword (seed “${row.seedWord}”)`,
        source:     'gcmd-kms',
        model:      'lens-scan-heuristic/v2',
        evidence:   suggestionEvidence(row, SCIENCE_FACET),
      }))
      const lensPerItem = uniq.map((row) => ({
        seedWord:   String(row.seedWord || ''),
        matchType:  row.matchType,
        score:      row.score,
        confidence: row.confidence,
        evidence:   suggestionEvidence(row, SCIENCE_FACET),
      }))
      suggestions.push({
        fieldPath: `keywords.${SCIENCE_FACET}`,
        value:     perItem.map((s) => s.value),
        lensPerItem,
        confidence: 0.58,
        label:     'GCMD science keywords (heuristic merge)',
        source:    'gcmd-kms',
        model:     'lens-scan-heuristic/v2',
        evidence:  `sourceText="${seed.slice(0, 220)}"`,
      })
    }
    const optionalFacets = [
      {
        rows:       platformUniq,
        field:      'platforms',
        seedLabel:  'platform',
        mergeLabel: 'GCMD platform keywords (heuristic merge)',
        rowCap:     0.72,
        mergeConf:  0.52,
      },
      {
        rows:       instrumentUniq,
        field:      'instruments',
        seedLabel:  'instrument',
        mergeLabel: 'GCMD instrument keywords (heuristic merge)',
        rowCap:     0.7,
        mergeConf:  0.5,
      },
      {
        rows:       locationUniq,
        field:      'locations',
        seedLabel:  'location',
        mergeLabel: 'GCMD location keywords (heuristic merge)',
        rowCap:     0.68,
        mergeConf:  0.48,
      },
      {
        rows:       datacenterUniq,
        field:      'datacenters',
        seedLabel:  'datacenter',
        mergeLabel: 'GCMD data center keywords (heuristic merge)',
        rowCap:     0.7,
        mergeConf:  0.5,
      },
      {
        rows:       providerUniq,
        field:      'providers',
        seedLabel:  'provider',
        mergeLabel: 'GCMD provider keywords (heuristic merge)',
        rowCap:     0.64,
        mergeConf:  0.46,
      },
      {
        rows:       projectUniq,
        field:      'projects',
        seedLabel:  'project',
        mergeLabel: 'GCMD project keywords (heuristic merge)',
        rowCap:     0.64,
        mergeConf:  0.45,
      },
    ]
    for (const spec of optionalFacets) {
      if (!spec.rows.length) continue
      const per = spec.rows.map((row) => ({
        fieldPath: `keywords.${spec.field}`,
        value:     { label: row.label, uuid: row.uuid },
        confidence: Math.min(spec.rowCap, row.confidence),
        label:      `GCMD ${spec.seedLabel} (seed “${row.seedWord}”)`,
        source:     'gcmd-kms',
        model:      'lens-scan-heuristic/v2',
        evidence:   suggestionEvidence(row, spec.field),
      }))
      const lensPerItem = spec.rows.map((row) => ({
        seedWord:   String(row.seedWord || ''),
        matchType:  row.matchType,
        score:      row.score,
        confidence: row.confidence,
        evidence:   suggestionEvidence(row, spec.field),
      }))
      suggestions.push({
        fieldPath: `keywords.${spec.field}`,
        value:     per.map((s) => s.value),
        lensPerItem,
        confidence: spec.mergeConf,
        label:     spec.mergeLabel,
        source:    'gcmd-kms',
        model:     'lens-scan-heuristic/v2',
        evidence:  `sourceText="${seed.slice(0, 220)}"`,
      })
    }
    return {
      runId:       `lens-${Date.now()}`,
      profileId:   'mission',
      suggestions,
    }
  }

  // BEDI: flat pilot state paths for {@link parseScannerSuggestionsToBediPartial}.
  const fieldPath = profileId === 'bediCollection' ? 'scienceKeywords' : 'oerKeywords'
  return {
    runId:      `lens-${Date.now()}`,
    profileId,
    suggestions: [
      {
        fieldPath,
        value: uniq.map((row) => ({ label: row.label, uuid: row.uuid })),
        lensPerItem: uniq.map((row) => ({
          seedWord:   String(row.seedWord || ''),
          matchType:  row.matchType,
          score:      row.score,
          confidence: row.confidence,
          evidence:   suggestionEvidence(row, SCIENCE_FACET),
        })),
        confidence: 0.58,
        label:
          profileId === 'bediCollection'
            ? 'GCMD science keywords → collection scienceKeywords (+ KMS hrefs on merge)'
            : 'GCMD science keywords → granule oerKeywords (labels)',
        source:   'gcmd-kms',
        model:    'lens-scan-heuristic/v2',
        evidence: seed.slice(0, 240),
      },
    ],
  }
}
