/** NCEI UxS template default prefix for `gmd:fileIdentifier` (see USX V4 / Navy template). */
export const NCEI_UXS_FILE_ID_PREFIX = 'gov.noaa.ncei.uxs:'

/**
 * @param {string} raw from `gmd:fileIdentifier`
 * @returns {{ fileId: string, hadNceiUxsPrefix: boolean }}
 */
export function parseNceiUxsFileIdentifier(raw) {
  const s = String(raw || '').trim()
  if (!s) return { fileId: '', hadNceiUxsPrefix: false }
  if (s.startsWith(NCEI_UXS_FILE_ID_PREFIX)) {
    const rest = s.slice(NCEI_UXS_FILE_ID_PREFIX.length).trim()
    return { fileId: rest || s, hadNceiUxsPrefix: true }
  }
  return { fileId: s, hadNceiUxsPrefix: false }
}

/**
 * @param {string} fileId mission / editor value (usually without prefix)
 * @param {object} dist `state.distribution`
 * @returns {string} value for `gco:CharacterString` under `gmd:fileIdentifier`
 */
export function formatNceiUxsFileIdentifierForXml(fileId, dist) {
  const raw = String(fileId || '').trim()
  if (!raw) return ''
  if (dist?.nceiFileIdPrefix === false || dist?.nceiFileIdPrefix === 'false') return raw
  if (raw.startsWith(NCEI_UXS_FILE_ID_PREFIX)) return raw
  return `${NCEI_UXS_FILE_ID_PREFIX}${raw}`
}
