/**
 * StepCollectionDistribution — format, license, and access URLs for a collection record.
 *
 * Reads from pilotState.distribution and writes via setPilotState.
 * Props arrive as the WizardShell superset; only what's needed is destructured.
 */

import { useFieldValidation } from '../../components/fields/useFieldValidation.js'

const FORMAT_OPTIONS = [
  '',
  'NetCDF',
  'HDF5',
  'CSV',
  'GeoTIFF',
  'Zarr',
  'JSON',
  'GeoJSON',
  'Shapefile',
  'Other',
]

const LICENSE_OPTIONS = [
  '',
  'Public Domain (CC0)',
  'CC-BY-4.0',
  'CC-BY-NC-4.0',
  'NOAA Open Data',
  'Government Works',
  'Restricted',
]

export default function StepCollectionDistribution({
  pilotState,
  setPilotState,
  touched,
  onTouched,
  showAllErrors,
  issues,
}) {
  const dist = pilotState?.distribution ?? {}

  function patch(p) {
    setPilotState((prev) => ({
      ...prev,
      distribution: { ...prev.distribution, ...p },
    }))
  }

  const { show, invalid } = useFieldValidation({ issues, touched, showAllErrors })

  return (
    <div className="pilot-step-fields">
      <div className="row mb-3">
        <div className="col-md-6">
          <label className="form-label" htmlFor="col-dist-format">
            Format <span aria-hidden="true">*</span>
          </label>
          <select
            id="col-dist-format"
            className={`form-select${invalid('distribution.format') ? ' is-invalid' : ''}`}
            value={dist.format || ''}
            onChange={(e) => patch({ format: e.target.value })}
            onBlur={() => onTouched('distribution.format')}
          >
            {FORMAT_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o || '— select —'}
              </option>
            ))}
          </select>
          {show('distribution.format') && (
            <div className="invalid-feedback d-block">{show('distribution.format')}</div>
          )}
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="col-dist-license">
            License <span aria-hidden="true">*</span>
          </label>
          <select
            id="col-dist-license"
            className={`form-select${invalid('distribution.license') ? ' is-invalid' : ''}`}
            value={dist.license || ''}
            onChange={(e) => patch({ license: e.target.value })}
            onBlur={() => onTouched('distribution.license')}
          >
            {LICENSE_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o || '— select —'}
              </option>
            ))}
          </select>
          {show('distribution.license') && (
            <div className="invalid-feedback d-block">{show('distribution.license')}</div>
          )}
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label" htmlFor="col-landing-url">
          Landing Page URL
        </label>
        <input
          id="col-landing-url"
          type="url"
          className={`form-control${invalid('distribution.landingUrl') ? ' is-invalid' : ''}`}
          value={dist.landingUrl || ''}
          onChange={(e) => patch({ landingUrl: e.target.value })}
          onBlur={() => onTouched('distribution.landingUrl')}
          placeholder="https://example.org/collection"
        />
        {show('distribution.landingUrl') && (
          <div className="invalid-feedback d-block">{show('distribution.landingUrl')}</div>
        )}
      </div>

      <div className="mb-3">
        <label className="form-label" htmlFor="col-download-url">
          Download URL
        </label>
        <input
          id="col-download-url"
          type="url"
          className={`form-control${invalid('distribution.downloadUrl') ? ' is-invalid' : ''}`}
          value={dist.downloadUrl || ''}
          onChange={(e) => patch({ downloadUrl: e.target.value })}
          onBlur={() => onTouched('distribution.downloadUrl')}
          placeholder="https://example.org/collection/download"
        />
        {show('distribution.downloadUrl') && (
          <div className="invalid-feedback d-block">{show('distribution.downloadUrl')}</div>
        )}
      </div>
    </div>
  )
}
