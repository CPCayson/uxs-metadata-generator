/**
 * reconcileFragments — automatic multi-source field reconciliation
 *
 * Takes arrays of MetadataFragment from multiple sources (all sharing the
 * same entityFingerprint) and produces a single resolved value per fieldPath
 * using the evidence priority ladder.
 *
 * Rules:
 * 1. Higher evidence always wins (deterministic — no LLM opinions here)
 * 2. Conflicts are logged, never silently dropped
 * 3. user-confirmed evidence is locked — never overwritten by any import (enforced in mergeWithEvidence)
 * 4. Equal-evidence conflicts keep the first-seen value and log the rest
 * 5. llm-suggestion fragments never auto-apply — they go to the review queue (via reconciledMapToPartial)
 *
 * This module never touches pilotState directly.
 * It works on fragments and returns reconciled field objects.
 * The caller is responsible for mapping results back to pilotState.
 */

import { evidenceOutranks } from '../fragments/MetadataFragment.js'

/**
 * @typedef {Object} ReconciledField
 * @property {string}   fieldPath
 * @property {*}        value
 * @property {string}   evidence
 * @property {import('../fragments/MetadataFragment.js').MetadataFragment['source'][]} sources
 * @property {{ value: unknown, evidence: string, source: import('../fragments/MetadataFragment.js').MetadataFragment['source'], rawSnippet?: string }[]} conflicts
 * @property {boolean}  locked
 * @property {boolean}  hasConflict
 * @property {boolean}  isSuggestion
 */

/**
 * @param {import('../fragments/MetadataFragment.js').MetadataFragment[]} fragments
 * @param {string} fieldPath
 */
function assertUniformFieldPath(fragments, fieldPath) {
  for (const f of fragments) {
    if (f.fieldPath !== fieldPath) {
      throw new Error(`reconcileField: mixed fieldPath (expected ${fieldPath}, got ${f.fieldPath})`)
    }
  }
}

/**
 * Reconcile an array of fragments for a single fieldPath.
 * All fragments must share the same fieldPath.
 *
 * @param {import('../fragments/MetadataFragment.js').MetadataFragment[]} fragments
 * @returns {ReconciledField}
 */
export function reconcileField(fragments) {
  if (!fragments || fragments.length === 0) {
    throw new Error('reconcileField: fragments array must not be empty')
  }

  const fieldPath = fragments[0].fieldPath
  assertUniformFieldPath(fragments, fieldPath)

  const withIdx = fragments.map((f, i) => ({ f, i }))
  withIdx.sort((a, b) => {
    if (evidenceOutranks(a.f.evidence, b.f.evidence)) return -1
    if (evidenceOutranks(b.f.evidence, a.f.evidence)) return 1
    return a.i - b.i
  })
  const ranked = withIdx.map(({ f }) => f)

  const winner = ranked[0]
  const losers = ranked.slice(1)

  const conflicts = losers
    .filter((f) => !valuesEqual(f.value, winner.value))
    .map((f) => ({
      value: f.value,
      evidence: f.evidence,
      source: f.source,
      rawSnippet: f.rawSnippet,
    }))

  if (conflicts.length > 0) {
    console.warn('[reconcileFragments]', fieldPath, 'conflicting values; winner evidence:', winner.evidence)
  }

  return {
    fieldPath,
    value: winner.value,
    evidence: winner.evidence,
    sources: fragments.map((f) => f.source),
    conflicts,
    locked: winner.evidence === 'user-confirmed',
    hasConflict: conflicts.length > 0,
    isSuggestion: winner.evidence === 'llm-suggestion',
  }
}

/**
 * Reconcile all fragments from multiple sources into a map of
 * fieldPath → ReconciledField.
 *
 * Groups fragments by fieldPath, then reconciles each group.
 * All fragments must share the same entityFingerprint.
 *
 * @param {import('../fragments/MetadataFragment.js').MetadataFragment[]} fragments
 * @returns {Map<string, ReconciledField>}
 */
export function reconcileFragments(fragments) {
  const result = new Map()
  if (!fragments?.length) return result

  const fp0 = fragments[0].entityFingerprint
  for (const f of fragments) {
    if (f.entityFingerprint !== fp0) {
      throw new Error(
        'reconcileFragments: mixed entityFingerprint — partition by fingerprint before calling',
      )
    }
  }

  const byField = new Map()
  for (const frag of fragments) {
    if (!byField.has(frag.fieldPath)) {
      byField.set(frag.fieldPath, [])
    }
    byField.get(frag.fieldPath).push(frag)
  }

  for (const [, fieldFragments] of byField) {
    const rf = reconcileField(fieldFragments)
    result.set(rf.fieldPath, rf)
  }

  return result
}

/**
 * Convert a reconciled field map into a partial pilotState object.
 * Only includes fields that are not suggestions (isSuggestion = false).
 * Suggestions are returned separately for the review queue.
 *
 * @param {Map<string, ReconciledField>} reconciledMap
 * @returns {{
 *   partial: object,
 *   suggestions: ReconciledField[],
 *   conflicts: ReconciledField[],
 * }}
 */
export function reconciledMapToPartial(reconciledMap) {
  const partial = {}
  const suggestions = []
  const conflicts = []

  for (const [, field] of reconciledMap) {
    if (field.isSuggestion) {
      suggestions.push(field)
      continue
    }

    if (field.hasConflict) {
      conflicts.push(field)
    }

    setAtPath(partial, field.fieldPath, field.value)
  }

  return { partial, suggestions, conflicts }
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function valuesEqual(a, b) {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== typeof b) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return JSON.stringify(a) === JSON.stringify(b)
  }
  if (typeof a === 'object') {
    return JSON.stringify(a) === JSON.stringify(b)
  }
  if (typeof a === 'string') {
    return String(a).trim().toLowerCase() === String(b).trim().toLowerCase()
  }
  return false
}

/**
 * @param {object} obj
 * @param {string} path
 * @param {unknown} value
 */
function setAtPath(obj, path, value) {
  const parts = path.split('.')
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {}
    }
    current = current[key]
  }
  current[parts[parts.length - 1]] = value
}
