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
 * @param {string} qname
 * @param {'element' | 'attr'} role
 */
function highlightQNameParts(qname, role) {
  const colon = qname.indexOf(':')
  const nsClass = role === 'attr' ? 'xml-hl-attr-ns' : 'xml-hl-ns'
  const localClass = role === 'attr' ? 'xml-hl-attr-local' : 'xml-hl-name'
  if (colon === -1) {
    return `<span class="${localClass}">${escapeHtml(qname)}</span>`
  }
  return `<span class="${nsClass}">${escapeHtml(qname.slice(0, colon))}</span><span class="xml-hl-colon">:</span><span class="${localClass}">${escapeHtml(qname.slice(colon + 1))}</span>`
}

/**
 * @param {string} attrPart
 */
function highlightAttributes(attrPart) {
  const s = attrPart
  let i = 0
  let out = ''
  const len = s.length
  while (i < len) {
    while (i < len && /\s/.test(s[i])) {
      out += s[i]
      i++
    }
    if (i >= len) break
    const nameStart = i
    while (i < len && /[\w:.-]/.test(s[i])) i++
    if (nameStart === i) {
      out += escapeHtml(s.slice(i))
      break
    }
    const attrName = s.slice(nameStart, i)
    while (i < len && /\s/.test(s[i])) i++
    if (i >= len || s[i] !== '=') {
      out += escapeHtml(s.slice(nameStart))
      break
    }
    i++
    while (i < len && /\s/.test(s[i])) i++
    const quote = s[i]
    if (quote !== '"' && quote !== "'") {
      out += escapeHtml(s.slice(nameStart))
      break
    }
    i++
    const valStart = i
    while (i < len && s[i] !== quote) i++
    const val = s.slice(valStart, i)
    if (i >= len) {
      out += escapeHtml(s.slice(nameStart))
      break
    }
    i++

    out += highlightQNameParts(attrName, 'attr')
    out += '<span class="xml-hl-equals">=</span>'
    out += `<span class="xml-hl-quote">${escapeHtml(quote)}</span>`
    out += `<span class="xml-hl-string">${escapeHtml(val)}</span>`
    out += `<span class="xml-hl-quote">${escapeHtml(quote)}</span>`
  }
  return out
}

/**
 * @param {string} tag — includes `<` … `>` or `/>`
 */
function highlightStandardTag(tag) {
  const trimmedEnd = tag.trimEnd()
  const selfClosing = trimmedEnd.endsWith('/>')
  let inner = tag.slice(1, selfClosing ? -2 : -1).trim()

  let closing = false
  if (inner.startsWith('/')) {
    closing = true
    inner = inner.slice(1).trim()
  }

  const nameMatch = inner.match(/^([\w:.-]+)/)
  if (!nameMatch) {
    return `<span class="xml-hl-fallback">${escapeHtml(tag)}</span>`
  }

  const qname = nameMatch[1]
  const attrPart = inner.slice(qname.length)

  const lt = '<span class="xml-hl-bracket">&lt;</span>'
  const slashClose = closing ? '<span class="xml-hl-bracket">/</span>' : ''
  const nameHtml = highlightQNameParts(qname, 'element')
  const attrsHtml = closing ? '' : highlightAttributes(attrPart)
  const gtInner = selfClosing ? '/' : ''
  const gt = `<span class="xml-hl-bracket">${gtInner}&gt;</span>`

  return `${lt}${slashClose}${nameHtml}${attrsHtml}${gt}`
}

/**
 * @param {string} tag
 */
function highlightTagToken(tag) {
  const t = tag.trim()
  if (t.startsWith('<!--')) {
    return `<span class="xml-hl-comment">${escapeHtml(tag)}</span>`
  }
  if (t.startsWith('<![CDATA[')) {
    return `<span class="xml-hl-cdata">${escapeHtml(tag)}</span>`
  }
  if (t.startsWith('<?')) {
    return `<span class="xml-hl-decl">${escapeHtml(tag)}</span>`
  }
  return highlightStandardTag(tag)
}

/**
 * Lightweight XML-ish highlighting (split on tags); namespaces, attrs, strings colored.
 * @param {string} xml
 * @returns {string} HTML (safe if `xml` is trusted preview output)
 */
export function highlightXmlToHtml(xml) {
  const raw = String(xml ?? '')
  const parts = raw.split(/(<[^>]+>)/g)
  return parts
    .map((part) => {
      if (!part) return ''
      if (part.startsWith('<')) return highlightTagToken(part)
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
