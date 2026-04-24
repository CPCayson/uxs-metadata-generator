/**
 * BEDI Collection — Step 2: Description & Extent
 *
 * Covers: abstract, purpose, status, browseGraphicUrl, resourceUseLimitation,
 * bbox (west/east/south/north), startDate, endDate,
 * platforms, scienceKeywords (+ optional scienceKeywordHrefs), oerKeywords, placeKeywords,
 * datacenters (+ optional datacenterKeywordHrefs).
 */

import { useFieldValidation } from '../../components/fields/useFieldValidation.js'

const STATUS_OPTIONS = [
  '', 'completed', 'historicalArchive', 'onGoing', 'planned', 'required', 'superseded',
]

export default function StepBediCollectionExtent({
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

  /** @param {string} field @param {string} raw comma-separated */
  function patchArray(field, raw) {
    const items = raw.split(',').map((x) => x.trim()).filter(Boolean)
    patch({ [field]: items })
  }

  function patchLines(field, raw) {
    const lines = raw.split('\n').map((l) => l.trim())
    patch({ [field]: lines })
  }

  const { show, invalid } = useFieldValidation({ issues, touched, showAllErrors })

  return (
    <div className="pilot-step-fields">

      {/* Abstract */}
      <div className="mb-3">
        <label className="form-label" htmlFor="bdc-abstract">
          Abstract <span aria-hidden="true">*</span>
        </label>
        <textarea
          id="bdc-abstract"
          data-pilot-field="abstract"
          rows={4}
          className={`form-control${invalid('abstract') ? ' is-invalid' : ''}`}
          value={s.abstract || ''}
          onChange={(e) => patch({ abstract: e.target.value })}
          onBlur={() => onTouched('abstract')}
          placeholder="Description of the collection and its scientific significance"
        />
        {show('abstract') && (
          <div className="invalid-feedback d-block">{show('abstract')}</div>
        )}
      </div>

      {/* Purpose */}
      <div className="mb-3">
        <label className="form-label" htmlFor="bdc-purpose">
          Purpose
        </label>
        <textarea
          id="bdc-purpose"
          data-pilot-field="purpose"
          rows={2}
          className="form-control"
          value={s.purpose || ''}
          onChange={(e) => patch({ purpose: e.target.value })}
          onBlur={() => onTouched('purpose')}
          placeholder="Scientific or archival purpose of this collection"
        />
      </div>

      {/* Status + Browse Graphic */}
      <div className="row mb-3">
        <div className="col-md-4">
          <label className="form-label" htmlFor="bdc-status">
            Status <span aria-hidden="true">*</span>
          </label>
          <select
            id="bdc-status"
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
        <div className="col-md-8">
          <label className="form-label" htmlFor="bdc-browseGraphic">
            Browse Graphic URL
          </label>
          <input
            id="bdc-browseGraphic"
            data-pilot-field="browseGraphicUrl"
            className={`form-control${invalid('browseGraphicUrl') ? ' is-invalid' : ''}`}
            value={s.browseGraphicUrl || ''}
            onChange={(e) => patch({ browseGraphicUrl: e.target.value })}
            onBlur={() => onTouched('browseGraphicUrl')}
            placeholder="https://www.ncei.noaa.gov/data/.../BrowseGraphic.jpg"
          />
          {show('browseGraphicUrl') && (
            <div className="invalid-feedback d-block">{show('browseGraphicUrl')}</div>
          )}
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label" htmlFor="bdc-resourceUseLimitation">
          Resource use limitation
        </label>
        <textarea
          id="bdc-resourceUseLimitation"
          data-pilot-field="resourceUseLimitation"
          rows={2}
          className="form-control"
          value={s.resourceUseLimitation || ''}
          onChange={(e) => patch({ resourceUseLimitation: e.target.value })}
          onBlur={() => onTouched('resourceUseLimitation')}
          placeholder="Leave blank to use the built-in NOAA-style use limitation in XML preview"
        />
        <div className="form-text">
          Maps to <code className="small">gmd:MD_LegalConstraints/gmd:useLimitation</code> in the collection ISO preview.
        </div>
      </div>

      {/* Bounding Box */}
      <fieldset className="mb-3">
        <legend className="form-label">Bounding Box <span aria-hidden="true">*</span></legend>
        {show('west') && (
          <div className="alert alert-danger py-1 small">{show('west')}</div>
        )}
        <div className="row g-2">
          {[
            { id: 'bdc-west',  label: 'West',  field: 'west',  placeholder: '-79.5' },
            { id: 'bdc-east',  label: 'East',  field: 'east',  placeholder: '-77.66' },
            { id: 'bdc-south', label: 'South', field: 'south', placeholder: '24.0' },
            { id: 'bdc-north', label: 'North', field: 'north', placeholder: '27.5' },
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
      <div className="row mb-3">
        <div className="col-md-6">
          <label className="form-label" htmlFor="bdc-startDate">
            Start Date <span aria-hidden="true">*</span>
          </label>
          <input
            id="bdc-startDate"
            data-pilot-field="startDate"
            type="date"
            className={`form-control${invalid('startDate') ? ' is-invalid' : ''}`}
            value={s.startDate?.split('T')[0] || ''}
            onChange={(e) => patch({ startDate: e.target.value })}
            onBlur={() => onTouched('startDate')}
          />
          {show('startDate') && (
            <div className="invalid-feedback d-block">{show('startDate')}</div>
          )}
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="bdc-endDate">
            End Date <span aria-hidden="true">*</span>
          </label>
          <input
            id="bdc-endDate"
            data-pilot-field="endDate"
            type="date"
            className={`form-control${invalid('endDate') ? ' is-invalid' : ''}`}
            value={s.endDate?.split('T')[0] || ''}
            onChange={(e) => patch({ endDate: e.target.value })}
            onBlur={() => onTouched('endDate')}
          />
          {show('endDate') && (
            <div className="invalid-feedback d-block">{show('endDate')}</div>
          )}
        </div>
      </div>

      {/* Platforms */}
      <div className="mb-3">
        <label className="form-label" htmlFor="bdc-platforms">
          Platforms <span aria-hidden="true">*</span>
        </label>
        <input
          id="bdc-platforms"
          data-pilot-field="platforms"
          className={`form-control${invalid('platforms') ? ' is-invalid' : ''}`}
          value={(s.platforms || []).join(', ')}
          onChange={(e) => patchArray('platforms', e.target.value)}
          onBlur={() => onTouched('platforms')}
          placeholder="R/V Seward Johnson I, Johnson-Sea-Link II HOV"
        />
        {show('platforms') && (
          <div className="invalid-feedback d-block">{show('platforms')}</div>
        )}
        <div className="form-text">Comma-separated platform names (ship, submersible, ROV, etc.)</div>
      </div>

      {/* GCMD Science Keywords */}
      <div className="mb-3">
        <label className="form-label" htmlFor="bdc-scienceKw">
          GCMD Science Keywords <span aria-hidden="true">*</span>
        </label>
        <textarea
          id="bdc-scienceKw"
          data-pilot-field="scienceKeywords"
          rows={3}
          className={`form-control${invalid('scienceKeywords') ? ' is-invalid' : ''}`}
          value={(s.scienceKeywords || []).join(', ')}
          onChange={(e) => patchArray('scienceKeywords', e.target.value)}
          onBlur={() => onTouched('scienceKeywords')}
          placeholder="Earth Science > Oceans > Marine Environment Monitoring"
        />
        {show('scienceKeywords') && (
          <div className="invalid-feedback d-block">{show('scienceKeywords')}</div>
        )}
        <label className="form-label mt-2" htmlFor="bdc-scienceKwHrefs">
          Optional GCMD concept URLs (science)
        </label>
        <textarea
          id="bdc-scienceKwHrefs"
          data-pilot-field="scienceKeywordHrefs"
          rows={2}
          className="form-control font-monospace small"
          value={(s.scienceKeywordHrefs || []).join('\n')}
          onChange={(e) => patchLines('scienceKeywordHrefs', e.target.value)}
          onBlur={() => onTouched('scienceKeywordHrefs')}
          placeholder={'One HTTPS URL per line, same order as science keywords above.\nLeave lines blank to use the built-in GCMD lookup URL in XML.'}
        />
        <div className="form-text">Paste real NASA KMS concept links when you have them (e.g. from https://gcmd.earthdata.nasa.gov/kms/concepts/concept/).</div>
      </div>

      {/* Place Keywords */}
      <div className="mb-3">
        <label className="form-label" htmlFor="bdc-placeKw">
          Place Keywords
        </label>
        <input
          id="bdc-placeKw"
          data-pilot-field="placeKeywords"
          className="form-control"
          value={(s.placeKeywords || []).join(', ')}
          onChange={(e) => patchArray('placeKeywords', e.target.value)}
          onBlur={() => onTouched('placeKeywords')}
          placeholder="Little Bahama Bank Lithoherm, Northwest Providence Channel"
        />
      </div>

      {/* Data Centers */}
      <div className="mb-3">
        <label className="form-label" htmlFor="bdc-datacenters">
          Data Center Keywords <span aria-hidden="true">*</span>
        </label>
        <input
          id="bdc-datacenters"
          data-pilot-field="datacenters"
          className={`form-control${invalid('datacenters') ? ' is-invalid' : ''}`}
          value={(s.datacenters || []).join(', ')}
          onChange={(e) => patchArray('datacenters', e.target.value)}
          onBlur={() => onTouched('datacenters')}
          placeholder="DOC/NOAA/NESDIS/NCEI > National Centers for Environmental Information"
        />
        {show('datacenters') && (
          <div className="invalid-feedback d-block">{show('datacenters')}</div>
        )}
        <label className="form-label mt-2" htmlFor="bdc-datacenterHrefs">
          Optional GCMD concept URLs (data centers)
        </label>
        <textarea
          id="bdc-datacenterHrefs"
          data-pilot-field="datacenterKeywordHrefs"
          rows={2}
          className="form-control font-monospace small"
          value={(s.datacenterKeywordHrefs || []).join('\n')}
          onChange={(e) => patchLines('datacenterKeywordHrefs', e.target.value)}
          onBlur={() => onTouched('datacenterKeywordHrefs')}
          placeholder={'One URL per line, aligned with comma-separated data center keywords.'}
        />
      </div>

      {/* OER / provider theme keywords (optional but recommended) */}
      <div className="mb-3">
        <label className="form-label" htmlFor="bdc-oerKw">
          OER / provider keywords
        </label>
        <textarea
          id="bdc-oerKw"
          data-pilot-field="oerKeywords"
          rows={2}
          className="form-control"
          value={(s.oerKeywords || []).join(', ')}
          onChange={(e) => patchArray('oerKeywords', e.target.value)}
          onBlur={() => onTouched('oerKeywords')}
          placeholder="bioluminescence, exploration, NOAA Ocean Exploration, …"
        />
        <div className="form-text">Comma-separated program or theme keywords.</div>
      </div>
    </div>
  )
}
