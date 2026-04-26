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
  return engine.run({ profile, state: pilotState, mode, includeExternal: false })
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
  const draftReady = (snapshot.lenient?.errCount ?? 1) === 0
  const profileReady = (snapshot.lenient?.errCount ?? 1) === 0
  const isoReady = (snapshot.strict?.errCount ?? 1) === 0
  const discoveryReady = (snapshot.catalog?.errCount ?? 1) === 0
  const preflightOverall = ctx.preflightSummary?.overall
  const cometReady = preflightOverall === 'PASS'
  const archiveReady = isoReady && discoveryReady && (!preflightOverall || cometReady) && !ctx.isDirty

  return [
    {
      id: 'draft',
      label: 'Draft',
      scope: 'internal',
      ready: draftReady,
      detail: draftReady
        ? 'Baseline editor checks pass for continued drafting.'
        : `${snapshot.lenient?.errCount ?? 0} draft error(s).`,
    },
    {
      id: 'profile-valid',
      label: 'Profile-valid',
      scope: 'internal',
      ready: profileReady,
      detail: profileReady
        ? 'Local profile rules have no blocking errors.'
        : `${snapshot.lenient?.errCount ?? 0} profile validation error(s).`,
    },
    {
      id: 'iso-ready',
      label: 'ISO-ready',
      scope: 'internal',
      ready: isoReady,
      detail: isoReady
        ? 'Local ISO/export-oriented editor checks have no errors.'
        : `${snapshot.strict?.errCount ?? 0} ISO/editor validation error(s).`,
    },
    {
      id: 'discovery-ready',
      label: 'Discovery-ready',
      scope: 'internal',
      ready: discoveryReady,
      detail: discoveryReady
        ? 'Local catalog/discovery editor checks have no errors.'
        : `${snapshot.catalog?.errCount ?? 0} discovery validation error(s).`,
    },
    {
      id: 'comet-preflight',
      label: 'CoMET-verified',
      scope: 'external',
      ready: cometReady,
      detail: preflightOverall
        ? `External CoMET preflight: ${preflightOverall}.`
        : 'External CoMET preflight has not run yet.',
    },
    {
      id: 'handoff-ready',
      label: 'Handoff-ready',
      scope: 'handoff',
      ready: archiveReady,
      detail: archiveReady
        ? 'Local readiness is clear, external preflight is clear when present, and no unsaved edits remain.'
        : isoReady
          ? 'Save/stabilize edits and clear discovery or external preflight blockers before handoff.'
          : 'Resolve ISO/editor validation errors first.',
    },
  ]
}
