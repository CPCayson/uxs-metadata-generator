/**
 * Framework-agnostic scanner pipeline: envelope → mission partial → merged pilot
 * + optional host bridge scan. UI (AssistantShell) and a future Web Extension can
 * import this without pulling React.
 *
 * @module lib/scannerEngine
 */

import { runLensScanHeuristic } from './lensScanHeuristic.js'
import {
  isScannerSuggestionEnvelope,
  mergeScannerPartialIntoPilotState,
  parseScannerSuggestionsToMissionPartial,
} from '../adapters/sources/ScannerSuggestionAdapter.js'
// Re-export merge for callers that only need the merge step
export { mergeScannerPartialIntoPilotState } from '../adapters/sources/ScannerSuggestionAdapter.js'

/**
 * @param {string} profileId
 * @param {{ title?: string, abstract?: string, xmlSnippet?: string, uxsContext?: unknown }} stateSlice
 * @param {{ lensScan?: (p: object) => Promise<unknown> } | null} hostBridge
 */
export async function runScannerHeuristicOrHost({
  profileId = 'mission',
  title = '',
  abstract = '',
  xmlSnippet = '',
  uxsContext,
} = {}, hostBridge = null) {
  const payload = { title, abstract, xmlSnippet, profileId, uxsContext }
  if (hostBridge && typeof hostBridge.lensScan === 'function') {
    return hostBridge.lensScan(payload)
  }
  return runLensScanHeuristic(payload)
}

/**
 * @param {unknown} envelope
 * @param {object} basePilotState
 * @param {Parameters<typeof parseScannerSuggestionsToMissionPartial>[1]} [parseMeta]
 * @returns {{ ok: true, nextPilotState: object, parse: ReturnType<typeof parseScannerSuggestionsToMissionPartial> } | { ok: false, error: string, parse?: import('../core/registry/types.js').ScannerSuggestionResult }}
 */
export function applyEnvelopeToPilotState(envelope, basePilotState, parseMeta) {
  if (!isScannerSuggestionEnvelope(envelope)) {
    return { ok: false, error: 'Not a scanner suggestion envelope.' }
  }
  const parse = parseScannerSuggestionsToMissionPartial(envelope, parseMeta || {})
  if (!parse.ok || !parse.partial) {
    return { ok: false, error: parse.error || 'Parse failed.', parse }
  }
  const nextPilotState = mergeScannerPartialIntoPilotState(basePilotState, /** @type {Record<string, unknown>} */ (parse.partial))
  return { ok: true, nextPilotState, parse }
}

/**
 * @param {{
 *   hostBridge?: { lensScan?: (p: object) => Promise<unknown> } | null
 *   parseMeta?: import('../core/registry/types.js').ImportParseMeta
 * }} [opts]
 * @returns {{
 *   scan: typeof runScannerHeuristicOrHost
 *   parseEnvelope: typeof parseScannerSuggestionsToMissionPartial
 *   mergePartial: typeof mergeScannerPartialIntoPilotState
 *   applyEnvelope: typeof applyEnvelopeToPilotState
 * }}
 */
export function createScannerController(opts = {}) {
  const { hostBridge = null, parseMeta } = opts
  return {
    scan:   (input) => runScannerHeuristicOrHost(input, hostBridge),
    parseEnvelope: (env, meta) => parseScannerSuggestionsToMissionPartial(env, meta || parseMeta || {}),
    mergePartial: mergeScannerPartialIntoPilotState,
    applyEnvelope: (envelope, base) => applyEnvelopeToPilotState(envelope, base, parseMeta),
  }
}
