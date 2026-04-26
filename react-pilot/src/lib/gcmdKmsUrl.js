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
