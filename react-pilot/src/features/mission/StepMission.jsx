import { useMemo, useState, useEffect } from 'react'
import { searchRorOrganizationsClient } from '../../lib/rorClient'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../../lib/datetimeLocal'
import { useFieldValidation } from '../../components/fields/useFieldValidation'
import { UXS_LAYER_OPTIONS, UXS_OUTCOME_OPTIONS, getUxsLayerDefinition } from '../../lib/uxsOperationalModel.js'
import MantaFieldGlass from '../../components/MantaFieldGlass.jsx'
import MantaFieldInsights from '../../components/MantaFieldInsights.jsx'
import SourceProvenancePanel from '../../components/SourceProvenancePanel.jsx'
import FieldHintTooltip, { LabelWithHint } from '../../components/FieldHintTooltip.jsx'
import { pilotFieldControlAttrs } from '../../lib/pilotFieldControlAttrs.js'
import { useWorkbenchChrome } from '../../shell/useWorkbenchChrome.js'
import { NCEI_DEFAULT_MISSION_PURPOSE } from '../../lib/nceiMissionDefaults.js'

/** Typical NCEI distribution liability prose — shown read-only until user edits. */
const NCEI_DEFAULT_DISTRIBUTION_LIABILITY =
  'NOAA and NCEI make no warranty, expressed or implied, regarding these metadata or related data concerning accuracy, completeness, or fitness for a particular purpose.'

const ISO_TOPIC_PRESETS = [
  { value: '', label: '— Add topic code —' },
  { value: 'oceans', label: 'oceans' },
  { value: 'climatologyMeteorologyAtmosphere', label: 'climatologyMeteorologyAtmosphere' },
  { value: 'geoscientificInformation', label: 'geoscientificInformation' },
  { value: 'elevation', label: 'elevation' },
  { value: 'location', label: 'location' },
  { value: 'inlandWaters', label: 'inlandWaters' },
  { value: 'imageryBaseMapsEarthCover', label: 'imageryBaseMapsEarthCover' },
]

const MISSION_ISO639_PRESETS = ['eng', 'spa', 'fra', 'deu', 'zho', 'jpn', 'por', 'rus', 'ita', 'mul', 'und']

const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/i

function hasText(v) {
  return Boolean(String(v ?? '').trim())
}

/**
 * @param {{
 *   title: string,
 *   defaultOpen?: boolean,
 *   hasValues?: boolean,
 *   children: import('react').ReactNode,
 *   variant?: 'default' | 'symphony',
 *   sectionClassName?: string,
 * }} props
 */
function AccordionSection({
  title,
  defaultOpen = false,
  hasValues = false,
  children,
  variant = 'default',
  sectionClassName = '',
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen))
  useEffect(() => {
    if (defaultOpen) setOpen(true)
  }, [defaultOpen])
  const symphony = variant === 'symphony'
  const rootClass = symphony
    ? `mission-symphony-accordion${open ? ' mission-symphony-accordion--open' : ''}${sectionClassName ? ` ${sectionClassName}` : ''}`
    : sectionClassName.trim() || undefined

  return (
    <div
      className={rootClass}
      style={
        symphony
          ? undefined
          : {
              borderBottom: '0.5px solid var(--color-border-tertiary, rgba(148, 163, 184, 0.35))',
              marginBottom: 0,
            }
      }
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={symphony ? 'mission-symphony-accordion__trigger' : undefined}
        aria-expanded={open}
        style={
          symphony
            ? undefined
            : {
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 0',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--color-text-primary, var(--text-color, #0f172a))',
                textAlign: 'left',
              }
        }
      >
        <span className={symphony ? 'mission-symphony-accordion__title' : undefined}>{title}</span>
        <span
          className={symphony ? 'mission-symphony-accordion__chev' : undefined}
          style={
            symphony
              ? undefined
              : {
                  fontSize: '11px',
                  color: 'var(--color-text-secondary, var(--text-muted, #64748b))',
                  transform: open ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s',
                }
          }
          aria-hidden
        >
          ▾
        </span>
      </button>
      {symphony ? (
        <div className="mission-symphony-accordion__panel">
          <div className="mission-symphony-accordion__panel-inner">{open ? children : null}</div>
        </div>
      ) : open ? (
        <div style={{ paddingBottom: '16px' }}>{children}</div>
      ) : null}
    </div>
  )
}

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
 *   contactLibraryEnabled?: boolean,
 *   platform?: object,
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
  contactLibraryEnabled = false,
  platform = null,
  pilotState = null,
  onSourceProvenanceClear,
  /** Workspace “Simple” density — shorter Mission intro; tuck optional UxS block behind a disclosure */
  guidedMissionIntro = false,
  aiSuggestions = {},
  onApplyAiSuggestion,
  onIgnoreAiSuggestion,
}) {
  const [rorQuery, setRorQuery] = useState('')
  const [rorLoading, setRorLoading] = useState(false)
  const [rorResults, setRorResults] = useState([])
  const [rorError, setRorError] = useState('')
  const [lensSymbioteActive, setLensSymbioteActive] = useState(false)
  const [editPurpose, setEditPurpose] = useState(false)
  const [abstractExpanded, setAbstractExpanded] = useState(false)
  const [editLiability, setEditLiability] = useState(false)

  const { lensActive, lensTarget, assistantLayout } = useWorkbenchChrome()

  useEffect(() => {
    const onSym = (e) => setLensSymbioteActive(Boolean(e?.detail?.active))
    window.addEventListener('manta:lens-symbiote-active', onSym)
    return () => window.removeEventListener('manta:lens-symbiote-active', onSym)
  }, [])

  /** Form / split lens already surfaces suggestions + actions — drop the extra insights card and chip rows. */
  const hideMissionLensDuplicateChrome = Boolean(
    lensActive && (lensTarget === 'form' || lensTarget === 'split'),
  )
  /** Split-float: keep chip row until the LENS sheet is open (symbiote mounts); otherwise the step would go bare. */
  const hideMissionGlassChips = Boolean(
    hideMissionLensDuplicateChrome && (lensSymbioteActive || assistantLayout !== 'split-float'),
  )

  const { show, invalid } = useFieldValidation({ issues, touched, showAllErrors })

  /** Align MantaFieldGlass with useFieldValidation — no red "required" / issue chips until touch or show-all. */
  const glassShowChrome = (fieldKey) => Boolean(touched[fieldKey] || showAllErrors)

  /** Dates, language, DOI, accession — file identifier lives under Core identity. */
  const accTimelineTracking = useMemo(
    () =>
      hasText(mission.startDate)
      || hasText(mission.endDate)
      || hasText(mission.publicationDate)
      || hasText(mission.language)
      || hasText(mission.doi)
      || hasText(mission.accession),
    [mission.startDate, mission.endDate, mission.publicationDate, mission.language, mission.doi, mission.accession],
  )
  const accAdvancedIso = useMemo(
    () =>
      hasText(mission.supplementalInformation)
      || hasText(mission.temporalExtentIntervalUnit)
      || hasText(mission.temporalExtentIntervalValue)
      || hasText(mission.metadataRecordDate)
      || hasText(mission.characterSet)
      || hasText(mission.graphicOverviewHref)
      || hasText(mission.graphicOverviewTitle)
      || (Array.isArray(mission.topicCategories) && mission.topicCategories.length > 0),
    [
      mission.supplementalInformation,
      mission.temporalExtentIntervalUnit,
      mission.temporalExtentIntervalValue,
      mission.metadataRecordDate,
      mission.characterSet,
      mission.graphicOverviewHref,
      mission.graphicOverviewTitle,
      mission.topicCategories,
    ],
  )

  const accCitationParties = useMemo(
    () =>
      hasText(mission.citationAuthorIndividualName)
      || hasText(mission.citationAuthorOrganisationName)
      || hasText(mission.citationPublisherOrganisationName)
      || hasText(mission.citationOriginatorIndividualName)
      || hasText(mission.citationOriginatorOrganisationName),
    [
      mission.citationAuthorIndividualName,
      mission.citationAuthorOrganisationName,
      mission.citationPublisherOrganisationName,
      mission.citationOriginatorIndividualName,
      mission.citationOriginatorOrganisationName,
    ],
  )
  const accScope = useMemo(() => {
    const v = String(mission.scopeCode || '').trim()
    return Boolean(v && v !== 'dataset')
  }, [mission.scopeCode])
  const accContactParties = useMemo(
    () =>
      hasText(mission.org)
      || hasText(mission.email)
      || hasText(mission.individualName)
      || hasText(mission.contactPhone)
      || hasText(mission.contactUrl)
      || hasText(mission.contactAddress)
      || Boolean(mission.ror?.id),
    [
      mission.org,
      mission.email,
      mission.individualName,
      mission.contactPhone,
      mission.contactUrl,
      mission.contactAddress,
      mission.ror,
    ],
  )
  const accConstraints = useMemo(
    () =>
      hasText(mission.citeAs)
      || hasText(mission.otherCiteAs)
      || hasText(mission.licenseUrl)
      || hasText(mission.accessConstraints)
      || hasText(mission.distributionLiability)
      || Boolean(mission.accessConstraintsCode),
    [
      mission.citeAs,
      mission.otherCiteAs,
      mission.licenseUrl,
      mission.accessConstraints,
      mission.distributionLiability,
      mission.accessConstraintsCode,
    ],
  )
  const accRelatedRecords = useMemo(
    () =>
      hasText(mission.parentProjectTitle)
      || hasText(mission.parentProjectDate)
      || hasText(mission.parentProjectCode)
      || hasText(mission.relatedDatasetTitle)
      || hasText(mission.relatedDatasetDate)
      || hasText(mission.relatedDatasetCode)
      || hasText(mission.relatedDatasetOrg)
      || hasText(mission.relatedDataUrl)
      || hasText(mission.relatedDataUrlTitle)
      || hasText(mission.relatedDataUrlDescription)
      || hasText(mission.associatedPublicationTitle)
      || hasText(mission.associatedPublicationDate)
      || hasText(mission.associatedPublicationCode),
    [
      mission.parentProjectTitle,
      mission.parentProjectDate,
      mission.parentProjectCode,
      mission.relatedDatasetTitle,
      mission.relatedDatasetDate,
      mission.relatedDatasetCode,
      mission.relatedDatasetOrg,
      mission.relatedDataUrl,
      mission.relatedDataUrlTitle,
      mission.relatedDataUrlDescription,
      mission.associatedPublicationTitle,
      mission.associatedPublicationDate,
      mission.associatedPublicationCode,
    ],
  )

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
  const uxsPrimaryLayer = String(uxsContext.primaryLayer || 'datasetProduct')
  /** Operational ID rows: only surface fields that match the selected primary layer (full grid for dataset / other). */
  const showUxsRunPair =
    uxsPrimaryLayer === 'run'
    || uxsPrimaryLayer === 'sortie'
    || uxsPrimaryLayer === 'datasetProduct'
    || uxsPrimaryLayer === 'other'
  const showUxsSortiePair =
    uxsPrimaryLayer === 'sortie' || uxsPrimaryLayer === 'datasetProduct' || uxsPrimaryLayer === 'other'
  const showUxsDivePair =
    uxsPrimaryLayer === 'dive' || uxsPrimaryLayer === 'datasetProduct' || uxsPrimaryLayer === 'other'

  const accUxsOperationalDrawer = useMemo(
    () =>
      hasText(uxsContext.deploymentName)
      || hasText(uxsContext.runName)
      || hasText(uxsContext.runId)
      || hasText(uxsContext.sortieName)
      || hasText(uxsContext.sortieId)
      || hasText(uxsContext.diveName)
      || hasText(uxsContext.diveId)
      || hasText(uxsContext.narrative),
    [
      uxsContext.deploymentName,
      uxsContext.runName,
      uxsContext.runId,
      uxsContext.sortieName,
      uxsContext.sortieId,
      uxsContext.diveName,
      uxsContext.diveId,
      uxsContext.narrative,
    ],
  )

  const stepErrorSummary = (() => {
    /** @type {Array<{ id: string, label: string, match: (field: string) => boolean }>} */
    const stepMatchers = [
      { id: 'mission', label: '1. Mission', match: (field) => field === 'mission' || field.startsWith('mission.') },
      { id: 'platform', label: '2. Platform', match: (field) => field.startsWith('platform.') },
      { id: 'sensors', label: '3. Sensors', match: (field) => field === 'sensors' || field.startsWith('sensors[') },
      { id: 'spatial', label: '4. Spatial', match: (field) => field.startsWith('spatial.') },
      { id: 'keywords', label: '5. Keywords', match: (field) => field === 'keywords' || field.startsWith('keywords.') },
      { id: 'distribution', label: '6. Distribution', match: (field) => field.startsWith('distribution.') },
    ]
    const withErrors = stepMatchers
      .filter((step) => issues.some((iss) => iss.severity === 'e' && step.match(String(iss.field || ''))))
      .map((step) => step.label)
    return withErrors.length ? `${withErrors.join(' · ')}: Errors` : ''
  })()

  function patchUxsContext(patch) {
    onMissionPatch({
      uxsContext: {
        ...uxsContext,
        ...patch,
      },
    })
  }

  const sourceProvenance = pilotState?.sourceProvenance ?? null

  const importedFromStructuredSource = Boolean(
    sourceProvenance?.sourceType
    && ['rawIso', 'bediXml', 'comet'].includes(sourceProvenance.sourceType),
  )

  /** High-signal “still empty after import” checklist — not exhaustive vs catalog rules. */
  const importPriorityMissingLabels = useMemo(() => {
    if (!importedFromStructuredSource) return []
    const checks = [
      ['File identifier', mission.fileId],
      ['Title', mission.title],
      ['Abstract', mission.abstract],
      ['Purpose', mission.purpose],
      ['Start date', mission.startDate],
      ['End date', mission.endDate],
      ['Language', mission.language],
      ['Organization', mission.org],
      ['Contact name', mission.individualName],
      ['Contact email', mission.email],
      ['Dataset status', mission.status],
    ]
    return checks.filter(([, v]) => !String(v ?? '').trim()).map(([label]) => label)
  }, [importedFromStructuredSource, mission])

  const citeAsSuggestion = useMemo(() => {
    const title = String(mission.title || '').trim() || '[dataset title]'
    const who =
      String(mission.citationAuthorIndividualName || '').trim()
      || String(mission.individualName || '').trim()
      || '[responsible party]'
    return `${who}. ${title}. NOAA National Centers for Environmental Information.`
  }, [mission.title, mission.citationAuthorIndividualName, mission.individualName])

  const doiShapeOk = Boolean(String(mission.doi || '').trim()) && DOI_PATTERN.test(String(mission.doi || '').trim())

  useEffect(() => {
    const plat = platform != null && typeof platform === 'object' ? platform : {}
    const hint = String(plat.manufacturer || '').trim() || String(plat.platformName || '').trim()
    if (!hint) return
    if (String(mission.org || '').trim()) return
    onMissionPatch({ org: hint })
  }, [platform, mission.org, onMissionPatch])

  return (
    <>
      <SourceProvenancePanel
        sourceProvenance={sourceProvenance}
        onClear={onSourceProvenanceClear ?? (() => {})}
      />

      {guidedMissionIntro ? (
        <p className="card-intro card-intro--guided">
          <strong>Start here:</strong> collection context (below), then use the steps across the top — Platform, Sensors,
          Spatial, and the rest. Turn on <strong>Detailed</strong> in the tools menu when you want every label explained.
        </p>
      ) : (
        <p className="card-intro">
          <strong>This pilot centers on UxS acquisition metadata:</strong> operational collection context (below), and the
          Platform, Sensors, and Spatial steps, carry how the Navy/NOAA UxS mission produced the dataset.{' '}
          <strong>Required for export</strong> in the current mode: ISO identifiers, title, abstract, purpose, period,
          contact, status, and language. Supplemental citation and aggregation sections follow; bbox, CRS, and data-quality
          detail are on the <strong>Spatial</strong> step.
        </p>
      )}
      {stepErrorSummary && !guidedMissionIntro ? (
        <p className="hint">
          <strong>Current step blockers:</strong> {stepErrorSummary}
        </p>
      ) : null}

      <section className="panel mission-symphony-uxs" aria-labelledby="uxs-context-heading">
        <h3 className="panel-title panel-title-hint" id="uxs-context-heading">
          <span>UxS collection context</span>
          <FieldHintTooltip ariaLabel="About UxS collection context">
            <>
              NOAA UxS records often sit in a stack: program → deployment → run → sortie or dive → dataset/product.
              Capture the operational layer here so runs and dives are not hidden only in the title or abstract.
            </>
          </FieldHintTooltip>
        </h3>
        <>
          <div className="mission-symphony-context-bar" role="group" aria-label="Operational routing">
            <div className="mission-symphony-context-bar__cell">
              <span className="mission-symphony-context-bar__label">
                Primary layer
                {uxsLayer.idField ? (
                  <FieldHintTooltip ariaLabel="Primary layer and catalog expectations">
                    <>
                      This block is the operational unit the data came from.
                      {` Catalog mode expects ${uxsLayer.label.toLowerCase()} ID/name fields when this layer is selected.`}
                    </>
                  </FieldHintTooltip>
                ) : null}
              </span>
              <select
                id="uxsPrimaryLayer"
                className="form-control"
                data-pilot-field="mission.uxsContext.primaryLayer"
                value={uxsContext.primaryLayer || 'datasetProduct'}
                onChange={(e) => patchUxsContext({ primaryLayer: e.target.value })}
                onBlur={() => onTouched('mission.uxsContext.primaryLayer')}
              >
                {UXS_LAYER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="mission-symphony-context-bar__cell">
              <span className="mission-symphony-context-bar__label">
                Outcome
                <FieldHintTooltip ariaLabel="Operation outcome vs dataset status">
                  <>
                    Operational outcome for filtering sorties/runs; separate from dataset status /{' '}
                    <code>MD_ProgressCode</code>.
                  </>
                </FieldHintTooltip>
              </span>
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
            </div>
            <div className="mission-symphony-context-bar__cell">
              <span className="mission-symphony-context-bar__label">Deployment ID</span>
              <input
                id="uxsDeploymentId"
                className="form-control"
                data-pilot-field="mission.uxsContext.deploymentId"
                value={uxsContext.deploymentId || ''}
                onChange={(e) => patchUxsContext({ deploymentId: e.target.value })}
                onBlur={() => onTouched('mission.uxsContext.deploymentId')}
                placeholder="Field effort ID"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="mission-symphony-uxs-details">
            <h4 className="panel-subtitle">
              Operational details
              <FieldHintTooltip ariaLabel="About deployment identifiers">
                <>
                  Use field-log labels and IDs where available. Rows follow the selected primary layer; values for hidden
                  layers remain in state and show again if you switch layers.
                </>
              </FieldHintTooltip>
            </h4>
            <fieldset className="pilot-fieldset mission-field-group mission-symphony-uxs-fieldset">
              <legend className="visually-hidden">Deployment, run, sortie, dive identifiers and note</legend>
              <label htmlFor="uxsDeploymentName">Deployment name</label>
              <input
                  id="uxsDeploymentName"
                  className="form-control"
                  data-pilot-field="mission.uxsContext.deploymentName"
                  value={uxsContext.deploymentName || ''}
                  onChange={(e) => patchUxsContext({ deploymentName: e.target.value })}
                  onBlur={() => onTouched('mission.uxsContext.deploymentName')}
              />
              {showUxsRunPair ? (
                <div className="form-row-2">
                  <div>
                    <label htmlFor="uxsRunName" >Run name</label>
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
                    <label htmlFor="uxsRunId" >Run ID</label>
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
              ) : null}
              {showUxsSortiePair ? (
                <div className="form-row-2">
                  <div>
                    <label htmlFor="uxsSortieName" >Sortie name</label>
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
                    <label htmlFor="uxsSortieId" >Sortie ID</label>
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
              ) : null}
              {showUxsDivePair ? (
                <div className="form-row-2">
                  <div>
                    <label htmlFor="uxsDiveName" >Dive name</label>
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
                    <label htmlFor="uxsDiveId" >Dive ID</label>
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
              ) : null}
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
            </fieldset>
          </div>
        </>
      </section>

      <section className="panel mission-step-identification" aria-labelledby="mission-record-heading">
        <h3 className="mission-step-identification__title" id="mission-record-heading">
          Mission identification
        </h3>
        <div className="step-mission-form-shell mission-step-identification__shell">
        {hideMissionLensDuplicateChrome ? null : (
          <MantaFieldInsights
            issues={issues}
            pilotState={{ mission, platform: {}, spatial: {}, keywords: {} }}
            activeStep="mission"
            onApply={(field, value) => {
              const key = field.replace('mission.', '')
              onMissionPatch({ [key]: value })
            }}
          />
        )}
        {importedFromStructuredSource ? (
          <div className="pilot-import-attention" role="status">
            <strong>After import:</strong>{' '}
            {importPriorityMissingLabels.length ? (
              <>
                These export-critical fields are still empty (not in the XML, not mapped yet, or cleared):{' '}
                <span className="pilot-import-attention__list">{importPriorityMissingLabels.join(', ')}</span>.
                {' '}
                Values in <strong>Core identity</strong> reflect merged state — expand timeline, contact, Spatial, and Advanced ISO as needed.
              </>
            ) : (
              <>
                The checklist of common required fields looks filled — continue with dates, contact, and status in the
                sections below, then run validation.
              </>
            )}
          </div>
        ) : null}
        <AccordionSection
          title="Core identity · anchor"
          variant="symphony"
          defaultOpen
          sectionClassName="mission-module-core"
        >
          <fieldset className="pilot-fieldset mission-field-group">
            <legend className="mission-fieldset-legend visually-hidden">Core identity</legend>
        <MantaFieldGlass
          fieldPath="mission.title"
          value={mission.title}
          issues={issues}
          label="Title"
          required
          hideChipsRow={hideMissionGlassChips}
          showValidationChrome={glassShowChrome('mission.title')}
          aiSuggestion={aiSuggestions['mission.title']}
          onApplyAiSuggestion={onApplyAiSuggestion}
          onIgnoreAiSuggestion={onIgnoreAiSuggestion}
        >
          <input
            id="title"
            className={`form-control${invalid('mission.title') ? ' form-control--invalid' : ''}`}
            data-pilot-field="mission.title"
            value={mission.title}
            onChange={(e) => onMissionPatch({ title: e.target.value })}
            onBlur={() => onTouched('mission.title')}
            aria-required
          />
        </MantaFieldGlass>

        <MantaFieldGlass
          fieldPath="mission.alternateTitle"
          value={mission.alternateTitle || ''}
          issues={issues}
          label="Alternate title"
          hideAskMore
          hideChipsRow={hideMissionGlassChips}
          showValidationChrome={glassShowChrome('mission.alternateTitle')}
          aiSuggestion={aiSuggestions['mission.alternateTitle']}
          onApplyAiSuggestion={onApplyAiSuggestion}
          onIgnoreAiSuggestion={onIgnoreAiSuggestion}
        >
          <input
            id="alternateTitle"
            className="form-control"
            data-pilot-field="mission.alternateTitle"
            value={mission.alternateTitle || ''}
            onChange={(e) => onMissionPatch({ alternateTitle: e.target.value })}
          />
        </MantaFieldGlass>

        <MantaFieldGlass
          fieldPath="mission.abstract"
          value={mission.abstract}
          issues={issues}
          label="Abstract"
          required
          textLengthThreshold={100}
          hideChipsRow={hideMissionGlassChips}
          showValidationChrome={glassShowChrome('mission.abstract')}
          hint="Include platform type, instruments, survey area, dates, and data products. Turn on Lens and focus this field for acronym-safe drafting help."
          aiSuggestion={aiSuggestions['mission.abstract']}
          onApplyAiSuggestion={onApplyAiSuggestion}
          onIgnoreAiSuggestion={onIgnoreAiSuggestion}
        >
          <>
            <textarea
              id="abstract"
              rows={abstractExpanded ? 12 : 5}
              className={`form-control${invalid('mission.abstract') ? ' form-control--invalid' : ''}`}
              data-pilot-field="mission.abstract"
              value={mission.abstract}
              onChange={(e) => onMissionPatch({ abstract: e.target.value })}
              onBlur={() => onTouched('mission.abstract')}
              aria-required
            />
            <div className="mission-abstract-expand-row">
              <button
                type="button"
                className="button button-tiny button-secondary"
                onClick={() => setAbstractExpanded((v) => !v)}
              >
                {abstractExpanded ? 'Use compact abstract' : 'Expand editing surface'}
              </button>
            </div>
          </>
        </MantaFieldGlass>

        <MantaFieldGlass
          fieldPath="mission.purpose"
          value={mission.purpose || ''}
          issues={issues}
          label="Purpose (dataset)"
          required
          hideChipsRow={hideMissionGlassChips}
          showValidationChrome={glassShowChrome('mission.purpose')}
          aiSuggestion={aiSuggestions['mission.purpose']}
          onApplyAiSuggestion={onApplyAiSuggestion}
          onIgnoreAiSuggestion={onIgnoreAiSuggestion}
        >
          {editPurpose ? (
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
          ) : (
            <div
              style={{
                fontSize: '13px',
                color: 'var(--color-text-secondary, var(--text-muted, #64748b))',
                fontStyle: 'italic',
                lineHeight: 1.45,
              }}
            >
              {String(mission.purpose || '').trim() || NCEI_DEFAULT_MISSION_PURPOSE}
              <button
                type="button"
                className="button button-tiny button-secondary"
                onClick={() => setEditPurpose(true)}
                style={{ marginLeft: '8px', fontSize: '11px', verticalAlign: 'baseline' }}
              >
                Edit
              </button>
            </div>
          )}
        </MantaFieldGlass>

        <MantaFieldGlass
          fieldPath="mission.status"
          value={mission.status || ''}
          issues={issues}
          label="Dataset status"
          required
          hideChipsRow={hideMissionGlassChips}
          showValidationChrome={glassShowChrome('mission.status')}
        >
          <div className="mission-pill-select">
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
              <option value="historicalArchive">historicalArchive</option>
              <option value="onGoing">onGoing</option>
              <option value="planned">planned</option>
              <option value="underDevelopment">underDevelopment</option>
              <option value="obsolete">obsolete</option>
              <option value="required">required</option>
            </select>
          </div>
          {show('mission.status') ? <p className="field-error">{show('mission.status')}</p> : null}
        </MantaFieldGlass>

        <MantaFieldGlass
          fieldPath="mission.fileId"
          value={mission.fileId}
          issues={issues}
          label="File identifier"
          required
          hideChipsRow={hideMissionGlassChips}
          showValidationChrome={glassShowChrome('mission.fileId')}
          hint={<>NCEI file identifier; optional <code>gov.noaa.ncei.uxs:</code> prefix.</>}
        >
          <input
            id="fileId"
            className={`form-control mission-mono-input${invalid('mission.fileId') ? ' form-control--invalid' : ''}`}
            data-pilot-field="mission.fileId"
            value={mission.fileId}
            onChange={(e) => onMissionPatch({ fileId: e.target.value })}
            onBlur={() => onTouched('mission.fileId')}
            aria-invalid={invalid('mission.fileId')}
            aria-required
            spellCheck="false"
            autoCapitalize="off"
            autoCorrect="off"
          />
        </MantaFieldGlass>

          </fieldset>
        </AccordionSection>

        <AccordionSection
          title="Timeline & tracking"
          variant="symphony"
          defaultOpen={accTimelineTracking}
          hasValues={accTimelineTracking}
        >
        <fieldset className="pilot-fieldset mission-field-group">
          <legend className="mission-fieldset-legend visually-hidden">Timeline and tracking</legend>
        <div className="form-row-2">
          <div>
            <label htmlFor="startDate">Start date *</label>
            <input
              {...pilotFieldControlAttrs('mission.startDate', 'startDate')}
              type="datetime-local"
              className={`form-control${invalid('mission.startDate') ? ' form-control--invalid' : ''}`}
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
              {...pilotFieldControlAttrs('mission.endDate', 'endDate')}
              type="datetime-local"
              className={`form-control${invalid('mission.endDate') ? ' form-control--invalid' : ''}`}
              value={toDatetimeLocalValue(mission.endDate)}
              onChange={(e) => onMissionPatch({ endDate: fromDatetimeLocalValue(e.target.value) })}
              onBlur={() => onTouched('mission.endDate')}
              aria-required
            />
            {show('mission.endDate') ? <p className="field-error">{show('mission.endDate')}</p> : null}
          </div>
        </div>

        <div className="form-row-2">
          <div>
            <label htmlFor="publicationDate">Publication date (citation)</label>
            <input
              {...pilotFieldControlAttrs('mission.publicationDate', 'publicationDate')}
              type="datetime-local"
              className={`form-control${invalid('mission.publicationDate') ? ' form-control--invalid' : ''}`}
              value={toDatetimeLocalValue(mission.publicationDate)}
              onChange={(e) => onMissionPatch({ publicationDate: fromDatetimeLocalValue(e.target.value) })}
              onBlur={() => onTouched('mission.publicationDate')}
            />
            {show('mission.publicationDate') ? <p className="field-error">{show('mission.publicationDate')}</p> : null}
          </div>
          <div>
            <label htmlFor="language">Language</label>
            <select
              {...pilotFieldControlAttrs('mission.language', 'language')}
              className={`form-control form-select${invalid('mission.language') ? ' form-control--invalid' : ''}`}
              value={mission.language || 'eng'}
              onChange={(e) => onMissionPatch({ language: e.target.value })}
              onBlur={() => onTouched('mission.language')}
              aria-required
            >
              {(() => {
                const rawLang = String(mission.language || '').trim()
                if (!rawLang || MISSION_ISO639_PRESETS.includes(rawLang)) return null
                return <option value={rawLang}>{rawLang} (current)</option>
              })()}
              {MISSION_ISO639_PRESETS.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
            {show('mission.language') ? <p className="field-error">{show('mission.language')}</p> : null}
          </div>
        </div>

        <div className="mission-doi-accession-grid">
          <div className="mission-doi-row">
            <label htmlFor="doi">DOI</label>
            <div className="mission-doi-row__controls">
              <input
                {...pilotFieldControlAttrs('mission.doi', 'doi')}
                className={`form-control mission-mono-input${invalid('mission.doi') ? ' form-control--invalid' : ''}`}
                placeholder="e.g., 10.7289/V5ABC123"
                value={mission.doi}
                onChange={(e) => onMissionPatch({ doi: e.target.value })}
                onBlur={() => onTouched('mission.doi')}
                spellCheck="false"
              />
              <span
                className={`mission-doi-badge${doiShapeOk ? ' mission-doi-badge--ok' : ''}`}
                title={doiShapeOk ? 'Handle matches DataCite-style DOI pattern' : 'Enter a DOI (10.xxxx/…) to mark shape OK'}
                aria-label={doiShapeOk ? 'DOI shape looks valid' : 'DOI shape not validated'}
              >
                {doiShapeOk ? '✓' : '○'}
              </span>
            </div>
            {show('mission.doi') ? <p className="field-error">{show('mission.doi')}</p> : null}
            <p className="hint mission-doi-hint">Permanent data link (DataCite-style <code>10.xxxx/…</code>).</p>
          </div>
          <div>
            <label htmlFor="accession">NCEI accession</label>
            <input
              id="accession"
              className={`form-control mission-mono-input${invalid('mission.accession') ? ' form-control--invalid' : ''}`}
              data-pilot-field="mission.accession"
              value={mission.accession}
              onChange={(e) => onMissionPatch({ accession: e.target.value })}
              onBlur={() => onTouched('mission.accession')}
              spellCheck="false"
            />
            {show('mission.accession') ? <p className="field-error">{show('mission.accession')}</p> : null}
          </div>
        </div>

        </fieldset>
        </AccordionSection>

        <AccordionSection
          title="Citation parties (author / publisher / originator)"
          variant="symphony"
          defaultOpen={false}
          hasValues={accCitationParties}
        >
          <div className="mission-collapsible__body" style={{ paddingTop: 0 }}>
        <fieldset className="pilot-fieldset mission-field-group">
          <legend className="mission-fieldset-legend visually-hidden">Citation parties</legend>
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
        </fieldset>
          </div>
        </AccordionSection>

        <AccordionSection title="Scope code" variant="symphony" defaultOpen={false} hasValues={accScope}>
          <div className="mission-collapsible__body" style={{ paddingTop: 0 }}>
        <fieldset className="pilot-fieldset mission-field-group">
          <legend className="mission-fieldset-legend">Scope</legend>
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

        </fieldset>
          </div>
        </AccordionSection>

        <AccordionSection
          title="Responsible party · organization &amp; contact"
          variant="symphony"
          defaultOpen={accContactParties}
          hasValues={accContactParties}
        >
          <div className="mission-collapsible__body" style={{ paddingTop: 0 }}>
        <fieldset className="pilot-fieldset mission-field-group">
          <legend className="mission-fieldset-legend">Organization &amp; contact (ROR)</legend>
        <h4 className="panel-subtitle">Organization &amp; contact</h4>
        {contactLibraryEnabled ? (
          <div className="mission-contact-library panel" style={{ marginBottom: '0.85rem' }}>
            <p className="hint" style={{ marginTop: 0 }}>
              <strong>Contact library</strong> — apply a vetted NOAA block, then edit the individual name and email to
              match your record.
            </p>
            <div className="form-row-2">
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  onMissionPatch({
                    org: 'National Oceanic and Atmospheric Administration',
                    ror: {
                      id: 'https://ror.org/033thwp43',
                      name: 'National Oceanic and Atmospheric Administration',
                      country: 'US',
                      types: ['Government'],
                    },
                  })
                }
              >
                NOAA (agency) + ROR
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  onMissionPatch({
                    org: 'National Centers for Environmental Information, NOAA',
                  })
                }
              >
                NCEI organization text
              </button>
            </div>
          </div>
        ) : null}
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

        </fieldset>
          </div>
        </AccordionSection>

        <AccordionSection
          title="Advanced ISO · technical appendix"
          variant="symphony"
          defaultOpen={false}
          hasValues={accAdvancedIso}
        >
        <fieldset className="pilot-fieldset mission-field-group">
          <legend className="mission-fieldset-legend visually-hidden">Advanced ISO</legend>

        <div className="mission-topic-quickadd" role="group" aria-label="Quick-add topic category codes">
          {ISO_TOPIC_PRESETS.filter((o) => o.value).map((o) => (
            <button
              key={o.value}
              type="button"
              className="button button-tiny button-secondary"
              onClick={() => {
                const cur = Array.isArray(mission.topicCategories) ? [...mission.topicCategories] : []
                if (!cur.includes(o.value)) cur.push(o.value)
                onMissionPatch({ topicCategories: cur })
              }}
            >
              + {o.label}
            </button>
          ))}
        </div>
        <label htmlFor="topicCategories">MD_TopicCategoryCode values (one per line, comma, or semicolon)</label>
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
              topicCategories: e.target.value.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean),
            })
          }
        />

        <label htmlFor="characterSet">Character set</label>
        <input
          id="characterSet"
          className="form-control mission-mono-input"
          data-pilot-field="mission.characterSet"
          placeholder="e.g., utf8"
          value={mission.characterSet || ''}
          onChange={(e) => onMissionPatch({ characterSet: e.target.value })}
        />

        <div className="form-row-2">
          <div>
            <LabelWithHint
              htmlFor="temporalExtentIntervalUnit"
              label={
                <>
                  Temporal sampling interval unit (<code>gml:timeInterval</code> @unit)
                </>
              }
              hint="Optional. NOAA template uses a unit token with a numeric value below."
            />
            <input
              id="temporalExtentIntervalUnit"
              className="form-control"
              data-pilot-field="mission.temporalExtentIntervalUnit"
              placeholder="e.g., day, hour, or UOM URI"
              value={mission.temporalExtentIntervalUnit || ''}
              onChange={(e) => onMissionPatch({ temporalExtentIntervalUnit: e.target.value })}
            />
          </div>
          <div>
            <LabelWithHint
              htmlFor="temporalExtentIntervalValue"
              label="Temporal sampling interval value"
              hint={
                <>
                  Paired with interval unit for <code>gml:timeInterval</code> inside acquisition period.
                </>
              }
            />
            <input
              id="temporalExtentIntervalValue"
              className="form-control"
              data-pilot-field="mission.temporalExtentIntervalValue"
              placeholder="e.g., 1"
              value={mission.temporalExtentIntervalValue || ''}
              onChange={(e) => onMissionPatch({ temporalExtentIntervalValue: e.target.value })}
            />
          </div>
        </div>

        <LabelWithHint
          htmlFor="metadataRecordDate"
          label={
            <>
              Metadata record date (<code>gmd:dateStamp</code>)
            </>
          }
          hint={
            <>
              <strong>Metadata record date</strong> for <code>gmd:dateStamp</code>. When blank, the XML preview uses the
              current UTC instant so downloads always carry a fresh stamp; set this field to freeze a specific instant
              (for example to match a source file you imported).
            </>
          }
        />
        <input
          id="metadataRecordDate"
          type="datetime-local"
          className={`form-control${invalid('mission.metadataRecordDate') ? ' form-control--invalid' : ''}`}
          data-pilot-field="mission.metadataRecordDate"
          value={toDatetimeLocalValue(mission.metadataRecordDate)}
          onChange={(e) => onMissionPatch({ metadataRecordDate: fromDatetimeLocalValue(e.target.value) })}
          onBlur={() => onTouched('mission.metadataRecordDate')}
        />
        {show('mission.metadataRecordDate') ? (
          <p className="field-error">{show('mission.metadataRecordDate')}</p>
        ) : null}

        <label htmlFor="supplementalInformation" style={{ fontSize: '12px', color: 'var(--color-text-secondary, var(--text-muted, #64748b))', marginBottom: '4px', display: 'block' }}>Supplemental information</label>
        <textarea
          id="supplementalInformation"
          rows={2}
          className="form-control"
          data-pilot-field="mission.supplementalInformation"
          value={mission.supplementalInformation || ''}
          onChange={(e) => onMissionPatch({ supplementalInformation: e.target.value })}
        />

        <fieldset className="pilot-fieldset mission-field-group mission-field-group--nested">
          <legend className="mission-fieldset-legend">Graphic overview (optional)</legend>
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
        </fieldset>
        </fieldset>
        </AccordionSection>

        </div>
      </section>

      <section className="panel">
        <h3 className="panel-title panel-title-hint">
          <span>Constraints &amp; legal</span>
          <FieldHintTooltip ariaLabel="About constraints fields">
            <>
              Same fields as the classic <code>#missionForm</code>: cite-as, other constraints, license preset / URL, access
              text, distribution liability (see <code>METADATA_FIELD_MAP.md</code> §2).
            </>
          </FieldHintTooltip>
        </h3>
        <div className="step-mission-form-shell">
        <AccordionSection title="Constraints &amp; legal · standardized use" variant="symphony" defaultOpen={accConstraints} hasValues={accConstraints}>
        <fieldset className="pilot-fieldset mission-field-group mission-constraints-fieldset">
          <legend className="visually-hidden">Constraints and legal fields</legend>

        <div className="mission-cite-as-suggest" aria-live="polite">
          <span className="mission-cite-as-suggest__label">Suggested cite-as (from title / contact)</span>
          <div className="mission-cite-as-suggest__output">{citeAsSuggestion}</div>
          <button
            type="button"
            className="button button-tiny button-secondary"
            onClick={() => onMissionPatch({ citeAs: citeAsSuggestion })}
          >
            Apply suggestion
          </button>
        </div>
        <MantaFieldGlass
          fieldPath="mission.citeAs"
          value={mission.citeAs || ''}
          issues={issues}
          label="Cite as (use limitation)"
          hideChipsRow={hideMissionGlassChips}
          showValidationChrome={glassShowChrome('mission.citeAs')}
          aiSuggestion={aiSuggestions['mission.citeAs']}
          onApplyAiSuggestion={onApplyAiSuggestion}
          onIgnoreAiSuggestion={onIgnoreAiSuggestion}
          hint="Standard citation string for users of this dataset. Include authors, year, title, and repository."
        >
          <textarea
            id="citeAs"
            rows={2}
            className="form-control"
            data-pilot-field="mission.citeAs"
            value={mission.citeAs || ''}
            onChange={(e) => onMissionPatch({ citeAs: e.target.value })}
            onBlur={() => onTouched('mission.citeAs')}
          />
        </MantaFieldGlass>
        <label htmlFor="otherCiteAs">Other cite / plain other constraints</label>
        <textarea
          id="otherCiteAs"
          rows={2}
          className="form-control"
          data-pilot-field="mission.otherCiteAs"
          value={mission.otherCiteAs || ''}
          onChange={(e) => onMissionPatch({ otherCiteAs: e.target.value })}
        />

        <span className="mission-license-cards__label" id="mission-license-cards-label">Data license</span>
        <div className="mission-license-cards" role="group" aria-labelledby="mission-license-cards-label">
          {[
            { preset: 'ncei_cc0', label: 'CC0' },
            { preset: 'ncei_cc_by_4', label: 'CC-BY-4.0' },
            { preset: 'custom', label: 'Custom' },
          ].map(({ preset, label }) => {
            const active = (mission.dataLicensePreset || 'custom') === preset
            return (
              <button
                key={preset}
                type="button"
                className={`mission-license-card${active ? ' mission-license-card--active' : ''}`}
                aria-pressed={active}
                onClick={() => onMissionPatch({ dataLicensePreset: preset })}
              >
                {label}
              </button>
            )
          })}
        </div>
        <details className="mission-license-more">
          <summary>Other NCEI license presets</summary>
          <label className="visually-hidden" htmlFor="dataLicensePreset">Data license preset (full list)</label>
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
        </details>
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
        {mission.dataLicensePreset === 'custom' && !String(mission.licenseUrl || '').trim() ? (
          <p className="hint" role="status" style={{ color: '#b45309', fontWeight: 600, fontSize: '0.82rem', marginTop: 6 }}>
            License URL is required for custom preset — or switch to CC-BY-4.0.
          </p>
        ) : null}
        {show('mission.licenseUrl') ? <p className="field-error">{show('mission.licenseUrl')}</p> : null}
        <LabelWithHint
          htmlFor="accessConstraintsCode"
          label="Access restriction (ISO MD_RestrictionCode)"
          hint={
            <>
              The live XML preview emits a proper <code>gmd:MD_RestrictionCode</code> with codelist when a value is chosen;
              notes add <code>gmd:otherConstraints</code> for details. Text without a code maps to{' '}
              <code>otherRestrictions</code> + your text (legacy free-text shape is normalized).
            </>
          }
        />
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
        {editLiability ? (
          <div className="mission-liability-edit">
            <textarea
              id="distributionLiability"
              rows={4}
              className="form-control"
              data-pilot-field="mission.distributionLiability"
              value={mission.distributionLiability || ''}
              onChange={(e) => onMissionPatch({ distributionLiability: e.target.value })}
              onBlur={() => onTouched('mission.distributionLiability')}
            />
            <button
              type="button"
              className="button button-tiny button-secondary"
              onClick={() => setEditLiability(false)}
            >
              Show read-only summary
            </button>
          </div>
        ) : (
          <div className="mission-legal-readonly">
            <pre className="mission-legal-readonly__block">{String(mission.distributionLiability || '').trim() || NCEI_DEFAULT_DISTRIBUTION_LIABILITY}</pre>
            <button
              type="button"
              className="button button-tiny button-secondary"
              onClick={() => {
                if (!String(mission.distributionLiability || '').trim()) {
                  onMissionPatch({ distributionLiability: NCEI_DEFAULT_DISTRIBUTION_LIABILITY })
                }
                setEditLiability(true)
              }}
            >
              Edit liability text
            </button>
          </div>
        )}
        </fieldset>
        </AccordionSection>
        </div>
      </section>

      <section className="panel">
        <h3 className="panel-title panel-title-hint">
          <span>Aggregation &amp; related resources</span>
          <FieldHintTooltip ariaLabel="About aggregation fields">
            <>
              Same flat <code>name</code> attributes as the classic mission form (larger work, cross-reference dataset,
              associated publication). Preview emits XML comments until full <code>aggregationInfo</code> blocks are modeled.
            </>
          </FieldHintTooltip>
        </h3>
        <div className="step-mission-form-shell">
        <AccordionSection
          title="Aggregation · related records &amp; lineage"
          variant="symphony"
          defaultOpen={false}
          hasValues={accRelatedRecords}
        >

        <fieldset className="pilot-fieldset mission-field-group">
          <legend className="mission-fieldset-legend">Parent project (larger work citation)</legend>
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
        </fieldset>

        <fieldset className="pilot-fieldset mission-field-group">
          <legend className="mission-fieldset-legend">Related dataset &amp; links (cross reference)</legend>
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
        </fieldset>

        <fieldset className="pilot-fieldset mission-field-group">
          <legend className="mission-fieldset-legend">Associated publication</legend>
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
        </fieldset>
        </AccordionSection>
        </div>
      </section>

      <section className="panel" aria-labelledby="mission-local-draft-heading">
        <h3 className="panel-title" id="mission-local-draft-heading">Local draft</h3>
        <fieldset className="pilot-fieldset mission-field-group">
          <legend className="visually-hidden">Draft actions</legend>
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
        </fieldset>
      </section>
    </>
  )
}
