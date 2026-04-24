/**
 * BEDI Collection — Step 3: Contacts & Distribution
 *
 * Covers: piName, piOrg, piEmail, docucomp `contact*Href` xlinks, contactRefs,
 * landingPageUrl, granulesSearchUrl, docucomp hrefs.
 */

import { useFieldValidation } from '../../components/fields/useFieldValidation.js'

export default function StepBediCollectionDistribution({
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

      {/* Principal Investigator */}
      <fieldset className="mb-4 p-3 border rounded">
        <legend className="form-label fw-semibold">Principal Investigator</legend>

        <div className="mb-3">
          <label className="form-label" htmlFor="bdc-piName">
            Name
          </label>
          <input
            id="bdc-piName"
            data-pilot-field="piName"
            className="form-control"
            value={s.piName || ''}
            onChange={(e) => patch({ piName: e.target.value })}
            onBlur={() => onTouched('piName')}
            placeholder="e.g. Dr. Tamara Frank"
          />
        </div>

        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label" htmlFor="bdc-piOrg">
              Organization
            </label>
            <input
              id="bdc-piOrg"
              data-pilot-field="piOrg"
              className="form-control"
              value={s.piOrg || ''}
              onChange={(e) => patch({ piOrg: e.target.value })}
              onBlur={() => onTouched('piOrg')}
              placeholder="Nova Southeastern University"
            />
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="bdc-piEmail">
              Email
            </label>
            <input
              id="bdc-piEmail"
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

      {/* NCEI / OER docucomp xlink:href (cruise-level ISO template) */}
      <fieldset className="mb-4 p-3 border rounded">
        <legend className="form-label fw-semibold">Docucomp contact xlinks</legend>
        <p className="small text-secondary mb-3">
          Optional URLs for <code className="small">xlink:href</code> on root <code>gmd:contact</code>,
          identification <code>gmd:pointOfContact</code>, and <code>gmd:distributorContact</code> — same pattern as NCEI OER cruise packages.
        </p>
        <div className="mb-3">
          <label className="form-label" htmlFor="bdc-contactNceiHref">
            NCEI contact URL
          </label>
          <input
            id="bdc-contactNceiHref"
            data-pilot-field="contactNceiHref"
            className="form-control font-monospace"
            value={s.contactNceiHref || ''}
            onChange={(e) => patch({ contactNceiHref: e.target.value })}
            onBlur={() => onTouched('contactNceiHref')}
            placeholder="https://www.ncei.noaa.gov/... (docucomp)"
          />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="bdc-contactOerHref">
            NOAA Ocean Exploration contact URL
          </label>
          <input
            id="bdc-contactOerHref"
            data-pilot-field="contactOerHref"
            className="form-control font-monospace"
            value={s.contactOerHref || ''}
            onChange={(e) => patch({ contactOerHref: e.target.value })}
            onBlur={() => onTouched('contactOerHref')}
            placeholder="https://oceanexplorer.noaa.gov/... (docucomp)"
          />
        </div>
        <div className="mb-0">
          <label className="form-label" htmlFor="bdc-contactPiHref">
            Principal investigator contact URL
          </label>
          <input
            id="bdc-contactPiHref"
            data-pilot-field="contactPiHref"
            className="form-control font-monospace"
            value={s.contactPiHref || ''}
            onChange={(e) => patch({ contactPiHref: e.target.value })}
            onBlur={() => onTouched('contactPiHref')}
            placeholder="https://... (PI docucomp, optional)"
          />
        </div>
      </fieldset>

      {/* NCEI / OER Contact References */}
      <div className="mb-3">
        <label className="form-label" htmlFor="bdc-contactRefs">
          Contact xlink References
        </label>
        <textarea
          id="bdc-contactRefs"
          data-pilot-field="contactRefs"
          rows={3}
          className="form-control font-monospace"
          value={(s.contactRefs || []).join('\n')}
          onChange={(e) => {
            const lines = e.target.value.split('\n').map((l) => l.trim()).filter(Boolean)
            patch({ contactRefs: lines })
          }}
          onBlur={() => onTouched('contactRefs')}
          placeholder={'NCEI (pointOfContact)\nNOAA Ocean Exploration and Research (pointOfContact)'}
        />
        <div className="form-text">
          xlink:title values for NCEI/OER docucomp contact references — one per line.
        </div>
      </div>

      {/* Landing Page URL */}
      <div className="mb-3">
        <label className="form-label" htmlFor="bdc-landingPageUrl">
          NCEI Landing Page URL
        </label>
        <input
          id="bdc-landingPageUrl"
          data-pilot-field="landingPageUrl"
          className={`form-control${invalid('landingPageUrl') ? ' is-invalid' : ''}`}
          value={s.landingPageUrl || ''}
          onChange={(e) => patch({ landingPageUrl: e.target.value })}
          onBlur={() => onTouched('landingPageUrl')}
          placeholder="https://data.noaa.gov/onestop/collections/details/..."
        />
        {show('landingPageUrl') && (
          <div className="invalid-feedback d-block">{show('landingPageUrl')}</div>
        )}
      </div>

      {/* Granule Search URL */}
      <div className="mb-3">
        <label className="form-label" htmlFor="bdc-granulesUrl">
          Granule Search URL
        </label>
        <input
          id="bdc-granulesUrl"
          data-pilot-field="granulesSearchUrl"
          className="form-control"
          value={s.granulesSearchUrl || ''}
          onChange={(e) => patch({ granulesSearchUrl: e.target.value })}
          onBlur={() => onTouched('granulesSearchUrl')}
          placeholder="https://data.noaa.gov/onestop/collections/granules/..."
        />
        <div className="form-text">OneStop URL for browsing granules belonging to this collection.</div>
      </div>
    </div>
  )
}
