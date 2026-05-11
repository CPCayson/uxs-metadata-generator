import { getFieldDefinition } from '../shell/metadataKnowledgeBase.js'

/**
 * @param {Array<{ field?: string, message: string, severity: string }>} issues
 * @returns {Array<{ field?: string, message: string, severity: string }>}
 */
export function buildFixGuideQueue(issues) {
  if (!Array.isArray(issues)) return []
  return issues.filter((i) => i && typeof i.field === 'string' && i.field.trim())
}

/**
 * @param {Array<{ field?: string }>} issues
 * @returns {number}
 */
export function countFixableIssues(issues) {
  return buildFixGuideQueue(issues).length
}

/**
 * @param {{ field?: string, message: string, severity: string }} issue
 * @returns {string[]}
 */
export function getCoachingPrompts(issue) {
  if (!issue) return []
  const lines = []

  const def = issue.field ? getFieldDefinition(issue.field) : null
  if (def) {
    lines.push(def)
  }

  lines.push(String(issue.message || '').trim())

  if (issue.severity === 'e') lines.push('Blocking error — must be resolved before catalog submission.')
  else if (issue.severity === 'w') lines.push('Warning — fix before catalog handoff if possible.')

  return lines.filter(Boolean)
}
