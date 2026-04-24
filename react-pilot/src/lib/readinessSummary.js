/**
 * Cross-mode validation snapshot for “readiness lane” UI (lenient / strict / catalog).
 * Uses the same engine path as WizardShell validation (profile rules when present).
 *
 * @module lib/readinessSummary
 */

/**
 * @param {import('../core/validation/ValidationEngine.js').ValidationEngine} engine
 * @param {import('../core/registry/types.js').EntityProfile | null | undefined} profile
 * @param {object} pilotState
 * @param {string} mode
 */
export function runValidationForMode(engine, profile, pilotState, mode) {
  if (profile?.validationRuleSets?.length) {
    return engine.runProfileRules(pilotState, mode, profile)
  }
  return engine.runForPilotState(pilotState, mode)
}

/**
 * @param {object} pilotState
 * @param {import('../core/validation/ValidationEngine.js').ValidationEngine} engine
 * @param {import('../core/registry/types.js').EntityProfile | null | undefined} profile
 */
export function computeReadinessSnapshot(pilotState, engine, profile) {
  return {
    lenient: runValidationForMode(engine, profile, pilotState, 'lenient'),
    strict:  runValidationForMode(engine, profile, pilotState, 'strict'),
    catalog: runValidationForMode(engine, profile, pilotState, 'catalog'),
  }
}

/**
 * @param {ReturnType<typeof computeReadinessSnapshot>} snapshot
 * @param {{
 *   preflightSummary?: { overall?: string } | null,
 *   isDirty?: boolean,
 * }} [ctx]
 */
export function computeReadinessBundles(snapshot, ctx = {}) {
  const isoReady = (snapshot.strict?.errCount ?? 1) === 0
  const discoveryReady = (snapshot.catalog?.errCount ?? 1) === 0
  const preflightOverall = ctx.preflightSummary?.overall
  const cometReady = preflightOverall === 'PASS'
  const archiveReady = isoReady && !ctx.isDirty

  return [
    {
      id: 'iso',
      label: 'ISO-ready',
      ready: isoReady,
      detail: isoReady
        ? 'Strict editor validation has no errors.'
        : `${snapshot.strict?.errCount ?? 0} strict validation error(s).`,
    },
    {
      id: 'discovery',
      label: 'Discovery-ready',
      ready: discoveryReady,
      detail: discoveryReady
        ? 'Catalog validation has no errors.'
        : `${snapshot.catalog?.errCount ?? 0} catalog validation error(s).`,
    },
    {
      id: 'comet-preflight',
      label: 'CoMET preflight',
      ready: cometReady,
      detail: preflightOverall
        ? `Last preflight: ${preflightOverall}.`
        : 'Preflight has not run yet.',
    },
    {
      id: 'archive-handoff',
      label: 'Handoff-ready',
      ready: archiveReady,
      detail: archiveReady
        ? 'ISO-ready with no unsaved edits.'
        : isoReady
          ? 'Save or stabilize edits before handoff.'
          : 'Resolve strict validation errors first.',
    },
  ]
}
