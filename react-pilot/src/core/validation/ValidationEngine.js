/**
 * ValidationEngine — profile-driven validation runner.
 *
 * `run({ profile, state, mode })` is the canonical local/editor validation path.
 * Profile rule sets are the source of truth for registered profiles. Legacy
 * pilot validation is retained only behind compatibility helpers for migration
 * and parity tests.
 *
 * @module core/validation/ValidationEngine
 */

import { validatePilotState } from '../../lib/pilotValidation.js'
import { previewMetadataXPath } from '../../lib/metadataXPath.js'
import { canonicalToPilotState } from '../mappers/pilotStateMapper.js'
import { getCompiledRuleIssues } from './compiledRuleRuntime.js'

const VALIDATION_SOURCES = new Set(['profile', 'legacy', 'server', 'comet', 'linkcheck', 'xsd', 'schematron', 'scanner', 'compiled'])

function slugPart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 80) || 'issue'
}

/**
 * @param {string} mode
 * @returns {string[]}
 */
function readinessBundleIdsForMode(mode) {
  const m = mode === 'strict' || mode === 'catalog' ? mode : 'lenient'
  const ids = ['draft', 'profile-valid']
  if (m === 'strict') ids.push('iso-ready')
  if (m === 'catalog') ids.push('iso-ready', 'discovery-ready')
  return ids
}

/**
 * @param {import('../entities/types.js').ValidationIssue} issue
 * @returns {import('../entities/types.js').ValidationIssue}
 */
function withPreviewXPath(issue) {
  if (!issue || issue.xpath == null) return issue
  return { ...issue, xpath: previewMetadataXPath(issue.xpath) }
}

/**
 * @param {unknown} issue
 * @param {{
 *   profile?: import('../registry/types.js').EntityProfile | null,
 *   mode?: string,
 *   source?: string,
 *   rule?: import('../registry/types.js').ValidationRule,
 *   ruleSetId?: string,
 * }} ctx
 * @returns {import('../entities/types.js').ValidationIssue}
 */
export function normalizeValidationIssue(issue, ctx = {}) {
  const raw = issue && typeof issue === 'object' ? /** @type {Record<string, unknown>} */ (issue) : {}
  const field = String(raw.field ?? raw.path ?? ctx.rule?.field ?? '').trim()
  const message = String(raw.message ?? ctx.rule?.message ?? 'Validation issue').trim()
  const source = VALIDATION_SOURCES.has(String(raw.source || ctx.source)) ? String(raw.source || ctx.source) : 'profile'
  const severityRaw = raw.severity ?? ctx.rule?.severity ?? 'w'
  const severity = severityRaw === 'error' ? 'e' : severityRaw === 'warning' ? 'w' : String(severityRaw || 'w')
  const id = String(
    raw.id
    ?? ctx.rule?.id
    ?? [
      ctx.profile?.id || 'metadata',
      source,
      ctx.ruleSetId || 'validation',
      slugPart(field),
      slugPart(message),
    ].join('.'),
  )
  return withPreviewXPath({
    ...raw,
    id,
    field,
    path: String(raw.path ?? field),
    severity: severity === 'e' || severity === 'w' ? severity : 'w',
    source,
    message,
    detail: typeof raw.detail === 'string' ? raw.detail : undefined,
    xpath: raw.xpath != null ? String(raw.xpath) : ctx.rule?.xpath,
    readinessBundleIds: Array.isArray(raw.readinessBundleIds)
      ? raw.readinessBundleIds.map((v) => String(v))
      : readinessBundleIdsForMode(ctx.mode || 'lenient'),
  })
}

/**
 * @param {import('../entities/types.js').ValidationIssue[]} issues
 */
function summarizeIssues(issues) {
  const errCount = issues.filter((i) => i.severity === 'e').length
  const warnCount = issues.filter((i) => i.severity === 'w').length
  const score = Math.max(0, 100 - errCount * 8 - warnCount * 3)
  return { issues, score, maxScore: 100, errCount, warnCount }
}

export class ValidationEngine {
  /**
   * Unified validation entry point for local/editor rules.
   *
   * @param {{
   *   profile?: import('../registry/types.js').EntityProfile | null,
   *   state: object,
   *   mode?: string,
   *   includeExternal?: boolean,
   * }} args
   * @returns {import('../entities/types.js').ValidationResult}
   */
  run({ profile = null, state, mode, includeExternal = false }) {
    void includeExternal
    const resolvedMode = mode || state?.mode || 'lenient'
    if (profile?.validationRuleSets?.length) {
      return this.runLocalProfileRules(state, resolvedMode, profile)
    }
    return summarizeIssues([])
  }

  /**
   * Compatibility path for old pilotState callers and parity checks.
   * New code should call `run({ profile, state, mode })` so profile rule sets
   * remain the local/editor source of truth.
   *
   * @param {object} pilotState
   * @param {string} [mode] - 'lenient' | 'strict' | 'catalog'
   * @returns {import('../entities/types.js').ValidationResult}
   */
  runForPilotState(pilotState, mode) {
    const resolvedMode = mode || pilotState?.mode || 'lenient'
    const result = validatePilotState(resolvedMode, pilotState)
    const issues = (result.issues ?? []).map((issue) =>
      normalizeValidationIssue(issue, {
        mode: resolvedMode,
        source: 'legacy',
      }))
    return { ...result, issues }
  }

  /**
   * Run validation for a CanonicalMetadataEntity.
   * Translates to pilotState internally, then delegates to validatePilotState.
   *
   * @param {import('../entities/types.js').CanonicalMetadataEntity} entity
   * @returns {import('../entities/types.js').ValidationResult}
   */
  runForEntity(entity) {
    const pilotState = canonicalToPilotState(entity)
    return this.runForPilotState(pilotState, entity.validationMode)
  }

  /**
   * Backwards-compatible alias for older tests/tools.
   *
   * @param {object} state - pilotState
   * @param {string} mode
   * @param {import('../registry/types.js').EntityProfile} profile
   * @returns {import('../entities/types.js').ValidationResult}
   */
  runProfileRules(state, mode, profile) {
    return this.runLocalProfileRules(state, mode, profile)
  }

  /**
   * Run a profile's explicit rule sets against a pilotState object.
   *
   * `rule.check(state, mode)` may return:
   *   - `false`  — no issue (check passed)
   *   - `true`   — one issue using the rule's own field/severity/message/xpath
   *   - `ValidationIssue[]` — zero or more issues (used by sensor/keyword generators)
   *
   * @param {object} state - pilotState
   * @param {string} mode
   * @param {import('../registry/types.js').EntityProfile} profile
   * @returns {import('../entities/types.js').ValidationResult}
   */
  runLocalProfileRules(state, mode, profile) {
    /** @type {import('../entities/types.js').ValidationIssue[]} */
    const issues = []

    for (const ruleSet of profile.validationRuleSets ?? []) {
      if (!ruleSet.modes.includes(mode)) continue
      for (const rule of ruleSet.rules) {
        const result = rule.check(state, mode)
        if (!result) continue
        if (result === true) {
          issues.push(
            normalizeValidationIssue({
              severity: rule.severity,
              field: rule.field,
              message: rule.message,
              xpath: rule.xpath,
            }, {
              profile,
              mode,
              source: 'profile',
              rule,
              ruleSetId: ruleSet.id,
            }),
          )
        } else if (Array.isArray(result)) {
          issues.push(...result.map((i) => normalizeValidationIssue(i, {
            profile,
            mode,
            source: 'profile',
            rule,
            ruleSetId: ruleSet.id,
          })))
        }
      }
    }

    // Append compiled swarm rules (if a compiled bundle exists for this profile type).
    const compiledIssues = getCompiledRuleIssues(profile?.id, state)
    if (compiledIssues.length) {
      issues.push(...compiledIssues.map((i) => normalizeValidationIssue(i, {
        profile,
        mode,
        source: 'compiled',
        ruleSetId: 'compiled-rules',
      })))
    }

    return summarizeIssues(issues)
  }
}
