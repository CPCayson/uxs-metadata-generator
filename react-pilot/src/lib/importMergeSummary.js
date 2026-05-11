/**
 * Human-readable stats after merging imported XML into pilotState — avoids “silent” imports.
 *
 * @param {object | null | undefined} state Sanitized pilot state
 * @returns {{ summary: string, detail: string, populatedSteps: string[] }}
 */
export function summarizePilotImportPopulation(state) {
  if (!state || typeof state !== 'object') {
    return { summary: 'No state merged.', detail: '', populatedSteps: [] }
  }

  const m = state.mission && typeof state.mission === 'object' ? state.mission : {}
  const missionKeys = Object.keys(m).filter((k) => {
    const v = m[k]
    if (v == null) return false
    if (typeof v === 'string') return v.trim().length > 0
    if (typeof v === 'number' || typeof v === 'boolean') return true
    if (Array.isArray(v)) return v.length > 0
    if (typeof v === 'object') return Object.keys(v).length > 0
    return false
  })

  const sensors = Array.isArray(state.sensors) ? state.sensors : []
  const sensorRows = sensors.filter((s) => s && typeof s === 'object' && Object.keys(s).some((k) => String(s[k] ?? '').trim()))

  const kw = state.keywords && typeof state.keywords === 'object' ? state.keywords : {}
  const kwCounts = ['sciencekeywords', 'datacenters', 'platforms', 'instruments', 'locations', 'projects', 'providers'].map(
    (facet) => {
      const arr = Array.isArray(kw[facet]) ? kw[facet] : []
      const n = arr.filter((row) => row && (String(row.label || '').trim() || String(row.uuid || '').trim())).length
      return { facet, n }
    },
  )

  const sp = state.spatial && typeof state.spatial === 'object' ? state.spatial : {}
  const spatialKeys = Object.keys(sp).filter((k) => String(sp[k] ?? '').trim())

  const dist = state.distribution && typeof state.distribution === 'object' ? state.distribution : {}
  const distKeys = Object.keys(dist).filter((k) => String(dist[k] ?? '').trim())

  const populatedSteps = []
  if (missionKeys.length) populatedSteps.push(`Mission (${missionKeys.length} fields)`)
  if (sensorRows.length) populatedSteps.push(`Sensors (${sensorRows.length})`)
  const kwTotal = kwCounts.reduce((a, x) => a + x.n, 0)
  if (kwTotal) populatedSteps.push(`Keywords (${kwTotal} entries)`)
  if (spatialKeys.length) populatedSteps.push(`Spatial (${spatialKeys.length})`)
  if (distKeys.length) populatedSteps.push(`Distribution (${distKeys.length})`)

  const titleHint = typeof m.title === 'string' && m.title.trim() ? ` Title: “${m.title.trim().slice(0, 72)}${m.title.trim().length > 72 ? '…' : ''}”.` : ''

  const summary =
    populatedSteps.length > 0
      ? `Imported into ${populatedSteps.join(', ')}.${titleHint}`
      : 'Import merged but no obvious mission/spatial/keyword fields were filled — check that this file matches the active profile (e.g. UxS mission ISO).'

  const detail = [
    missionKeys.length ? `mission keys: ${missionKeys.slice(0, 12).join(', ')}${missionKeys.length > 12 ? '…' : ''}` : null,
    kwCounts.some((x) => x.n) ? `keywords: ${kwCounts.filter((x) => x.n).map((x) => `${x.facet} ${x.n}`).join(', ')}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return { summary, detail, populatedSteps }
}
