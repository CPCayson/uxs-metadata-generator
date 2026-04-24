/**
 * Detect whether `sessionStorage` pilot payload matches a BEDI profile shape
 * (avoid merging mission-shaped state into BEDI wizards).
 *
 * @module profiles/bedi/bediSessionGuards
 */

/**
 * @param {object} p
 * @returns {boolean}
 */
export function sessionLooksLikeBediCollection(p) {
  if (!p || typeof p !== 'object') return false
  if (p.mission && typeof p.mission === 'object' && Object.keys(p.mission).length) return false
  return String(p.hierarchyLevel || '') === 'fieldSession'
}

/**
 * @param {object} p
 * @returns {boolean}
 */
export function sessionLooksLikeBediGranule(p) {
  if (!p || typeof p !== 'object') return false
  if (p.mission && typeof p.mission === 'object' && Object.keys(p.mission).length) return false
  return String(p.hierarchyLevel || '') === 'dataset' && String(p.parentCollectionId || '').trim() !== ''
}
