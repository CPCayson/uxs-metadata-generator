/**
 * Human-readable labels for pilot field paths when the profile has no custom label.
 *
 * Uses wizard section names (Mission, Distribution, …) plus humanized path segments so
 * validators rarely show raw tokens like `citationAuthorIndividualName` alone.
 *
 * @param {string} field
 * @returns {string}
 */
const SECTION_LABEL = /** @type {Record<string, string>} */ ({
  mission: 'Mission',
  platform: 'Platform',
  spatial: 'Spatial extent',
  distribution: 'Distribution',
  keywords: 'Keywords',
  sensors: 'Sensors',
  meta: 'Record metadata',
  sourceProvenance: 'Import source',
  comet: 'CoMET',
})

/**
 * @param {string} id
 */
function humanizeIdentifier(id) {
  return String(id || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * @param {string} s
 */
function capitalizeWords(s) {
  const t = humanizeIdentifier(s)
  if (!t) return t
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function getPilotFieldLabelFallback(field) {
  if (!field || typeof field !== 'string') return String(field ?? '')

  const bracket = field.match(/^(\w+)\[(\d+)]\.([\w.]+)$/)
  if (bracket) {
    const root = bracket[1]
    const idx = Number(bracket[2]) + 1
    const rest = bracket[3]
    const section = SECTION_LABEL[root] || capitalizeWords(root)
    const restLabel = rest
      .split('.')
      .filter(Boolean)
      .map((p) => capitalizeWords(p))
      .join(' · ')
    return `${section} · ${idx} · ${restLabel}`
  }

  const parts = field.split('.').filter(Boolean)
  if (parts.length >= 2) {
    const head = parts[0]
    const section = SECTION_LABEL[head]
    if (section) {
      const tail = parts
        .slice(1)
        .map((p) => capitalizeWords(p))
        .join(' · ')
      return `${section} · ${tail}`
    }
    return parts.map((p) => capitalizeWords(p)).join(' · ')
  }

  const leaf = parts[parts.length - 1] || field
  return capitalizeWords(leaf)
}
