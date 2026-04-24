/**
 * BEDI Collection — Step 1: Identification
 *
 * Covers: fileId, collectionId, nceiAccessionId, nceiMetadataId,
 * hierarchyLevel, title, alternateTitle, vesselName, creationDate.
 *
 * BEDI state is flat (not nested), so patches go directly on pilotState.
 */

import { useFieldValidation } from '../../components/fields/useFieldValidation.js'

const HIERARCHY_OPTIONS = ['', 'fieldSession', 'series', 'dataset']

export default function StepBediCollectionIdentification({
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
      <p className="text-muted small mb-4">
        Required identifiers for an OER BEDI collection (fieldSession-level metadata).
      </p>

      {/* File ID */}
      <div className="mb-3">
        <label className="form-label" htmlFor="bdc-fileId">
          File Identifier <span aria-hidden="true">*</span>
        </label>
        <input
          id="bdc-fileId"
          data-pilot-field="fileId"
          className={`form-control font-monospace${invalid('fileId') ? ' is-invalid' : ''}`}
          value={s.fileId || ''}
          onChange={(e) => patch({ fileId: e.target.value })}
          onBlur={() => onTouched('fileId')}
          placeholder="gov.noaa.ncei.oer:BIOLUM2009_COLLECTION"
        />
        {show('fileId') && (
          <div className="invalid-feedback d-block">{show('fileId')}</div>
        )}
        <div className="form-text">Must follow pattern: <code>gov.noaa.ncei.oer:&lt;ID&gt;</code></div>
      </div>

      {/* Optional CoMET / catalog metadata UUID (root xml uuid) */}
      <div className="mb-3">
        <label className="form-label" htmlFor="bdc-metadataUuid">
          Metadata record UUID (optional)
        </label>
        <input
          id="bdc-metadataUuid"
          data-pilot-field="metadataUuid"
          className="form-control font-monospace"
          value={s.metadataUuid || ''}
          onChange={(e) => patch({ metadataUuid: e.target.value })}
          onBlur={() => onTouched('metadataUuid')}
          placeholder="e.g. a1b2c3d4-e5f6-7890-abcd-ef1234567890 (root MI_Metadata uuid)"
          autoComplete="off"
        />
        <div className="form-text">
          When set, XML preview and download include this value on <code>gmi:MI_Metadata</code>.
          Import from XML restores it from the same attribute.
        </div>
      </div>

      {/* Short collection ID + NCEI Accession */}
      <div className="row mb-3">
        <div className="col-md-6">
          <label className="form-label" htmlFor="bdc-collectionId">
            Short Collection ID <span aria-hidden="true">*</span>
          </label>
          <input
            id="bdc-collectionId"
            data-pilot-field="collectionId"
            className={`form-control${invalid('collectionId') ? ' is-invalid' : ''}`}
            value={s.collectionId || ''}
            onChange={(e) => patch({ collectionId: e.target.value })}
            onBlur={() => onTouched('collectionId')}
            placeholder="e.g. Biolum2009"
          />
          {show('collectionId') && (
            <div className="invalid-feedback d-block">{show('collectionId')}</div>
          )}
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="bdc-accession">
            NCEI Accession ID <span aria-hidden="true">*</span>
          </label>
          <input
            id="bdc-accession"
            data-pilot-field="nceiAccessionId"
            className={`form-control${invalid('nceiAccessionId') ? ' is-invalid' : ''}`}
            value={s.nceiAccessionId || ''}
            onChange={(e) => patch({ nceiAccessionId: e.target.value })}
            onBlur={() => onTouched('nceiAccessionId')}
            placeholder="e.g. 0039615"
          />
          {show('nceiAccessionId') && (
            <div className="invalid-feedback d-block">{show('nceiAccessionId')}</div>
          )}
          <div className="form-text">Numeric ID from NCEI Archive Management System</div>
        </div>
      </div>

      {/* NCEI Metadata ID */}
      <div className="mb-3">
        <label className="form-label" htmlFor="bdc-nceiMetadataId">
          NCEI Metadata ID
        </label>
        <input
          id="bdc-nceiMetadataId"
          data-pilot-field="nceiMetadataId"
          className={`form-control font-monospace${invalid('nceiMetadataId') ? ' is-invalid' : ''}`}
          value={s.nceiMetadataId || ''}
          onChange={(e) => patch({ nceiMetadataId: e.target.value })}
          onBlur={() => onTouched('nceiMetadataId')}
          placeholder="gov.noaa.ncei.oer:BIOLUM2009_COLLECTION"
        />
        {show('nceiMetadataId') && (
          <div className="invalid-feedback d-block">{show('nceiMetadataId')}</div>
        )}
      </div>

      {/* Hierarchy Level */}
      <div className="row mb-3">
        <div className="col-md-6">
          <label className="form-label" htmlFor="bdc-hierarchyLevel">
            Hierarchy Level <span aria-hidden="true">*</span>
          </label>
          <select
            id="bdc-hierarchyLevel"
            data-pilot-field="hierarchyLevel"
            className={`form-select${invalid('hierarchyLevel') ? ' is-invalid' : ''}`}
            value={s.hierarchyLevel || ''}
            onChange={(e) => patch({ hierarchyLevel: e.target.value })}
            onBlur={() => onTouched('hierarchyLevel')}
          >
            {HIERARCHY_OPTIONS.map((o) => (
              <option key={o} value={o}>{o || '— select —'}</option>
            ))}
          </select>
          {show('hierarchyLevel') && (
            <div className="invalid-feedback d-block">{show('hierarchyLevel')}</div>
          )}
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="bdc-creationDate">
            Creation Date <span aria-hidden="true">*</span>
          </label>
          <input
            id="bdc-creationDate"
            data-pilot-field="creationDate"
            type="date"
            className={`form-control${invalid('creationDate') ? ' is-invalid' : ''}`}
            value={s.creationDate || ''}
            onChange={(e) => patch({ creationDate: e.target.value })}
            onBlur={() => onTouched('creationDate')}
          />
          {show('creationDate') && (
            <div className="invalid-feedback d-block">{show('creationDate')}</div>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="mb-3">
        <label className="form-label" htmlFor="bdc-title">
          Title <span aria-hidden="true">*</span>
        </label>
        <input
          id="bdc-title"
          data-pilot-field="title"
          className={`form-control${invalid('title') ? ' is-invalid' : ''}`}
          value={s.title || ''}
          onChange={(e) => patch({ title: e.target.value })}
          onBlur={() => onTouched('title')}
          placeholder="e.g. Bioluminescence- Living light on the deep sea floor 2009"
        />
        {show('title') && (
          <div className="invalid-feedback d-block">{show('title')}</div>
        )}
      </div>

      {/* Alternate Title + Vessel Name */}
      <div className="row mb-3">
        <div className="col-md-6">
          <label className="form-label" htmlFor="bdc-alternateTitle">
            Alternate Title
          </label>
          <input
            id="bdc-alternateTitle"
            data-pilot-field="alternateTitle"
            className="form-control"
            value={s.alternateTitle || ''}
            onChange={(e) => patch({ alternateTitle: e.target.value })}
            onBlur={() => onTouched('alternateTitle')}
            placeholder="Dataset alternate title"
          />
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="bdc-vesselName">
            Vessel Name
          </label>
          <input
            id="bdc-vesselName"
            data-pilot-field="vesselName"
            className="form-control"
            value={s.vesselName || ''}
            onChange={(e) => patch({ vesselName: e.target.value })}
            onBlur={() => onTouched('vesselName')}
            placeholder="e.g. R/V Seward Johnson I"
          />
        </div>
      </div>
    </div>
  )
}
