/**
 * Collect text-bearing XML leaves with ancestor paths (localName + sibling index when repeated).
 * Used to compare original ISO XML vs preview export without requiring an XSD.
 */

/** @param {import('@xmldom/xmldom').Element | import('@xmldom/xmldom').Document | null} el */
export function xmlTextDeep(el) {
  if (!el) return ''
  if (el.nodeType === 3) return String(el.data || '')
  if (el.nodeType === 4) return String(el.data || '')
  let s = ''
  const nodes = el.childNodes || []
  for (let i = 0; i < nodes.length; i += 1) s += xmlTextDeep(nodes[i])
  return s
}

/** @param {string} s */
export function isPlaceholderLeaf(s) {
  const t = String(s).trim()
  if (!t) return true
  if (/^\{\{[\s\S]*\}\}$/.test(t)) return true
  if (/\{\{[^}]+\}\}/.test(t)) return true
  return false
}

/**
 * @param {import('@xmldom/xmldom').Element} el
 * @returns {import('@xmldom/xmldom').Element[]}
 */
function elementChildren(el) {
  const out = []
  const nodes = el.childNodes || []
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    if (n && n.nodeType === 1) out.push(/** @type {import('@xmldom/xmldom').Element} */ (n))
  }
  return out
}

/**
 * Walk tree; at elements with **no element children**, record trimmed text (CDATA/text nodes only).
 * @param {import('@xmldom/xmldom').Element} el
 * @param {string[]} segments
 * @param {Array<{ path: string, text: string }>} acc
 * @param {{ maxTextLen: number }} opts
 */
function walkLeaves(el, segments, acc, opts) {
  const kids = elementChildren(el)
  if (kids.length === 0) {
    let t = xmlTextDeep(el).replace(/\s+/g, ' ').trim()
    if (t.length > opts.maxTextLen) t = `${t.slice(0, opts.maxTextLen)}…`
    if (!t || isPlaceholderLeaf(t)) return
    acc.push({ path: segments.join('/'), text: t })
    return
  }

  const nameFreq = {}
  for (const c of kids) {
    const ln = c.localName || c.tagName || 'element'
    nameFreq[ln] = (nameFreq[ln] || 0) + 1
  }
  const seen = {}
  for (const c of kids) {
    const ln = c.localName || c.tagName || 'element'
    seen[ln] = (seen[ln] || 0) + 1
    const idx = seen[ln]
    const seg = nameFreq[ln] > 1 ? `${ln}[${idx}]` : ln
    walkLeaves(c, [...segments, seg], acc, opts)
  }
}

/**
 * @param {import('@xmldom/xmldom').Document} doc
 * @param {{ maxTextLen?: number }} [options]
 * @returns {Array<{ path: string, text: string }>}
 */
export function collectXmlLeafEntries(doc, options = {}) {
  const maxTextLen = options.maxTextLen ?? 4000
  const root = doc.documentElement
  if (!root) return []
  const acc = []
  const ln = root.localName || root.tagName || 'root'
  walkLeaves(root, [ln], acc, { maxTextLen })
  return acc
}

/** @param {Array<{ path: string, text: string }>} entries */
export function multisetFromEntries(entries) {
  /** @type {Map<string, number>} */
  const m = new Map()
  for (const e of entries) {
    const k = `${e.path}\t${e.text}`
    m.set(k, (m.get(k) || 0) + 1)
  }
  return m
}

/**
 * @param {Map<string, number>} original
 * @param {Map<string, number>} preview
 */
export function diffLeafMultisets(original, preview) {
  /** @type {Array<{ fingerprint: string, path: string, text: string, onlyIn: 'original' | 'preview', count: number }>} */
  const rows = []
  const keys = new Set([...original.keys(), ...preview.keys()])
  for (const k of keys) {
    const co = original.get(k) || 0
    const cp = preview.get(k) || 0
    if (co === cp) continue
    const tab = k.indexOf('\t')
    const pathPart = tab >= 0 ? k.slice(0, tab) : k
    const textPart = tab >= 0 ? k.slice(tab + 1) : ''
    if (co > cp) {
      rows.push({
        fingerprint: k,
        path: pathPart,
        text: textPart.length > 500 ? `${textPart.slice(0, 497)}…` : textPart,
        onlyIn: 'original',
        count: co - cp,
      })
    }
    if (cp > co) {
      rows.push({
        fingerprint: k,
        path: pathPart,
        text: textPart.length > 500 ? `${textPart.slice(0, 497)}…` : textPart,
        onlyIn: 'preview',
        count: cp - co,
      })
    }
  }
  rows.sort((a, b) => a.path.localeCompare(b.path) || a.text.localeCompare(b.text) || a.onlyIn.localeCompare(b.onlyIn))
  return rows
}
