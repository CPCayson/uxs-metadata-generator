/**
 * Lightweight XML template hygiene checks.
 *
 * Designed to catch common unresolved-template artifacts before expensive
 * resolver/validation calls (e.g. {{placeholders}}, malformed braces,
 * and xlink href placeholders wrapped in template braces).
 *
 * @module lib/xmlTemplateHygiene
 */

/**
 * @param {string} xml
 * @returns {{ ok: boolean, issues: string[], warnings: string[] }}
 */
export function checkXmlTemplateHygiene(xml) {
  const text = String(xml || '')
  /** @type {string[]} */
  const issues = []
  /** @type {string[]} */
  const warnings = []

  const unresolvedPlaceholders = text.match(/\{\{[^{}]+\}\}/g) ?? []
  if (unresolvedPlaceholders.length > 0) {
    issues.push(`Found ${unresolvedPlaceholders.length} unresolved template placeholder(s) like {{...}}.`)
  }

  // Common malformed token found in hand-edited templates: "{TOKEN}}"
  const malformedBraceTokens = text.match(/\{[^{}\n]+\}\}/g) ?? []
  if (malformedBraceTokens.length > 0) {
    issues.push(`Found ${malformedBraceTokens.length} malformed brace token(s) like {token}}.`)
  }

  const wrappedDocucompHref = text.match(/xlink:href="\{\{https?:\/\/[^"]+\}\}"/gi) ?? []
  if (wrappedDocucompHref.length > 0) {
    issues.push(`Found ${wrappedDocucompHref.length} xlink href value(s) wrapped in template braces.`)
  }

  const placeholderDate = text.match(/>\s*\{\{[0-9]{4}-[0-9]{2}-[0-9]{2}/g) ?? []
  if (placeholderDate.length > 0) {
    warnings.push(`Date fields appear templated in ${placeholderDate.length} location(s).`)
  }

  return { ok: issues.length === 0, issues, warnings }
}

/**
 * Apply deterministic, low-risk XML template repairs before external validation.
 *
 * Repairs:
 * - unwrap `xlink:href="{{https://...}}"` -> `xlink:href="https://..."`
 * - normalize malformed single-open/double-close token `{TOKEN}}` -> `{{TOKEN}}`
 * - trim extra whitespace around placeholder braces `{{ value }}` -> `{{value}}`
 *
 * @param {string} xml
 * @returns {{ xml: string, fixes: string[] }}
 */
export function applySafeXmlTemplateFixes(xml) {
  let next = String(xml || '')
  /** @type {string[]} */
  const fixes = []

  const beforeHrefWrapped = (next.match(/xlink:href="\{\{https?:\/\/[^"]+\}\}"/gi) ?? []).length
  if (beforeHrefWrapped > 0) {
    next = next.replace(/xlink:href="\{\{(https?:\/\/[^"}]+)\}\}"/gi, 'xlink:href="$1"')
    fixes.push(`Unwrapped ${beforeHrefWrapped} xlink href value(s) from template braces.`)
  }

  const malformedBraceTokens = (next.match(/\{[^{}\n]+\}\}/g) ?? []).length
  if (malformedBraceTokens > 0) {
    next = next.replace(/\{([^{}\n]+)\}\}/g, '{{$1}}')
    fixes.push(`Normalized ${malformedBraceTokens} malformed brace token(s) to {{token}} form.`)
  }

  const spacedPlaceholders = (next.match(/\{\{\s+[^{}]*?\s+\}\}/g) ?? []).length
  if (spacedPlaceholders > 0) {
    next = next.replace(/\{\{\s*([^{}]*?)\s*\}\}/g, '{{$1}}')
    fixes.push(`Trimmed whitespace in ${spacedPlaceholders} placeholder token(s).`)
  }

  return { xml: next, fixes }
}

