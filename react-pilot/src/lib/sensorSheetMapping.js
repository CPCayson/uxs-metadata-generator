/**
 * Maps `getSensors()` / `saveSensor` DB rows ↔ React `pilotState.sensors[]` cards.
 */

import { SENSOR_XML_OPTIONAL_DEFAULTS } from './sensorInstrumentDescription.js'

/**
 * @param {Record<string, unknown>} row
 * @param {{ fromLibrary?: boolean, index?: number }} [opts]
 * @returns {Record<string, unknown>}
 */
export function mapDbSensorRowToPilotSensor(row, opts = {}) {
  const fromLibrary = Boolean(opts.fromLibrary)
  const i = typeof opts.index === 'number' ? opts.index : 0
  /** @type {Record<string, string>} */
  const optional = { ...SENSOR_XML_OPTIONAL_DEFAULTS }
  for (const k of Object.keys(SENSOR_XML_OPTIONAL_DEFAULTS)) {
    const v = row[k]
    if (v !== undefined && v !== null && String(v).trim()) optional[k] = String(v)
  }
  const base = {
    localId: `sen_${Date.now()}_${i}`,
    sensorId: String(row.id ?? row.sensorId ?? '').trim(),
    type: String(row.type ?? row.sensorType ?? '').trim(),
    modelId: String(row.model ?? row.modelId ?? '').trim(),
    variable: String(row.observedVariable ?? row.observed_variable ?? row.variable ?? '').trim(),
    firmware: String(row.firmware ?? '').trim(),
    ...optional,
  }
  if (fromLibrary) base.fromSensorLibrary = true
  return base
}

/**
 * Pilot sensor card → `saveSensorsBatch` / `saveSensor` payload (normalized server-side).
 * @param {Record<string, unknown>} s
 * @param {{ platformId?: string }} [ctx]
 * @returns {Record<string, unknown>}
 */
export function mapPilotSensorToSavePayload(s, ctx = {}) {
  const id = String(s?.sensorId ?? s?.id ?? '').trim()
  if (!id) throw new Error('Sensor id is required to save to the library.')
  const platformId = String(ctx.platformId ?? '').trim()
  const observed = String(s?.variable ?? '').trim()
  return {
    id,
    type: String(s?.type ?? '').trim(),
    model: String(s?.modelId ?? s?.model ?? '').trim(),
    firmware: String(s?.firmware ?? '').trim(),
    manufacturer: String(s?.manufacturer ?? '').trim(),
    observed_variable: observed,
    platform_id: platformId,
    operationMode: String(s?.operationMode ?? '').trim(),
    uncertainty: String(s?.uncertainty ?? '').trim(),
    frequency: String(s?.frequency ?? '').trim(),
    beamCount: s?.beamCount ?? '',
    depthRating: String(s?.depthRating ?? '').trim(),
    confidenceInterval: String(s?.confidenceInterval ?? '').trim(),
    notes: String(s?.description ?? '').trim(),
  }
}
