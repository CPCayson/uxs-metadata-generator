/**
 * BEDI Granule — Step 3: Links & Keywords
 *
 * Covers: oerKeywords, dataCenterKeyword, instrumentKeyword,
 * parentCollectionRef, parentCollectionLandingUrl, diveSummaryReportUrl,
 * contactNceiHref, granulesSearchUrl,
 * videoFormat, videoFilename, landingPageUrl, observationVariables.
 */

import { useFieldValidation } from '../../components/fields/useFieldValidation.js'

export default function StepBediGranuleDistribution({
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

  function patchArray(field, raw) {
    const items = raw.split(',').map((x) => x.trim()).filter(Boolean)
    patch({ [field]: items })
  }

  const { show, invalid } = useFieldValidation({ issues, touched, showAllErrors })

  return (
    <div className="pilot-step-fields">

      {/* Aggregation — parent collection reference */}
      <fieldset className="mb-4 p-3 border rounded">
        <legend className="form-label fw-semibold">Parent Collection Reference</legend>
        <p className="text-muted small">
          Aggregation links that associate this granule with its parent collection (largerWorkCitation).
        </p>

        <div className="mb-3">
          <label className="form-label" htmlFor="bdg-parentCollRef">
            Collection Name (largerWorkCitation) <span aria-hidden="true">*</span>
          </label>
          <input
            id="bdg-parentCollRef"
            data-pilot-field="parentCollectionRef"
            className={`form-control${invalid('parentCollectionRef') ? ' is-invalid' : ''}`}
            value={s.parentCollectionRef || ''}
            onChange={(e) => patch({ parentCollectionRef: e.target.value })}
            onBlur={() => onTouched('parentCollectionRef')}
            placeholder="Biolum2009"
          />
          {show('parentCollectionRef') && (
            <div className="invalid-feedback d-block">{show('parentCollectionRef')}</div>
          )}
        </div>

        <div className="mb-3">
          <label className="form-label" htmlFor="bdg-parentCollUrl">
            Parent Collection NCEI Landing Page URL
          </label>
          <input
            id="bdg-parentCollUrl"
            data-pilot-field="parentCollectionLandingUrl"
            className="form-control"
            value={s.parentCollectionLandingUrl || ''}
            onChange={(e) => patch({ parentCollectionLandingUrl: e.target.value })}
            onBlur={() => onTouched('parentCollectionLandingUrl')}
            placeholder="https://www.ncei.noaa.gov/access/metadata/landing-page/bin/iso?id=gov.noaa.nodc:..."
          />
        </div>

        <div className="mb-0">
          <label className="form-label" htmlFor="bdg-diveSummaryUrl">
            Dive Summary Report URL (crossReference)
          </label>
          <input
            id="bdg-diveSummaryUrl"
            data-pilot-field="diveSummaryReportUrl"
            className="form-control"
            value={s.diveSummaryReportUrl || ''}
            onChange={(e) => patch({ diveSummaryReportUrl: e.target.value })}
            onBlur={() => onTouched('diveSummaryReportUrl')}
            placeholder="https://..."
          />
        </div>
      </fieldset>

      {/* Keywords */}
      <div className="mb-3">
        <label className="form-label" htmlFor="bdg-dataCenterKw">
          Data Center Keyword <span aria-hidden="true">*</span>
        </label>
        <input
          id="bdg-dataCenterKw"
          data-pilot-field="dataCenterKeyword"
          className={`form-control${invalid('dataCenterKeyword') ? ' is-invalid' : ''}`}
          value={s.dataCenterKeyword || ''}
          onChange={(e) => patch({ dataCenterKeyword: e.target.value })}
          onBlur={() => onTouched('dataCenterKeyword')}
          placeholder="US DOC; NOAA; OAR; Office of Ocean Exploration and Research"
        />
        {show('dataCenterKeyword') && (
          <div className="invalid-feedback d-block">{show('dataCenterKeyword')}</div>
        )}
        <div className="form-text">From NCEI Submitting Institution Names Thesaurus.</div>
        <label className="form-label mt-2" htmlFor="bdg-dataCenterKwHref">
          Optional GCMD concept URL (data center)
        </label>
        <input
          id="bdg-dataCenterKwHref"
          data-pilot-field="dataCenterKeywordHref"
          className="form-control font-monospace"
          value={s.dataCenterKeywordHref || ''}
          onChange={(e) => patch({ dataCenterKeywordHref: e.target.value })}
          onBlur={() => onTouched('dataCenterKeywordHref')}
          placeholder="https://gcmd.earthdata.nasa.gov/kms/concepts/concept/..."
        />
      </div>

      <div className="mb-3">
        <label className="form-label" htmlFor="bdg-instrumentKw">
          Instrument Keyword <span aria-hidden="true">*</span>
        </label>
        <input
          id="bdg-instrumentKw"
          data-pilot-field="instrumentKeyword"
          className={`form-control${invalid('instrumentKeyword') ? ' is-invalid' : ''}`}
          value={s.instrumentKeyword || ''}
          onChange={(e) => patch({ instrumentKeyword: e.target.value })}
          onBlur={() => onTouched('instrumentKeyword')}
          placeholder="video camera"
        />
        {show('instrumentKeyword') && (
          <div className="invalid-feedback d-block">{show('instrumentKeyword')}</div>
        )}
        <div className="form-text">From NCEI Instrument Types Thesaurus.</div>
        <label className="form-label mt-2" htmlFor="bdg-instrumentKwHref">
          Optional GCMD concept URL (instrument)
        </label>
        <input
          id="bdg-instrumentKwHref"
          data-pilot-field="instrumentKeywordHref"
          className="form-control font-monospace"
          value={s.instrumentKeywordHref || ''}
          onChange={(e) => patch({ instrumentKeywordHref: e.target.value })}
          onBlur={() => onTouched('instrumentKeywordHref')}
          placeholder="https://gcmd.earthdata.nasa.gov/kms/concepts/concept/..."
        />
      </div>

      <div className="mb-3">
        <label className="form-label" htmlFor="bdg-oerKw">
          OER Theme Keywords
        </label>
        <textarea
          id="bdg-oerKw"
          data-pilot-field="oerKeywords"
          rows={2}
          className="form-control"
          value={(s.oerKeywords || []).join(', ')}
          onChange={(e) => patchArray('oerKeywords', e.target.value)}
          onBlur={() => onTouched('oerKeywords')}
          placeholder="bioluminescence, exploration, biota, ..."
        />
        <div className="form-text">Comma-separated free-text keywords.</div>
      </div>

      {/* Video / Distribution */}
      <fieldset className="mb-3 p-3 border rounded">
        <legend className="form-label fw-semibold">Video / NCEI distribution</legend>

        <div className="mb-3">
          <label className="form-label" htmlFor="bdg-contactOerHref">
            NOAA Ocean Exploration contact URL (identification POC xlink)
          </label>
          <input
            id="bdg-contactOerHref"
            data-pilot-field="contactOerHref"
            className="form-control font-monospace"
            value={s.contactOerHref || ''}
            onChange={(e) => patch({ contactOerHref: e.target.value })}
            onBlur={() => onTouched('contactOerHref')}
            placeholder="https://oceanexplorer.noaa.gov/... (optional)"
          />
        </div>

        <div className="mb-3">
          <label className="form-label" htmlFor="bdg-contactPiHref">
            PI docucomp contact URL (identification POC xlink)
          </label>
          <input
            id="bdg-contactPiHref"
            data-pilot-field="contactPiHref"
            className="form-control font-monospace"
            value={s.contactPiHref || ''}
            onChange={(e) => patch({ contactPiHref: e.target.value })}
            onBlur={() => onTouched('contactPiHref')}
            placeholder="https://... (optional)"
          />
        </div>

        <div className="mb-3">
          <label className="form-label" htmlFor="bdg-contactNceiHref">
            NCEI distributor contact URL (docucomp)
          </label>
          <input
            id="bdg-contactNceiHref"
            data-pilot-field="contactNceiHref"
            className="form-control font-monospace"
            value={s.contactNceiHref || ''}
            onChange={(e) => patch({ contactNceiHref: e.target.value })}
            onBlur={() => onTouched('contactNceiHref')}
            placeholder="https://www.ncei.noaa.gov/... (optional xlink for distributorContact)"
          />
        </div>

        <div className="mb-3">
          <label className="form-label" htmlFor="bdg-granulesSearchUrl">
            Granule search URL (OneStop)
          </label>
          <input
            id="bdg-granulesSearchUrl"
            data-pilot-field="granulesSearchUrl"
            className="form-control font-monospace"
            value={s.granulesSearchUrl || ''}
            onChange={(e) => patch({ granulesSearchUrl: e.target.value })}
            onBlur={() => onTouched('granulesSearchUrl')}
            placeholder="https://data.noaa.gov/onestop/collections/granules/..."
          />
        </div>

        <div className="row g-2">
          <div className="col-md-4">
            <label className="form-label" htmlFor="bdg-videoFormat">
              Format
            </label>
            <input
              id="bdg-videoFormat"
              data-pilot-field="videoFormat"
              className="form-control"
              value={s.videoFormat || ''}
              onChange={(e) => patch({ videoFormat: e.target.value })}
              onBlur={() => onTouched('videoFormat')}
              placeholder="MP4"
            />
          </div>
          <div className="col-md-8">
            <label className="form-label" htmlFor="bdg-videoFilename">
              Filename
            </label>
            <input
              id="bdg-videoFilename"
              data-pilot-field="videoFilename"
              className="form-control"
              value={s.videoFilename || ''}
              onChange={(e) => patch({ videoFilename: e.target.value })}
              onBlur={() => onTouched('videoFilename')}
              placeholder="BIOLUM2009_VID_...SEG1OF1.mp4"
            />
          </div>
        </div>

        <div className="mt-2">
          <label className="form-label" htmlFor="bdg-landingPageUrl">
            Landing Page URL
          </label>
          <input
            id="bdg-landingPageUrl"
            data-pilot-field="landingPageUrl"
            className="form-control"
            value={s.landingPageUrl || ''}
            onChange={(e) => patch({ landingPageUrl: e.target.value })}
            onBlur={() => onTouched('landingPageUrl')}
            placeholder="https://www.ncei.noaa.gov/..."
          />
        </div>
      </fieldset>

      {/* Observation Variables */}
      <div className="mb-3">
        <label className="form-label" htmlFor="bdg-obsVars">
          Observation Variables
        </label>
        <input
          id="bdg-obsVars"
          data-pilot-field="observationVariables"
          className="form-control"
          value={(s.observationVariables || []).join(', ')}
          onChange={(e) => patchArray('observationVariables', e.target.value)}
          onBlur={() => onTouched('observationVariables')}
          placeholder="Bioluminescence, species observations, ..."
        />
        <div className="form-text">Comma-separated — from gmd:contentInfo.</div>
      </div>
    </div>
  )
}
