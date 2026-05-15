/**
 * Cross-mode validation snapshot for “readiness lane” UI (lenient / strict / catalog).
 * Uses the same engine path as WizardShell validation (profile rules when present).
 *
 * @module lib/readinessSummary
 */

/** Idle validation — used when the wizard has not primed checks yet (Start over / fresh session). */
export const IDLE_VALIDATION_RESULT = Object.freeze({
  issues: [],
  score: 100,
  maxScore: 100,
  errCount: 0,
  warnCount: 0,
})

/** Idle readiness strip — all modes at 100% with zero issues. */
export const IDLE_READINESS_SNAPSHOT = Object.freeze({
  lenient: IDLE_VALIDATION_RESULT,
  strict: IDLE_VALIDATION_RESULT,
  catalog: IDLE_VALIDATION_RESULT,
})

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
 *   oneStopStatus?: 'PASS' | 'CHECK' | 'BLOCK' | null,
 *   docucompStatus?: 'PASS' | 'CHECK' | 'BLOCK' | null,
 *   wafStatus?: 'PASS' | 'CHECK' | 'BLOCK' | null,
 * }} [ctx]
 */
export function computeReadinessBundles(snapshot, ctx = {}) {
  const draftReady     = (snapshot.lenient?.errCount ?? 1) === 0
  const isoReady       = (snapshot.strict?.errCount  ?? 1) === 0
  const discoveryReady = (snapshot.catalog?.errCount ?? 1) === 0
  const preflightOverall = ctx.preflightSummary?.overall
  const cometReady     = preflightOverall === 'PASS'
  const oneStopReady   = ctx.oneStopStatus === 'PASS'
  const docucompReady  = ctx.docucompStatus !== 'BLOCK'
  const wafReady       = ctx.wafStatus !== 'BLOCK'
  const archiveReady   = isoReady && discoveryReady && (!preflightOverall || cometReady) && !ctx.isDirty

  return [
    {
      id: 'draft',
      label: 'Draft',
      scope: 'internal',
      ready: draftReady,
      detail: draftReady
        ? 'Baseline editor checks pass.'
        : `${snapshot.lenient?.errCount ?? 0} draft error(s) — fix before exporting.`,
    },
    {
      id: 'iso-ready',
      label: 'ISO-ready',
      scope: 'internal',
      ready: isoReady,
      detail: isoReady
        ? 'ISO 19115-2 export checks pass.'
        : `${snapshot.strict?.errCount ?? 0} ISO validation error(s).`,
    },
    {
      id: 'discovery-ready',
      label: 'Discovery-ready',
      scope: 'internal',
      ready: discoveryReady,
      detail: discoveryReady
        ? 'Catalog/discovery checks have no errors.'
        : `${snapshot.catalog?.errCount ?? 0} discovery validation error(s).`,
    },
    {
      id: 'comet-preflight',
      label: 'CoMET',
      scope: 'external',
      ready: cometReady,
      detail: preflightOverall
        ? `CoMET preflight: ${preflightOverall}.`
        : 'CoMET preflight has not run yet — use the CoMET panel.',
    },
    {
      id: 'onestop',
      label: 'OneStop',
      scope: 'external',
      ready: oneStopReady,
      detail: ctx.oneStopStatus
        ? `OneStop readiness: ${ctx.oneStopStatus}. Check GCMD keywords, UUID linkage, and WAF registration.`
        : 'OneStop readiness check has not run. Verify GCMD keywords and UUID linkage.',
    },
    {
      id: 'docucomp',
      label: 'DocuComp',
      scope: 'external',
      ready: docucompReady,
      detail: ctx.docucompStatus === 'PASS'
        ? 'DocuComp license and contact components resolved.'
        : ctx.docucompStatus === 'BLOCK'
          ? 'DocuComp component unresolvable — fix xlink href before submission.'
          : 'DocuComp not yet verified — run preflight to check component links.',
    },
    {
      id: 'waf',
      label: 'WAF / Archive',
      scope: 'handoff',
      ready: wafReady,
      detail: ctx.wafStatus === 'PASS'
        ? 'WAF links and archive URLs healthy.'
        : ctx.wafStatus === 'BLOCK'
          ? 'Broken WAF or archive URLs detected — run batch:waf:audit.'
          : 'WAF audit not yet run for this record.',
    },
    {
      id: 'handoff-ready',
      label: 'Handoff-ready',
      scope: 'handoff',
      ready: archiveReady,
      detail: archiveReady
        ? 'All local checks clear, CoMET confirmed, no unsaved edits.'
        : isoReady
          ? 'Resolve discovery or CoMET blockers before handoff.'
          : 'Resolve ISO validation errors first.',
    },
  ]
}
