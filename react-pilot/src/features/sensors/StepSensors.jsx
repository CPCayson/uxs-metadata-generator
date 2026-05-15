import { useCallback, useEffect, useState } from 'react'
import {
  SENSOR_XML_EXTRA_FIELD_LABELS,
  SENSOR_XML_OPTIONAL_DEFAULTS,
  acquisitionInstrumentHasContent,
} from '../../lib/sensorInstrumentDescription.js'
import { mapDbSensorRowToPilotSensor, mapPilotSensorToSavePayload } from '../../lib/sensorSheetMapping.js'
import { useFieldValidation } from '../../components/fields/useFieldValidation'
import { useMetadataEngine } from '../../shell/context.js'

const SENSOR_TYPES = [
  'Earth Remote Sensing Instruments',
  'Spectral/Engineering',
  'In Situ/Laboratory Instruments',
  'Earth Science Services',
  'Other',
]

/**
 * @param {{
 *   sensors: Array<object>,
 *   onSetSensors: (next: Array<object>) => void,
 *   touched: Record<string, boolean>,
 *   onTouched: (key: string) => void,
 *   showAllErrors: boolean,
 *   issues: Array<{ field: string, message: string }>,
 *   platform?: object,
 *   libraryKitContributionSuggested?: boolean,
 *   onSavePlatformKitToLibrary?: () => void | Promise<void>,
 *   platformSaveBusy?: boolean,
 * }} props
 */
export default function StepSensors({
  sensors,
  onSetSensors,
  touched,
  onTouched,
  showAllErrors,
  issues,
  platform = {},
  libraryKitContributionSuggested = false,
  onSavePlatformKitToLibrary,
  platformSaveBusy = false,
}) {
  const { hostBridge } = useMetadataEngine()
  const { show: showField } = useFieldValidation({ issues, touched, showAllErrors })

  // ── Sensor library (Postgres /api/db) ───────────────────────────────────
  const [libraryRows,    setLibraryRows]    = useState([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [libraryError,   setLibraryError]   = useState('')
  const [saveBusy,       setSaveBusy]       = useState(false)
  const [saveStatus,     setSaveStatus]     = useState('')

  const hostBridgeReady = hostBridge.isAvailable()

  const loadLibrary = useCallback(async () => {
    if (!hostBridgeReady) return
    setLibraryLoading(true)
    setLibraryError('')
    try {
      const res = await hostBridge.listSensors()
      setLibraryRows(res.unexpectedShape ? [] : res.rows)
      if (res.unexpectedShape) setLibraryError('Unexpected shape from getSensors — check server function.')
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : 'Failed to load sensor library.')
    } finally {
      setLibraryLoading(false)
    }
  }, [hostBridge, hostBridgeReady])

  useEffect(() => { loadLibrary() }, [loadLibrary])

  function applyFromLibrary(row) {
    if (!row) return
    onSetSensors([...sensors, mapDbSensorRowToPilotSensor(row, { fromLibrary: true, index: sensors.length })])
  }

  async function saveCurrentSensorsToSheets() {
    if (!hostBridgeReady || !sensors.length) return
    const platformId = String(platform?.platformId ?? '').trim()
    /** @type {Array<Record<string, unknown>>} */
    const batch = []
    for (const s of sensors) {
      if (!acquisitionInstrumentHasContent(s)) continue
      try {
        batch.push(mapPilotSensorToSavePayload(s, { platformId }))
      } catch {
        /* rows without a sensor id cannot be upserted */
      }
    }
    if (!batch.length) {
      setSaveStatus('Add a sensor ID on each row you want to save to the library.')
      return
    }
    setSaveBusy(true)
    setSaveStatus('')
    try {
      await hostBridge.saveSensorsBatch(batch)
      setSaveStatus(`Saved ${batch.length} sensor${batch.length !== 1 ? 's' : ''} to the library.`)
      await loadLibrary()
    } catch (err) {
      setSaveStatus(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSaveBusy(false)
    }
  }

  function addSensor() {
    onSetSensors([
      ...sensors,
      {
        localId: `sen_${Date.now()}`,
        sensorId: '',
        type: '',
        modelId: '',
        variable: '',
        firmware: '',
        ...SENSOR_XML_OPTIONAL_DEFAULTS,
      },
    ])
  }

  function removeSensor(idx) {
    onSetSensors(sensors.filter((_, i) => i !== idx))
  }

  function patchSensor(idx, patch) {
    onSetSensors(sensors.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }

  return (
    <>
      <p className="card-intro">
        <strong>Acquisition instruments and observed variables</strong> — at least one active sensor is required. Empty
        rows are ignored.
      </p>
      {showField('sensors') ? <p className="field-error">{showField('sensors')}</p> : null}

      {/* ── Sensor library panel (mirrors Platform pattern) ─────────── */}
      {libraryKitContributionSuggested && hostBridgeReady ? (
        <div className="library-kit-contribution-callout" role="status">
          <p className="library-kit-contribution-callout__text">
            <strong>Strict validation is clean.</strong> Save the full platform + sensor kit from the Platform step, or use the button below.
          </p>
          <button
            type="button"
            className="button button-tiny"
            disabled={platformSaveBusy}
            onClick={() => void onSavePlatformKitToLibrary?.()}
          >
            {platformSaveBusy ? 'Saving…' : 'Save platform & sensors to library'}
          </button>
        </div>
      ) : null}

      {hostBridgeReady && (
        <section className="library-panel">
          <div className="library-panel-header">
            <h3 className="library-panel-title">Sensor Library</h3>
            <div className="library-panel-actions">
              <button
                type="button"
                className="button button-secondary button-tiny"
                onClick={loadLibrary}
                disabled={libraryLoading}
              >
                {libraryLoading ? 'Loading…' : '↻ Refresh'}
              </button>
              <button
                type="button"
                className={`button button-secondary button-tiny${libraryKitContributionSuggested ? ' library-kit-save-suppressed' : ''}`}
                onClick={saveCurrentSensorsToSheets}
                disabled={saveBusy || !sensors.length}
                aria-busy={saveBusy}
              >
                {saveBusy ? 'Saving…' : '↑ Save to library'}
              </button>
            </div>
          </div>
          {libraryError && <p className="field-error">{libraryError}</p>}
          {saveStatus && <p className="hint">{saveStatus}</p>}
          {libraryRows.length > 0 && (
            <div className="library-rows">
              {libraryRows.map((row, i) => {
                const label = [row.sensorId ?? row.id, row.modelId ?? row.model, row.type ?? row.sensorType]
                  .filter(Boolean).join(' · ')
                return (
                  <div key={row.sensorId ?? row.id ?? i} className="library-row">
                    <span className="library-row-label">{label || `Sensor ${i + 1}`}</span>
                    <button
                      type="button"
                      className="button button-secondary button-tiny"
                      onClick={() => applyFromLibrary(row)}
                    >
                      + Add
                    </button>
                  </div>
                )
              })}
            </div>
          )}
          {!libraryLoading && libraryRows.length === 0 && !libraryError && (
            <p className="hint">No sensors in library yet. Save sensors above to populate it.</p>
          )}
        </section>
      )}

      {sensors.map((sen, idx) => {
        const pfx = `sensors[${idx}]`
        const fType = `${pfx}.type`
        const fModel = `${pfx}.modelId`
        const fVar = `${pfx}.variable`
        const show = showField
        function inv(f) { return Boolean(show(f)) }
        return (
          <section key={sen.localId || idx} className="sensor-card panel">
            <div className="sensor-card-head">
              <h3 className="panel-title">Sensor {idx + 1}</h3>
              <div className="sensor-card-head-actions">
                {sen.fromSensorLibrary ? (
                  <span className="sensor-library-asset-badge" title="Fields aligned with a Postgres sensor library row">
                    Library asset
                  </span>
                ) : null}
                <button type="button" className="button button-secondary button-tiny" onClick={() => removeSensor(idx)}>
                  Remove
                </button>
              </div>
            </div>
            <label htmlFor={`${pfx}-sid`}>Sensor ID</label>
            <input
              id={`${pfx}-sid`}
              data-pilot-field={`sensors[${idx}].modelId`}
              className="form-control"
              value={sen.sensorId || ''}
              onChange={(e) => patchSensor(idx, { sensorId: e.target.value })}
            />

            <label htmlFor={`${pfx}-type`}>Type</label>
            <input
              id={`${pfx}-type`}
              list={`${pfx}-type-list`}
              data-pilot-field={`sensors[${idx}].type`}
              className={`form-control${inv(fType) ? ' form-control--invalid' : ''}`}
              value={sen.type}
              onChange={(e) => patchSensor(idx, { type: e.target.value })}
              onBlur={() => onTouched(fType)}
              aria-required
              placeholder="e.g. Inertial Navigation System"
            />
            <datalist id={`${pfx}-type-list`}>
              {SENSOR_TYPES.map((t) => <option key={t} value={t} />)}
            </datalist>
            {show(fType) ? <p className="field-error">{show(fType)}</p> : null}

            <label htmlFor={`${pfx}-model`}>Model ID</label>
            <input
              id={`${pfx}-model`}
              data-pilot-field={`sensors[${idx}].model`}
              className={`form-control${inv(fModel) ? ' form-control--invalid' : ''}`}
              value={sen.modelId}
              onChange={(e) => patchSensor(idx, { modelId: e.target.value })}
              onBlur={() => onTouched(fModel)}
              aria-required
            />
            {show(fModel) ? <p className="field-error">{show(fModel)}</p> : null}

            <label htmlFor={`${pfx}-var`}>Observed variable</label>
            <input
              id={`${pfx}-var`}
              data-pilot-field={`sensors[${idx}].variable`}
              className={`form-control${inv(fVar) ? ' form-control--invalid' : ''}`}
              value={sen.variable}
              onChange={(e) => patchSensor(idx, { variable: e.target.value })}
              onBlur={() => onTouched(fVar)}
              aria-required
            />
            {show(fVar) ? <p className="field-error">{show(fVar)}</p> : null}

            <label htmlFor={`${pfx}-fw`}>Firmware</label>
            <input
              id={`${pfx}-fw`}
              data-pilot-field={`sensors[${idx}].firmware`}
              className="form-control"
              value={sen.firmware || ''}
              onChange={(e) => patchSensor(idx, { firmware: e.target.value })}
            />

            <details className="sensor-extra-details">
              <summary className="sensor-extra-summary">More instrument fields (optional, XML export)</summary>
              <div className="sensor-extra-grid">
                {Object.keys(SENSOR_XML_OPTIONAL_DEFAULTS).map((key) => (
                  <div key={key}>
                    <label htmlFor={`${pfx}-${key}`}>{SENSOR_XML_EXTRA_FIELD_LABELS[key] || key}</label>
                    <input
                      id={`${pfx}-${key}`}
                      data-pilot-field={`sensors[${idx}].${key}`}
                      className="form-control"
                      value={sen[key] || ''}
                      onChange={(e) => patchSensor(idx, { [key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            </details>
          </section>
        )
      })}
      <button type="button" className="button button-secondary" onClick={addSensor}>
        Add sensor
      </button>
    </>
  )
}
