/**
 * Match XML-imported / partial pilot sensors to Postgres library rows and merge canonical fields.
 *
 * @param {Record<string, unknown>} sensor
 * @param {Array<Record<string, unknown>>} libraryRows
 * @returns {Record<string, unknown> | null}
 */
export function findSensorLibraryMatch(sensor, libraryRows) {
  if (!sensor || !Array.isArray(libraryRows) || libraryRows.length === 0) return null
  const sid = String(sensor.sensorId ?? sensor.id ?? '').trim().toLowerCase()
  const model = String(sensor.modelId ?? sensor.model ?? '').trim().toLowerCase()
  const typ = String(sensor.type ?? '').trim().toLowerCase()
  const variable = String(sensor.variable ?? '').trim().toLowerCase()
  const hay = [sid, model, typ, variable].filter(Boolean).join(' ')

  for (const r of libraryRows) {
    const rid = String(r.id ?? r.sensorId ?? '').trim().toLowerCase()
    const rmodel = String(r.model ?? r.modelId ?? '').trim().toLowerCase()
    const rtype = String(r.type ?? r.sensorType ?? '').trim().toLowerCase()
    const rvar = String(r.observedVariable ?? r.observed_variable ?? '').trim().toLowerCase()

    if (sid && rid && sid === rid) return r
    if (sid && rid && (sid.includes(rid) || rid.includes(sid))) return r
    if (model && rmodel && (model === rmodel || model.includes(rmodel) || rmodel.includes(model))) return r
    if (rtype && hay && (hay.includes(rtype) || rtype.includes(variable) || variable.includes(rtype))) return r
    if (rid && hay && (hay.includes(rid) || rid.includes(typ) || rid.includes(model))) return r
    if (rvar && variable && (variable.includes(rvar) || rvar.includes(variable))) return r
  }
  return null
}

/**
 * Thicken `partial.sensors` using DB library rows (name / model / type match).
 *
 * @param {object} partial
 * @param {Array<Record<string, unknown>>} libraryRows
 * @returns {object}
 */
export function enrichPartialSensorsFromLibrary(partial, libraryRows) {
  if (!partial || typeof partial !== 'object' || !Array.isArray(libraryRows) || libraryRows.length === 0) {
    return partial
  }
  const sensors = partial.sensors
  if (!Array.isArray(sensors) || sensors.length === 0) return partial

  const nextSensors = sensors.map((s) => {
    if (!s || typeof s !== 'object') return s
    const match = findSensorLibraryMatch(/** @type {Record<string, unknown>} */ (s), libraryRows)
    if (!match) return s
    const canonType = String(match.type ?? '').trim()
    const canonModel = String(match.model ?? '').trim()
    const canonVar = String(match.observedVariable ?? match.observed_variable ?? '').trim()
    return {
      ...s,
      type: canonType || String(s.type ?? '').trim(),
      modelId: canonModel || String(s.modelId ?? '').trim(),
      variable: canonVar || String(s.variable ?? '').trim(),
      sensorId: String(s.sensorId ?? match.id ?? '').trim() || String(match.id ?? '').trim(),
      firmware: String(s.firmware ?? match.firmware ?? '').trim(),
      fromSensorLibrary: true,
    }
  })
  return { ...partial, sensors: nextSensors }
}
