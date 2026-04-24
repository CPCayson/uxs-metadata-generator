/**
 * WorkflowEngine — profile-driven step graph and validation routing.
 *
 * Replaces the hardcoded logic in pilotStepCompletion.js. Each step definition
 * declares which field path prefixes it owns, so routing is driven by the
 * profile rather than by hardcoded switch/prefix logic here.
 *
 * @module core/workflow/WorkflowEngine
 */

export class WorkflowEngine {
  /**
   * @param {import('../registry/types.js').StepDefinition[]} steps
   */
  constructor(steps) {
    this._steps = steps
    this._stepIds = steps.map((s) => s.id)
  }

  /**
   * Returns the step id that owns the given validation field path.
   * Falls back to the first step for unknown fields.
   *
   * @param {string} field
   * @returns {string}
   */
  stepForField(field) {
    if (!field || typeof field !== 'string') return this._stepIds[0]

    for (const step of this._steps) {
      for (const prefix of step.ownedFieldPrefixes) {
        if (field === prefix || field.startsWith(prefix)) return step.id
      }
    }

    return this._stepIds[0]
  }

  /**
   * Aggregates validation issues into a per-step worst status.
   *
   * @param {Array<{ severity: string, field: string }>} issues
   * @returns {Record<string, 'ok'|'warn'|'err'>}
   */
  stepCompletionFromIssues(issues) {
    /** @type {Record<string, 'ok'|'warn'|'err'>} */
    const out = {}
    for (const id of this._stepIds) out[id] = 'ok'

    const list = Array.isArray(issues) ? issues : []
    for (const iss of list) {
      const stepId = this.stepForField(iss.field)
      if (iss.severity === 'e') {
        out[stepId] = 'err'
      } else if (iss.severity === 'w' && out[stepId] !== 'err') {
        out[stepId] = 'warn'
      }
    }

    return out
  }

  /**
   * Returns the ordered list of step ids for this profile.
   * @returns {string[]}
   */
  get stepIds() {
    return this._stepIds
  }

  /**
   * Returns the step definition for a given id.
   * @param {string} id
   * @returns {import('../registry/types.js').StepDefinition | undefined}
   */
  stepById(id) {
    return this._steps.find((s) => s.id === id)
  }
}
