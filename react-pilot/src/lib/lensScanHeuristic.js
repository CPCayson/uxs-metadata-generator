/**
 * Heuristic Lens Scan — title + abstract → GCMD suggestions as a
 * {@link import('../core/registry/types.js').ScannerSuggestionEnvelope} (no ML).
 * Mission profile: **science** plus optional **platform**, **instrument**, **location**, **provider**, and **project** GCMD facets when KMS matches exist (parallel KMS queries; per-scheme failures degrade to empty matches). (`datacenters` has no matching KMS `concept_scheme` at the current GCMD base URL.)
 *
 * Used by the scanner UI (browser) and by Netlify `lensScan` (`db.mjs`).
 *
 * @module lib/lensScanHeuristic
 */

import { searchGcmdSchemeClient } from './gcmdClient.js'

const SCIENCE_FACET = 'sciencekeywords'
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
  'results',
  'study',
  'survey',
  'team',
  'that',
  'their',
  'these',
  'this',
  'using',
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
 * @param {string} title
 * @param {string} abstract
 * @param {string} xmlSnippet
 */
function buildSeedTerms(title, abstract, xmlSnippet) {
  const source = [title, abstract, stripXmlToText(xmlSnippet).slice(0, 1200)].filter(Boolean).join(' ')
  const tokens = [...new Set(
    source
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, ' ')
      .split(/\s+/)
      .map((w) => w.replace(/^-+|-+$/g, ''))
      .filter((w) => w.length > 4 && !STOPWORDS.has(w)),
  )]
  const bigrams = []
  for (let i = 0; i < tokens.length - 1 && bigrams.length < 4; i += 1) {
    bigrams.push(`${tokens[i]} ${tokens[i + 1]}`)
  }
  return [...new Set([...bigrams, ...tokens])].slice(0, 8)
}

/**
 * @param {string[]} words  lowercased tokens (already filtered)
 * @param {string} scheme   GCMD concept_scheme id (e.g. sciencekeywords, platforms, locations, providers)
 * @param {number} maxMatches per word KMS query
 * @returns {Promise<Array<{ label: string, uuid: string, confidence: number, seedWord: string }>>}
 */
async function collectGcmdRowsFromWords(words, scheme, maxMatches) {
  const collected = []
  for (const w of words) {
    const rows = await searchGcmdSchemeClient(scheme, w, { maxMatches })
    for (const r of rows) {
      const label = String(r.prefLabel || r.label || '').trim()
      const uuid = String(r.uuid || '').trim()
      if (!label || !uuid) continue
      collected.push({
        label,
        uuid,
        confidence: Math.min(0.78, 0.42 + Math.min(w.length, 12) * 0.03),
        seedWord: w,
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
  const seed = [title, abstract, stripXmlToText(xmlSnippet).slice(0, 1200)].filter(Boolean).join(' ').trim()
  if (!seed) {
    throw new Error('Lens scan needs a non-empty title, abstract, or XML snippet.')
  }

  const wordList = buildSeedTerms(title, abstract, xmlSnippet)

  let uniq
  let platformUniq
  let instrumentUniq
  let locationUniq
  let providerUniq
  let projectUniq
  if (profileId === 'mission') {
    ;[uniq, platformUniq, instrumentUniq, locationUniq, providerUniq, projectUniq] = await Promise.all([
      collectGcmdRowsFromWordsSafe(wordList, SCIENCE_FACET, 5),
      collectGcmdRowsFromWordsSafe(wordList.slice(0, 4), 'platforms', 4),
      collectGcmdRowsFromWordsSafe(wordList.slice(0, 3), 'instruments', 4),
      collectGcmdRowsFromWordsSafe(wordList.slice(0, 3), 'locations', 4),
      collectGcmdRowsFromWordsSafe(wordList.slice(0, 2), 'providers', 4),
      collectGcmdRowsFromWordsSafe(wordList.slice(0, 2), 'projects', 4),
    ])
  } else {
    uniq = await collectGcmdRowsFromWordsSafe(wordList, SCIENCE_FACET, 5)
    platformUniq = []
    instrumentUniq = []
    locationUniq = []
    providerUniq = []
    projectUniq = []
  }

  if (
    !uniq.length &&
    !platformUniq.length &&
    !instrumentUniq.length &&
    !locationUniq.length &&
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
        evidence:   seed.slice(0, 220),
      }))
      suggestions.push({
        fieldPath: `keywords.${SCIENCE_FACET}`,
        value:     perItem.map((s) => s.value),
        confidence: 0.58,
        label:     'GCMD science keywords (heuristic merge)',
        source:    'gcmd-kms',
        model:     'lens-scan-heuristic/v2',
        evidence:  seed.slice(0, 240),
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
        evidence:   seed.slice(0, 220),
      }))
      suggestions.push({
        fieldPath: `keywords.${spec.field}`,
        value:     per.map((s) => s.value),
        confidence: spec.mergeConf,
        label:     spec.mergeLabel,
        source:    'gcmd-kms',
        model:     'lens-scan-heuristic/v2',
        evidence:  seed.slice(0, 240),
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
