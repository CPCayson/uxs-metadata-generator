/**
 * BEDI Granule — Step 1: Identification & Linkage
 *
 * The most important field here is parentCollectionId — the link to the
 * parent collection. fileId must also follow the OER namespace pattern.
 */

import { useFieldValidation } from '../../components/fields/useFieldValidation.js'

const PRESENTATION_FORMS = [
  '', 'videoDigital', 'videoHardcopy', 'imageDigital', 'documentDigital', 'documentHardcopy',
]

const GRANULE_HIERARCHY_LEVELS = ['', 'dataset', 'series', 'fieldSession']

export default function StepBediGranuleIdentification({
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

      {/* Parent Collection ID — the critical BEDI field */}
      <div className="mb-3">
        <label className="form-label" htmlFor="bdg-parentId">
          Parent Collection Identifier <span aria-hidden="true">*</span>
        </label>
        <input
          id="bdg-parentId"
          data-pilot-field="parentCollectionId"
          className={`form-control font-monospace${invalid('parentCollectionId') ? ' is-invalid' : ''}`}
          value={s.parentCollectionId || ''}
          onChange={(e) => patch({ parentCollectionId: e.target.value })}
          onBlur={() => onTouched('parentCollectionId')}
          placeholder="gov.noaa.ncei.oer:BIOLUM2009_COLLECTION"
        />
        {show('parentCollectionId') && (
          <div className="invalid-feedback d-block">{show('parentCollectionId')}</div>
        )}
        <div className="form-text">
          Must match the <code>fileId</code> of the parent BEDI Collection record.
          This is the <code>gmd:parentIdentifier</code> in ISO 19139.
        </div>
      </div>

      {/* Optional CoMET / catalog metadata UUID */}
      <div className="mb-3">
        <label className="form-label" htmlFor="bdg-metadataUuid">
          Metadata record UUID (optional)
        </label>
        <input
          id="bdg-metadataUuid"
          data-pilot-field="metadataUuid"
          className="form-control font-monospace"
          value={s.metadataUuid || ''}
          onChange={(e) => patch({ metadataUuid: e.target.value })}
          onBlur={() => onTouched('metadataUuid')}
          placeholder="CoMET UUID — echoed on exported XML root"
          autoComplete="off"
        />
        <div className="form-text">
          Included on exported <code>gmi:MI_Metadata</code> as <code>uuid</code> when present; restored on XML import.
        </div>
      </div>

      {/* File ID */}
      <div className="mb-3">
        <label className="form-label" htmlFor="bdg-fileId">
          File Identifier <span aria-hidden="true">*</span>
        </label>
        <input
          id="bdg-fileId"
          data-pilot-field="fileId"
          className={`form-control font-monospace${invalid('fileId') ? ' is-invalid' : ''}`}
          value={s.fileId || ''}
          onChange={(e) => patch({ fileId: e.target.value })}
          onBlur={() => onTouched('fileId')}
          placeholder="gov.noaa.ncei.oer:BIOLUM2009_VID_20090730_..."
        />
        {show('fileId') && (
          <div className="invalid-feedback d-block">{show('fileId')}</div>
        )}
      </div>

      {/* Granule ID */}
      <div className="mb-3">
        <label className="form-label" htmlFor="bdg-granuleId">
          Granule ID (short) <span aria-hidden="true">*</span>
        </label>
        <input
          id="bdg-granuleId"
          data-pilot-field="granuleId"
          className={`form-control${invalid('granuleId') ? ' is-invalid' : ''}`}
          value={s.granuleId || ''}
          onChange={(e) => patch({ granuleId: e.target.value })}
          onBlur={() => onTouched('granuleId')}
          placeholder="BIOLUM2009_VID_20090730_SIT_DIVE_JSL2-3699_TAPE1OF1_SEG1OF1"
        />
        {show('granuleId') && (
          <div className="invalid-feedback d-block">{show('granuleId')}</div>
        )}
      </div>

      {/* Dive metadata row */}
      <div className="row mb-3 g-2">
        <div className="col-md-4">
          <label className="form-label" htmlFor="bdg-diveId">
            Dive ID <span aria-hidden="true">*</span>
          </label>
          <input
            id="bdg-diveId"
            data-pilot-field="diveId"
            className={`form-control${invalid('diveId') ? ' is-invalid' : ''}`}
            value={s.diveId || ''}
            onChange={(e) => patch({ diveId: e.target.value })}
            onBlur={() => onTouched('diveId')}
            placeholder="JSL2-3699"
          />
          {show('diveId') && (
            <div className="invalid-feedback d-block">{show('diveId')}</div>
          )}
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="bdg-tapeNum">
            Tape Number
          </label>
          <input
            id="bdg-tapeNum"
            data-pilot-field="tapeNumber"
            type="number"
            min="1"
            className="form-control"
            value={s.tapeNumber || ''}
            onChange={(e) => patch({ tapeNumber: e.target.value })}
            onBlur={() => onTouched('tapeNumber')}
            placeholder="1"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="bdg-segNum">
            Segment Number
          </label>
          <input
            id="bdg-segNum"
            data-pilot-field="segmentNumber"
            type="number"
            min="1"
            className="form-control"
            value={s.segmentNumber || ''}
            onChange={(e) => patch({ segmentNumber: e.target.value })}
            onBlur={() => onTouched('segmentNumber')}
            placeholder="1"
          />
        </div>
      </div>

      {/* Title */}
      <div className="mb-3">
        <label className="form-label" htmlFor="bdg-title">
          Title <span aria-hidden="true">*</span>
        </label>
        <input
          id="bdg-title"
          data-pilot-field="title"
          className={`form-control${invalid('title') ? ' is-invalid' : ''}`}
          value={s.title || ''}
          onChange={(e) => patch({ title: e.target.value })}
          onBlur={() => onTouched('title')}
          placeholder="[Collection title] from Dive[ID] recorded at [datetime]..."
        />
        {show('title') && (
          <div className="invalid-feedback d-block">{show('title')}</div>
        )}
      </div>

      {/* Creation Date + Presentation Form */}
      <div className="row mb-3 g-2">
        <div className="col-md-6">
          <label className="form-label" htmlFor="bdg-creationDate">
            Creation Date <span aria-hidden="true">*</span>
          </label>
          <input
            id="bdg-creationDate"
            data-pilot-field="creationDate"
            type="date"
            className={`form-control${invalid('creationDate') ? ' is-invalid' : ''}`}
            value={s.creationDate?.split('T')[0] || ''}
            onChange={(e) => patch({ creationDate: e.target.value })}
            onBlur={() => onTouched('creationDate')}
          />
          {show('creationDate') && (
            <div className="invalid-feedback d-block">{show('creationDate')}</div>
          )}
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="bdg-presForm">
            Presentation Form <span aria-hidden="true">*</span>
          </label>
          <select
            id="bdg-presForm"
            data-pilot-field="presentationForm"
            className={`form-select${invalid('presentationForm') ? ' is-invalid' : ''}`}
            value={s.presentationForm || ''}
            onChange={(e) => patch({ presentationForm: e.target.value })}
            onBlur={() => onTouched('presentationForm')}
          >
            {PRESENTATION_FORMS.map((o) => (
              <option key={o} value={o}>{o || '— select —'}</option>
            ))}
          </select>
          {show('presentationForm') && (
            <div className="invalid-feedback d-block">{show('presentationForm')}</div>
          )}
        </div>
      </div>

      {/* Hierarchy (defaults are correct for BEDI; exposed for import repair & issue navigation) */}
      <div className="row mb-0 g-2">
        <div className="col-md-6">
          <label className="form-label" htmlFor="bdg-hierarchyLevel">
            Hierarchy level
          </label>
          <select
            id="bdg-hierarchyLevel"
            data-pilot-field="hierarchyLevel"
            className={`form-select${invalid('hierarchyLevel') ? ' is-invalid' : ''}`}
            value={s.hierarchyLevel || ''}
            onChange={(e) => patch({ hierarchyLevel: e.target.value })}
            onBlur={() => onTouched('hierarchyLevel')}
          >
            {GRANULE_HIERARCHY_LEVELS.map((o) => (
              <option key={o || 'empty'} value={o}>{o || '— select —'}</option>
            ))}
          </select>
          {show('hierarchyLevel') && (
            <div className="invalid-feedback d-block">{show('hierarchyLevel')}</div>
          )}
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="bdg-hierarchyLevelName">
            Hierarchy level name
          </label>
          <input
            id="bdg-hierarchyLevelName"
            data-pilot-field="hierarchyLevelName"
            className={`form-control${invalid('hierarchyLevelName') ? ' is-invalid' : ''}`}
            value={s.hierarchyLevelName || ''}
            onChange={(e) => patch({ hierarchyLevelName: e.target.value })}
            onBlur={() => onTouched('hierarchyLevelName')}
            placeholder="Granule"
          />
          {show('hierarchyLevelName') && (
            <div className="invalid-feedback d-block">{show('hierarchyLevelName')}</div>
          )}
        </div>
      </div>
    </div>
  )
}
