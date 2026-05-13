/**
 * mergeWithEvidence — evidence-aware replacement for last-write-wins merge
 *
 * Bridge between the reconciler and the existing pilotState merge path.
 * Wraps {@link mergeLoadedPilotState} so higher-trust incoming values can
 * replace lower-trust base assumptions, without modifying mergeLoadedPilotState.
 */

import { mergeLoadedPilotState } from '../../lib/pilotValidation.js'
import { reconcileFragments, reconciledMapToPartial } from './reconcileFragments.js'
import { evidenceOutranks } from '../fragments/MetadataFragment.js'

/**
 * Merge incoming fragments into a base pilotState using evidence ranking.
 *
 * For each field in the incoming fragments:
 * - If base state is treated as user-confirmed and the field has a value → skip (locked)
 * - If incoming evidence strictly outranks baseEvidence → apply
 * - If base evidence equals or outranks incoming → skip (log if values differ)
 *
 * @param {object} basePilotState
 * @param {import('../fragments/MetadataFragment.js').MetadataFragment[]} incomingFragments
 * @param {object} [options]
 * @param {string} [options.baseEvidence='iso-xpath-exact']
 * @param {boolean} [options.allowSuggestions=false]
 * @returns {{
 *   mergedState: object,
 *   conflicts: import('./reconcileFragments.js').ReconciledField[],
 *   suggestions: import('./reconcileFragments.js').ReconciledField[],
 *   appliedCount: number,
 *   skippedCount: number,
 * }}
 */
export function mergeWithEvidence(basePilotState, incomingFragments, options = {}) {
  const {
    baseEvidence = 'iso-xpath-exact',
    allowSuggestions = false,
  } = options ?? {}

  if (!incomingFragments?.length) {
    return {
      mergedState: mergeLoadedPilotState(basePilotState, {}),
      conflicts: [],
      suggestions: [],
      appliedCount: 0,
      skippedCount: 0,
    }
  }

  const reconciledMap = reconcileFragments(incomingFragments)
  const { suggestions, conflicts: fragmentConflicts } = reconciledMapToPartial(reconciledMap)
  /** @type {import('./reconcileFragments.js').ReconciledField[]} */
  const reportedConflicts = [...fragmentConflicts]

  const safePartial = {}
  let appliedCount = 0
  let skippedCount = 0

  for (const [, reconciledField] of reconciledMap) {
    if (reconciledField.isSuggestion && !allowSuggestions) {
      skippedCount++
      continue
    }

    const fieldPath = reconciledField.fieldPath
    const baseValue = getAtPath(basePilotState, fieldPath)
    const hasBaseValue =
      baseValue !== undefined && baseValue !== null && baseValue !== ''

    if (hasBaseValue && baseEvidence === 'user-confirmed') {
      skippedCount++
      if (!valuesLooselyEqual(baseValue, reconciledField.value)) {
        reportedConflicts.push(appendBaseConflict(reconciledField, baseValue, baseEvidence, fieldPath))
      }
      continue
    }

    if (hasBaseValue && !evidenceOutranks(reconciledField.evidence, baseEvidence)) {
      skippedCount++
      if (!valuesLooselyEqual(baseValue, reconciledField.value)) {
        reportedConflicts.push(appendBaseConflict(reconciledField, baseValue, baseEvidence, fieldPath))
      }
      continue
    }

    setAtPath(safePartial, fieldPath, reconciledField.value)
    appliedCount++
  }

  const mergedState = mergeLoadedPilotState(basePilotState, safePartial)

  return {
    mergedState,
    conflicts: reportedConflicts,
    suggestions,
    appliedCount,
    skippedCount,
  }
}

/**
 * @param {import('./reconcileFragments.js').ReconciledField} field
 * @param {unknown} baseValue
 * @param {string} baseEvidence
 * @param {string} fieldPath
 */
function appendBaseConflict(field, baseValue, baseEvidence, fieldPath) {
  return {
    ...field,
    conflicts: [
      ...field.conflicts,
      {
        value: baseValue,
        evidence: baseEvidence,
        source: { id: 'base-state', kind: 'user', location: fieldPath },
      },
    ],
    hasConflict: true,
  }
}

/**
 * @param {object} obj
 * @param {string} path
 * @returns {unknown}
 */
function getAtPath(obj, path) {
  const parts = path.split('.')
  let current = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    current = current[part]
  }
  return current
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

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function valuesLooselyEqual(a, b) {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a === 'string' && typeof b === 'string') {
    return a.trim().toLowerCase() === b.trim().toLowerCase()
  }
  return JSON.stringify(a) === JSON.stringify(b)
}
