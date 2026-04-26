/**
 * Optional XPath string attached to validation issues (ISO preview / tools).
 * Passthrough if already set; no-op for missing XML mapping.
 *
 * @param {string} [xpath]
 * @returns {string|undefined}
 */
export function previewMetadataXPath(xpath) {
  if (xpath == null) return undefined
  const s = String(xpath).trim()
  return s || undefined
}
