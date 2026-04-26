import { useState } from 'react'
import { searchRorOrganizationsClient } from '../../lib/rorClient'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../../lib/datetimeLocal'
import { useFieldValidation } from '../../components/fields/useFieldValidation'
import { UXS_LAYER_OPTIONS, UXS_OUTCOME_OPTIONS, getUxsLayerDefinition } from '../../lib/uxsOperationalModel.js'

/**
 * @param {{
 *   mission: object,
 *   onMissionPatch: (p: object) => void,
 *   touched: Record<string, boolean>,
 *   onTouched: (key: string) => void,
 *   showAllErrors: boolean,
 *   issues: Array<{ field: string, message: string, severity: string }>,
 *   onLoadDraft: () => void,
 *   onSaveDraft: () => void,
 *   loadDisabled: boolean,
 *   saveDisabled: boolean,
 *   draftStatus: { timestamp?: string | null, source?: string },
 *   hostBridgeReady?: boolean,
 *   templateCatalogRows?: Array<{ key: string, name: string, category?: string }>,
 *   templateCatalogLoading?: boolean,
 *   templateCatalogError?: string,
 *   onRefreshTemplateCatalog?: () => void,
 *   onApplySheetTemplate?: (name: string) => void,
 *   templateApplyDisabled?: boolean,
 * }} props
 */
export default function StepMission({
  mission,
  onMissionPatch,
  touched,
  onTouched,
  showAllErrors,
  issues,
  onLoadDraft,
  onSaveDraft,
  loadDisabled,
  saveDisabled,
  draftStatus,
  hostBridgeReady = false,
  templateCatalogRows = [],
  templateCatalogLoading = false,
  templateCatalogError = '',
  onRefreshTemplateCatalog,
  onApplySheetTemplate,
  templateApplyDisabled = false,
}) {
  const [rorQuery, setRorQuery] = useState('')
  const [rorLoading, setRorLoading] = useState(false)
  const [rorResults, setRorResults] = useState([])
  const [rorError, setRorError] = useState('')
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('')

  const { show, invalid } = useFieldValidation({ issues, touched, showAllErrors })

  async function runRorSearch() {
    setRorError('')
    setRorLoading(true)
    setRorResults([])
    try {
      const rows = await searchRorOrganizationsClient(rorQuery, { limit: 8 })
      setRorResults(rows)
    } catch (e) {
      setRorError(e instanceof Error ? e.message : 'ROR search failed')
    } finally {
      setRorLoading(false)
    }
  }

  function selectRor(org) {
    onMissionPatch({
      ror: { id: org.id, name: org.displayName, country: org.country, types: org.types },
      org: mission.org || org.displayName,
    })
    setRorResults([])
    setRorQuery('')
    onTouched('mission.ror')
  }

  function clearRor() {
    onMissionPatch({ ror: null })
  }

  const hasDraftTimestamp = typeof draftStatus?.timestamp === 'string' && draftStatus.timestamp.trim()
  let draftLabel = ''
  if (hasDraftTimestamp) {
    const parsed = new Date(draftStatus.timestamp)
    draftLabel = Number.isNaN(parsed.getTime()) ? draftStatus.timestamp : parsed.toLocaleString()
  }
  const uxsContext = mission.uxsContext && typeof mission.uxsContext === 'object' ? mission.uxsContext : {}
  const uxsLayer = getUxsLayerDefinition(uxsContext)

  function patchUxsContext(patch) {
    onMissionPatch({
      uxsContext: {
        ...uxsContext,
        ...patch,
      },
    })
  }

  return (
    <>
      <p className="card-intro">
        <strong>Required for export</strong> in the current mode: identifiers, title, abstract, purpose, period, contact,
        status, and language. <strong>Optional</strong> below: UxS operational context, supplemental text, and aggregation.
        Bbox, CRS, and data-quality detail live on the <strong>Spatial</strong> step.
      </p>

      <section className="panel" aria-labelledby="uxs-context-heading">
        <h3 className="panel-title" id="uxs-context-heading">UxS collection context</h3>
        <p className="hint" id="uxs-context-help">
          NOAA UxS records often sit in a stack: program → deployment → run → sortie or dive → dataset/product.
          Capture the operational layer here so runs and dives are not hidden only in the title or abstract.
        </p>
        <div className="form-row-2">
          <div>
            <label htmlFor="uxsPrimaryLayer">This metadata record primarily describes</label>
            <select
              id="uxsPrimaryLayer"
              className="form-control"
              data-pilot-field="mission.uxsContext.primaryLayer"
              value={uxsContext.primaryLayer || 'datasetProduct'}
              onChange={(e) => patchUxsContext({ primaryLayer: e.target.value })}
              onBlur={() => onTouched('mission.uxsContext.primaryLayer')}
              aria-describedby="uxs-context-help"
            >
              {UXS_LAYER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="hint">
              Parent project below is the program citation; this block is the operational unit the data came from.
              {uxsLayer.idField ? ` Catalog mode expects ${uxsLayer.label.toLowerCase()} ID/name fields when this layer is selected.` : ''}
            </p>
          </div>
          <div>
            <label htmlFor="uxsOperationOutcome">Operation outcome</label>
            <select
              id="uxsOperationOutcome"
              className="form-control"
              data-pilot-field="mission.uxsContext.operationOutcome"
              value={uxsContext.operationOutcome || ''}
              onChange={(e) => patchUxsContext({ operationOutcome: e.target.value })}
              onBlur={() => onTouched('mission.uxsContext.operationOutcome')}
            >
              {UXS_OUTCOME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="hint">
              Operational outcome for filtering sorties/runs; separate from dataset status / <code>MD_ProgressCode</code>.
            </p>
          </div>
        </div>

        <details>
          <summary>Deployment, run, sortie, and dive identifiers</summary>
          <p className="hint">
            Use field-log labels and IDs where available. These are optional in this first slice and prepare the archive
            search model before XML aggregation export is expanded.
          </p>
          <div className="form-row-2">
            <div>
              <label htmlFor="uxsDeploymentName">Deployment name</label>
              <input
                id="uxsDeploymentName"
                className="form-control"
                data-pilot-field="mission.uxsContext.deploymentName"
                value={uxsContext.deploymentName || ''}
                onChange={(e) => patchUxsContext({ deploymentName: e.target.value })}
                onBlur={() => onTouched('mission.uxsContext.deploymentName')}
              />
            </div>
            <div>
              <label htmlFor="uxsDeploymentId">Deployment ID</label>
              <input
                id="uxsDeploymentId"
                className="form-control"
                data-pilot-field="mission.uxsContext.deploymentId"
                value={uxsContext.deploymentId || ''}
                onChange={(e) => patchUxsContext({ deploymentId: e.target.value })}
                onBlur={() => onTouched('mission.uxsContext.deploymentId')}
              />
            </div>
          </div>
          <div className="form-row-2">
            <div>
              <label htmlFor="uxsRunName">Run name</label>
              <input
                id="uxsRunName"
                className="form-control"
                data-pilot-field="mission.uxsContext.runName"
                value={uxsContext.runName || ''}
                onChange={(e) => patchUxsContext({ runName: e.target.value })}
                onBlur={() => onTouched('mission.uxsContext.runName')}
              />
            </div>
            <div>
              <label htmlFor="uxsRunId">Run ID</label>
              <input
                id="uxsRunId"
                className="form-control"
                data-pilot-field="mission.uxsContext.runId"
                value={uxsContext.runId || ''}
                onChange={(e) => patchUxsContext({ runId: e.target.value })}
                onBlur={() => onTouched('mission.uxsContext.runId')}
              />
            </div>
          </div>
          <div className="form-row-2">
            <div>
              <label htmlFor="uxsSortieName">Sortie name</label>
              <input
                id="uxsSortieName"
                className="form-control"
                data-pilot-field="mission.uxsContext.sortieName"
                value={uxsContext.sortieName || ''}
                onChange={(e) => patchUxsContext({ sortieName: e.target.value })}
                onBlur={() => onTouched('mission.uxsContext.sortieName')}
              />
            </div>
            <div>
              <label htmlFor="uxsSortieId">Sortie ID</label>
              <input
                id="uxsSortieId"
                className="form-control"
                data-pilot-field="mission.uxsContext.sortieId"
                value={uxsContext.sortieId || ''}
                onChange={(e) => patchUxsContext({ sortieId: e.target.value })}
                onBlur={() => onTouched('mission.uxsContext.sortieId')}
              />
            </div>
          </div>
          <div className="form-row-2">
            <div>
              <label htmlFor="uxsDiveName">Dive name</label>
              <input
                id="uxsDiveName"
                className="form-control"
                data-pilot-field="mission.uxsContext.diveName"
                value={uxsContext.diveName || ''}
                onChange={(e) => patchUxsContext({ diveName: e.target.value })}
                onBlur={() => onTouched('mission.uxsContext.diveName')}
              />
            </div>
            <div>
              <label htmlFor="uxsDiveId">Dive ID</label>
              <input
                id="uxsDiveId"
                className="form-control"
                data-pilot-field="mission.uxsContext.diveId"
                value={uxsContext.diveId || ''}
                onChange={(e) => patchUxsContext({ diveId: e.target.value })}
                onBlur={() => onTouched('mission.uxsContext.diveId')}
              />
            </div>
          </div>
          <label htmlFor="uxsContextNarrative">Operational context note</label>
          <textarea
            id="uxsContextNarrative"
            rows={2}
            className="form-control"
            data-pilot-field="mission.uxsContext.narrative"
            value={uxsContext.narrative || ''}
            onChange={(e) => patchUxsContext({ narrative: e.target.value })}
            onBlur={() => onTouched('mission.uxsContext.narrative')}
          />
        </details>
      </section>

      <section className="panel">
        <h3 className="panel-title">Identification</h3>
        <label htmlFor="fileId">File identifier</label>
        <input
          id="fileId"
          className={`form-control${invalid('mission.fileId') ? ' form-control--invalid' : ''}`}
          data-pilot-field="mission.fileId"
          value={mission.fileId}
          onChange={(e) => onMissionPatch({ fileId: e.target.value })}
          onBlur={() => onTouched('mission.fileId')}
          aria-invalid={invalid('mission.fileId')}
          aria-required
        />
        <p className="hint">
          NCEI file identifier; optional <code>gov.noaa.ncei.uxs:</code> prefix. Legacy <code>missionId</code> maps here when
          empty.
        </p>
        {show('mission.fileId') ? <p className="field-error">{show('mission.fileId')}</p> : null}

        <label htmlFor="title">Title</label>
        <input
          id="title"
          className={`form-control${invalid('mission.title') ? ' form-control--invalid' : ''}`}
          data-pilot-field="mission.title"
          value={mission.title}
          onChange={(e) => onMissionPatch({ title: e.target.value })}
          onBlur={() => onTouched('mission.title')}
          aria-required
        />
        {show('mission.title') ? <p className="field-error">{show('mission.title')}</p> : null}

        <label htmlFor="alternateTitle">Alternate title</label>
        <input
          id="alternateTitle"
          className="form-control"
          data-pilot-field="mission.alternateTitle"
          value={mission.alternateTitle || ''}
          onChange={(e) => onMissionPatch({ alternateTitle: e.target.value })}
        />

        <label htmlFor="abstract">Abstract</label>
        <textarea
          id="abstract"
          rows={4}
          className={`form-control${invalid('mission.abstract') ? ' form-control--invalid' : ''}`}
          data-pilot-field="mission.abstract"
          value={mission.abstract}
          onChange={(e) => onMissionPatch({ abstract: e.target.value })}
          onBlur={() => onTouched('mission.abstract')}
          aria-required
        />
        {show('mission.abstract') ? <p className="field-error">{show('mission.abstract')}</p> : null}

        <label htmlFor="purpose">Purpose (dataset)</label>
        <textarea
          id="purpose"
          rows={2}
          className={`form-control${invalid('mission.purpose') ? ' form-control--invalid' : ''}`}
          data-pilot-field="mission.purpose"
          value={mission.purpose || ''}
          onChange={(e) => onMissionPatch({ purpose: e.target.value })}
          onBlur={() => onTouched('mission.purpose')}
          aria-required
        />
        {show('mission.purpose') ? <p className="field-error">{show('mission.purpose')}</p> : null}

        <label htmlFor="supplementalInformation">Supplemental information</label>
        <textarea
          id="supplementalInformation"
          rows={2}
          className="form-control"
          data-pilot-field="mission.supplementalInformation"
          value={mission.supplementalInformation || ''}
          onChange={(e) => onMissionPatch({ supplementalInformation: e.target.value })}
        />

        <div className="form-row-2">
          <div>
            <label htmlFor="startDate">Start date *</label>
            <input
              id="startDate"
              type="datetime-local"
              className={`form-control${invalid('mission.startDate') ? ' form-control--invalid' : ''}`}
              data-pilot-field="mission.startDate"
              value={toDatetimeLocalValue(mission.startDate)}
              onChange={(e) => onMissionPatch({ startDate: fromDatetimeLocalValue(e.target.value) })}
              onBlur={() => onTouched('mission.startDate')}
              aria-required
            />
            {show('mission.startDate') ? <p className="field-error">{show('mission.startDate')}</p> : null}
          </div>
          <div>
            <label htmlFor="endDate">End date *</label>
            <input
              id="endDate"
              type="datetime-local"
              className={`form-control${invalid('mission.endDate') ? ' form-control--invalid' : ''}`}
              data-pilot-field="mission.endDate"
              value={toDatetimeLocalValue(mission.endDate)}
              onChange={(e) => onMissionPatch({ endDate: fromDatetimeLocalValue(e.target.value) })}
              onBlur={() => onTouched('mission.endDate')}
              aria-required
            />
            {show('mission.endDate') ? <p className="field-error">{show('mission.endDate')}</p> : null}
          </div>
        </div>
        <p className="hint">
          <strong>Dataset period</strong> for citation creation / completion and <code>gml:TimePeriod</code> in the
          XML preview — not the same as <em>metadata record date</em> below (when the metadata document itself was
          prepared).
        </p>

        <div className="form-row-2">
          <div>
            <label htmlFor="temporalExtentIntervalUnit">
              Temporal sampling interval unit (<code>gml:timeInterval</code> @unit)
            </label>
            <input
              id="temporalExtentIntervalUnit"
              className="form-control"
              data-pilot-field="mission.temporalExtentIntervalUnit"
              placeholder="e.g., day, hour, or UOM URI"
              value={mission.temporalExtentIntervalUnit || ''}
              onChange={(e) => onMissionPatch({ temporalExtentIntervalUnit: e.target.value })}
            />
            <p className="hint">
              Optional. NOAA template uses a unit token with a numeric value below.
            </p>
          </div>
          <div>
            <label htmlFor="temporalExtentIntervalValue">Temporal sampling interval value</label>
            <input
              id="temporalExtentIntervalValue"
              className="form-control"
              data-pilot-field="mission.temporalExtentIntervalValue"
              placeholder="e.g., 1"
              value={mission.temporalExtentIntervalValue || ''}
              onChange={(e) => onMissionPatch({ temporalExtentIntervalValue: e.target.value })}
            />
            <p className="hint">
              Paired with interval unit for <code>gml:timeInterval</code> inside acquisition period.
            </p>
          </div>
        </div>

        <div className="form-row-2">
          <div>
            <label htmlFor="metadataRecordDate">Metadata record date (<code>gmd:dateStamp</code>)</label>
            <input
              id="metadataRecordDate"
              type="datetime-local"
              className={`form-control${invalid('mission.metadataRecordDate') ? ' form-control--invalid' : ''}`}
              data-pilot-field="mission.metadataRecordDate"
              value={toDatetimeLocalValue(mission.metadataRecordDate)}
              onChange={(e) => onMissionPatch({ metadataRecordDate: fromDatetimeLocalValue(e.target.value) })}
              onBlur={() => onTouched('mission.metadataRecordDate')}
            />
            <p className="hint">
              <strong>Metadata record date</strong> for <code>gmd:dateStamp</code>: when this field is set, the
              preview emits it; when it is blank, the preview omits <code>dateStamp</code> (with a comment) and a
              server-side generator may stamp &quot;now&quot; at export time. If you merge a payload where only{' '}
              <code>output.metadataRecordDate</code> is filled, it is copied here only when this field is still empty — a
              value you enter in the Mission step always wins.
            </p>
            {show('mission.metadataRecordDate') ? (
              <p className="field-error">{show('mission.metadataRecordDate')}</p>
            ) : null}
          </div>
          <div>
            <label htmlFor="publicationDate">Dataset publication date (citation)</label>
            <input
              id="publicationDate"
              type="datetime-local"
              className={`form-control${invalid('mission.publicationDate') ? ' form-control--invalid' : ''}`}
              data-pilot-field="mission.publicationDate"
              value={toDatetimeLocalValue(mission.publicationDate)}
              onChange={(e) => onMissionPatch({ publicationDate: fromDatetimeLocalValue(e.target.value) })}
              onBlur={() => onTouched('mission.publicationDate')}
            />
            <p className="hint">
              <code>CI_DateTypeCode</code> publication, separate from completion/end.
            </p>
            {show('mission.publicationDate') ? <p className="field-error">{show('mission.publicationDate')}</p> : null}
          </div>
        </div>

        <div className="form-row-2">
          <div>
            <label htmlFor="language">Language</label>
            <input
              id="language"
              className={`form-control${invalid('mission.language') ? ' form-control--invalid' : ''}`}
              data-pilot-field="mission.language"
              placeholder="e.g., eng"
              value={mission.language || ''}
              onChange={(e) => onMissionPatch({ language: e.target.value })}
              onBlur={() => onTouched('mission.language')}
              aria-required
            />
            {show('mission.language') ? <p className="field-error">{show('mission.language')}</p> : null}
          </div>
          <div>
            <label htmlFor="characterSet">Character set</label>
            <input
              id="characterSet"
              className="form-control"
              data-pilot-field="mission.characterSet"
              placeholder="e.g., utf8"
              value={mission.characterSet || ''}
              onChange={(e) => onMissionPatch({ characterSet: e.target.value })}
            />
          </div>
        </div>

        <h4 className="panel-subtitle">Topic categories (ISO)</h4>
        <label htmlFor="topicCategories">MD_TopicCategoryCode values (one per line)</label>
        <textarea
          id="topicCategories"
          className="form-control"
          data-pilot-field="mission.topicCategories"
          rows={3}
          placeholder={`e.g.
oceans
geoscientificInformation`}
          value={(Array.isArray(mission.topicCategories) ? mission.topicCategories : []).join('\n')}
          onChange={(e) =>
            onMissionPatch({
              topicCategories: e.target.value.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean),
            })
          }
        />
        <p className="hint">Maps to repeated <code>gmd:topicCategory</code> / <code>MD_TopicCategoryCode</code> in the XML preview (NCEI UxS template pattern).</p>

        <h4 className="panel-subtitle">Graphic overview (optional)</h4>
        <div className="form-row-2">
          <div>
            <label htmlFor="graphicOverviewHref">Browse graphic xlink href</label>
            <input
              id="graphicOverviewHref"
              className="form-control"
              data-pilot-field="mission.graphicOverviewHref"
              placeholder="https://data.noaa.gov/docucomp/…"
              value={mission.graphicOverviewHref || ''}
              onChange={(e) => onMissionPatch({ graphicOverviewHref: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="graphicOverviewTitle">Graphic title</label>
            <input
              id="graphicOverviewTitle"
              className="form-control"
              data-pilot-field="mission.graphicOverviewTitle"
              placeholder="e.g. Default NOAA logo"
              value={mission.graphicOverviewTitle || ''}
              onChange={(e) => onMissionPatch({ graphicOverviewTitle: e.target.value })}
            />
          </div>
        </div>

        <h4 className="panel-subtitle">Citation parties (<code>CI_Citation</code> / <code>citedResponsibleParty</code>)</h4>
        <p className="hint">
          Distinct from resource <code>gmd:pointOfContact</code> below — these are author / publisher / originator on the
          dataset citation.
        </p>
        <div className="form-row-2">
          <div>
            <label htmlFor="citationAuthorIndividualName">Author — individual</label>
            <input
              id="citationAuthorIndividualName"
              className="form-control"
              data-pilot-field="mission.citationAuthorIndividualName"
              value={mission.citationAuthorIndividualName || ''}
              onChange={(e) => onMissionPatch({ citationAuthorIndividualName: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="citationAuthorOrganisationName">Author — organisation</label>
            <input
              id="citationAuthorOrganisationName"
              className="form-control"
              data-pilot-field="mission.citationAuthorOrganisationName"
              value={mission.citationAuthorOrganisationName || ''}
              onChange={(e) => onMissionPatch({ citationAuthorOrganisationName: e.target.value })}
            />
          </div>
        </div>
        <div className="form-row-2">
          <div>
            <label htmlFor="citationPublisherOrganisationName">Publisher — organisation</label>
            <input
              id="citationPublisherOrganisationName"
              className="form-control"
              data-pilot-field="mission.citationPublisherOrganisationName"
              value={mission.citationPublisherOrganisationName || ''}
              onChange={(e) => onMissionPatch({ citationPublisherOrganisationName: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="citationOriginatorIndividualName">Originator — individual</label>
            <input
              id="citationOriginatorIndividualName"
              className="form-control"
              data-pilot-field="mission.citationOriginatorIndividualName"
              value={mission.citationOriginatorIndividualName || ''}
              onChange={(e) => onMissionPatch({ citationOriginatorIndividualName: e.target.value })}
            />
          </div>
        </div>
        <label htmlFor="citationOriginatorOrganisationName">Originator — organisation</label>
        <input
          id="citationOriginatorOrganisationName"
          className="form-control"
          data-pilot-field="mission.citationOriginatorOrganisationName"
          value={mission.citationOriginatorOrganisationName || ''}
          onChange={(e) => onMissionPatch({ citationOriginatorOrganisationName: e.target.value })}
        />

        <label htmlFor="scopeCode">Scope code</label>
        <select
          id="scopeCode"
          className="form-control form-select"
          data-pilot-field="mission.scopeCode"
          value={mission.scopeCode || ''}
          onChange={(e) => onMissionPatch({ scopeCode: e.target.value })}
        >
          <option value="">Select scope…</option>
          <option value="dataset">Dataset</option>
          <option value="series">Series</option>
          <option value="application">Application</option>
        </select>

        <div className="form-row-2">
          <div>
            <label htmlFor="missionStatus">Dataset status</label>
            <select
              id="missionStatus"
              className={`form-control form-select${invalid('mission.status') ? ' form-control--invalid' : ''}`}
              data-pilot-field="mission.status"
              value={mission.status || ''}
              onChange={(e) => onMissionPatch({ status: e.target.value })}
              onBlur={() => onTouched('mission.status')}
              aria-required
            >
              <option value="">Select…</option>
              <option value="completed">completed</option>
              <option value="onGoing">onGoing</option>
              <option value="planned">planned</option>
              <option value="historicalArchive">historicalArchive</option>
            </select>
            {show('mission.status') ? <p className="field-error">{show('mission.status')}</p> : null}
          </div>
        </div>

        <h4 className="panel-subtitle">Organization &amp; contact</h4>
        <div className="form-row-2">
          <div>
            <label htmlFor="org">Organization *</label>
            <input
              id="org"
              className={`form-control${invalid('mission.org') ? ' form-control--invalid' : ''}`}
              data-pilot-field="mission.org"
              placeholder="e.g., NOAA MESOPHOTIC DEEP BENTHIC COMMUNITIES RESTORATION PROJECT"
              value={mission.org}
              onChange={(e) => onMissionPatch({ org: e.target.value })}
              onBlur={() => onTouched('mission.org')}
              aria-required
            />
            {show('mission.org') ? <p className="field-error">{show('mission.org')}</p> : null}
          </div>
          <div>
            <label htmlFor="individualName">
              Contact person name (<code>gmd:individualName</code>)
            </label>
            <input
              id="individualName"
              className={`form-control${invalid('mission.individualName') ? ' form-control--invalid' : ''}`}
              data-pilot-field="mission.individualName"
              placeholder="e.g., point of contact for citation / author block"
              value={mission.individualName}
              onChange={(e) => onMissionPatch({ individualName: e.target.value })}
              onBlur={() => onTouched('mission.individualName')}
              aria-required
            />
            {show('mission.individualName') ? <p className="field-error">{show('mission.individualName')}</p> : null}
          </div>
        </div>

        <div className="form-row-2">
          <div>
            <label htmlFor="email">Contact email *</label>
            <input
              id="email"
              type="email"
              className={`form-control${invalid('mission.email') ? ' form-control--invalid' : ''}`}
              data-pilot-field="mission.email"
              placeholder="e.g., name@noaa.gov"
              value={mission.email}
              onChange={(e) => onMissionPatch({ email: e.target.value })}
              onBlur={() => onTouched('mission.email')}
              aria-required
            />
            {show('mission.email') ? <p className="field-error">{show('mission.email')}</p> : null}
          </div>
          <div>
            <label htmlFor="contactPhone">Contact phone</label>
            <input
              id="contactPhone"
              className="form-control"
              data-pilot-field="mission.contactPhone"
              placeholder="e.g., (555) 555-5555"
              value={mission.contactPhone || ''}
              onChange={(e) => onMissionPatch({ contactPhone: e.target.value })}
            />
          </div>
        </div>

        <label htmlFor="contactUrl">Contact URL</label>
        <input
          id="contactUrl"
          className={`form-control${invalid('mission.contactUrl') ? ' form-control--invalid' : ''}`}
          data-pilot-field="mission.contactUrl"
          value={mission.contactUrl || ''}
          onChange={(e) => onMissionPatch({ contactUrl: e.target.value })}
          onBlur={() => onTouched('mission.contactUrl')}
        />
        {show('mission.contactUrl') ? <p className="field-error">{show('mission.contactUrl')}</p> : null}

        <label htmlFor="contactAddress">Contact address</label>
        <textarea
          id="contactAddress"
          rows={2}
          className="form-control"
          data-pilot-field="mission.contactAddress"
          value={mission.contactAddress || ''}
          onChange={(e) => onMissionPatch({ contactAddress: e.target.value })}
        />

        <div className="ror-block">
          <label htmlFor="rorSearch">Organization lookup (ROR)</label>
          <div className="ror-search-row">
            <input
              id="rorSearch"
              className="form-control"
              data-pilot-field="mission.ror"
              placeholder="Search ROR…"
              value={rorQuery}
              onChange={(e) => setRorQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  runRorSearch()
                }
              }}
            />
            <button type="button" className="button button-secondary" onClick={runRorSearch} disabled={rorLoading}>
              {rorLoading ? 'Searching…' : 'Search'}
            </button>
          </div>
          {rorError ? <p className="field-error">{rorError}</p> : null}
          {mission.ror?.id ? (
            <div className="ror-selected">
              <strong>{mission.ror.name || mission.ror.id}</strong>
              <span className="hint">{mission.ror.id}</span>
              <button type="button" className="button button-tiny" onClick={clearRor}>
                Clear
              </button>
            </div>
          ) : null}
          {show('mission.ror') ? <p className="field-error warn">{show('mission.ror')}</p> : null}
          <ul className="ror-results">
            {rorResults.map((r) => (
              <li key={r.id}>
                <button type="button" className="linkish" onClick={() => selectRor(r)}>
                  {r.displayName}
                  {r.country ? ` — ${r.country}` : ''}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="form-row-2">
          <div>
            <label htmlFor="doi">DOI</label>
            <input
              id="doi"
              className={`form-control${invalid('mission.doi') ? ' form-control--invalid' : ''}`}
              data-pilot-field="mission.doi"
              value={mission.doi}
              onChange={(e) => onMissionPatch({ doi: e.target.value })}
              onBlur={() => onTouched('mission.doi')}
            />
            {show('mission.doi') ? <p className="field-error">{show('mission.doi')}</p> : null}
          </div>
          <div>
            <label htmlFor="accession">NCEI accession</label>
            <input
              id="accession"
              className={`form-control${invalid('mission.accession') ? ' form-control--invalid' : ''}`}
              data-pilot-field="mission.accession"
              value={mission.accession}
              onChange={(e) => onMissionPatch({ accession: e.target.value })}
              onBlur={() => onTouched('mission.accession')}
            />
            {show('mission.accession') ? <p className="field-error">{show('mission.accession')}</p> : null}
          </div>
        </div>
      </section>

      <section className="panel">
        <h3 className="panel-title">Constraints &amp; legal</h3>
        <p className="hint">
          Same fields as the classic <code>#missionForm</code>: cite-as, other constraints, license preset / URL, access text,
          distribution liability (see <code>METADATA_FIELD_MAP.md</code> §2).
        </p>
        <label htmlFor="citeAs">Cite as (use limitation)</label>
        <textarea
          id="citeAs"
          rows={2}
          className="form-control"
          data-pilot-field="mission.citeAs"
          value={mission.citeAs || ''}
          onChange={(e) => onMissionPatch({ citeAs: e.target.value })}
        />
        <label htmlFor="otherCiteAs">Other cite / plain other constraints</label>
        <textarea
          id="otherCiteAs"
          rows={2}
          className="form-control"
          data-pilot-field="mission.otherCiteAs"
          value={mission.otherCiteAs || ''}
          onChange={(e) => onMissionPatch({ otherCiteAs: e.target.value })}
        />
        <label htmlFor="dataLicensePreset">Data license preset</label>
        <select
          id="dataLicensePreset"
          className="form-control form-select"
          data-pilot-field="mission.dataLicensePreset"
          value={mission.dataLicensePreset || 'custom'}
          onChange={(e) => onMissionPatch({ dataLicensePreset: e.target.value })}
        >
          <option value="custom">custom (use license URL below)</option>
          <option value="cc0_acdo">cc0_acdo</option>
          <option value="ncei_cc0">ncei_cc0</option>
          <option value="ncei_cc_by_4">ncei_cc_by_4</option>
          <option value="ncei_cc0_internal_noaa">ncei_cc0_internal_noaa</option>
          <option value="cc0_acdo_and_ncei">cc0_acdo_and_ncei</option>
        </select>
        <label htmlFor="licenseUrl">License URL {mission.dataLicensePreset === 'custom' ? '(required)' : '(optional)'}</label>
        <input
          id="licenseUrl"
          type="url"
          className={`form-control${invalid('mission.licenseUrl') ? ' form-control--invalid' : ''}`}
          data-pilot-field="mission.licenseUrl"
          value={mission.licenseUrl || ''}
          onChange={(e) => onMissionPatch({ licenseUrl: e.target.value })}
          onBlur={() => onTouched('mission.licenseUrl')}
          aria-required={mission.dataLicensePreset === 'custom'}
        />
        {show('mission.licenseUrl') ? <p className="field-error">{show('mission.licenseUrl')}</p> : null}
        <label htmlFor="accessConstraintsCode">Access restriction (ISO MD_RestrictionCode)</label>
        <select
          id="accessConstraintsCode"
          className="form-control form-select"
          data-pilot-field="mission.accessConstraintsCode"
          value={mission.accessConstraintsCode || ''}
          onChange={(e) => onMissionPatch({ accessConstraintsCode: e.target.value })}
        >
          <option value="">— Not set (notes only, or otherRestrictions if you only type text) —</option>
          <option value="unrestricted">unrestricted</option>
          <option value="limited">limited</option>
          <option value="restricted">restricted</option>
          <option value="confidential">confidential</option>
          <option value="otherRestrictions">otherRestrictions (see notes)</option>
        </select>
        <p className="hint">
          The live XML preview emits a proper <code>gmd:MD_RestrictionCode</code> with codelist when a value is chosen;
          notes add <code>gmd:otherConstraints</code> for details. Text without a code maps to{' '}
          <code>otherRestrictions</code> + your text (legacy free-text shape is normalized).
        </p>
        <label htmlFor="accessConstraints">Access notes / narrative</label>
        <textarea
          id="accessConstraints"
          rows={2}
          className="form-control"
          data-pilot-field="mission.accessConstraints"
          value={mission.accessConstraints || ''}
          onChange={(e) => onMissionPatch({ accessConstraints: e.target.value })}
          onBlur={() => onTouched('mission.accessConstraints')}
        />
        <label htmlFor="distributionLiability">Distribution liability</label>
        <textarea
          id="distributionLiability"
          rows={2}
          className="form-control"
          data-pilot-field="mission.distributionLiability"
          value={mission.distributionLiability || ''}
          onChange={(e) => onMissionPatch({ distributionLiability: e.target.value })}
        />
      </section>

      <section className="panel">
        <h3 className="panel-title">Aggregation &amp; related resources</h3>
        <p className="hint">
          Same flat <code>name</code> attributes as the classic mission form (larger work, cross-reference dataset,
          associated publication). Preview emits XML comments until full <code>aggregationInfo</code> blocks are
          modeled.
        </p>

        <h4 className="panel-subtitle">Parent project (larger work citation)</h4>
        <div className="form-row-3">
          <div>
            <label htmlFor="parentProjectTitle">Title</label>
            <input
              id="parentProjectTitle"
              className={`form-control${invalid('mission.parentProjectTitle') ? ' form-control--invalid' : ''}`}
              data-pilot-field="mission.parentProjectTitle"
              value={mission.parentProjectTitle || ''}
              onChange={(e) => onMissionPatch({ parentProjectTitle: e.target.value })}
              onBlur={() => onTouched('mission.parentProjectTitle')}
            />
            {show('mission.parentProjectTitle') ? (
              <p className="field-error">{show('mission.parentProjectTitle')}</p>
            ) : null}
          </div>
          <div>
            <label htmlFor="parentProjectDate">Date</label>
            <input
              id="parentProjectDate"
              className="form-control"
              data-pilot-field="mission.parentProjectDate"
              value={mission.parentProjectDate || ''}
              onChange={(e) => onMissionPatch({ parentProjectDate: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="parentProjectCode">Code / ID</label>
            <input
              id="parentProjectCode"
              className="form-control"
              data-pilot-field="mission.parentProjectCode"
              value={mission.parentProjectCode || ''}
              onChange={(e) => onMissionPatch({ parentProjectCode: e.target.value })}
            />
          </div>
        </div>

        <h4 className="panel-subtitle">Related dataset (cross reference)</h4>
        <div className="form-row-2">
          <div>
            <label htmlFor="relatedDatasetTitle">Title</label>
            <input
              id="relatedDatasetTitle"
              className="form-control"
              data-pilot-field="mission.relatedDatasetTitle"
              value={mission.relatedDatasetTitle || ''}
              onChange={(e) => onMissionPatch({ relatedDatasetTitle: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="relatedDatasetDate">Date</label>
            <input
              id="relatedDatasetDate"
              className="form-control"
              data-pilot-field="mission.relatedDatasetDate"
              value={mission.relatedDatasetDate || ''}
              onChange={(e) => onMissionPatch({ relatedDatasetDate: e.target.value })}
            />
          </div>
        </div>
        <div className="form-row-2">
          <div>
            <label htmlFor="relatedDatasetCode">Code</label>
            <input
              id="relatedDatasetCode"
              className="form-control"
              data-pilot-field="mission.relatedDatasetCode"
              value={mission.relatedDatasetCode || ''}
              onChange={(e) => onMissionPatch({ relatedDatasetCode: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="relatedDatasetOrg">Organization</label>
            <input
              id="relatedDatasetOrg"
              className="form-control"
              data-pilot-field="mission.relatedDatasetOrg"
              value={mission.relatedDatasetOrg || ''}
              onChange={(e) => onMissionPatch({ relatedDatasetOrg: e.target.value })}
            />
          </div>
        </div>
        <label htmlFor="relatedDataUrl">Related data URL</label>
        <input
          id="relatedDataUrl"
          type="url"
          className={`form-control${invalid('mission.relatedDataUrl') ? ' form-control--invalid' : ''}`}
          data-pilot-field="mission.relatedDataUrl"
          value={mission.relatedDataUrl || ''}
          onChange={(e) => onMissionPatch({ relatedDataUrl: e.target.value })}
          onBlur={() => onTouched('mission.relatedDataUrl')}
        />
        {show('mission.relatedDataUrl') ? <p className="field-error">{show('mission.relatedDataUrl')}</p> : null}
        <div className="form-row-2">
          <div>
            <label htmlFor="relatedDataUrlTitle">Link title</label>
            <input
              id="relatedDataUrlTitle"
              className="form-control"
              data-pilot-field="mission.relatedDataUrlTitle"
              value={mission.relatedDataUrlTitle || ''}
              onChange={(e) => onMissionPatch({ relatedDataUrlTitle: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="relatedDataUrlDescription">Link description</label>
            <input
              id="relatedDataUrlDescription"
              className="form-control"
              data-pilot-field="mission.relatedDataUrlDescription"
              value={mission.relatedDataUrlDescription || ''}
              onChange={(e) => onMissionPatch({ relatedDataUrlDescription: e.target.value })}
            />
          </div>
        </div>

        <h4 className="panel-subtitle">Associated publication</h4>
        <div className="form-row-3">
          <div>
            <label htmlFor="associatedPublicationTitle">Title</label>
            <input
              id="associatedPublicationTitle"
              className="form-control"
              data-pilot-field="mission.associatedPublicationTitle"
              value={mission.associatedPublicationTitle || ''}
              onChange={(e) => onMissionPatch({ associatedPublicationTitle: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="associatedPublicationDate">Date</label>
            <input
              id="associatedPublicationDate"
              className="form-control"
              data-pilot-field="mission.associatedPublicationDate"
              value={mission.associatedPublicationDate || ''}
              onChange={(e) => onMissionPatch({ associatedPublicationDate: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="associatedPublicationCode">Code / DOI</label>
            <input
              id="associatedPublicationCode"
              className="form-control"
              data-pilot-field="mission.associatedPublicationCode"
              value={mission.associatedPublicationCode || ''}
              onChange={(e) => onMissionPatch({ associatedPublicationCode: e.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="panel">
        <h3 className="panel-title">Mission templates</h3>
        <p className="card-intro platform-library-intro">
          Load a named template from your Postgres-backed catalog (<code>/api/db</code>). The list loads when you open
          this step; use Refresh after catalog edits. Pick a template in the dropdown, then <strong>Apply template</strong>.
        </p>
        <div className="platform-library-row">
          <select
            className="form-control form-select"
            value={selectedTemplateKey}
            disabled={!hostBridgeReady || templateCatalogLoading}
            onChange={(e) => setSelectedTemplateKey(e.target.value)}
          >
            <option value="">Select a template…</option>
            {templateCatalogRows.map(({ key, name, category }) => {
              const cat = String(category || '').trim()
              const label = cat ? `${name} (${cat})` : name
              return (
                <option key={key} value={key}>
                  {label}
                </option>
              )
            })}
          </select>
          <button
            type="button"
            className="button button-secondary button-tiny"
            disabled={!hostBridgeReady || templateCatalogLoading}
            onClick={() => onRefreshTemplateCatalog?.()}
          >
            {templateCatalogLoading ? 'Loading…' : 'Refresh'}
          </button>
          <button
            type="button"
            className="button button-tiny"
            disabled={templateApplyDisabled || templateCatalogLoading || !selectedTemplateKey}
            onClick={() => onApplySheetTemplate?.(selectedTemplateKey)}
          >
            Apply template
          </button>
        </div>
        {!hostBridgeReady ? (
          <p className="hint">Templates need a reachable <code>/api/db</code> on the same origin as this app.</p>
        ) : null}
        {templateCatalogError ? <p className="field-error">{templateCatalogError}</p> : null}
      </section>

      <div className="mission-actions">
        <button type="button" className="button button-secondary" onClick={onLoadDraft} disabled={loadDisabled}>
          Load full draft
        </button>
        <button type="button" className="button" onClick={onSaveDraft} disabled={saveDisabled}>
          Save full draft
        </button>
      </div>
      {hasDraftTimestamp ? (
        <p className="draft-meta" aria-live="polite">
          Last {draftStatus.source === 'loaded' ? 'loaded' : 'saved'}: {draftLabel}
        </p>
      ) : (
        <p className="draft-meta" aria-live="polite">No draft timestamp yet.</p>
      )}
    </>
  )
}
