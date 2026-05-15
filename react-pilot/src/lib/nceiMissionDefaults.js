/**
 * NCEI collection-style defaults shared by import, sanitize, and Mission UI.
 *
 * @module lib/nceiMissionDefaults
 */

/** NCEI standard purpose string (not a copy of the abstract). */
export const NCEI_DEFAULT_MISSION_PURPOSE =
  'This data is available to the public for a wide variety of uses including scientific research and analysis.'

/** NCEI collection template `gmd:otherConstraints` — distribution liability (verbatim family). */
export const NCEI_DEFAULT_DISTRIBUTION_LIABILITY =
  'Distribution liability: NOAA and NCEI make no warranty, expressed or implied, regarding these data, nor does the fact of distribution constitute such a warranty. NOAA and NCEI cannot assume liability for any damages caused by any errors or omissions in these data. If appropriate, NCEI can only certify that the data it distributes are an authentic copy of the records that were accepted for inclusion in the NCEI archives.'

/** NCEI collection template `gmd:otherConstraints` — use liability (secondary citation / use note). */
export const NCEI_DEFAULT_USE_LIABILITY =
  'Use liability: NOAA and NCEI cannot provide any warranty as to the accuracy, reliability, or completeness of furnished data. Users assume responsibility to determine the usability of these data. The user is responsible for the results of any application of this data for other than its intended purpose'

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
