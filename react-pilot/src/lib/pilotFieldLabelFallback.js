/**
 * Human-readable labels for pilot field paths when the profile has no custom label.
 *
 * @param {string} field
 * @returns {string}
 */
export function getPilotFieldLabelFallback(field) {
  if (!field || typeof field !== 'string') return String(field ?? '')
  const parts = field.split('.').filter(Boolean)
  const leaf = parts[parts.length - 1] || field
  const spaced = leaf
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
  if (!spaced) return field
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
