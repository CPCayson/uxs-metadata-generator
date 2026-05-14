/**
 * NCEI collection-style defaults shared by import, sanitize, and Mission UI.
 *
 * @module lib/nceiMissionDefaults
 */

/** NCEI standard purpose string (not a copy of the abstract). */
export const NCEI_DEFAULT_MISSION_PURPOSE =
  'This data is available to the public for a wide variety of uses including scientific research and analysis.'

/**
 * @param {string} rawPurpose
 * @param {string} abstractText
 * @returns {string}
 */
export function resolveMissionPurposeForNcei(rawPurpose, abstractText) {
  const raw = String(rawPurpose ?? '').trim()
  const abs = String(abstractText ?? '').trim()
  const absHead = abs.slice(0, 60)
  if (!raw || raw === abs || (abs && raw.startsWith(absHead))) {
    return NCEI_DEFAULT_MISSION_PURPOSE
  }
  return raw
}
