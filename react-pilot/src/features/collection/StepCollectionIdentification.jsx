/**
 * StepCollectionIdentification — identification fields for a collection record.
 *
 * Reads from pilotState.identification and writes via setPilotState.
 * Props arrive as the WizardShell superset; only what's needed is destructured.
 */

import { useFieldValidation } from '../../components/fields/useFieldValidation.js'

const STATUS_OPTIONS = ['', 'completed', 'onGoing', 'planned', 'deprecated', 'superseded']

export default function StepCollectionIdentification({
  pilotState,
  setPilotState,
  touched,
  onTouched,
  showAllErrors,
  issues,
}) {
  const ident = pilotState?.identification ?? {}

  function patch(p) {
    setPilotState((prev) => ({
      ...prev,
      identification: { ...prev.identification, ...p },
    }))
  }

  const { show, invalid } = useFieldValidation({ issues, touched, showAllErrors })

  return (
    <div className="pilot-step-fields">
      <div className="mb-3">
        <label className="form-label" htmlFor="col-identifier">
          Identifier <span aria-hidden="true">*</span>
        </label>
        <input
          id="col-identifier"
          className={`form-control${invalid('identification.identifier') ? ' is-invalid' : ''}`}
          value={ident.identifier || ''}
          onChange={(e) => patch({ identifier: e.target.value })}
          onBlur={() => onTouched('identification.identifier')}
          placeholder="e.g. NOAA-COLLECTION-2024-001"
        />
        {show('identification.identifier') && (
          <div className="invalid-feedback d-block">{show('identification.identifier')}</div>
        )}
      </div>

      <div className="mb-3">
        <label className="form-label" htmlFor="col-title">
          Title <span aria-hidden="true">*</span>
        </label>
        <input
          id="col-title"
          className={`form-control${invalid('identification.title') ? ' is-invalid' : ''}`}
          value={ident.title || ''}
          onChange={(e) => patch({ title: e.target.value })}
          onBlur={() => onTouched('identification.title')}
          placeholder="Collection title"
        />
        {show('identification.title') && (
          <div className="invalid-feedback d-block">{show('identification.title')}</div>
        )}
      </div>

      <div className="mb-3">
        <label className="form-label" htmlFor="col-abstract">
          Abstract <span aria-hidden="true">*</span>
        </label>
        <textarea
          id="col-abstract"
          className={`form-control${invalid('identification.abstract') ? ' is-invalid' : ''}`}
          rows={4}
          value={ident.abstract || ''}
          onChange={(e) => patch({ abstract: e.target.value })}
          onBlur={() => onTouched('identification.abstract')}
          placeholder="Brief description of the collection"
        />
        {show('identification.abstract') && (
          <div className="invalid-feedback d-block">{show('identification.abstract')}</div>
        )}
      </div>

      <div className="mb-3">
        <label className="form-label" htmlFor="col-purpose">
          Purpose
        </label>
        <input
          id="col-purpose"
          className="form-control"
          value={ident.purpose || ''}
          onChange={(e) => patch({ purpose: e.target.value })}
          onBlur={() => onTouched('identification.purpose')}
          placeholder="Optional: why this collection exists"
        />
      </div>

      <div className="row mb-3">
        <div className="col-md-6">
          <label className="form-label" htmlFor="col-status">
            Status <span aria-hidden="true">*</span>
          </label>
          <select
            id="col-status"
            className={`form-select${invalid('identification.status') ? ' is-invalid' : ''}`}
            value={ident.status || ''}
            onChange={(e) => patch({ status: e.target.value })}
            onBlur={() => onTouched('identification.status')}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o || '— select —'}
              </option>
            ))}
          </select>
          {show('identification.status') && (
            <div className="invalid-feedback d-block">{show('identification.status')}</div>
          )}
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="col-language">
            Language <span aria-hidden="true">*</span>
          </label>
          <input
            id="col-language"
            className={`form-control${invalid('identification.language') ? ' is-invalid' : ''}`}
            value={ident.language || ''}
            onChange={(e) => patch({ language: e.target.value })}
            onBlur={() => onTouched('identification.language')}
            placeholder="eng"
          />
          {show('identification.language') && (
            <div className="invalid-feedback d-block">{show('identification.language')}</div>
          )}
        </div>
      </div>

      <fieldset className="mb-3">
        <legend className="form-label">Contact</legend>
        <div className="row g-2">
          <div className="col-md-6">
            <label className="form-label" htmlFor="col-org">
              Organization <span aria-hidden="true">*</span>
            </label>
            <input
              id="col-org"
              className={`form-control${invalid('identification.org') ? ' is-invalid' : ''}`}
              value={ident.org || ''}
              onChange={(e) => patch({ org: e.target.value })}
              onBlur={() => onTouched('identification.org')}
              placeholder="e.g. NOAA NCEI"
            />
            {show('identification.org') && (
              <div className="invalid-feedback d-block">{show('identification.org')}</div>
            )}
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="col-email">
              Email <span aria-hidden="true">*</span>
            </label>
            <input
              id="col-email"
              type="email"
              className={`form-control${invalid('identification.email') ? ' is-invalid' : ''}`}
              value={ident.email || ''}
              onChange={(e) => patch({ email: e.target.value })}
              onBlur={() => onTouched('identification.email')}
              placeholder="contact@noaa.gov"
            />
            {show('identification.email') && (
              <div className="invalid-feedback d-block">{show('identification.email')}</div>
            )}
          </div>
        </div>
      </fieldset>
    </div>
  )
}
