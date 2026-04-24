import { useState } from 'react'
import { useFieldValidation } from '../../components/fields/useFieldValidation'

/**
 * @param {{
 *   platform: object,
 *   onPlatformPatch: (p: object) => void,
 *   touched: Record<string, boolean>,
 *   onTouched: (key: string) => void,
 *   showAllErrors: boolean,
 *   issues: Array<{ field: string, message: string }>,
 *   hostBridgeReady?: boolean,
 *   platformLibraryRows?: Array<{ key: string, row: Record<string, unknown> }>,
 *   platformLibraryLoading?: boolean,
 *   platformLibraryError?: string,
 *   onRefreshPlatformLibrary?: () => void,
 *   onApplyPlatformFromLibrary?: (key: string) => void,
 *   onSavePlatformToSheets?: () => void,
 *   platformSaveBusy?: boolean,
 * }} props
 */
export default function StepPlatform({
  platform,
  onPlatformPatch,
  touched,
  onTouched,
  showAllErrors,
  issues,
  hostBridgeReady = false,
  platformLibraryRows = [],
  platformLibraryLoading = false,
  platformLibraryError = '',
  onRefreshPlatformLibrary,
  onApplyPlatformFromLibrary,
  onSavePlatformToSheets,
  platformSaveBusy = false,
}) {
  const [selectedPlatformKey, setSelectedPlatformKey] = useState('')

  const { show, invalid } = useFieldValidation({ issues, touched, showAllErrors })

  return (
    <>
      <p className="card-intro">
        Platform record — canonical <code>platform.*</code> (identification, dimensions, power, deployment), aligned with the
        historical HTML wizard <code>#platformForm</code> field map for XML parity.
      </p>

      <section className="panel">
        <h3 className="panel-title">Platform library</h3>
        <p className="card-intro platform-library-intro">
          Load an existing platform from your Postgres-backed catalog (<code>/api/db</code>) and apply it here. The list loads
          when you open this step; use Refresh to reload.
        </p>
        <div className="platform-library-row">
          <select
            className="form-control form-select"
            value={selectedPlatformKey}
            disabled={!hostBridgeReady || platformLibraryLoading}
            onChange={(e) => setSelectedPlatformKey(e.target.value)}
          >
            <option value="">Select a platform…</option>
            {platformLibraryRows.map(({ key, row }) => {
              const id = String(row.id || row.platformId || '').trim()
              const name = String(row.name || row.platformName || '').trim()
              const label = name && id ? `${name} (${id})` : name || id || key
              return (
                <option key={key} value={key}>
                  {label}
                </option>
              )
            })}
          </select>
          <button
            type="button"
            className="button button-secondary button-tiny"
            disabled={!hostBridgeReady || platformLibraryLoading}
            onClick={() => onRefreshPlatformLibrary?.()}
          >
            {platformLibraryLoading ? 'Loading…' : 'Refresh'}
          </button>
          <button
            type="button"
            className="button button-tiny"
            disabled={!hostBridgeReady || platformLibraryLoading || !selectedPlatformKey}
            onClick={() => onApplyPlatformFromLibrary?.(selectedPlatformKey)}
          >
            Apply selected
          </button>
          <button
            type="button"
            className="button button-secondary button-tiny"
            disabled={!hostBridgeReady || platformLibraryLoading || platformSaveBusy}
            onClick={() => onSavePlatformToSheets?.()}
          >
            {platformSaveBusy ? 'Saving…' : 'Save to library'}
          </button>
        </div>
        {!hostBridgeReady ? (
          <p className="hint">Platform library needs a reachable <code>/api/db</code> (e.g. same-origin Postgres API).</p>
        ) : null}
        {platformLibraryError ? <p className="field-error">{platformLibraryError}</p> : null}
      </section>

      <section className="panel">
        <h3 className="panel-title">Identification</h3>
        <label htmlFor="platformType">Platform type (GCMD)</label>
        <input
          id="platformType"
          className={`form-control${invalid('platform.platformType') ? ' form-control--invalid' : ''}`}
          list="platformTypeList"
          value={platform.platformType || ''}
          onChange={(e) => onPlatformPatch({ platformType: e.target.value })}
          onBlur={() => onTouched('platform.platformType')}
          aria-required
        />
        <datalist id="platformTypeList">
          {['UAV', 'AUV', 'Boat/Ship - Research', 'Satellites', 'Ground-based Platforms'].map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        {show('platform.platformType') ? <p className="field-error">{show('platform.platformType')}</p> : null}

        <label htmlFor="customPlatformType">Custom platform type</label>
        <input
          id="customPlatformType"
          className="form-control"
          value={platform.customPlatformType || ''}
          onChange={(e) => onPlatformPatch({ customPlatformType: e.target.value })}
        />

        <div className="form-row-2">
          <div>
            <label htmlFor="platformId">Platform ID</label>
            <input
              id="platformId"
              className={`form-control${invalid('platform.platformId') ? ' form-control--invalid' : ''}`}
              value={platform.platformId || ''}
              onChange={(e) => onPlatformPatch({ platformId: e.target.value })}
              onBlur={() => onTouched('platform.platformId')}
              aria-required
            />
            {show('platform.platformId') ? <p className="field-error">{show('platform.platformId')}</p> : null}
          </div>
          <div>
            <label htmlFor="platformName">Platform name</label>
            <input
              id="platformName"
              className="form-control"
              value={platform.platformName || ''}
              onChange={(e) => onPlatformPatch({ platformName: e.target.value })}
            />
          </div>
        </div>

        <label htmlFor="platformDesc">Description / comments</label>
        <textarea
          id="platformDesc"
          rows={3}
          className={`form-control${invalid('platform.platformDesc') ? ' form-control--invalid' : ''}`}
          value={platform.platformDesc || ''}
          onChange={(e) => onPlatformPatch({ platformDesc: e.target.value })}
          onBlur={() => onTouched('platform.platformDesc')}
          aria-required
        />
        {show('platform.platformDesc') ? <p className="field-error">{show('platform.platformDesc')}</p> : null}
      </section>

      <section className="panel">
        <h3 className="panel-title">Manufacturer &amp; hull</h3>
        <div className="form-row-2">
          <div>
            <label htmlFor="manufacturer">Manufacturer</label>
            <input
              id="manufacturer"
              className="form-control"
              value={platform.manufacturer || ''}
              onChange={(e) => onPlatformPatch({ manufacturer: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="model">Model</label>
            <input
              id="model"
              className="form-control"
              value={platform.model || ''}
              onChange={(e) => onPlatformPatch({ model: e.target.value })}
            />
          </div>
        </div>
        <div className="form-row-2">
          <div>
            <label htmlFor="serialNumber">Serial number</label>
            <input
              id="serialNumber"
              className="form-control"
              value={platform.serialNumber || ''}
              onChange={(e) => onPlatformPatch({ serialNumber: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="material">Material</label>
            <input
              id="material"
              className="form-control"
              value={platform.material || ''}
              onChange={(e) => onPlatformPatch({ material: e.target.value })}
            />
          </div>
        </div>
        <div className="form-row-4">
          {[
            ['weight', 'Weight'],
            ['length', 'Length'],
            ['width', 'Width'],
            ['height', 'Height'],
          ].map(([key, label]) => (
            <div key={key}>
              <label htmlFor={key}>{label}</label>
              <input
                id={key}
                className="form-control"
                value={platform[key] || ''}
                onChange={(e) => onPlatformPatch({ [key]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3 className="panel-title">Operation</h3>
        <div className="form-row-2">
          <div>
            <label htmlFor="speed">Speed</label>
            <input
              id="speed"
              className="form-control"
              value={platform.speed || ''}
              onChange={(e) => onPlatformPatch({ speed: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="powerSource">Power source</label>
            <input
              id="powerSource"
              className="form-control"
              value={platform.powerSource || ''}
              onChange={(e) => onPlatformPatch({ powerSource: e.target.value })}
            />
          </div>
        </div>
        <label htmlFor="navigationSystem">Navigation system</label>
        <input
          id="navigationSystem"
          className="form-control"
          value={platform.navigationSystem || ''}
          onChange={(e) => onPlatformPatch({ navigationSystem: e.target.value })}
        />
        <label htmlFor="sensorMounts">Sensor mounts</label>
        <input
          id="sensorMounts"
          className="form-control"
          value={platform.sensorMounts || ''}
          onChange={(e) => onPlatformPatch({ sensorMounts: e.target.value })}
        />
        <label htmlFor="operationalArea">Operational area</label>
        <input
          id="operationalArea"
          className="form-control"
          value={platform.operationalArea || ''}
          onChange={(e) => onPlatformPatch({ operationalArea: e.target.value })}
        />
        <label htmlFor="deploymentDate">Deployment date</label>
        <input
          id="deploymentDate"
          className="form-control"
          type="date"
          value={platform.deploymentDate || ''}
          onChange={(e) => onPlatformPatch({ deploymentDate: e.target.value })}
        />
      </section>
    </>
  )
}
