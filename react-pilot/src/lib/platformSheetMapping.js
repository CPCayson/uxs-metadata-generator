/**
 * Maps legacy `getPlatforms()`-shaped rows ↔ React `pilotState.platform`,
 * and pilot platform ↔ `savePlatform()` payload (same JSON as historical GAS).
 */

/**
 * @param {Record<string, unknown> | null | undefined} obj
 * @param {string[]} keys
 * @returns {string}
 */
export function firstNonEmptyString(obj, keys) {
  for (const key of keys) {
    const raw = obj?.[key]
    if (raw === undefined || raw === null) continue
    const s = String(raw).trim()
    if (s) return s
  }
  return ''
}

/**
 * @param {Record<string, unknown> | null | undefined} obj
 * @param {string[]} keys
 * @returns {string}
 */
export function numberishString(obj, keys) {
  for (const key of keys) {
    const raw = obj?.[key]
    if (raw === undefined || raw === null || raw === '') continue
    const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
    if (Number.isFinite(n)) return n === 0 ? '' : String(n)
    const s = String(raw).trim()
    if (s) return s
  }
  return ''
}

/**
 * @param {Record<string, unknown>} row
 * @param {number} idx
 * @returns {string}
 */
export function platformRowKey(row, idx) {
  const idish = firstNonEmptyString(row, ['id', 'platformId', 'platform_id', 'code']) || `row_${idx + 1}`
  return `${idish}__${idx}`
}

/**
 * @param {Record<string, unknown>} row
 * @returns {Record<string, string>}
 */
export function mapPlatformRowToPilotPatch(row) {
  return {
    platformId: firstNonEmptyString(row, ['id', 'platformId', 'platform_id', 'code']),
    platformName: firstNonEmptyString(row, ['name', 'platformName', 'title', 'label']),
    platformType: firstNonEmptyString(row, ['type', 'platformType', 'gcmdType', 'platform_type']),
    platformDesc: firstNonEmptyString(row, ['comments', 'platformDesc', 'description', 'notes', 'abstract']),
    manufacturer: firstNonEmptyString(row, ['manufacturer', 'make', 'vendor', 'mfr']),
    model: firstNonEmptyString(row, ['model', 'modelName', 'model_id']),
    serialNumber: firstNonEmptyString(row, ['serialNumber', 'serial', 'sn']),
    weight: numberishString(row, ['weight']),
    length: numberishString(row, ['length']),
    width: numberishString(row, ['width']),
    height: numberishString(row, ['height']),
    powerSource: firstNonEmptyString(row, ['powerSource', 'power_source', 'power']),
    navigationSystem: firstNonEmptyString(row, ['navigationSystem', 'navigation', 'navSystem']),
    deploymentDate: firstNonEmptyString(row, ['deploymentDate', 'deployment_date']),
  }
}

/**
 * @param {unknown} v
 * @returns {number}
 */
function numOrZero(v) {
  const n = Number(String(v ?? '').trim())
  return Number.isFinite(n) ? n : 0
}

/**
 * Server `savePlatform(platform)` shape (legacy-compatible JSON).
 * @param {Record<string, unknown>} p - `pilotState.platform`
 * @returns {Record<string, unknown>}
 */
export function mapPilotPlatformToSavePlatform(p) {
  const id = String(p?.platformId ?? p?.id ?? '').trim()
  if (!id) {
    throw new Error('Platform ID is required to save to the library.')
  }
  const name = String(p?.platformName ?? '').trim() || id
  const type = String(p?.platformType ?? p?.customPlatformType ?? '').trim()
  return {
    id,
    name,
    type,
    manufacturer: String(p?.manufacturer ?? '').trim(),
    model: String(p?.model ?? '').trim(),
    weight: numOrZero(p?.weight),
    length: numOrZero(p?.length),
    width: numOrZero(p?.width),
    height: numOrZero(p?.height),
    powerSource: String(p?.powerSource ?? '').trim(),
    navigationSystem: String(p?.navigationSystem ?? '').trim(),
    comments: String(p?.platformDesc ?? '').trim(),
    serialNumber: String(p?.serialNumber ?? '').trim(),
    deploymentDate: String(p?.deploymentDate ?? '').trim(),
  }
}
