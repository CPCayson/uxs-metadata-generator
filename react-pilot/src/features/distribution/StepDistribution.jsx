import { useFieldValidation } from '../../components/fields/useFieldValidation'

/**
 * @param {{
 *   distribution: object,
 *   onDistPatch: (p: object) => void,
 *   touched: Record<string, boolean>,
 *   onTouched: (key: string) => void,
 *   showAllErrors: boolean,
 *   issues: Array<{ field: string, message: string }>,
 *   hostBridgeReady?: boolean,
 *   onSaveSheetTemplate?: () => void,
 *   sheetTemplateSaveDisabled?: boolean,
 * }} props
 */
export default function StepDistribution({
  distribution,
  onDistPatch,
  touched,
  onTouched,
  showAllErrors,
  issues,
  hostBridgeReady = false,
  onSaveSheetTemplate,
  sheetTemplateSaveDisabled = false,
}) {
  const { show, invalid } = useFieldValidation({ issues, touched, showAllErrors })

  return (
    <>
      <p className="card-intro">
        Distribution and export settings — canonical paths live on <code>distribution.*</code>, in the same scope as
        the historical HTML wizard <code>#outputForm</code> (see §5 of <code>METADATA_FIELD_MAP.md</code>).
      </p>

      <section className="panel">
        <h3 className="panel-title">Metadata standard</h3>
        <label htmlFor="metadataStandard">Metadata standard name</label>
        <input
          id="metadataStandard"
          className="form-control"
          value={distribution.metadataStandard || ''}
          onChange={(e) => onDistPatch({ metadataStandard: e.target.value })}
        />
        <label htmlFor="metadataVersion">Metadata standard version</label>
        <input
          id="metadataVersion"
          className="form-control"
          value={distribution.metadataVersion || ''}
          onChange={(e) => onDistPatch({ metadataVersion: e.target.value })}
        />
        <label htmlFor="metadataMaintenanceFrequency">Maintenance frequency</label>
        <select
          id="metadataMaintenanceFrequency"
          className="form-control form-select"
          value={distribution.metadataMaintenanceFrequency || 'asNeeded'}
          onChange={(e) => onDistPatch({ metadataMaintenanceFrequency: e.target.value })}
        >
          <option value="continual">continual</option>
          <option value="daily">daily</option>
          <option value="weekly">weekly</option>
          <option value="monthly">monthly</option>
          <option value="annually">annually</option>
          <option value="asNeeded">asNeeded</option>
          <option value="irregular">irregular</option>
          <option value="notPlanned">notPlanned</option>
          <option value="unknown">unknown</option>
        </select>
      </section>

      <section className="panel">
        <h3 className="panel-title">Format &amp; transfer</h3>
        <label htmlFor="format">Distribution format (short)</label>
        <input
          id="format"
          className={`form-control${invalid('distribution.format') ? ' form-control--invalid' : ''}`}
          value={distribution.format || ''}
          onChange={(e) => onDistPatch({ format: e.target.value })}
          onBlur={() => onTouched('distribution.format')}
          aria-required
        />
        {show('distribution.format') ? <p className="field-error">{show('distribution.format')}</p> : null}

        <label htmlFor="distributionFormatName">Format name (MD_Format)</label>
        <input
          id="distributionFormatName"
          className="form-control"
          value={distribution.distributionFormatName || ''}
          onChange={(e) => onDistPatch({ distributionFormatName: e.target.value })}
        />
        <label htmlFor="distributionFileFormat">File format detail</label>
        <input
          id="distributionFileFormat"
          className="form-control"
          value={distribution.distributionFileFormat || ''}
          onChange={(e) => onDistPatch({ distributionFileFormat: e.target.value })}
        />

        <label htmlFor="license">Use / license (summary)</label>
        <input
          id="license"
          className={`form-control${invalid('distribution.license') ? ' form-control--invalid' : ''}`}
          value={distribution.license || ''}
          onChange={(e) => onDistPatch({ license: e.target.value })}
          onBlur={() => onTouched('distribution.license')}
          aria-required
        />
        {show('distribution.license') ? <p className="field-error">{show('distribution.license')}</p> : null}

        <label htmlFor="metadataLandingUrl">Metadata landing URL</label>
        <input
          id="metadataLandingUrl"
          className={`form-control${invalid('distribution.metadataLandingUrl') ? ' form-control--invalid' : ''}`}
          value={distribution.metadataLandingUrl || ''}
          onChange={(e) => onDistPatch({ metadataLandingUrl: e.target.value })}
          onBlur={() => onTouched('distribution.metadataLandingUrl')}
        />
        {show('distribution.metadataLandingUrl') ? (
          <p className="field-error">{show('distribution.metadataLandingUrl')}</p>
        ) : null}

        <label htmlFor="metadataLandingLinkName">Metadata record link name</label>
        <input
          id="metadataLandingLinkName"
          className="form-control"
          value={distribution.metadataLandingLinkName || ''}
          onChange={(e) => onDistPatch({ metadataLandingLinkName: e.target.value })}
        />

        <label htmlFor="metadataLandingDescription">Landing link description</label>
        <input
          id="metadataLandingDescription"
          className="form-control"
          value={distribution.metadataLandingDescription || ''}
          onChange={(e) => onDistPatch({ metadataLandingDescription: e.target.value })}
        />

        <label htmlFor="landingUrl">Dataset landing URL</label>
        <input
          id="landingUrl"
          className={`form-control${invalid('distribution.landingUrl') ? ' form-control--invalid' : ''}`}
          value={distribution.landingUrl || ''}
          onChange={(e) => onDistPatch({ landingUrl: e.target.value })}
          onBlur={() => onTouched('distribution.landingUrl')}
        />
        {show('distribution.landingUrl') ? <p className="field-error">{show('distribution.landingUrl')}</p> : null}

        <label htmlFor="downloadUrl">Download URL</label>
        <input
          id="downloadUrl"
          className={`form-control${invalid('distribution.downloadUrl') ? ' form-control--invalid' : ''}`}
          value={distribution.downloadUrl || ''}
          onChange={(e) => onDistPatch({ downloadUrl: e.target.value })}
          onBlur={() => onTouched('distribution.downloadUrl')}
        />
        {show('distribution.downloadUrl') ? <p className="field-error">{show('distribution.downloadUrl')}</p> : null}

        <div className="form-row-2">
          <div>
            <label htmlFor="downloadProtocol">Download protocol</label>
            <input
              id="downloadProtocol"
              className="form-control"
              value={distribution.downloadProtocol || ''}
              onChange={(e) => onDistPatch({ downloadProtocol: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="downloadLinkName">Download link name</label>
            <input
              id="downloadLinkName"
              className="form-control"
              value={distribution.downloadLinkName || ''}
              onChange={(e) => onDistPatch({ downloadLinkName: e.target.value })}
            />
          </div>
        </div>
        <label htmlFor="downloadLinkDescription">Download link description</label>
        <textarea
          id="downloadLinkDescription"
          rows={2}
          className="form-control"
          value={distribution.downloadLinkDescription || ''}
          onChange={(e) => onDistPatch({ downloadLinkDescription: e.target.value })}
        />

        <label htmlFor="distributionFeesText">Distribution fees</label>
        <input
          id="distributionFeesText"
          className="form-control"
          value={distribution.distributionFeesText || ''}
          onChange={(e) => onDistPatch({ distributionFeesText: e.target.value })}
        />
        <label htmlFor="distributionOrderingInstructions">Ordering instructions</label>
        <textarea
          id="distributionOrderingInstructions"
          rows={2}
          className="form-control"
          value={distribution.distributionOrderingInstructions || ''}
          onChange={(e) => onDistPatch({ distributionOrderingInstructions: e.target.value })}
        />

        <h4 className="panel-subtitle">Distributor contact (when not using DocuComp xlink)</h4>
        <label htmlFor="distributorIndividualName">Distributor individual name</label>
        <input
          id="distributorIndividualName"
          className="form-control"
          value={distribution.distributorIndividualName || ''}
          onChange={(e) => onDistPatch({ distributorIndividualName: e.target.value })}
        />
        <label htmlFor="distributorOrganisationName">Distributor organisation</label>
        <input
          id="distributorOrganisationName"
          className="form-control"
          value={distribution.distributorOrganisationName || ''}
          onChange={(e) => onDistPatch({ distributorOrganisationName: e.target.value })}
        />
        <label htmlFor="distributorEmail">Distributor email</label>
        <input
          id="distributorEmail"
          type="email"
          className="form-control"
          value={distribution.distributorEmail || ''}
          onChange={(e) => onDistPatch({ distributorEmail: e.target.value })}
        />
        <label htmlFor="distributorContactUrl">Distributor website URL</label>
        <input
          id="distributorContactUrl"
          type="url"
          className={`form-control${invalid('distribution.distributorContactUrl') ? ' form-control--invalid' : ''}`}
          value={distribution.distributorContactUrl || ''}
          onChange={(e) => onDistPatch({ distributorContactUrl: e.target.value })}
          onBlur={() => onTouched('distribution.distributorContactUrl')}
        />
        {show('distribution.distributorContactUrl') ? (
          <p className="field-error">{show('distribution.distributorContactUrl')}</p>
        ) : null}
      </section>

      <section className="panel">
        <h3 className="panel-title">NCEI / template flags</h3>
        <label className="toggle">
          <input
            type="checkbox"
            checked={Boolean(distribution.useNceiMetadataContactXlink)}
            onChange={(e) => onDistPatch({ useNceiMetadataContactXlink: e.target.checked })}
          />
          <span>Use NCEI metadata contact xlink</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={Boolean(distribution.omitRootReferenceSystemInfo)}
            onChange={(e) => onDistPatch({ omitRootReferenceSystemInfo: e.target.checked })}
          />
          <span>Omit root referenceSystemInfo</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={
              distribution.nceiFileIdPrefix !== false &&
              String(distribution.nceiFileIdPrefix || '').toLowerCase() !== 'false'
            }
            onChange={(e) => onDistPatch({ nceiFileIdPrefix: e.target.checked })}
          />
          <span>
            Prefix file identifier with <code>gov.noaa.ncei.uxs:</code> in XML preview
          </span>
        </label>
        <label htmlFor="nceiMetadataContactHref">NCEI metadata contact href (xlink)</label>
        <input
          id="nceiMetadataContactHref"
          className={`form-control${invalid('distribution.nceiMetadataContactHref') ? ' form-control--invalid' : ''}`}
          value={distribution.nceiMetadataContactHref || ''}
          onChange={(e) => onDistPatch({ nceiMetadataContactHref: e.target.value })}
          onBlur={() => onTouched('distribution.nceiMetadataContactHref')}
          placeholder="https://…"
        />
        {show('distribution.nceiMetadataContactHref') ? (
          <p className="field-error">{show('distribution.nceiMetadataContactHref')}</p>
        ) : null}
        <label htmlFor="nceiMetadataContactTitle">NCEI metadata contact title</label>
        <input
          id="nceiMetadataContactTitle"
          className="form-control"
          value={distribution.nceiMetadataContactTitle || ''}
          onChange={(e) => onDistPatch({ nceiMetadataContactTitle: e.target.value })}
        />
        <label htmlFor="nceiDistributorContactHref">NCEI distributor contact href (xlink)</label>
        <input
          id="nceiDistributorContactHref"
          className={`form-control${invalid('distribution.nceiDistributorContactHref') ? ' form-control--invalid' : ''}`}
          value={distribution.nceiDistributorContactHref || ''}
          onChange={(e) => onDistPatch({ nceiDistributorContactHref: e.target.value })}
          onBlur={() => onTouched('distribution.nceiDistributorContactHref')}
          placeholder="https://…"
        />
        {show('distribution.nceiDistributorContactHref') ? (
          <p className="field-error">{show('distribution.nceiDistributorContactHref')}</p>
        ) : null}
        <label htmlFor="nceiDistributorContactTitle">NCEI distributor contact title</label>
        <input
          id="nceiDistributorContactTitle"
          className="form-control"
          value={distribution.nceiDistributorContactTitle || ''}
          onChange={(e) => onDistPatch({ nceiDistributorContactTitle: e.target.value })}
        />
      </section>

      <section className="panel">
        <h3 className="panel-title">Export routing</h3>
        <p className="card-intro">
          Mirrors classic <code>#outputForm</code> <code>outputLocation</code>, AWS placeholders, and <code>finalNotes</code>.
          AWS fields are editable here for future S3 workflows; the bundled classic HTML may still show them as read-only.
        </p>
        <label htmlFor="outputLocation">Output location</label>
        <select
          id="outputLocation"
          className="form-control form-select"
          value={distribution.outputLocation || 'download'}
          onChange={(e) => onDistPatch({ outputLocation: e.target.value })}
        >
          <option value="download">Download</option>
          <option value="Google Drive">Google Drive</option>
        </select>
        <div className="form-row-2">
          <div>
            <label htmlFor="awsBucket">AWS S3 bucket (optional / future)</label>
            <input
              id="awsBucket"
              className="form-control"
              value={distribution.awsBucket || ''}
              onChange={(e) => onDistPatch({ awsBucket: e.target.value })}
              placeholder="e.g. my-metadata-bucket"
            />
          </div>
          <div>
            <label htmlFor="awsPrefix">AWS S3 prefix (optional / future)</label>
            <input
              id="awsPrefix"
              className="form-control"
              value={distribution.awsPrefix || ''}
              onChange={(e) => onDistPatch({ awsPrefix: e.target.value })}
              placeholder="e.g. missions/2024"
            />
          </div>
        </div>
        <label htmlFor="finalNotes">Final notes (workflow)</label>
        <textarea
          id="finalNotes"
          rows={3}
          className="form-control"
          value={distribution.finalNotes || ''}
          onChange={(e) => onDistPatch({ finalNotes: e.target.value })}
        />
      </section>

      <section className="panel">
        <h3 className="panel-title">Save as sheet template</h3>
        <p className="card-intro">
          Upserts a row in the spreadsheet <strong>Templates</strong> sheet via <code>saveTemplate</code>, same payload
          shape as the Mission <strong>Save full draft</strong> action (full <code>pilot</code> JSON). Load it later from
          the Mission step template picker. Do not use the reserved draft name <code>react-pilot-mission-draft</code> here.
        </p>
        <label htmlFor="sheetTemplateName">Template name</label>
        <input
          id="sheetTemplateName"
          className="form-control"
          value={distribution.templateName || ''}
          onChange={(e) => onDistPatch({ templateName: e.target.value })}
          placeholder="e.g. cruise-2024-default"
        />
        <label htmlFor="sheetTemplateCategory">Category (optional)</label>
        <input
          id="sheetTemplateCategory"
          className="form-control"
          value={distribution.templateCategory || ''}
          onChange={(e) => onDistPatch({ templateCategory: e.target.value })}
          placeholder="Defaults to react-pilot"
        />
        <div className="mission-actions mission-actions--compact">
          <button
            type="button"
            className="button"
            disabled={sheetTemplateSaveDisabled || !String(distribution.templateName || '').trim()}
            onClick={() => onSaveSheetTemplate?.()}
          >
            Save current pilot as template
          </button>
        </div>
        {!hostBridgeReady ? (
          <p className="hint">Saving templates needs a reachable <code>/api/db</code> on the same origin as this app.</p>
        ) : null}
      </section>

      <section className="panel">
        <h3 className="panel-title">Catalog context</h3>
        <label htmlFor="parentProject">Parent project</label>
        <input
          id="parentProject"
          className={`form-control${invalid('distribution.parentProject') ? ' form-control--invalid' : ''}`}
          value={distribution.parentProject || ''}
          onChange={(e) => onDistPatch({ parentProject: e.target.value })}
          onBlur={() => onTouched('distribution.parentProject')}
        />
        {show('distribution.parentProject') ? <p className="field-error">{show('distribution.parentProject')}</p> : null}

        <label htmlFor="publication">Publication reference</label>
        <textarea
          id="publication"
          rows={2}
          className={`form-control${invalid('distribution.publication') ? ' form-control--invalid' : ''}`}
          value={distribution.publication || ''}
          onChange={(e) => onDistPatch({ publication: e.target.value })}
          onBlur={() => onTouched('distribution.publication')}
        />
        {show('distribution.publication') ? <p className="field-error">{show('distribution.publication')}</p> : null}
      </section>
    </>
  )
}
