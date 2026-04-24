/**
 * StepCollectionExtent — temporal and geographic extent for a collection record.
 *
 * Reads from pilotState.extent and writes via setPilotState.
 * Props arrive as the WizardShell superset; only what's needed is destructured.
 */

import { useFieldValidation } from '../../components/fields/useFieldValidation.js'

export default function StepCollectionExtent({
  pilotState,
  setPilotState,
  touched,
  onTouched,
  showAllErrors,
  issues,
}) {
  const extent = pilotState?.extent ?? {}

  function patch(p) {
    setPilotState((prev) => ({
      ...prev,
      extent: { ...prev.extent, ...p },
    }))
  }

  const { show, invalid } = useFieldValidation({ issues, touched, showAllErrors })

  return (
    <div className="pilot-step-fields">
      <fieldset className="mb-4">
        <legend className="form-label fw-semibold">Temporal Extent</legend>
        <div className="row g-2">
          <div className="col-md-6">
            <label className="form-label" htmlFor="col-start-date">
              Start Date <span aria-hidden="true">*</span>
            </label>
            <input
              id="col-start-date"
              type="text"
              className={`form-control${invalid('extent.startDate') ? ' is-invalid' : ''}`}
              value={extent.startDate || ''}
              onChange={(e) => patch({ startDate: e.target.value })}
              onBlur={() => onTouched('extent.startDate')}
              placeholder="YYYY-MM-DD"
            />
            {show('extent.startDate') && (
              <div className="invalid-feedback d-block">{show('extent.startDate')}</div>
            )}
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="col-end-date">
              End Date
            </label>
            <input
              id="col-end-date"
              type="text"
              className={`form-control${invalid('extent.endDate') ? ' is-invalid' : ''}`}
              value={extent.endDate || ''}
              onChange={(e) => patch({ endDate: e.target.value })}
              onBlur={() => onTouched('extent.endDate')}
              placeholder="YYYY-MM-DD (leave blank if ongoing)"
            />
            {show('extent.endDate') && (
              <div className="invalid-feedback d-block">{show('extent.endDate')}</div>
            )}
          </div>
        </div>
      </fieldset>

      <fieldset className="mb-3">
        <legend className="form-label fw-semibold">Geographic Bounding Box</legend>
        <div
          className={`row g-2${invalid('extent.bbox') ? ' border border-danger rounded p-2' : ''}`}
        >
          <div className="col-6 col-md-3">
            <label className="form-label" htmlFor="col-west">
              West
            </label>
            <input
              id="col-west"
              className="form-control"
              value={extent.west ?? '-180'}
              onChange={(e) => patch({ west: e.target.value })}
              onBlur={() => onTouched('extent.west')}
              placeholder="-180"
            />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label" htmlFor="col-east">
              East
            </label>
            <input
              id="col-east"
              className="form-control"
              value={extent.east ?? '180'}
              onChange={(e) => patch({ east: e.target.value })}
              onBlur={() => onTouched('extent.east')}
              placeholder="180"
            />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label" htmlFor="col-south">
              South
            </label>
            <input
              id="col-south"
              className="form-control"
              value={extent.south ?? '-90'}
              onChange={(e) => patch({ south: e.target.value })}
              onBlur={() => onTouched('extent.south')}
              placeholder="-90"
            />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label" htmlFor="col-north">
              North
            </label>
            <input
              id="col-north"
              className="form-control"
              value={extent.north ?? '90'}
              onChange={(e) => patch({ north: e.target.value })}
              onBlur={() => onTouched('extent.north')}
              placeholder="90"
            />
          </div>
        </div>
        {show('extent.bbox') && (
          <div className="text-danger mt-1" style={{ fontSize: '0.875rem' }}>
            {show('extent.bbox')}
          </div>
        )}
      </fieldset>
    </div>
  )
}
