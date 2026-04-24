/**
 * @deprecated Use WorkflowEngine from core/workflow/WorkflowEngine.js instead.
 * These exports are kept for backward compatibility with any external consumers
 * while the migration to profile-driven WorkflowEngine is in progress.
 */

import { WorkflowEngine } from '../core/workflow/WorkflowEngine.js'
import { missionProfile } from '../profiles/mission/missionProfile.js'

const _engine = new WorkflowEngine(missionProfile.steps)

/**
 * @param {string} field
 * @returns {string}
 * @deprecated Use workflowEngine.stepForField(field) from core/workflow/WorkflowEngine
 */
export function stepIdForValidationField(field) {
  return _engine.stepForField(field)
}

/**
 * @param {Array<{ severity: string, field: string }>} issues
 * @returns {Record<string, 'ok'|'warn'|'err'>}
 * @deprecated Use workflowEngine.stepCompletionFromIssues(issues) from core/workflow/WorkflowEngine
 */
export function stepCompletionByIssues(issues) {
  return _engine.stepCompletionFromIssues(issues)
}
