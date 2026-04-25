/**
 * ValidationEngine — profile-driven validation runner.
 *
 * Wraps the existing validatePilotState so the existing rules continue to work
 * during migration. In Phase 3+ the engine will call profile rule sets directly
 * on the canonical entity; for now it translates to/from pilotState internally.
 *
 * @module core/validation/ValidationEngine
 */

import { validatePilotState } from '../../lib/pilotValidation.js'
import { previewMetadataXPath } from '../../lib/metadataXPath.js'
import { canonicalToPilotState } from '../mappers/pilotStateMapper.js'

/**
 * @param {import('../entities/types.js').ValidationIssue} issue
 * @returns {import('../entities/types.js').ValidationIssue}
 */
function withPreviewXPath(issue) {
  if (!issue || issue.xpath == null) return issue
  return { ...issue, xpath: previewMetadataXPath(issue.xpath) }
}

export class ValidationEngine {
  /**
   * Run validation for a pilotState object using the existing engine.
   * This is the Phase 1/2 path — the engine delegates to validatePilotState.
   *
   * @param {object} pilotState
   * @param {string} [mode] - 'lenient' | 'strict' | 'catalog'
   * @returns {import('../entities/types.js').ValidationResult}
   */
  runForPilotState(pilotState, mode) {
    const resolvedMode = mode || pilotState?.mode || 'lenient'
    return validatePilotState(resolvedMode, pilotState)
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
  runProfileRules(state, mode, profile) {
    /** @type {import('../entities/types.js').ValidationIssue[]} */
    const issues = []

    for (const ruleSet of profile.validationRuleSets ?? []) {
      if (!ruleSet.modes.includes(mode)) continue
      for (const rule of ruleSet.rules) {
        const result = rule.check(state, mode)
        if (!result) continue
        if (result === true) {
          issues.push(
            withPreviewXPath({
              severity: rule.severity,
              field: rule.field,
              message: rule.message,
              xpath: rule.xpath,
            }),
          )
        } else if (Array.isArray(result)) {
          issues.push(...result.map((i) => withPreviewXPath(i)))
        }
      }
    }

    const errCount = issues.filter((i) => i.severity === 'e').length
    const warnCount = issues.filter((i) => i.severity === 'w').length
    const score = Math.max(0, 100 - errCount * 8 - warnCount * 3)

    return { issues, score, maxScore: 100, errCount, warnCount }
  }
}
