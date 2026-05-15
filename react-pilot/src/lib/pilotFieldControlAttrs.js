/**
 * Shared id / name / autocomplete for wizard controls (a11y + DevTools hygiene).
 *
 * @param {string} fieldPath e.g. `mission.startDate`
 * @param {string} [explicitId] when the DOM id must differ from the path leaf
 */
export function pilotFieldControlAttrs(fieldPath, explicitId) {
  const id = explicitId ?? String(fieldPath || '').split('.').pop() ?? 'field'
  return {
    id,
    name: String(fieldPath || id).replace(/\./g, '_'),
    autoComplete: 'off',
    'data-pilot-field': fieldPath,
  }
}
