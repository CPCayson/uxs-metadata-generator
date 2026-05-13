import { useMemo } from 'react'
import { mergeWithEvidence } from '../core/reconcile/mergeWithEvidence.js'

/**
 * Build the object consumed by {@link ../components/RebuildReviewPanel.jsx}.
 *
 * @param {object} basePilotState
 * @param {import('../core/fragments/MetadataFragment.js').MetadataFragment[]} fragments
 * @param {object} [mergeOptions] — forwarded to {@link mergeWithEvidence}
 * @returns {{
 *   mergedState: object,
 *   conflicts: import('../core/reconcile/reconcileFragments.js').ReconciledField[],
 *   suggestions: import('../core/reconcile/reconcileFragments.js').ReconciledField[],
 *   appliedCount: number,
 *   skippedCount: number,
 *   sourceCount: number,
 *   fragmentCount: number,
 *   fingerprint: string,
 *   extractionErrors: string[],
 * }}
 */
export function buildMultiSourceReconstructResult(basePilotState, fragments = [], mergeOptions = {}) {
  const list = Array.isArray(fragments) ? fragments : []
  const uniqueSources = new Set(list.map((f) => f.source?.id).filter(Boolean))
  const fingerprint = list[0]?.entityFingerprint ?? ''
  const { mergedState, conflicts, suggestions, appliedCount, skippedCount } = mergeWithEvidence(
    basePilotState,
    list,
    mergeOptions,
  )

  return {
    mergedState,
    conflicts,
    suggestions,
    appliedCount,
    skippedCount,
    sourceCount: uniqueSources.size || (list.length ? 1 : 0),
    fragmentCount: list.length,
    fingerprint,
    extractionErrors: [],
  }
}

/**
 * Memoized multi-source reconstruction summary + merge output for RebuildReviewPanel.
 *
 * @param {object} basePilotState
 * @param {import('../core/fragments/MetadataFragment.js').MetadataFragment[]} fragments
 * @param {object} [mergeOptions]
 */
export function useMultiSourceReconstruct(basePilotState, fragments = [], mergeOptions = {}) {
  const list = useMemo(() => (Array.isArray(fragments) ? fragments : []), [fragments])

  return useMemo(
    () => buildMultiSourceReconstructResult(basePilotState, list, mergeOptions),
    [basePilotState, list, mergeOptions],
  )
}
