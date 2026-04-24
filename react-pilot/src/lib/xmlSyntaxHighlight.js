/**
 * Escape text for HTML.
 * @param {string} s
 */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Lightweight XML-ish highlighting (split on tags).
 * @param {string} xml
 * @returns {string} HTML (safe if `xml` is trusted preview output)
 */
export function highlightXmlToHtml(xml) {
  const raw = String(xml ?? '')
  const parts = raw.split(/(<[^>]+>)/g)
  return parts
    .map((part) => {
      if (!part) return ''
      if (part.startsWith('<')) {
        return `<span class="xml-hl-tag">${escapeHtml(part)}</span>`
      }
      return `<span class="xml-hl-text">${escapeHtml(part)}</span>`
    })
    .join('')
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {{ changed: number, total: number }}
 */
export function countLineDiff(a, b) {
  const la = String(a ?? '').split('\n')
  const lb = String(b ?? '').split('\n')
  const n = Math.max(la.length, lb.length)
  let changed = 0
  for (let i = 0; i < n; i += 1) {
    if (la[i] !== lb[i]) changed += 1
  }
  return { changed, total: n }
}
