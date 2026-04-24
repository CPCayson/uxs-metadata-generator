/**
 * BEDI Granule — Step 2: Description & Extent
 *
 * Covers: abstract, status, resourceUseLimitation, PI contact,
 * bbox, temporal extent, vertical extent (depth).
 */

import { useFieldValidation } from '../../components/fields/useFieldValidation.js'

const STATUS_OPTIONS = ['', 'completed', 'onGoing', 'planned', 'superseded']

export default function StepBediGranuleExtent({
  pilotState,
  setPilotState,
  touched,
  onTouched,
  showAllErrors,
  issues,
}) {
  const s = pilotState ?? {}

  function patch(update) {
    setPilotState((prev) => ({ ...prev, ...update }))
  }

  const { show, invalid } = useFieldValidation({ issues, touched, showAllErrors })

  return (
    <div className="pilot-step-fields">

      {/* Abstract */}
      <div className="mb-3">
        <label className="form-label" htmlFor="bdg-abstract">
          Abstract <span aria-hidden="true">*</span>
        </label>
        <textarea
          id="bdg-abstract"
          data-pilot-field="abstract"
          rows={3}
          className={`form-control${invalid('abstract') ? ' is-invalid' : ''}`}
          value={s.abstract || ''}
          onChange={(e) => patch({ abstract: e.target.value })}
          onBlur={() => onTouched('abstract')}
          placeholder="Description of this video segment (tape, dive, content)"
        />
        {show('abstract') && (
          <div className="invalid-feedback d-block">{show('abstract')}</div>
        )}
      </div>

      {/* Status */}
      <div className="mb-3">
        <label className="form-label" htmlFor="bdg-status">
          Status <span aria-hidden="true">*</span>
        </label>
        <select
          id="bdg-status"
          data-pilot-field="status"
          className={`form-select${invalid('status') ? ' is-invalid' : ''}`}
          value={s.status || ''}
          onChange={(e) => patch({ status: e.target.value })}
          onBlur={() => onTouched('status')}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o} value={o}>{o || '— select —'}</option>
          ))}
        </select>
        {show('status') && (
          <div className="invalid-feedback d-block">{show('status')}</div>
        )}
      </div>

      <div className="mb-3">
        <label className="form-label" htmlFor="bdg-resourceUseLimitation">
          Resource use limitation
        </label>
        <textarea
          id="bdg-resourceUseLimitation"
          data-pilot-field="resourceUseLimitation"
          rows={2}
          className="form-control"
          value={s.resourceUseLimitation || ''}
          onChange={(e) => patch({ resourceUseLimitation: e.target.value })}
          onBlur={() => onTouched('resourceUseLimitation')}
          placeholder="Leave blank for a built-in NOAA-style granule use limitation in XML preview"
        />
        <div className="form-text small text-secondary">
          Maps to <code className="small">gmd:MD_LegalConstraints/gmd:useLimitation</code> in the granule ISO preview.
        </div>
      </div>

      {/* Principal Investigator */}
      <fieldset className="mb-4 p-3 border rounded">
        <legend className="form-label fw-semibold">Principal Investigator</legend>
        <div className="mb-2">
          <label className="form-label" htmlFor="bdg-piName">
            Name <span aria-hidden="true">*</span>
          </label>
          <input
            id="bdg-piName"
            data-pilot-field="piName"
            className={`form-control${invalid('piName') ? ' is-invalid' : ''}`}
            value={s.piName || ''}
            onChange={(e) => patch({ piName: e.target.value })}
            onBlur={() => onTouched('piName')}
            placeholder="Dr. Tamara Frank"
          />
          {show('piName') && (
            <div className="invalid-feedback d-block">{show('piName')}</div>
          )}
        </div>
        <div className="row g-2">
          <div className="col-md-6">
            <label className="form-label" htmlFor="bdg-piOrg">Organization</label>
            <input
              id="bdg-piOrg"
              data-pilot-field="piOrg"
              className={`form-control${invalid('piOrg') ? ' is-invalid' : ''}`}
              value={s.piOrg || ''}
              onChange={(e) => patch({ piOrg: e.target.value })}
              onBlur={() => onTouched('piOrg')}
              placeholder="Nova Southeastern University"
            />
            {show('piOrg') && (
              <div className="invalid-feedback d-block">{show('piOrg')}</div>
            )}
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="bdg-piEmail">Email</label>
            <input
              id="bdg-piEmail"
              data-pilot-field="piEmail"
              type="email"
              className="form-control"
              value={s.piEmail || ''}
              onChange={(e) => patch({ piEmail: e.target.value })}
              onBlur={() => onTouched('piEmail')}
              placeholder="pi@institution.edu"
            />
          </div>
        </div>
      </fieldset>

      {/* Bounding Box */}
      <fieldset className="mb-3">
        <legend className="form-label">Bounding Box <span aria-hidden="true">*</span></legend>
        {show('west') && (
          <div className="alert alert-danger py-1 small">{show('west')}</div>
        )}
        <div className="row g-2">
          {[
            { id: 'bdg-west',  label: 'West',  field: 'west',  placeholder: '-79.5' },
            { id: 'bdg-east',  label: 'East',  field: 'east',  placeholder: '-79.0' },
            { id: 'bdg-south', label: 'South', field: 'south', placeholder: '24.0' },
            { id: 'bdg-north', label: 'North', field: 'north', placeholder: '27.5' },
          ].map(({ id, label, field, placeholder }) => (
            <div key={field} className="col-6 col-md-3">
              <label className="form-label" htmlFor={id}>{label}</label>
              <input
                id={id}
                data-pilot-field={field}
                type="number"
                step="0.0001"
                className={`form-control${invalid(field) ? ' is-invalid' : ''}`}
                value={s[field] || ''}
                onChange={(e) => patch({ [field]: e.target.value })}
                onBlur={() => onTouched(field)}
                placeholder={placeholder}
              />
            </div>
          ))}
        </div>
      </fieldset>

      {/* Temporal Extent */}
      <div className="row mb-3 g-2">
        <div className="col-md-6">
          <label className="form-label" htmlFor="bdg-startDate">
            Observation Start <span aria-hidden="true">*</span>
          </label>
          <input
            id="bdg-startDate"
            data-pilot-field="startDate"
            type="datetime-local"
            className={`form-control${invalid('startDate') ? ' is-invalid' : ''}`}
            value={s.startDate?.replace('Z', '') || ''}
            onChange={(e) => patch({ startDate: e.target.value })}
            onBlur={() => onTouched('startDate')}
          />
          {show('startDate') && (
            <div className="invalid-feedback d-block">{show('startDate')}</div>
          )}
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="bdg-endDate">
            Observation End <span aria-hidden="true">*</span>
          </label>
          <input
            id="bdg-endDate"
            data-pilot-field="endDate"
            type="datetime-local"
            className={`form-control${invalid('endDate') ? ' is-invalid' : ''}`}
            value={s.endDate?.replace('Z', '') || ''}
            onChange={(e) => patch({ endDate: e.target.value })}
            onBlur={() => onTouched('endDate')}
          />
          {show('endDate') && (
            <div className="invalid-feedback d-block">{show('endDate')}</div>
          )}
        </div>
      </div>

      {/* Vertical Extent */}
      <div className="row mb-3 g-2">
        <div className="col-md-6">
          <label className="form-label" htmlFor="bdg-minDepth">
            Min Depth (m)
          </label>
          <input
            id="bdg-minDepth"
            data-pilot-field="minDepth"
            type="number"
            step="1"
            className={`form-control${invalid('minDepth') ? ' is-invalid' : ''}`}
            value={s.minDepth || ''}
            onChange={(e) => patch({ minDepth: e.target.value })}
            onBlur={() => onTouched('minDepth')}
            placeholder="0"
          />
          {show('minDepth') && (
            <div className="invalid-feedback d-block">{show('minDepth')}</div>
          )}
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="bdg-maxDepth">
            Max Depth (m) <span aria-hidden="true">*</span>
          </label>
          <input
            id="bdg-maxDepth"
            data-pilot-field="maxDepth"
            type="number"
            step="1"
            className={`form-control${invalid('maxDepth') ? ' is-invalid' : ''}`}
            value={s.maxDepth || ''}
            onChange={(e) => patch({ maxDepth: e.target.value })}
            onBlur={() => onTouched('maxDepth')}
            placeholder="914"
          />
          {show('maxDepth') && (
            <div className="invalid-feedback d-block">{show('maxDepth')}</div>
          )}
          <div className="form-text">Depth in meters below sea surface (positive = deeper)</div>
        </div>
      </div>
    </div>
  )
}
