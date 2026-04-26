/**
 * AssistantShell — Manta Ray Metadata Builder widget (v4).
 *
 * HUD window frame with four tabbed panels:
 *
 *   VALIDATE — Live validation: score ring, section bars, per-issue rows with
 *              "?" definition button, real-time error pulse on re-check.
 *   ASK      — Terminal-style Q&A against the local metadata knowledge base.
 *              Quick-tap suggestion chips. Inline markdown-lite rendering.
 *   SEARCH   — GCMD keyword + ROR org search, clipboard copy, search history.
 *   LIVE     — Auto-refreshing key-value view of the current session state.
 *
 * @module shell/AssistantShell
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import MantaScannerFrame from '../components/MantaScannerFrame.jsx'
import { getFieldElementForPilot, getFieldElementsForLensHighlight } from '../core/registry/FieldRegistry.js'
import { useMetadataEngine } from './context.js'
import { defaultPilotState } from '../lib/pilotValidation.js'
import { readPilotSessionPayload } from '../lib/pilotSessionStorage.js'
import { computeReadinessSnapshot } from '../lib/readinessSummary.js'
import ReadinessStrip from '../components/ReadinessStrip.jsx'
import {
  answerQuestion,
  getFieldDefinition,
  SUGGESTED_QUESTIONS,
} from './metadataKnowledgeBase.js'
import { fetchCometRecord, detectGaps, extractUuid } from '../lib/cometClient.js'
import { buildPilotPayloadFromCometXml } from '../lib/cometProfileImport.js'
import { getLensChipsForIssue } from '../lib/lensIssueChips.js'
import { buildFixGuideQueue, countFixableIssues, getCoachingPrompts } from '../lib/lensFixGuide.js'

// ── Constants ─────────────────────────────────────────────────────────────────

const SEARCH_SCHEMES = [
  { value: 'sciencekeywords', label: 'Science KW' },
  { value: 'instruments',     label: 'Instruments' },
  { value: 'platforms',       label: 'Platforms' },
  { value: 'locations',       label: 'Locations' },
  { value: 'organizations',   label: 'Organizations' },
]

const TIPS = [
  'Use full GCMD keyword paths — e.g. "Earth Science > Oceans > Marine Environment Monitoring."',
  'Every record needs a geographic bounding box (W / E / S / N) for spatial discovery.',
  'BEDI granules require parentCollectionId linking to their parent collection record.',
  'ISO 8601 dates (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ) are required for interoperability.',
  'A browse graphic URL makes your record stand out visually in catalogs like OneStop.',
  'Include a DOI or NCEI Accession ID for reliable cross-system record lookup.',
  '"Strict" mode checks all required fields for publication — run before submitting.',
  'Use ROR IDs for organizations — search via the Organizations scheme in SEARCH.',
  '"Catalog" mode enforces landing page URL, download URL, and DOI.',
  'ASK tab has definitions for every metadata field — try "What is parentCollectionId?"',
]

const SAMPLE_RECENT = [
  { id: 'r1', title: 'Satellite Climate Data 2023' },
  { id: 'r2', title: 'Ocean Temperature Records' },
  { id: 'r3', title: 'Historical Storm Reports' },
]

const SYSTEM_MSG = 'Metadata Assistant online. Ask me about ISO 19115, BEDI requirements, GCMD keywords, validation modes, or any metadata field.'

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score) {
  if (score >= 80) return '#22d3ee'
  if (score >= 50) return '#fbbf24'
  return '#f87171'
}

function computeSectionStatus(steps, issues) {
  return steps.map((step) => {
    const si      = issues.filter((i) => (i.field?.split('.')?.[0] ?? '') === step.id)
    const errors  = si.filter((i) => i.severity === 'e').length
    const warnings = si.filter((i) => i.severity === 'w').length
    const pct =
      errors   > 0 ? Math.max(10, 70 - errors   * 14) :
      warnings > 0 ? Math.max(55, 92 - warnings * 7)  : 100
    return { id: step.id, label: step.label ?? step.id, errors, warnings, pct }
  })
}

function extractLiveFields(pilotState) {
  if (!pilotState || typeof pilotState !== 'object') return []
  const SKIP = new Set(['__version', 'touched', 'issues'])
  const rows = []
  for (const [section, data] of Object.entries(pilotState)) {
    if (SKIP.has(section) || typeof data !== 'object' || data === null || Array.isArray(data)) continue
    for (const [key, value] of Object.entries(data)) {
      if (SKIP.has(key)) continue
      if (Array.isArray(value)) {
        const flat = value.filter(Boolean).join(', ')
        if (flat) rows.push({ section, key, value: flat, isArray: true })
      } else if (typeof value === 'string' && value.trim()) {
        rows.push({ section, key, value: value.trim(), isArray: false })
      } else if (typeof value === 'number') {
        rows.push({ section, key, value: String(value), isArray: false })
      }
    }
    if (rows.length >= 24) break
  }
  return rows
}

/** Render simple markdown-lite: **bold**, `code`, newlines */
function RichText({ text }) {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, li) => {
        const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
        return (
          <span key={li}>
            {parts.map((p, pi) => {
              if (p.startsWith('**') && p.endsWith('**'))
                return <strong key={pi}>{p.slice(2, -2)}</strong>
              if (p.startsWith('`') && p.endsWith('`'))
                return <code key={pi} className="manta-chat__code">{p.slice(1, -1)}</code>
              return p
            })}
            {li < lines.length - 1 && <br />}
          </span>
        )
      })}
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 76, sw = 6 }) {
  const color = scoreColor(score)
  const r     = (size - sw * 2) / 2
  const circ  = 2 * Math.PI * r
  const dash  = (score / 100) * circ
  return (
    <div className="manta-score-ring-wrap" style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <svg width={size} height={size} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} />
        <circle
          cx={size/2} cy={size/2} r={r}
          fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1), stroke 0.5s ease', filter: `drop-shadow(0 0 7px ${color}99)` }}
        />
      </svg>
      <div className="manta-score-ring-label">
        <span className="manta-score-ring-num" style={{ color, textShadow: `0 0 16px ${color}88` }}>{score}</span>
        <span className="manta-score-ring-denom">/100</span>
      </div>
    </div>
  )
}

/**
 * Maps profile step IDs → XML tag fragments that appear in that section.
 * Used by the lens to highlight the right XML lines when a section bar is clicked.
 */
const SECTION_XML_TERMS = {
  mission:      ['identificationInfo', 'MD_DataIdentification', 'citation', 'abstract', 'purpose', 'CI_Citation'],
  platform:     ['MI_Platform', 'MI_AcquisitionInformation', 'platform', 'platformType', 'CI_PlatformDetails'],
  sensors:      ['MI_Instrument', 'instrument', 'sensorType', 'sensor'],
  spatial:      ['EX_GeographicBoundingBox', 'EX_TemporalExtent', 'westBound', 'eastBound', 'southBound', 'northBound', 'extent'],
  keywords:     ['MD_Keywords', 'keyword', 'thesaurusName', 'descriptiveKeywords'],
  distribution: ['MD_Distribution', 'distributionFormat', 'transferOptions', 'onlineResource'],
  // BEDI (ISO 19115-2 / GMI + GCMD anchors in descriptiveKeywords)
  bediCollection: [
    'identificationInfo',
    'MD_DataIdentification',
    'citation',
    'abstract',
    'descriptiveKeywords',
    'MD_Keywords',
    'gmx:Anchor',
    'thesaurusName',
    'EX_Extent',
    'EX_TemporalExtent',
    'EX_VerticalExtent',
  ],
  bediGranule: [
    'identificationInfo',
    'fileIdentifier',
    'parentIdentifier',
    'abstract',
    'descriptiveKeywords',
    'MD_Keywords',
    'gmx:Anchor',
    'thesaurusName',
    'EX_Extent',
    'EX_TemporalExtent',
    'EX_VerticalExtent',
    'MD_Distribution',
  ],
  collection:     ['identificationInfo', 'MD_DataIdentification'],
}

/**
 * High-signal XML / GMI fragments for `pilotState` validation paths — merged with
 * section terms so Lens clicks land on real preview lines, not only camelCase leaves.
 */
const FIELD_XML_HINTS = {
  'mission.fileId': ['fileIdentifier', 'gmd:fileIdentifier'],
  'mission.title': ['gmd:title', 'CI_Citation', 'citation', 'title'],
  'mission.abstract': ['abstract', 'gmd:abstract', 'CharacterString'],
  'mission.purpose': ['purpose', 'gmd:purpose'],
  'mission.status': ['status', 'gmd:status', 'MD_ProgressCode', 'progress'],
  'mission.language': ['language', 'LanguageCode', 'gmd:language'],
  'mission.characterSet': ['characterSet', 'CharacterSetCode'],
  'mission.publicationDate': ['publicationDate', 'CI_Date', 'dateType'],
  'mission.metadataRecordDate': ['dateStamp', 'gmd:dateStamp'],
  'mission.startDate': ['beginPosition', 'TimePeriod', 'EX_TemporalExtent', 'extent'],
  'mission.endDate': ['endPosition', 'TimePeriod', 'EX_TemporalExtent'],
  'mission.doi': ['identifier', 'MD_Identifier', 'code', 'doi'],
  'mission.accession': ['identifier', 'code', 'accession'],
  'mission.ror': ['organisationName', 'ror.org', 'CI_Party'],
  'mission.org': ['organisationName', 'CI_ResponsibleParty', 'pointOfContact'],
  'mission.individualName': ['individualName', 'CI_Individual'],
  'mission.email': ['electronicMailAddress', 'CI_Address', 'contactInfo'],
  'mission.contactUrl': ['linkage', 'CI_OnlineResource', 'onlineResource'],
  'mission.contactPhone': ['voice', 'telephone', 'CI_Telephone'],
  'mission.contactAddress': ['deliveryPoint', 'CI_Address', 'city'],
  'mission.licenseUrl': ['useLimitation', 'MD_LegalConstraints', 'otherConstraints'],
  'mission.citeAs': ['useLimitation', 'otherConstraints'],
  'mission.topicCategories': ['topicCategory', 'MD_TopicCategoryCode'],
  'mission.graphicOverviewHref': ['graphicOverview', 'MD_BrowseGraphic'],
  'mission.bbox': ['westBoundLongitude', 'eastBoundLongitude', 'southBoundLatitude', 'northBoundLatitude', 'EX_GeographicBoundingBox'],
  'mission.vmin': ['minimumValue', 'EX_VerticalExtent', 'verticalElement'],
  'mission.vmax': ['maximumValue', 'EX_VerticalExtent'],
  'mission.vertical': ['vertical', 'verticalCRS', 'verticalExtent'],
  'mission.parentProjectTitle': ['aggregateInformation', 'MD_AggregateInformation', 'name'],
  'mission.relatedDataUrl': ['aggregateDataSetIdentifier', 'MD_Identifier', 'linkage'],
  'platform.platformType': ['platformType', 'MI_Platform', 'codeListValue'],
  'platform.platformId': ['identifier', 'MD_Identifier', 'MI_Platform'],
  'platform.platformDesc': ['description', 'MI_Platform', 'gco:CharacterString'],
  'spatial.accuracyStandard': ['DQ_ConformanceResult', 'specification', 'dataQualityInfo'],
  'spatial.accuracyValue': ['value', 'DQ_QuantitativeResult', 'DQ_DataQuality'],
  'spatial.errorLevel': ['DQ_QuantitativeResult', 'nameOfMeasure'],
  'spatial.errorValue': ['value', 'DQ_QuantitativeResult'],
  'spatial.verticalCrsUrl': ['verticalCRS', 'VerticalCRS', 'description'],
  'spatial.lineageStatement': ['LI_Lineage', 'statement', 'lineage'],
  'spatial.lineageProcessSteps': ['processStep', 'LI_ProcessStep', 'description'],
  'spatial.gridRepresentation': ['MD_GridSpatialRepresentation', 'axisDimensionProperties', 'cellGeometry'],
  'spatial.trajectorySampling': ['Trajectory', 'sampling', 'MI_Platform'],
  'distribution.format': ['format', 'MD_Format', 'name'],
  'distribution.license': ['useLimitation', 'MD_LegalConstraints'],
  'distribution.landingUrl': ['linkage', 'CI_OnlineResource', 'transferOptions'],
  'distribution.downloadUrl': ['linkage', 'transferOptions', 'onLine'],
  'distribution.metadataLandingUrl': ['linkage', 'onLine', 'distributorTransferOptions'],
  'distribution.nceiMetadataContactHref': ['contact', 'xlink:href', 'metadata'],
  'distribution.nceiDistributorContactHref': ['distributorContact', 'distributor', 'CI_ResponsibleParty'],
  'distribution.metadataMaintenanceFrequency': ['MD_MaintenanceInformation', 'maintenanceAndUpdateFrequency'],
  'distribution.publication': ['citation', 'CI_Citation', 'publication'],
  'distribution.parentProject': ['aggregateInformation', 'parentIdentifier'],
  keywords: ['MD_Keywords', 'keyword', 'thesaurusName', 'descriptiveKeywords', 'gmx:Anchor'],
  sensors: ['MI_Instrument', 'MI_CoverageDescription', 'sensor', 'instrument', 'MD_Band'],

  // BEDI flat pilot keys → XML fragments (Lens search / tether)
  title: ['gmd:title', 'CI_Citation', 'citation', 'CharacterString'],
  abstract: ['gmd:abstract', 'CharacterString'],
  alternateTitle: ['gmd:alternateTitle', 'CharacterString'],
  parentCollectionId: ['parentIdentifier', 'gmd:parentIdentifier', 'CharacterString'],
  fileId: ['fileIdentifier', 'gmd:fileIdentifier', 'CharacterString'],
  granuleId: ['MD_Identifier', 'gmd:identifier', 'gmd:code'],
  collectionId: ['MD_Identifier', 'gmd:identifier', 'gmd:code', 'Cruise ID'],
  scienceKeywords: ['MD_Keywords', 'descriptiveKeywords', 'gmx:Anchor', 'GCMD Science Keywords', 'thesaurusName'],
  scienceKeywordHrefs: ['gmx:Anchor', 'xlink:href', 'descriptiveKeywords'],
  placeKeywords: ['MD_Keywords', 'descriptiveKeywords', 'place', 'CharacterString'],
  datacenters: ['MD_Keywords', 'descriptiveKeywords', 'dataCentre', 'gmx:Anchor', 'GCMD Data Center'],
  datacenterKeywordHrefs: ['gmx:Anchor', 'xlink:href'],
  oerKeywords: ['MD_Keywords', 'descriptiveKeywords', 'OER', 'CharacterString', 'gmx:Anchor'],
  dataCenterKeyword: ['MD_Keywords', 'dataCentre', 'gmx:Anchor', 'thesaurusName'],
  dataCenterKeywordHref: ['gmx:Anchor', 'xlink:href'],
  instrumentKeyword: ['MD_Keywords', 'instrument', 'gmx:Anchor', 'thesaurusName'],
  instrumentKeywordHref: ['gmx:Anchor', 'xlink:href'],
  diveId: ['gmd:title', 'citation', 'DIVE', 'CharacterString'],
  tapeNumber: ['title', 'CharacterString', 'TAPE'],
  segmentNumber: ['title', 'CharacterString', 'SEG'],
  minDepth: ['minimumValue', 'EX_VerticalExtent', 'gco:Real'],
  maxDepth: ['maximumValue', 'EX_VerticalExtent', 'gco:Real'],
}

/** `sensors[0].modelId` → `sensors` for section maps; plain `mission.title` unchanged. */
function pilotSectionKey(fieldPath) {
  if (!fieldPath) return ''
  const head = fieldPath.split('.')[0] ?? ''
  const m    = head.match(/^([a-zA-Z_]+)\[\d+]$/)
  return m ? m[1] : head
}

/** Return XML search terms for a field key like "mission.title" or a section id like "mission". */
function xmlTermsForField(fieldOrSection) {
  if (!fieldOrSection) return []
  const hints = FIELD_XML_HINTS[fieldOrSection]
  const parts    = fieldOrSection.split('.')
  const section  = pilotSectionKey(fieldOrSection)
  const leaf     = parts[parts.length - 1]
  const sectionTerms = SECTION_XML_TERMS[section] ?? []
  const leafTerms = (leaf && leaf !== parts[0] && leaf !== section) ? [leaf] : []
  const base = [...sectionTerms, ...leafTerms]
  return hints?.length ? [...new Set([...hints, ...base])] : base
}

/** `/pattern/` in the Lens search box → RegExp (case-insensitive), invalid patterns fall back to literal search. */
function tryLensSearchRegex(raw) {
  const t = raw.trim()
  if (t.length >= 3 && t.startsWith('/') && t.endsWith('/')) {
    try {
      return new RegExp(t.slice(1, -1), 'i')
    } catch {
      return null
    }
  }
  return null
}

function SectionBar({ label, pct, errors, warnings, onClick, active }) {
  const color = errors > 0 ? '#f87171' : warnings > 0 ? '#fbbf24' : '#22d3ee'
  const fill  = pct === 100 ? 'linear-gradient(90deg,#22d3ee,#34d399)' : `linear-gradient(90deg,${color}88,${color})`
  const Tag   = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`manta-section-bar${active ? ' manta-section-bar--active' : ''}${onClick ? ' manta-section-bar--clickable' : ''}`}
      onClick={onClick}
      title={onClick ? 'Section scope' : undefined}
    >
      <span className="manta-section-bar__label">{label}</span>
      <div className="manta-section-bar__track">
        <div className="manta-section-bar__fill" style={{ width: `${pct}%`, background: fill, boxShadow: `0 0 8px ${color}55` }} />
      </div>
      <span className="manta-section-bar__stat" style={{ color }}>
        {errors > 0 ? `${errors}✗` : warnings > 0 ? `${warnings}⚠` : '✓'}
      </span>
    </Tag>
  )
}

function IssueRow({ issue, isNew, isDefActive, onToggleDef }) {
  const sev    = issue.severity === 'e' ? 'err' : 'wrn'
  const label  = sev === 'err' ? '✗ ERR' : '⚠ WRN'
  const section = issue.field?.split('.')?.[0]
  const hasDef  = !!getFieldDefinition(issue.field)

  return (
    <div className={`manta-issue-row manta-issue-row--${sev}${isNew ? ' manta-issue-row--new' : ''}`}>
      <span className={`manta-issue-badge manta-issue-badge--${sev}`}>{label}</span>
      <span className="manta-issue-msg">{issue.message}</span>
      <div className="manta-issue-actions">
        {section && <span className="manta-issue-section">{section}</span>}
        {hasDef && (
          <button
            type="button"
            className={`manta-issue-def-btn${isDefActive ? ' manta-issue-def-btn--on' : ''}`}
            onClick={onToggleDef}
            title="Show field definition"
            aria-label="Show definition"
          >
            ?
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AssistantShell({
  onClose,
  onOpenEditor,
  onToggleLens,
  lensMode = false,
  recentRecords,
  lensTarget: lensTargetProp = 'split',
  onLensTargetChange,
}) {
  const [lensTargetLocal, setLensTargetLocal] = useState('split')
  const isLensTargetControlled = onLensTargetChange != null
  const lensTarget = isLensTargetControlled ? lensTargetProp : lensTargetLocal
  const setLensTarget = isLensTargetControlled ? onLensTargetChange : setLensTargetLocal
  const { enrichmentService, validationEngine, hostBridge, profile, onCometLoad, workflowEngine } = useMetadataEngine()

  // ── Tab ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('validate')

  // ── VALIDATE ──────────────────────────────────────────────────────────────
  const [qualityResult,  setQualityResult]  = useState(null)
  const [qualityLoading, setQualityLoading] = useState(false)
  const [qualityMode, setQualityMode] = useState(() => {
    const m = readPilotSessionPayload()?.pilot?.mode
    return m === 'strict' || m === 'catalog' || m === 'lenient' ? m : 'lenient'
  })
  const [issuesOpen,     setIssuesOpen]     = useState(true)
  const [newIssueKeys,   setNewIssueKeys]   = useState(new Set())
  const [activeDefIssue, setActiveDefIssue] = useState(null) // issue object
  const prevIssueKeysRef = useRef(new Set())

  const runQualityCheck = useCallback((modeOverride) => {
    const mode = modeOverride ?? qualityMode
    setQualityMode(mode)
    setQualityLoading(true)
    try {
      const payload = readPilotSessionPayload()
      const state   = payload?.pilot ?? defaultPilotState()
      const result =
        profile.validationRuleSets?.length
          ? validationEngine.runProfileRules(state, mode, profile)
          : validationEngine.runForPilotState(state, mode)
      // Detect newly-appeared issues
      const currentKeys = new Set(result.issues.map((i) => `${i.field}:${i.message}`))
      const fresh       = new Set([...currentKeys].filter((k) => !prevIssueKeysRef.current.has(k)))
      setNewIssueKeys(fresh)
      prevIssueKeysRef.current = currentKeys
      setTimeout(() => setNewIssueKeys(new Set()), 1800)
      setQualityResult(result)
    } finally {
      setQualityLoading(false)
    }
  }, [validationEngine, qualityMode, profile])

  const widgetReadinessSnapshot = useMemo(() => {
    void qualityResult
    void qualityMode
    const payload = readPilotSessionPayload()
    const state = payload?.pilot ?? defaultPilotState()
    return computeReadinessSnapshot(state, validationEngine, profile)
  }, [validationEngine, profile, qualityResult, qualityMode])

  const syncValidationModeToWizard = useCallback(
    (m) => {
      window.dispatchEvent(new CustomEvent('manta:set-validation-mode', { detail: { mode: m } }))
      runQualityCheck(m)
    },
    [runQualityCheck],
  )

  useEffect(() => {
    runQualityCheck(qualityMode)
    const id = setInterval(() => runQualityCheck(qualityMode), 15000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qualityMode])

  useEffect(() => {
    function onWizardMode(/** @type {CustomEvent} */ e) {
      const m = e?.detail?.mode
      if (m !== 'lenient' && m !== 'strict' && m !== 'catalog') return
      setQualityMode(m)
      runQualityCheck(m)
    }
    window.addEventListener('manta:wizard-validation-mode-changed', onWizardMode)
    return () => window.removeEventListener('manta:wizard-validation-mode-changed', onWizardMode)
  }, [runQualityCheck])

  useEffect(() => {
    function onSessionWrite() {
      runQualityCheck(qualityMode)
    }
    window.addEventListener('manta:pilot-session-updated', onSessionWrite)
    return () => window.removeEventListener('manta:pilot-session-updated', onSessionWrite)
  }, [runQualityCheck, qualityMode])

  function toggleDef(issue) {
    setActiveDefIssue((prev) =>
      prev && prev.field === issue.field && prev.message === issue.message ? null : issue,
    )
  }

  // ── ASK ───────────────────────────────────────────────────────────────────
  const [chatHistory,  setChatHistory]  = useState([{ type: 'system', text: SYSTEM_MSG }])
  const [askInput,     setAskInput]     = useState('')
  const [askLoading,   setAskLoading]   = useState(false)
  const chatEndRef = useRef(null)

  function submitAsk(questionOverride) {
    const q = (questionOverride ?? askInput).trim()
    if (!q) return
    setAskInput('')
    setAskLoading(true)
    const match = answerQuestion(q)
    const answer = match
      ? match.a
      : "I don't have a specific answer for that. Try asking about: fileIdentifier, abstract length, bounding box, GCMD keywords, validation modes, BEDI parentCollectionId, or ISO 8601 dates."
    setChatHistory((prev) => [
      ...prev,
      { type: 'user', text: q },
      { type: 'assistant', text: answer },
    ])
    setAskLoading(false)
  }

  function onAskKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitAsk() }
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  // ── SEARCH ────────────────────────────────────────────────────────────────
  const [query,         setQuery]         = useState('')
  const [scheme,        setScheme]        = useState('sciencekeywords')
  const [kwResults,     setKwResults]     = useState([])
  const [orgResults,    setOrgResults]    = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError,   setSearchError]   = useState('')
  const [copied,        setCopied]        = useState(null)
  const [searchHistory, setSearchHistory] = useState([])
  const [suggestStatus, setSuggestStatus] = useState(null)

  const runSearch = useCallback(async (queryOverride) => {
    const q = (queryOverride ?? query).trim()
    if (!q) return
    setSearchLoading(true); setSearchError(''); setKwResults([]); setOrgResults([])
    try {
      if (scheme === 'organizations') {
        const res = await enrichmentService.searchOrganizations(q, { limit: 10 })
        setOrgResults(res)
        if (!res.length) setSearchError('No organizations matched.')
      } else {
        const res = await enrichmentService.suggestKeywords(scheme, q, { maxMatches: 12 })
        setKwResults(res)
        if (!res.length) setSearchError('No keywords found — try a shorter term.')
      }
      setSearchHistory((prev) => [q, ...prev.filter((h) => h !== q)].slice(0, 4))
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed.')
    } finally {
      setSearchLoading(false)
    }
  }, [enrichmentService, query, scheme])

  async function copyText(text, id) {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 2200) } catch { /* unavailable */ }
  }

  const runSuggestKeywords = useCallback(async () => {
    const payload  = readPilotSessionPayload()
    const state    = payload?.pilot
    const title    = state?.mission?.title?.trim()    ?? ''
    const abstract = state?.mission?.abstract?.trim() ?? ''
    const seed     = [title, abstract].filter(Boolean).join(' ').trim()
    if (!seed) { setSuggestStatus('empty'); return }
    setSuggestStatus('seeded'); setScheme('sciencekeywords')
    const q = seed.slice(0, 80); setQuery(q); setKwResults([]); setSearchLoading(true); setSearchError('')
    try {
      const res = await enrichmentService.suggestKeywords('sciencekeywords', q, { maxMatches: 12 })
      setKwResults(res)
      if (!res.length) setSearchError('No GCMD keywords matched — try refining.')
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Suggestion failed.')
    } finally { setSearchLoading(false) }
  }, [enrichmentService])

  // ── LIVE ──────────────────────────────────────────────────────────────────
  const [liveFields,    setLiveFields]    = useState([])
  const [liveUpdatedAt, setLiveUpdatedAt] = useState(null)

  const refreshLive = useCallback(() => {
    const payload = readPilotSessionPayload()
    if (payload?.pilot) {
      setLiveFields(extractLiveFields(payload.pilot))
      setLiveUpdatedAt(payload.savedAt ?? new Date().toISOString())
    }
  }, [])

  useEffect(() => {
    if (activeTab !== 'live') return
    function onSessionWrite() {
      refreshLive()
    }
    window.addEventListener('manta:pilot-session-updated', onSessionWrite)
    refreshLive()
    const id = setInterval(refreshLive, 10000)
    return () => {
      window.removeEventListener('manta:pilot-session-updated', onSessionWrite)
      clearInterval(id)
    }
  }, [activeTab, refreshLive])

  // ── RECORDS ───────────────────────────────────────────────────────────────
  const [_records,        setRecords]        = useState([])
  const [_recordsLoading, setRecordsLoading] = useState(false)

  const loadRecords = useCallback(async () => {
    setRecordsLoading(true)
    try {
      const res  = await hostBridge.listTemplates()
      setRecords((res.rows ?? []).filter((r) => r?.name).map((r) => ({ id: String(r.name), title: String(r.name), category: String(r.category ?? '') })))
    } catch { setRecords([]) } finally { setRecordsLoading(false) }
  }, [hostBridge])

  useEffect(() => { if (activeTab === 'records') loadRecords() }, [activeTab, loadRecords])

  // ── LENS state ────────────────────────────────────────────────────────────
  const [lensHlField,  setLensHlField]  = useState(null)
  const [lensSearch,   setLensSearch]   = useState('')
  const [lensAsk,      setLensAsk]      = useState(null)
  const [lensHitCount, setLensHitCount] = useState(0)
  const [lensHitFocus, setLensHitFocus] = useState(0)
  const [lensIssueFilter, setLensIssueFilter] = useState('all') // 'all' | 'errors' | 'warnings'
  const [lensIssueScope, setLensIssueScope] = useState(() => {
    try {
      const v = sessionStorage.getItem('manta-lens-issue-scope')
      if (v === 'all' || v === 'active') return v
    } catch { /* sessionStorage may be blocked */ }
    return 'active'
  })
  const [wizardActiveStepId, setWizardActiveStepId] = useState(/** @type {string | null} */ (null))
  const [lensFixGuide, setLensFixGuide] = useState(/** @type {null | { queue: Array<{ field?: string, message: string, severity: string }>, index: number }} */ (null))
  const [lensCopiedKey, setLensCopiedKey]     = useState(null) // last copied pilot field path
  const lensSearchInputRef = useRef(null)
  const lensHitCountRef    = useRef(0)
  const lensHitFocusRef    = useRef(0)
  const lensHighlightTargetRef = useRef({ target: null, isSearch: false })
  const lensIssueNavIdxRef = useRef(0)
  const fieldNavTimeoutRef   = useRef(0)
  const [lensHelpOpen, setLensHelpOpen] = useState(false)
  const lensQuickChipQcTimeoutRef = useRef(0)
  /** Where the live issues tray sits: above the through-glass work area (default) or below. */
  const [lensValidatorWrap, setLensValidatorWrap] = useState(() => {
    try {
      const v = sessionStorage.getItem('manta-lens-wrap')
      if (v === 'tuck-high' || v === 'tuck-low') return v
    } catch { /* */ }
    return 'tuck-high'
  })
  /** When false (default), hide readiness + score strip + section bars so Validator/XML stays largest. */
  const [lensHudExpanded, setLensHudExpanded] = useState(() => {
    try {
      const v = sessionStorage.getItem('manta-lens-hud-expanded')
      if (v === '1' || v === 'true') return true
    } catch { /* */ }
    return false
  })
  useEffect(() => {
    try {
      sessionStorage.setItem('manta-lens-wrap', lensValidatorWrap)
    } catch { /* */ }
  }, [lensValidatorWrap])

  useEffect(() => {
    try {
      sessionStorage.setItem('manta-lens-hud-expanded', lensHudExpanded ? '1' : '0')
    } catch { /* */ }
  }, [lensHudExpanded])

  useEffect(() => {
    try {
      sessionStorage.setItem('manta-lens-issue-scope', lensIssueScope)
    } catch { /* */ }
  }, [lensIssueScope])

  useEffect(() => {
    return () => {
      if (lensQuickChipQcTimeoutRef.current) {
        clearTimeout(lensQuickChipQcTimeoutRef.current)
        lensQuickChipQcTimeoutRef.current = 0
      }
    }
  }, [])

  useEffect(() => {
    function onWizardStep(/** @type {CustomEvent<{ stepId?: string }>} */ e) {
      const id = e?.detail?.stepId
      if (typeof id === 'string' && id.trim()) setWizardActiveStepId(id.trim())
    }
    window.addEventListener('manta:wizard-active-step', onWizardStep)
    return () => window.removeEventListener('manta:wizard-active-step', onWizardStep)
  }, [])

  const clearLensFieldHl = useCallback(() => {
    document.querySelectorAll('.manta-lens-field-hl').forEach((el) => {
      el.classList.remove('manta-lens-field-hl')
    })
  }, [])

  const clearLensDomHighlights = useCallback(() => {
    if (fieldNavTimeoutRef.current) {
      clearTimeout(fieldNavTimeoutRef.current)
      fieldNavTimeoutRef.current = 0
    }
    document.querySelectorAll('.fx-xml-line.manta-lens-hl').forEach((el) => {
      el.classList.remove('manta-lens-hl', 'manta-lens-hl--focus')
    })
    clearLensFieldHl()
  }, [clearLensFieldHl])

  const applyLensXmlHighlight = useCallback((target, isSearch, focusIdx = 0) => {
    const matches = []
    const rx = isSearch ? tryLensSearchRegex(target) : null

    document.querySelectorAll('.fx-xml-line').forEach((el) => {
      const textRaw = el.querySelector('.fx-xml-line-code')?.textContent ?? ''
      const text    = textRaw.toLowerCase()
      let ok = false
      if (isSearch) {
        if (rx) {
          try {
            ok = rx.test(textRaw)
            rx.lastIndex = 0
          } catch {
            ok = false
          }
        } else {
          const terms = target.trim().split(/[\s,]+/).filter(Boolean).map((t) => t.toLowerCase())
          ok = terms.length > 0 && terms.some((t) => text.includes(t))
        }
      } else {
        let terms = xmlTermsForField(target).map((t) => t.toLowerCase()).filter(Boolean)
        if (!terms.length) terms = [(target.split('.').pop() ?? target).toLowerCase()].filter(Boolean)
        ok = terms.some((t) => text.includes(t))
      }
      if (ok) matches.push(el)
    })

    const n  = matches.length
    const fi = n ? ((focusIdx % n) + n) % n : 0
    matches.forEach((el, i) => {
      el.classList.add('manta-lens-hl')
      if (i === fi) el.classList.add('manta-lens-hl--focus')
    })
    matches[fi]?.scrollIntoView({ behavior: 'smooth', block: 'center' })

    lensHitCountRef.current = n
    lensHitFocusRef.current = fi
    setLensHitCount(n)
    setLensHitFocus(fi)
  }, [])

  const applyLensFormHighlight = useCallback((fieldPath) => {
    if (fieldNavTimeoutRef.current) {
      clearTimeout(fieldNavTimeoutRef.current)
    }
    window.dispatchEvent(new CustomEvent('manta:lens-goto-field', { detail: { field: fieldPath } }))
    fieldNavTimeoutRef.current = window.setTimeout(() => {
      fieldNavTimeoutRef.current = 0
      clearLensFieldHl()
      const targets = getFieldElementsForLensHighlight(fieldPath)
      for (const fieldEl of targets) {
        fieldEl.classList.add('manta-lens-field-hl')
      }
      const primary = getFieldElementForPilot(fieldPath)
      primary?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 220)
  }, [clearLensFieldHl])

  const applyLensHighlights = useCallback((target, isSearch, focusIdx = 0) => {
    if (fieldNavTimeoutRef.current && focusIdx === 0) {
      clearTimeout(fieldNavTimeoutRef.current)
      fieldNavTimeoutRef.current = 0
    }
    document.querySelectorAll('.fx-xml-line.manta-lens-hl').forEach((el) => {
      el.classList.remove('manta-lens-hl', 'manta-lens-hl--focus')
    })
    if (focusIdx === 0) {
      clearLensFieldHl()
    }
    if (!target) {
      if (fieldNavTimeoutRef.current) {
        clearTimeout(fieldNavTimeoutRef.current)
        fieldNavTimeoutRef.current = 0
      }
      clearLensFieldHl()
      lensHitCountRef.current = 0
      lensHitFocusRef.current = 0
      setLensHitCount(0)
      setLensHitFocus(0)
      return
    }

    const doXml  = lensTarget === 'xml'  || lensTarget === 'split'
    const doForm = lensTarget === 'form' || lensTarget === 'split'

    if (doXml) {
      applyLensXmlHighlight(target, isSearch, focusIdx)
    } else {
      lensHitCountRef.current = 0
      lensHitFocusRef.current = 0
      setLensHitCount(0)
      setLensHitFocus(0)
    }

    if (doForm && !isSearch && typeof target === 'string' && target.includes('.') && focusIdx === 0) {
      applyLensFormHighlight(target)
    } else if (!doForm && focusIdx === 0) {
      if (fieldNavTimeoutRef.current) {
        clearTimeout(fieldNavTimeoutRef.current)
        fieldNavTimeoutRef.current = 0
      }
    }
  }, [lensTarget, applyLensFormHighlight, applyLensXmlHighlight, clearLensFieldHl])

  const bumpLensHits = useCallback((delta) => {
    if (lensTarget === 'form') return
    const { target, isSearch } = lensHighlightTargetRef.current
    const n = lensHitCountRef.current
    if (!target || n < 2) return
    const fi = (lensHitFocusRef.current + delta + n) % n
    applyLensHighlights(target, isSearch, fi)
  }, [applyLensHighlights, lensTarget])

  /** Form-only: XML search is not used. */
  useEffect(() => {
    if (lensMode && lensTarget === 'form') setLensSearch('')
  }, [lensMode, lensTarget])

  /** Drive highlights from field / section / free search (debounced for typing). */
  useEffect(() => {
    if (!lensMode) {
      setLensHelpOpen(false)
      clearLensDomHighlights()
      lensHighlightTargetRef.current = { target: null, isSearch: false }
      setLensHitCount(0)
      setLensHitFocus(0)
      return
    }
    if (lensTarget === 'form' && !lensHlField) {
      applyLensHighlights(null, false, 0)
      lensHighlightTargetRef.current = { target: null, isSearch: false }
      return
    }
    const trimmed = lensSearch.trim()
    const isSearch = Boolean(trimmed) && lensHlField == null && lensTarget !== 'form'
    const target   = isSearch ? lensSearch : lensHlField
    if (!target) {
      applyLensHighlights(null, false, 0)
      lensHighlightTargetRef.current = { target: null, isSearch: false }
      return
    }
    const t = window.setTimeout(() => {
      lensHighlightTargetRef.current = { target, isSearch }
      applyLensHighlights(target, isSearch, 0)
    }, isSearch ? 220 : 0)
    return () => window.clearTimeout(t)
  }, [lensMode, lensHlField, lensSearch, applyLensHighlights, clearLensDomHighlights, lensTarget])

  /** Validation severity rings on form controls (lens on): red = error, purple = warn. */
  useEffect(() => {
    function clearAllStatus() {
      document.querySelectorAll('.manta-lens-field-status').forEach((el) => {
        el.classList.remove('manta-lens-field-status', 'manta-lens-field-status--e', 'manta-lens-field-status--w', 'manta-lens-field-status--ok')
        el.removeAttribute('data-manta-lens-status')
      })
    }
    if (!lensMode || !qualityResult?.issues?.length) {
      clearAllStatus()
      return () => { clearAllStatus() }
    }
    const rankByField = new Map()
    for (const i of qualityResult.issues) {
      if (!i.field) continue
      const r = i.severity === 'e' ? 2 : 1
      const p = rankByField.get(i.field) ?? 0
      if (r > p) rankByField.set(i.field, r)
    }
    clearAllStatus()
    for (const [path, r] of rankByField) {
      const sev = r === 2 ? 'manta-lens-field-status--e' : 'manta-lens-field-status--w'
      for (const el of getFieldElementsForLensHighlight(path)) {
        el.classList.add('manta-lens-field-status', sev)
        el.setAttribute('data-manta-lens-status', '1')
      }
    }
    return () => { clearAllStatus() }
  }, [lensMode, qualityResult])

  // ── COMET ─────────────────────────────────────────────────────────────────
  const [cometInput,   setCometInput]   = useState('')   // raw UUID/URL text
  const [cometLoading, setCometLoading] = useState(false)
  const [cometError,   setCometError]   = useState('')
  const [cometGaps,    setCometGaps]    = useState(null) // null | string[]
  const [cometMeta,    setCometMeta]    = useState(null) // null | { title, uuid }
  const [cometParsed,  setCometParsed]  = useState(null) // null | pilotState partial
  const [cometLoaded,  setCometLoaded]  = useState(false)

  const runCometScan = useCallback(async () => {
    const uuid = extractUuid(cometInput)
    if (!uuid) {
      setCometError('Enter a valid CoMET UUID (e.g. a1b2c3d4-…) or full CoMET URL.')
      return
    }
    setCometLoading(true)
    setCometError('')
    setCometGaps(null)
    setCometMeta(null)
    setCometParsed(null)
    setCometLoaded(false)
    try {
      const xml = await fetchCometRecord(uuid)

      // null = skeleton record (200 but empty body from CoMET)
      const isSkeleton = xml === null

      // Pull a human-readable title from the XML (best-effort, no full DOM parser)
      const titleMatch = xml?.match(/<gco:CharacterString>([^<]{1,200})<\/gco:CharacterString>/)
      const title = titleMatch ? titleMatch[1].trim() : `Skeleton record (${uuid.slice(0, 8)}…)`

      let parsed = null
      if (!isSkeleton) {
        const payload = buildPilotPayloadFromCometXml(profile, xml, {
          forcedProvenanceType: 'comet',
          originalUuid:       uuid,
        })
        if (Object.keys(payload).length) parsed = payload
      }

      const gaps = detectGaps(parsed ?? {}, profile)
      setCometMeta({ title, uuid, isSkeleton })
      setCometGaps(gaps)
      // For skeleton records, pass empty object so wizard loads defaults + all gaps show
      setCometParsed(parsed ?? {})
    } catch (err) {
      setCometError(err instanceof Error ? err.message : 'Scan failed.')
    } finally {
      setCometLoading(false)
    }
  }, [cometInput, profile])

  function handleCometLoad() {
    if (!cometMeta) return
    const dataToLoad = (cometParsed && typeof cometParsed === 'object') ? cometParsed : {}
    // Primary path in the pilot: WizardShell and this widget now share
    // MetadataEngineCtx when `includeFloatingManta` is used. The window event
    // still notifies any legacy dual-shell embeds or code that is not under
    // the same provider.
    window.dispatchEvent(new CustomEvent('manta:comet-load', {
      detail: { parsed: dataToLoad, uuid: cometMeta.uuid, gaps: cometGaps ?? [] },
    }))
    // onCometLoad updates the shared context (and optional host callback).
    onCometLoad?.(dataToLoad, cometMeta.uuid, cometGaps ?? [])
    setCometLoaded(true)
  }

  // ── Tips ──────────────────────────────────────────────────────────────────
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * TIPS.length))
  useEffect(() => {
    const id = setInterval(() => setTipIndex((i) => (i + 1) % TIPS.length), 9000)
    return () => clearInterval(id)
  }, [])

  // ── Derived ───────────────────────────────────────────────────────────────
  const _displayRecent = recentRecords ?? SAMPLE_RECENT
  const qColor        = qualityResult ? scoreColor(qualityResult.score) : null
  const sectionBars   = qualityResult && profile?.steps?.length
    ? computeSectionStatus(profile.steps, qualityResult.issues) : []
  const errors = useMemo(
    () => qualityResult?.issues.filter((i) => i.severity === 'e') ?? [],
    [qualityResult],
  )
  const warnings = useMemo(
    () => qualityResult?.issues.filter((i) => i.severity === 'w') ?? [],
    [qualityResult],
  )
  const lensIssuesFiltered = useMemo(() => {
    const list = [...errors, ...warnings]
    if (lensIssueFilter === 'errors') return list.filter((i) => i.severity === 'e')
    if (lensIssueFilter === 'warnings') return list.filter((i) => i.severity === 'w')
    return list
  }, [errors, warnings, lensIssueFilter])

  const lensIssuesScoped = useMemo(() => {
    if (lensIssueScope !== 'active' || !wizardActiveStepId || !workflowEngine) return lensIssuesFiltered
    return lensIssuesFiltered.filter((i) => {
      if (!i.field) return false
      return workflowEngine.stepForField(i.field) === wizardActiveStepId
    })
  }, [lensIssueScope, wizardActiveStepId, lensIssuesFiltered, workflowEngine])

  const fixWalkFieldCount = useMemo(
    () => countFixableIssues(lensIssuesScoped),
    [lensIssuesScoped],
  )

  const startOrStopFixGuide = useCallback(() => {
    setLensFixGuide((prev) => {
      if (prev) return null
      const queue = buildFixGuideQueue(lensIssuesScoped)
      if (!queue.length) return null
      if (lensTarget === 'xml') {
        window.queueMicrotask(() => { setLensTarget('split') })
      }
      window.queueMicrotask(() => { setLensHelpOpen(true) })
      return { queue, index: 0 }
    })
  }, [lensIssuesScoped, lensTarget, setLensTarget])

  const stepFixGuide = useCallback((delta) => {
    setLensFixGuide((g) => {
      if (!g) return g
      const n = g.index + delta
      if (n < 0) return g
      if (n >= g.queue.length) return null
      return { ...g, index: n }
    })
  }, [])

  useEffect(() => {
    if (!lensMode) setLensFixGuide(null)
  }, [lensMode])

  useEffect(() => {
    if (!lensMode) return
    try {
      window.dispatchEvent(new CustomEvent('manta:lens-opened'))
    } catch { /* */ }
  }, [lensMode])

  useEffect(() => {
    if (!lensMode || !lensFixGuide) return
    const issue = lensFixGuide.queue[lensFixGuide.index]
    if (!issue?.field) return
    setLensHlField(issue.field)
    if (workflowEngine) {
      const stepId = workflowEngine.stepForField(issue.field)
      try {
        window.dispatchEvent(new CustomEvent('manta:goto-step', { detail: { stepId } }))
      } catch { /* */ }
    }
  }, [lensMode, lensFixGuide, workflowEngine])

  const lensChipPilot = readPilotSessionPayload()?.pilot ?? defaultPilotState()

  const onLensQuickChip = useCallback((chip, forIssue) => {
    const maybeScheduleTrayRefresh = () => {
      if (!lensFixGuide) return
      if (lensQuickChipQcTimeoutRef.current) {
        clearTimeout(lensQuickChipQcTimeoutRef.current)
      }
      lensQuickChipQcTimeoutRef.current = window.setTimeout(() => {
        lensQuickChipQcTimeoutRef.current = 0
        runQualityCheck(qualityMode)
      }, 400)
    }

    if (chip.kind === 'action' && chip.action === 'autofix') {
      window.dispatchEvent(new CustomEvent('manta:pilot-auto-fix-request', { detail: { mode: qualityMode } }))
      maybeScheduleTrayRefresh()
      return
    }
    if (chip.kind === 'fill' && chip.fieldPath) {
      window.dispatchEvent(
        new CustomEvent('manta:set-pilot-field', { detail: { field: chip.fieldPath, value: chip.value } }),
      )
      maybeScheduleTrayRefresh()
      return
    }
    if (chip.kind === 'help' && chip.helpText) {
      setLensAsk({ issue: forIssue, answer: chip.helpText })
    }
  }, [qualityMode, lensFixGuide, runQualityCheck])

  useEffect(() => {
    lensIssueNavIdxRef.current = 0
  }, [lensIssueFilter, lensIssueScope, wizardActiveStepId, errors.length, warnings.length])

  /** Lens keyboard: Esc exit, / focus search, j/k cycle issues, [ ] cycle XML hits */
  useEffect(() => {
    if (!lensMode) return
    const inText = (el) => {
      const t = el?.tagName
      return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || el?.isContentEditable
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (inText(e.target)) {
          if (e.target === lensSearchInputRef.current && lensSearch) {
            e.preventDefault()
            setLensSearch('')
            return
          }
          return
        }
        if (lensFixGuide) {
          e.preventDefault()
          setLensFixGuide(null)
          return
        }
        e.preventDefault()
        onToggleLens?.()
        return
      }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (lensTarget === 'form') {
          e.preventDefault()
          return
        }
        if (inText(e.target) && e.target !== lensSearchInputRef.current) return
        e.preventDefault()
        lensSearchInputRef.current?.focus()
        return
      }
      if (inText(e.target)) return

      if (lensFixGuide && (e.key === 'j' || e.key === 'k')) {
        e.preventDefault()
        stepFixGuide(e.key === 'j' ? 1 : -1)
        return
      }
      if (lensFixGuide && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault()
        stepFixGuide(1)
        return
      }
      if (lensFixGuide && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault()
        stepFixGuide(-1)
        return
      }

      if ((e.key === 'j' || e.key === 'k') && lensIssuesScoped.length) {
        e.preventDefault()
        const dir = e.key === 'j' ? 1 : -1
        lensIssueNavIdxRef.current = (lensIssueNavIdxRef.current + dir + lensIssuesScoped.length) % lensIssuesScoped.length
        const iss = lensIssuesScoped[lensIssueNavIdxRef.current]
        setLensSearch('')
        setLensHlField(iss.field)
        return
      }
      if (e.key === ']' || e.key === '[') {
        if (lensTarget === 'form') return
        e.preventDefault()
        bumpLensHits(e.key === ']' ? 1 : -1)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [lensMode, onToggleLens, lensIssuesScoped, lensFixGuide, stepFixGuide, bumpLensHits, lensSearch, lensTarget])

  const hasErrors     = errors.length > 0
  const hasWarnings   = warnings.length > 0
  const defText       = activeDefIssue ? getFieldDefinition(activeDefIssue.field) : null

  const TABS = [
    { id: 'validate', label: 'VALIDATE', dot: hasErrors ? 'error' : hasWarnings ? 'warn' : qualityResult ? 'ok' : null },
    { id: 'ask',      label: 'ASK',      dot: null },
    { id: 'search',   label: 'SEARCH',   dot: null },
    { id: 'live',     label: 'LIVE',     dot: null },
    { id: 'comet',    label: 'CoMET',    dot: cometLoaded ? 'ok' : cometGaps?.length ? 'warn' : null },
  ]

  // ── Lens overlay (portaled to #manta-scanner-host): Form/Split use
  // manta-lens--form-readable so HUD + glass read as one “smart form” surface.

  if (lensMode) {
    const lensRootClass = [
      'manta-lens',
      'manta-lens--viewport',
      'manta-lens--validator-wrap',
      lensValidatorWrap === 'tuck-high' ? 'manta-lens--tuck-high' : 'manta-lens--tuck-low',
      (lensTarget === 'form' || lensTarget === 'split') && 'manta-lens--form-readable',
      !lensHudExpanded && 'manta-lens--hud-compact',
    ].filter(Boolean).join(' ')

    const lensContent = (
      <div className={lensRootClass} role="dialog" aria-label="Manta Ray Lens Mode">
        {/* Corner brackets framing the panel */}
        <div className="manta-lens-corner manta-lens-corner--tl" aria-hidden="true" />
        <div className="manta-lens-corner manta-lens-corner--tr" aria-hidden="true" />
        <div className="manta-lens-corner manta-lens-corner--bl" aria-hidden="true" />
        <div className="manta-lens-corner manta-lens-corner--br" aria-hidden="true" />

        {/* ── HUD header bar ──────────────────────────────────────────── */}
        <header className="manta-lens-bar">
          <span className="manta-lens-bar__brand">⬡ MANTA LENS</span>

          {qualityResult && (
            <ScoreRing score={qualityResult.score} size={30} sw={3} />
          )}

          <div className="manta-lens-bar__tags">
            {hasErrors   && <span className="manta-lens-tag manta-lens-tag--err">{errors.length}✗</span>}
            {hasWarnings && <span className="manta-lens-tag manta-lens-tag--warn">{warnings.length}⚠</span>}
            {!hasErrors && !hasWarnings && qualityResult && <span className="manta-lens-tag manta-lens-tag--ok">✓</span>}
          </div>

          <div className="manta-lens-bar__lens-target" role="group" aria-label="Lens target">
            {(
              [
                { id: 'xml',   label: 'XML' },
                { id: 'form',  label: 'Form' },
                { id: 'split', label: 'Both' },
              ]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`manta-lens-target-btn${lensTarget === opt.id ? ' manta-lens-target-btn--active' : ''}`}
                aria-pressed={lensTarget === opt.id}
                onClick={() => setLensTarget(/** @type {'xml'|'form'|'split'} */ (opt.id))}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="manta-lens-bar__val-wrap" role="group" aria-label="Where to show live issues list">
            <span className="manta-lens-bar__val-label" title="Validation list vs. through-glass work area">Issues</span>
            <button
              type="button"
              className={`manta-lens-valwrap-btn${lensValidatorWrap === 'tuck-high' ? ' manta-lens-valwrap-btn--active' : ''}`}
              aria-pressed={lensValidatorWrap === 'tuck-high'}
              onClick={() => setLensValidatorWrap('tuck-high')}
              title="Show the live issues list just above the form (recommended)"
            >
              Wrap ↑
            </button>
            <button
              type="button"
              className={`manta-lens-valwrap-btn${lensValidatorWrap === 'tuck-low' ? ' manta-lens-valwrap-btn--active' : ''}`}
              aria-pressed={lensValidatorWrap === 'tuck-low'}
              onClick={() => setLensValidatorWrap('tuck-low')}
              title="Show issues at the bottom of the lens (older layout)"
            >
              Dock ↓
            </button>
            <button
              type="button"
              className={`manta-lens-bar__hud-toggle${lensHudExpanded ? ' manta-lens-bar__hud-toggle--active' : ''}`}
              aria-pressed={lensHudExpanded}
              onClick={() => setLensHudExpanded((v) => !v)}
              title={
                lensHudExpanded
                  ? 'Hide mode pills, score strip, and section bars — maximize Validator / XML'
                  : 'Show validation modes, score strip, and section jump row'
              }
            >
              {lensHudExpanded ? 'Less' : 'More'}
            </button>
          </div>

          <div className="manta-lens-bar__right">
            <button
              type="button"
              className="manta-lens-bar__fixwalk"
              disabled={fixWalkFieldCount === 0}
              aria-pressed={Boolean(lensFixGuide)}
              onClick={startOrStopFixGuide}
              title={
                lensFixGuide
                  ? 'Exit guided fix walk (Esc)'
                  : 'Guided walk: jump to each field, coaching, quick chips, wizard step sync (j/k n/p, uses the tray list & STEP/ERR filters)'
              }
            >
              {lensFixGuide ? 'Exit walk' : 'Fix walk'}
            </button>
            <button
              type="button"
              className="manta-lens-bar__help"
              aria-pressed={lensHelpOpen}
              onClick={() => setLensHelpOpen((v) => !v)}
              title="Keyboard shortcuts"
            >
              ?
            </button>
            <button
              type="button"
              className="manta-lens-bar__refresh"
              onClick={() => runQualityCheck(qualityMode)}
              disabled={qualityLoading}
              title="Re-run validation"
            >
              {qualityLoading ? '…' : '↻'}
            </button>
            <button type="button" className="manta-lens-bar__exit" onClick={onToggleLens}>
              ⬡ EXIT
            </button>
          </div>
        </header>

        {lensFixGuide && lensFixGuide.queue.length > 0 && (() => {
          const fwIssue   = lensFixGuide.queue[lensFixGuide.index]
          const atLast   = lensFixGuide.index >= lensFixGuide.queue.length - 1
          const coaching  = getCoachingPrompts(fwIssue)
          const walkChips = getLensChipsForIssue(fwIssue, lensChipPilot)
          return (
            <div className="manta-lens-fixguide" role="region" aria-label="Guided fix walk">
              <div className="manta-lens-fixguide__head">
                <span className="manta-lens-fixguide__title">Fix walk</span>
                <span className="manta-lens-fixguide__step">
                  {lensFixGuide.index + 1}
                  {' / '}
                  {lensFixGuide.queue.length}
                </span>
                {fwIssue.field
                  ? (
                    <code className="manta-lens-fixguide__path">{fwIssue.field}</code>
                    )
                  : null}
                <span
                  className={
                    fwIssue.severity === 'e'
                      ? 'manta-lens-fixguide__sev manta-lens-fixguide__sev--e'
                      : 'manta-lens-fixguide__sev manta-lens-fixguide__sev--w'
                  }
                >
                  {fwIssue.severity === 'e' ? 'Error' : 'Warning'}
                </span>
              </div>
              <ul className="manta-lens-fixguide__prompts">
                {coaching.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
              {walkChips.length > 0 && (
                <div className="manta-lens-fixguide__chips" role="group" aria-label="Quick actions for this field">
                  {walkChips.map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      className={`manta-lens-chip manta-lens-chip--${chip.kind}`}
                      onClick={() => onLensQuickChip(chip, fwIssue)}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="manta-lens-fixguide__row">
                <div className="manta-lens-fixguide__kbd">
                  <kbd>j</kbd>
                  <kbd>k</kbd>
                  {' '}
                  next / back ·
                  {' '}
                  <kbd>n</kbd>
                  <kbd>p</kbd>
                  {' '}
                  next / back ·
                  {' '}
                  <kbd>Esc</kbd>
                  {' '}
                  exit walk
                </div>
                <div className="manta-lens-fixguide__actions">
                  <button
                    type="button"
                    className="manta-lens-fixguide__btn"
                    disabled={lensFixGuide.index === 0}
                    onClick={() => { stepFixGuide(-1) }}
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    className="manta-lens-fixguide__btn manta-lens-fixguide__btn--primary"
                    onClick={() => { stepFixGuide(1) }}
                  >
                    {atLast ? 'Finish' : 'Next →'}
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

        {lensHudExpanded && (
          <div className="manta-lens-readiness-row">
            <ReadinessStrip
              className="readiness-strip--compact readiness-strip--lens"
              snapshot={widgetReadinessSnapshot}
              activeMode={qualityMode}
              onSelectMode={syncValidationModeToWizard}
            />
          </div>
        )}

        {/* Score progress bar */}
        {lensHudExpanded && qualityResult && (
          <div className="manta-lens-progress-bar">
            <div
              className="manta-lens-progress-fill"
              style={{
                width: `${qualityResult.score}%`,
                background: `linear-gradient(90deg, ${qColor}88, ${qColor})`,
                boxShadow: `0 0 10px ${qColor}88`,
              }}
            />
          </div>
        )}

        {/* ── Section bars — each is a clickable hot-spot ─────────── */}
        {lensHudExpanded && sectionBars.length > 0 && (
          <div className="manta-lens-section-bars">
            {sectionBars.map((sec) => (
              <SectionBar
                key={sec.id}
                label={sec.label}
                pct={sec.pct}
                errors={sec.errors}
                warnings={sec.warnings}
                active={lensHlField === sec.id}
                onClick={() => {
                  setLensSearch('')
                  if (lensTarget === 'form') {
                    setLensHlField((prev) => (prev === sec.id ? null : sec.id))
                    try {
                      window.dispatchEvent(
                        new CustomEvent('manta:goto-step', { detail: { stepId: sec.id } }),
                      )
                    } catch { /* */ }
                    return
                  }
                  setLensHlField((prev) => (prev === sec.id ? null : sec.id))
                }}
              />
            ))}
          </div>
        )}

        {/* ── Glass zone — XML visible + search bar ────────────────── */}
        <div className="manta-lens-glass">
          <div className="manta-lens-scanline" aria-hidden="true" />

          <div className="manta-lens-glass__chrome">
            <div className="manta-lens-glass__search">
              <span className="manta-lens-glass__search-icon" aria-hidden="true">⌕</span>
              <input
                ref={lensSearchInputRef}
                className="manta-lens-glass__search-input"
                type="text"
                placeholder={lensTarget === 'form' ? 'XML search — set target to XML or Both' : 'Tags, text, or /regex/ …'}
                value={lensSearch}
                disabled={lensTarget === 'form'}
                onChange={(e) => {
                  setLensSearch(e.target.value)
                  setLensHlField(null)
                }}
                aria-label="Highlight XML terms or regular expression"
                spellCheck={false}
              />
              {lensSearch && (
                <button
                  type="button"
                  className="manta-lens-glass__search-clear"
                  onClick={() => setLensSearch('')}
                  aria-label="Clear search"
                >✕</button>
              )}
            </div>

            {(lensHlField || lensSearch.trim()) && (
              <div className="manta-lens-glass__focus">
                <div className="manta-lens-glass__hl-label" aria-live="polite">
                  <span className="manta-lens-glass__hl-dot" aria-hidden="true" />
                  {lensHlField
                    ? `field: ${lensHlField}`
                    : (tryLensSearchRegex(lensSearch) ? `regex: ${lensSearch.trim()}` : `search: "${lensSearch.trim()}"`)}
                </div>
                <div className="manta-lens-glass__meta">
                  <div className="manta-lens-glass__hits">
                    <span>
                      {lensTarget === 'form'
                        ? 'Form mode — j/k to jump issues, fields ring in the wizard'
                        : lensHitCount === 0
                          ? 'no XML line matches'
                          : `${lensHitCount} hit${lensHitCount === 1 ? '' : 's'} · focus ${lensHitFocus + 1}/${lensHitCount}`}
                    </span>
                    <div className="manta-lens-glass__hit-nav">
                      <button
                        type="button"
                        className="manta-lens-glass__hit-btn"
                        disabled={lensHitCount < 2 || lensTarget === 'form'}
                        onClick={() => bumpLensHits(-1)}
                        aria-label="Previous XML highlight"
                        title="Previous match"
                      >‹</button>
                      <button
                        type="button"
                        className="manta-lens-glass__hit-btn"
                        disabled={lensHitCount < 2 || lensTarget === 'form'}
                        onClick={() => bumpLensHits(1)}
                        aria-label="Next XML highlight"
                        title="Next match"
                      >›</button>
                    </div>
                  </div>
                  {lensHelpOpen && (
                    <div className="manta-lens-glass__kbd-hint">
                      {lensFixGuide ? (
                        <>
                          <kbd>Esc</kbd> end fix walk
                          {' · '}
                          <kbd>j</kbd>
                          <kbd>k</kbd>
                          {' or '}
                          <kbd>n</kbd>
                          <kbd>p</kbd> next / back
                        </>
                      ) : (
                        <>
                          <kbd>Esc</kbd> exit lens
                          {lensTarget !== 'form' && (
                            <span>
                              {' · '}
                              <kbd>/</kbd> search
                            </span>
                          )}
                          {' · '}
                          <kbd>j</kbd>
                          <kbd>k</kbd> issues
                          {lensTarget !== 'form' && (
                            <span>
                              {' · '}
                              <kbd>[</kbd>
                              <kbd>]</kbd> XML
                            </span>
                          )}
                          {' · '}
                          Bar: Fix walk — guided fields, coaching, chips
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Issues tray at bottom ────────────────────────────────── */}
        <div className="manta-lens-tray">
          {errors.length + warnings.length > 0 ? (
            <>
              <div className="manta-lens-tray__header manta-lens-tray__header--row">
                <span className="manta-lens-tray__header-title">
                  ISSUES (
                  {lensIssuesScoped.length}
                  {lensIssueScope === 'active' && wizardActiveStepId && lensIssuesScoped.length < lensIssuesFiltered.length
                    ? ` of ${lensIssuesFiltered.length}`
                    : ''}
                  {lensIssueFilter !== 'all' ? ` / ${errors.length + warnings.length}` : ''}
                  )
                </span>
                <div className="manta-lens-tray__filters" role="group" aria-label="Issue list scope">
                  {[
                    { id: 'active', label: 'STEP' },
                    { id: 'all', label: 'ALL' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`manta-lens-filter-chip${lensIssueScope === s.id ? ' manta-lens-filter-chip--active' : ''}`}
                      onClick={() => setLensIssueScope(s.id)}
                    >{s.label}</button>
                  ))}
                </div>
                <div className="manta-lens-tray__filters" role="group" aria-label="Filter issues by severity">
                  {[
                    { id: 'all', label: 'ALL' },
                    { id: 'errors', label: 'ERR' },
                    { id: 'warnings', label: 'WRN' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`manta-lens-filter-chip${lensIssueFilter === f.id ? ' manta-lens-filter-chip--active' : ''}`}
                      onClick={() => setLensIssueFilter(f.id)}
                    >{f.label}</button>
                  ))}
                </div>
                {lensHlField && (
                  <button
                    type="button"
                    className="manta-lens-tray__clear-hl"
                    onClick={() => { setLensHlField(null) }}
                    title="Clear XML highlight"
                  >
                    ✕ clear hl
                  </button>
                )}
              </div>
              {lensIssuesFiltered.length === 0 ? (
                <div className="manta-lens-tray__filter-empty">
                  Nothing in this filter.
                </div>
              ) : lensIssuesScoped.length === 0 ? (
                <div className="manta-lens-tray__filter-empty">
                  No issues for this wizard step{wizardActiveStepId ? ` (“${wizardActiveStepId}”)` : ''} in the current
                  filter. Use ALL in the first chip row to see every step, or change severity (ALL / ERR / WRN).
                </div>
              ) : (
                <div className="manta-lens-tray__list">
                  {lensIssuesScoped.map((issue, idx) => {
                    const key     = `${issue.field}:${issue.message}`
                    const isNew   = newIssueKeys.has(key)
                    const isHl    = lensHlField === issue.field
                    const isDefOn = activeDefIssue?.field === issue.field && activeDefIssue?.message === issue.message
                    const isAsk   = lensAsk?.issue === issue
                    return (
                      <div
                        key={`${key}-${idx}`}
                        className={`manta-lens-issue-wrap${isHl ? ' manta-lens-issue-wrap--active' : ''}`}
                      >
                        <div
                          className="manta-lens-issue-row"
                          role="button"
                          tabIndex={0}
                          aria-pressed={isHl}
                          title="Focus in form & XML"
                          onClick={() => {
                            setLensSearch('')
                            lensIssueNavIdxRef.current = lensIssuesScoped.findIndex(
                              (i) => i.field === issue.field && i.message === issue.message,
                            )
                            if (lensIssueNavIdxRef.current < 0) lensIssueNavIdxRef.current = idx
                            setLensHlField((prev) => prev === issue.field ? null : issue.field)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              lensIssueNavIdxRef.current = idx
                              setLensHlField((prev) => prev === issue.field ? null : issue.field)
                            }
                          }}
                        >
                          <IssueRow
                            issue={issue}
                            isNew={isNew}
                            isDefActive={isDefOn}
                            onToggleDef={(e) => { e?.stopPropagation?.(); toggleDef(issue) }}
                          />
                          {issue.field && (
                            <button
                              type="button"
                              className="manta-lens-copy-field"
                              title="Copy field path"
                              aria-label={`Copy ${issue.field}`}
                              onClick={async (e) => {
                                e.stopPropagation()
                                try {
                                  await navigator.clipboard.writeText(issue.field)
                                  setLensCopiedKey(issue.field)
                                  window.setTimeout(() => {
                                    setLensCopiedKey((k) => (k === issue.field ? null : k))
                                  }, 1600)
                                } catch { /* clipboard unavailable */ }
                              }}
                            >{lensCopiedKey === issue.field ? '✓' : '⎘'}</button>
                          )}
                          <button
                            type="button"
                            className={`manta-lens-ask-btn${isAsk ? ' manta-lens-ask-btn--active' : ''}`}
                            title="Ask about this issue"
                            aria-label={`Ask about ${issue.message}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              const leaf   = issue.field?.split('.').pop() ?? issue.field ?? ''
                              const answer = getFieldDefinition(issue.field)
                                || answerQuestion(leaf)?.a
                                || answerQuestion(issue.message)?.a
                                || 'No specific guidance found. Ensure this field matches ISO 19115-2 requirements and your chosen validation mode.'
                              setLensAsk(isAsk ? null : { issue, answer })
                            }}
                          >
                            💬
                          </button>
                        </div>

                        <div
                          className="manta-lens-chips"
                          onClick={(e) => e.stopPropagation()}
                          role="group"
                          aria-label="Quick actions and field help"
                        >
                          {getLensChipsForIssue(issue, lensChipPilot).map((chip) => (
                            <button
                              key={chip.id}
                              type="button"
                              className={`manta-lens-chip manta-lens-chip--${chip.kind}`}
                              onClick={() => onLensQuickChip(chip, issue)}
                            >
                              {chip.label}
                            </button>
                          ))}
                        </div>

                        {isAsk && (
                          <div className="manta-lens-ask-answer">
                            <div className="manta-lens-ask-answer__label">
                              <span>ℹ</span>
                              <code>{issue.field?.split('.').pop() ?? ''}</code>
                              <button type="button" className="manta-lens-ask-answer__close" onClick={() => setLensAsk(null)}>✕</button>
                            </div>
                            <p className="manta-lens-ask-answer__text">{lensAsk.answer}</p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          ) : (
            qualityResult && (
              <div className="manta-lens-all-clear">✓ ALL CLEAR</div>
            )
          )}

          {activeDefIssue && defText && (
            <div className="manta-def-panel">
              <div className="manta-def-panel__header">
                <span className="manta-def-panel__label">DEF</span>
                <code className="manta-def-panel__field">{activeDefIssue.field}</code>
                <button type="button" className="manta-def-panel__close" onClick={() => setActiveDefIssue(null)}>✕</button>
              </div>
              <p className="manta-def-panel__text">{defText}</p>
            </div>
          )}

          <div className="manta-lens-tray__footer">
            <button type="button" className="manta-widget__fix-btn" onClick={onOpenEditor}>
              Fix Issues →
            </button>
          </div>
        </div>
      </div>
    )

    return <MantaScannerFrame>{lensContent}</MantaScannerFrame>
  }

  // ── Normal widget render ──────────────────────────────────────────────────

  return (
    <div className="manta-widget" role="dialog" aria-label="Manta Ray Metadata Builder">

      {/* ── HUD window frame ────────────────────────────────────────────── */}
      <div className="manta-hud-c manta-hud-c--tl" aria-hidden="true" />
      <div className="manta-hud-c manta-hud-c--tr" aria-hidden="true" />
      <div className="manta-hud-c manta-hud-c--bl" aria-hidden="true" />
      <div className="manta-hud-c manta-hud-c--br" aria-hidden="true" />
      <div className="manta-hud-scanline" aria-hidden="true" />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="manta-widget__header">
        <div className="manta-widget__logo" aria-hidden="true">🦈</div>
        <div className="manta-widget__title-group">
          <span className="manta-widget__title">Manta Ray</span>
          {profile && (
            <span className="manta-widget__profile-badge" title={`Profile: ${profile.id}`}>
              {profile.label}
            </span>
          )}
        </div>
        {qualityResult && (
          <span
            className="manta-hud-live-score"
            style={{ color: qColor }}
            title={`Quality score (${qualityMode})`}
          >
            {qualityResult.score}
          </span>
        )}
        <div className="manta-widget__header-icons">
          {onToggleLens && (
            <button
              type="button"
              className="manta-lens-toggle-btn"
              onClick={onToggleLens}
              title="Scanner: frame workspace and step through issues"
              aria-label="Open scanner (lens) mode"
            >
              ⬡ LENS
            </button>
          )}
          {onClose && (
            <button type="button" className="manta-widget__icon-btn manta-widget__icon-btn--close" aria-label="Close widget" onClick={onClose}>✕</button>
          )}
        </div>
      </header>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <nav className="manta-widget__tabs" role="tablist" aria-label="Widget sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            className={`manta-widget__tab${activeTab === tab.id ? ' manta-widget__tab--active' : ''}`}
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.dot && (
              <span className={`manta-widget__tab-dot manta-widget__tab-dot--${tab.dot}`} aria-hidden="true" />
            )}
          </button>
        ))}
      </nav>

      {/* ── Panel ───────────────────────────────────────────────────────── */}
      <div className="manta-widget__panel">

        {/* ══════════ VALIDATE ══════════════════════════════════════════ */}
        {activeTab === 'validate' && (
          <div className="manta-widget__quality-view">
            <ReadinessStrip
              className="readiness-strip--compact"
              snapshot={widgetReadinessSnapshot}
              activeMode={qualityMode}
              onSelectMode={syncValidationModeToWizard}
            />

            {/* Score ring + tags + modes */}
            <div className="manta-widget__quality-top">
              <div className="manta-widget__ring-wrap">
                {qualityResult
                  ? <ScoreRing score={qualityResult.score} size={64} sw={5} />
                  : <div className="manta-ring-placeholder" style={{ width: 64, height: 64 }}>—</div>
                }
              </div>
              <div className="manta-widget__quality-right">
                {qualityResult && (
                  <div className="manta-widget__quality-tags">
                    {hasErrors   && <span className="manta-widget__quality-tag manta-widget__quality-tag--err">{errors.length} error{errors.length !== 1 ? 's' : ''}</span>}
                    {hasWarnings && <span className="manta-widget__quality-tag manta-widget__quality-tag--warn">{warnings.length} warning{warnings.length !== 1 ? 's' : ''}</span>}
                    {!hasErrors && !hasWarnings && <span className="manta-widget__quality-tag manta-widget__quality-tag--ok">✓ All clear</span>}
                  </div>
                )}
                <div className="manta-widget__quality-modes">
                  {(['lenient', 'strict', 'catalog']).map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`manta-widget__mode-btn${qualityMode === m ? ' manta-widget__mode-btn--active' : ''}`}
                      onClick={() => syncValidationModeToWizard(m)}
                      disabled={qualityLoading}
                    >{m}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Section completion bars */}
            {sectionBars.length > 0 && (
              <div className="manta-widget__section-bars">
                {sectionBars.map((sec) => (
                  <SectionBar key={sec.id} label={sec.label} pct={sec.pct} errors={sec.errors} warnings={sec.warnings} />
                ))}
              </div>
            )}

            {/* Issues list */}
            {qualityResult && (errors.length > 0 || warnings.length > 0) && (
              <div className="manta-widget__issues-section">
                <div
                  className="manta-widget__issues-header"
                  role="button" tabIndex={0}
                  onClick={() => setIssuesOpen((v) => !v)}
                  onKeyDown={(e) => e.key === 'Enter' && setIssuesOpen((v) => !v)}
                  aria-expanded={issuesOpen}
                >
                  <span className="manta-widget__issues-label">
                    Issues ({errors.length + warnings.length})
                  </span>
                  <span className="manta-widget__issues-toggle" aria-hidden="true">
                    {issuesOpen ? '▲' : '▼'}
                  </span>
                </div>

                {issuesOpen && (
                  <div className="manta-issues-list">
                    {[...errors, ...warnings].map((issue, idx) => {
                      const key     = `${issue.field}:${issue.message}`
                      const isNew   = newIssueKeys.has(key)
                      const isDefOn = activeDefIssue?.field === issue.field && activeDefIssue?.message === issue.message
                      return (
                        <IssueRow
                          key={`${key}-${idx}`}
                          issue={issue}
                          isNew={isNew}
                          isDefActive={isDefOn}
                          onToggleDef={() => toggleDef(issue)}
                        />
                      )
                    })}
                  </div>
                )}

                {/* Definition panel */}
                {activeDefIssue && defText && (
                  <div className="manta-def-panel">
                    <div className="manta-def-panel__header">
                      <span className="manta-def-panel__label">DEFINITION</span>
                      <code className="manta-def-panel__field">{activeDefIssue.field}</code>
                      <button
                        type="button"
                        className="manta-def-panel__close"
                        onClick={() => setActiveDefIssue(null)}
                        aria-label="Close definition"
                      >✕</button>
                    </div>
                    <p className="manta-def-panel__text">{defText}</p>
                    <button
                      type="button"
                      className="manta-def-panel__ask-btn"
                      onClick={() => {
                        setActiveTab('ask')
                        const leaf = activeDefIssue.field?.split('.').pop() ?? activeDefIssue.field ?? ''
                        submitAsk(`What is ${leaf}?`)
                      }}
                    >
                      Ask more about this field →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* CTA */}
            <div className="manta-widget__quality-actions">
              <button type="button" className="manta-widget__fix-btn" onClick={onOpenEditor}>
                Fix Issues →
              </button>
              <button
                type="button"
                className="manta-widget__refresh-btn"
                onClick={() => runQualityCheck(qualityMode)}
                disabled={qualityLoading}
                title="Re-run check"
                aria-label="Re-run quality check"
              >
                {qualityLoading ? '…' : '↻'}
              </button>
            </div>
          </div>
        )}

        {/* ══════════ ASK ═══════════════════════════════════════════════ */}
        {activeTab === 'ask' && (
          <div className="manta-chat">
            {/* Suggested questions */}
            <div className="manta-chat__suggestions">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="manta-chat__suggest-chip"
                  onClick={() => submitAsk(q)}
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Chat history */}
            <div className="manta-chat__history">
              {chatHistory.map((msg, idx) => (
                <div
                  key={idx}
                  className={`manta-chat__msg manta-chat__msg--${msg.type}`}
                >
                  {msg.type === 'assistant'
                    ? <RichText text={msg.text} />
                    : msg.text
                  }
                </div>
              ))}
              {askLoading && (
                <div className="manta-chat__msg manta-chat__msg--thinking">
                  ⬡ thinking…
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="manta-chat__input-row">
              <input
                className="manta-chat__input"
                placeholder="Ask about any metadata field or concept…"
                value={askInput}
                onChange={(e) => setAskInput(e.target.value)}
                onKeyDown={onAskKeyDown}
                aria-label="Ask a metadata question"
              />
              <button
                type="button"
                className="manta-chat__submit"
                onClick={() => submitAsk()}
                disabled={!askInput.trim() || askLoading}
                aria-label="Submit question"
              >
                ASK
              </button>
            </div>
          </div>
        )}

        {/* ══════════ SEARCH ════════════════════════════════════════════ */}
        {activeTab === 'search' && (
          <div className="manta-widget__search">
            <div className="manta-widget__search-bar">
              <span className="manta-widget__search-icon" aria-hidden="true">⌕</span>
              <input
                className="manta-widget__search-input"
                placeholder={scheme === 'organizations' ? 'Search ROR organizations…' : 'Search GCMD keywords…'}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSuggestStatus(null) }}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void runSearch())}
                autoFocus
                aria-label="Search query"
              />
              <select
                className="manta-widget__search-scheme"
                value={scheme}
                onChange={(e) => { setScheme(e.target.value); setKwResults([]); setOrgResults([]); setSearchError('') }}
              >
                {SEARCH_SCHEMES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            {searchHistory.length > 0 && !kwResults.length && !orgResults.length && !searchLoading && (
              <div className="manta-widget__search-history">
                {searchHistory.map((h) => (
                  <button key={h} type="button" className="manta-widget__history-chip" onClick={() => { setQuery(h); void runSearch(h) }}>{h}</button>
                ))}
              </div>
            )}

            {searchLoading && <p className="manta-widget__search-status manta-widget__search-status--loading">Searching…</p>}
            {searchError && !searchLoading && <p className="manta-widget__search-status">{searchError}</p>}

            {kwResults.length > 0 && (
              <ul className="manta-widget__search-results">
                {kwResults.map((r) => {
                  const key = r.uuid || r.label
                  return (
                    <li key={key} className="manta-widget__result-item">
                      <span className="manta-widget__result-label" title={r.uuid}>{r.label}</span>
                      <button type="button" className={`manta-widget__copy-btn${copied === key ? ' manta-widget__copy-btn--done' : ''}`} onClick={() => copyText(r.label, key)} title="Copy">{copied === key ? '✓' : '⎘'}</button>
                    </li>
                  )
                })}
              </ul>
            )}

            {orgResults.length > 0 && (
              <ul className="manta-widget__search-results manta-widget__org-results">
                {orgResults.map((org) => (
                  <li key={org.id} className="manta-widget__result-item manta-widget__org-item">
                    <div className="manta-widget__org-info">
                      <span className="manta-widget__result-label">{org.displayName}</span>
                      <span className="manta-widget__org-meta">{[org.country, org.types?.[0]].filter(Boolean).join(' · ')}</span>
                    </div>
                    <button type="button" className={`manta-widget__copy-btn${copied === org.id ? ' manta-widget__copy-btn--done' : ''}`} onClick={() => copyText(org.id, org.id)} title="Copy ROR ID">{copied === org.id ? '✓' : '⎘'}</button>
                  </li>
                ))}
              </ul>
            )}

            <div className="manta-widget__suggest-row">
              {suggestStatus === 'empty' && <p className="manta-widget__suggest-hint-text">Fill Title / Abstract in the wizard first.</p>}
              {suggestStatus === 'seeded' && kwResults.length > 0 && <p className="manta-widget__suggest-seed-label">Seeded from your record's title · abstract</p>}
              <button type="button" className="manta-widget__suggest-btn" onClick={runSuggestKeywords} disabled={searchLoading}>
                ✦ Suggest from record
              </button>
            </div>
          </div>
        )}

        {/* ══════════ LIVE ══════════════════════════════════════════════ */}
        {activeTab === 'live' && (
          <div className="manta-widget__live-view">
            {liveUpdatedAt && (
              <p className="manta-widget__live-updated">sync: {new Date(liveUpdatedAt).toLocaleTimeString()}</p>
            )}
            {liveFields.length === 0 ? (
              <p className="manta-widget__live-empty">No record data yet. Fill in the wizard to see live field values here.</p>
            ) : (
              <table className="manta-widget__live-table">
                <tbody>
                  {liveFields.map(({ section, key, value, isArray }) => (
                    <tr key={`${section}.${key}`} className="manta-widget__live-row">
                      <td className="manta-widget__live-key">{key}</td>
                      <td className="manta-widget__live-val" title={value}>
                        {isArray
                          ? <span className="manta-widget__live-array">{value}</span>
                          : value.length > 52 ? `${value.slice(0, 52)}…` : value
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button type="button" className="manta-widget__refresh-btn manta-widget__refresh-btn--block" onClick={refreshLive}>
              ↻ Refresh
            </button>
          </div>
        )}

        {/* ══════════ COMET ═════════════════════════════════════════════ */}
        {activeTab === 'comet' && (
          <div className="manta-widget__comet">
            <p className="manta-widget__comet-desc">
              Paste a CoMET collection UUID or URL to scan it for gaps, then load it into the wizard.
            </p>

            {/* UUID input + scan */}
            <div className="manta-widget__comet-scan-row">
              <input
                className="manta-widget__comet-input"
                placeholder="CoMET UUID or URL…"
                value={cometInput}
                onChange={(e) => { setCometInput(e.target.value); setCometError('') }}
                onKeyDown={(e) => e.key === 'Enter' && !cometLoading && void runCometScan()}
                aria-label="CoMET collection UUID or URL"
                spellCheck={false}
              />
              <button
                type="button"
                className="manta-widget__comet-scan-btn"
                onClick={() => void runCometScan()}
                disabled={cometLoading || !cometInput.trim()}
                aria-busy={cometLoading}
              >
                {cometLoading ? '…' : 'Scan'}
              </button>
            </div>

            {cometError && (
              <p className="manta-widget__comet-error" role="alert">{cometError}</p>
            )}

            {/* Record meta */}
            {cometMeta && (
              <div className="manta-widget__comet-meta">
                <span className="manta-widget__comet-meta-label">
                  {cometMeta.isSkeleton ? 'Skeleton' : 'Record'}
                </span>
                <span className="manta-widget__comet-meta-title" title={cometMeta.uuid}>
                  {cometMeta.title.length > 60 ? `${cometMeta.title.slice(0, 60)}…` : cometMeta.title}
                </span>
                <a
                  className="manta-widget__comet-open-link"
                  href={`https://data.noaa.gov/cedit/collection/${cometMeta.uuid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in CoMET"
                >
                  Open in CoMET ↗
                </a>
              </div>
            )}

            {cometMeta?.isSkeleton && (
              <p className="manta-widget__comet-skeleton-note">
                This is an empty skeleton record — no content has been authored yet. Load it into the wizard to fill in all fields, then push back to CoMET.
              </p>
            )}

            {/* Gap list */}
            {cometGaps !== null && (
              <div className="manta-widget__comet-gaps">
                <div className="manta-widget__comet-gaps-header">
                  {cometGaps.length === 0
                    ? <span className="manta-widget__comet-gaps-ok">No critical gaps detected.</span>
                    : <span className="manta-widget__comet-gaps-count">{cometGaps.length} gap{cometGaps.length !== 1 ? 's' : ''} found</span>
                  }
                </div>
                {cometGaps.length > 0 && (
                  <div className="manta-issues-list">
                    {cometGaps.map((gap, i) => (
                      <div key={i} className="manta-issue-row manta-issue-row--wrn">
                        <span className="manta-issue-badge manta-issue-badge--wrn">GAP</span>
                        <span className="manta-issue-msg">{gap}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Load into wizard — always shown once a scan completes */}
            {cometMeta && !cometLoading && !cometError && (
              <div className="manta-widget__comet-actions">
                {/* Soft note when no pilot fields were extracted from the XML */}
                {cometParsed !== null && typeof cometParsed === 'object' &&
                  !cometMeta.isSkeleton && Object.keys(cometParsed).length === 0 && (
                  <p className="manta-widget__comet-skeleton-note" style={{ marginBottom: '0.5rem' }}>
                    No existing pilot fields found — wizard will open with defaults so you can fill in all gaps.
                  </p>
                )}
                <button
                  type="button"
                  className={`manta-widget__comet-load-btn${cometLoaded ? ' manta-widget__comet-load-btn--done' : ''}`}
                  onClick={handleCometLoad}
                  disabled={cometLoaded}
                >
                  {cometLoaded ? 'Loaded into wizard ✓' : 'Load into Wizard'}
                </button>
                {cometLoaded && (
                  <p className="manta-widget__comet-loaded-hint">
                    Refine the fields in the wizard, then use "Push to CoMET" in the toolbar to submit.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Rotating tip ─────────────────────────────────────────────────── */}
      <footer className="manta-widget__tip" onClick={() => setTipIndex((i) => (i + 1) % TIPS.length)} title="Click for next tip" style={{ cursor: 'pointer' }}>
        <span className="manta-widget__tip-icon" aria-hidden="true">💡</span>
        <span className="manta-widget__tip-text">{TIPS[tipIndex]}</span>
        <span className="manta-widget__tip-chevron" aria-hidden="true">›</span>
      </footer>
    </div>
  )
}
