/**
 * Quick-action chips for a validation issue in the Manta lens tray.
 *
 * @param {{ field?: string, message: string, severity: string }} issue
 * @param {object} [pilotState] reserved for field-aware quick fills
 * @returns {Array<{
 *   id: string,
 *   kind: 'action' | 'help' | 'fill',
 *   label: string,
 *   action?: string,
 *   fieldPath?: string,
 *   value?: unknown,
 *   helpText?: string,
 * }>}
 */
export function getLensChipsForIssue(issue, pilotState) {
  void pilotState
  if (!issue) return []
  const idBase = `${issue.field || 'issue'}:${(issue.message || '').slice(0, 32)}`
  return [
    {
      id:         `${idBase}:hint`,
      kind:       'help',
      label:      'What’s wrong?',
      helpText:   issue.message + (issue.field ? `\n\nPath: ${issue.field}` : ''),
    },
    {
      id:        `${idBase}:autofix`,
      kind:      'action',
      action:    'autofix',
      label:     'Run auto-fixes',
    },
  ]
}
