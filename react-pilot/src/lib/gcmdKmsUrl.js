/**
 * GCMD Keyword Management System (KMS) concept URL for a given UUID.
 *
 * @param {string} uuid
 * @returns {string}
 */
export function gcmdConceptUrlFromUuid(uuid) {
  const u = String(uuid || '').trim().toLowerCase()
  if (!/^[0-9a-f-]{36}$/i.test(u)) return ''
  return `https://gcmd.earthdata.nasa.gov/kms/concept/${u}`
}

/**
 * Earthdata Search query for a free-text GCMD keyword lookup (no UUID).
 *
 * @param {string} label
 * @returns {string}
 */
export function earthdataSearchUrlForGcmdKeyword(label) {
  const q = String(label || '').trim()
  if (!q) return ''
  return `https://search.earthdata.nasa.gov/search?q=${encodeURIComponent(`${q} GCMD keyword`)}`
}
