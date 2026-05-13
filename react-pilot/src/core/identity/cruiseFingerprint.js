/**
 * cruiseFingerprint — deterministic identity for cruise / mission entities.
 *
 * Normalizes raw identifiers so fragments from different sources can be matched
 * to the same logical record (Reverse Paper Shredder layer).
 *
 * @module core/identity/cruiseFingerprint
 */

/** Longest-first so `gov.noaa.ncei.oer:` wins over `gov.noaa.ncei:`. */
const PREFIXES = [
  'gov.noaa.ncei.oer:',
  'gov.noaa.ncei.uxs:',
  'gov.noaa.ncei:',
  'gov.noaa.nodc:',
  'gov.noaa.nmfs.inport:',
  'gov.noaa.',
]

const SEGMENT_SUFFIXES = [/_VID_.*$/, /_DIV_.*$/, /_TAPE.*$/, /_SEG.*$/, /_DIVE_.*$/i]

/**
 * @param {unknown} raw
 * @returns {string|null}
 */
export function normalizeCruiseId(raw) {
  if (raw == null || typeof raw !== 'string') return null

  let s = raw.trim()
  if (!s) return null

  const lower = s.toLowerCase()
  for (const prefix of PREFIXES) {
    if (lower.startsWith(prefix.toLowerCase())) {
      s = s.slice(prefix.length)
      break
    }
  }

  for (const pattern of SEGMENT_SUFFIXES) {
    s = s.replace(pattern, '')
  }

  s = s
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (!s) return null

  return `cruise:${s}`
}

/**
 * @param {object | null | undefined} mission — pilotState.mission or equivalent
 * @returns {string|null}
 */
export function fingerprintFromMission(mission) {
  if (!mission || typeof mission !== 'object') return null

  const candidates = [
    mission.fileId,
    mission.missionId,
    mission.fileIdentifier,
    mission.cruiseId,
    mission.alternateTitle,
    mission.accession,
    mission.doi,
  ]

  for (const candidate of candidates) {
    const fp = normalizeCruiseId(candidate)
    if (fp) return fp
  }

  if (mission.title) {
    const titleKey = String(mission.title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40)
    if (titleKey) return `cruise:title-${titleKey}`
  }

  return null
}

/**
 * Stamp `entityFingerprint` onto every fragment in an array (mutates in place).
 *
 * @param {import('../fragments/MetadataFragment.js').MetadataFragment[]} fragments
 * @returns {import('../fragments/MetadataFragment.js').MetadataFragment[]}
 */
export function stampFingerprints(fragments) {
  if (!Array.isArray(fragments) || fragments.length === 0) return fragments

  const identifierPaths = [
    'mission.fileId',
    'mission.missionId',
    'mission.fileIdentifier',
    'mission.cruiseId',
    'mission.alternateTitle',
    'mission.accession',
    'mission.doi',
    'mission.title',
  ]

  let fingerprint = null

  for (const path of identifierPaths) {
    const frag = fragments.find((f) => f.fieldPath === path && f.value != null && String(f.value).trim() !== '')
    if (frag) {
      if (path === 'mission.title') {
        const titleKey = String(frag.value)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 40)
        fingerprint = titleKey ? `cruise:title-${titleKey}` : null
      } else {
        fingerprint = normalizeCruiseId(String(frag.value))
      }
      if (fingerprint) break
    }
  }

  const stamp = fingerprint ?? 'cruise:unknown'
  for (const frag of fragments) {
    frag.entityFingerprint = stamp
  }

  return fragments
}
