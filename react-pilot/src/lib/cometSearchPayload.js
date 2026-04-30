/**
 * CoMET `GET /metadata/search?format=json` may return `metadata` as an array
 * or as an object (e.g. `{}` when empty). Normalize to an array of row objects.
 *
 * @param {unknown} parsed
 * @returns {Array<Record<string, unknown>>}
 */
export function metadataListFromCometSearchJson(parsed) {
  const m =
    parsed && typeof parsed === 'object' && 'metadata' in parsed
      ? /** @type {{ metadata?: unknown }} */ (parsed).metadata
      : undefined
  if (Array.isArray(m)) return m
  if (m && typeof m === 'object') {
    const vals = Object.values(m)
    if (!vals.length) return []
    return vals.every((v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v)) ? vals : []
  }
  return []
}
