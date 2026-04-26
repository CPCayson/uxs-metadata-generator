/**
 * Set a dot-path on pilot state (supports `sensors.0.modelId` array indices).
 *
 * @param {object} state
 * @param {string} field
 * @param {unknown} value
 * @returns {object} shallow/deep cloned next state
 */
export function setPilotFieldPath(state, field, value) {
  const parts = String(field).split('.').map((p) => p.trim()).filter(Boolean)
  if (!parts.length) throw new Error('Empty field path')

  const next =
    typeof structuredClone === 'function'
      ? structuredClone(state)
      : JSON.parse(JSON.stringify(state))

  let cur = next
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    const isIndex = /^\d+$/.test(key)
    if (isIndex) {
      const idx = parseInt(key, 10)
      if (!Array.isArray(cur)) {
        throw new Error(`Path ${parts.slice(0, i + 1).join('.')}: not an array`)
      }
      while (cur.length <= idx) {
        cur.push({})
      }
      if (cur[idx] == null || typeof cur[idx] !== 'object') {
        cur[idx] = /^\d+$/.test(parts[i + 1]) ? [] : {}
      }
      cur = cur[idx]
    } else {
      if (cur[key] == null || typeof cur[key] !== 'object') {
        const nextKey = parts[i + 1]
        cur[key] = nextKey && /^\d+$/.test(nextKey) ? [] : {}
      }
      cur = cur[key]
    }
  }

  const last = parts[parts.length - 1]
  if (/^\d+$/.test(last)) {
    const idx = parseInt(last, 10)
    if (!Array.isArray(cur)) throw new Error('Expected array for final index segment')
    while (cur.length <= idx) cur.push(null)
    cur[idx] = value
  } else {
    cur[last] = value
  }
  return next
}
