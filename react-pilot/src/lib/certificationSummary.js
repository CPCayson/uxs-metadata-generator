import { getDataLicensePresetDef, normalizeDataLicensePresetKey } from './noaaLicensePresets.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const URL_RE = /^https?:\/\//i
const DOCUCOMP_RE = /^https:\/\/data\.noaa\.gov\/docucomp\/[0-9a-f-]{8,}$/i

function text(value) {
  return String(value || '').trim()
}

function missionState(state) {
  return state?.mission && typeof state.mission === 'object' ? state.mission : state || {}
}

function distributionState(state) {
  return state?.distribution && typeof state.distribution === 'object' ? state.distribution : state || {}
}

function keywordFacetArrays(state) {
  const k = state?.keywords && typeof state.keywords === 'object' ? state.keywords : {}
  const missionFacets = Object.values(k).filter(Array.isArray)
  const flatFacets = [
    state?.scienceKeywords,
    state?.placeKeywords,
    state?.datacenters,
    state?.oerKeywords,
  ].filter(Array.isArray)
  return [...missionFacets, ...flatFacets]
}

function keywordCounts(state) {
  const facets = keywordFacetArrays(state)
  const items = facets.flat()
  const total = items.length
  const withUuid = items.filter((item) => text(item?.uuid || item?.href || item?.conceptId)).length
  return { total, withUuid, missingUuid: Math.max(0, total - withUuid) }
}

function collectUrls(state, xml = '') {
  const m = missionState(state)
  const d = distributionState(state)
  const raw = [
    m.url,
    m.landingPageUrl,
    m.downloadUrl,
    m.licenseUrl,
    m.browseGraphicUrl,
    m.graphicUrl,
    d.landingPageUrl,
    d.downloadUrl,
    d.accessUrl,
    d.licenseUrl,
    d.distributorContactHref,
    d.nceiMetadataContactHref,
    state?.landingPageUrl,
    state?.granulesSearchUrl,
    state?.downloadUrl,
    state?.browseGraphicUrl,
    state?.graphicUrl,
    state?.contactHref,
    state?.nceiContactHref,
    state?.piContactHref,
  ].map(text).filter(Boolean)

  const xmlUrls = Array.from(String(xml || '').matchAll(/(?:<gmd:URL>|xlink:href=")(https?:\/\/[^"<\s]+)/g))
    .map((mch) => text(mch[1]))
  return [...new Set([...raw, ...xmlUrls].filter((u) => URL_RE.test(u)))]
}

function imageUrls(state, xml = '') {
  return collectUrls(state, xml).filter((url) =>
    /image|graphic|browse|thumbnail|docucomp\/image/i.test(url)
  )
}

function getRecordUuid(state, cometUuid = '') {
  const candidates = [
    cometUuid,
    state?.metadataUuid,
    state?.uuid,
    state?.ident?.collectionUuid,
    state?.ident?.archiveObjectUuid,
    state?.mission?.metadataUuid,
    state?.collectionUuid,
    state?.archiveObjectUuid,
  ].map(text)
  return candidates.find(Boolean) || ''
}

function licenseEvidence(state, xml = '') {
  const m = missionState(state)
  const d = distributionState(state)
  const preset = normalizeDataLicensePresetKey(m.dataLicensePreset || state?.dataLicensePreset)
  const presetDef = getDataLicensePresetDef(preset)
  const url = text(m.licenseUrl || d.licenseUrl || state?.licenseUrl || presetDef.docucompHref)
  const xmlDocucomp = text((String(xml || '').match(/https:\/\/data\.noaa\.gov\/docucomp\/[0-9a-f-]{8,}/i) || [])[0])
  const href = url || xmlDocucomp
  const hasDocucomp = DOCUCOMP_RE.test(href) || DOCUCOMP_RE.test(xmlDocucomp)
  const hasCustomUrl = preset === 'custom' && URL_RE.test(url)
  const hasAcdOAnchor = presetDef.anchors?.length > 0
  return { preset, href, hasDocucomp, hasCustomUrl, hasAcdOAnchor }
}

/**
 * Build certification lanes that map batch metadata checks into the Manta
 * readiness surface. These are local/evidence checks; external WAF and
 * NODD/OSDD batch runs can later replace the CHECK placeholders with PASS/BLOCK.
 *
 * @param {object} state
 * @param {{
 *   xml?: string,
 *   readinessSnapshot?: Record<string, { errCount: number, warnCount: number }>,
 *   preflightSummary?: { overall?: string } | null,
 *   cometUuid?: string,
 *   isDirty?: boolean,
 * }} [ctx]
 */
export function computeCertificationBundles(state, ctx = {}) {
  const xml = String(ctx.xml || '')
  const strictErrors = ctx.readinessSnapshot?.strict?.errCount ?? 1
  const catalogErrors = ctx.readinessSnapshot?.catalog?.errCount ?? 1
  const preflight = text(ctx.preflightSummary?.overall).toUpperCase()
  const urls = collectUrls(state, xml)
  const imgs = imageUrls(state, xml)
  const kw = keywordCounts(state)
  const lic = licenseEvidence(state, xml)
  const uuid = getRecordUuid(state, ctx.cometUuid)
  const hasXmlRoot = /<(?:gmi:MI_Metadata|gmd:MD_Metadata)\b/.test(xml)
  const hasLinkEvidence = preflight === 'PASS'

  return [
    {
      id: 'xml-certification',
      label: 'XML cert',
      scope: 'certification',
      status: hasXmlRoot && strictErrors === 0 ? 'pass' : 'block',
      ready: hasXmlRoot && strictErrors === 0,
      detail: hasXmlRoot
        ? strictErrors === 0
          ? 'XML preview exists and strict local validation has no blocking errors.'
          : `${strictErrors} strict XML/editor blocker(s) remain.`
        : 'No ISO XML preview was available for certification.',
    },
    {
      id: 'comet-certification',
      label: 'CoMET cert',
      scope: 'external',
      status: preflight === 'PASS' ? 'pass' : preflight ? 'block' : 'check',
      ready: preflight === 'PASS',
      detail: preflight
        ? `CoMET preflight reported ${preflight}.`
        : 'CoMET preflight has not run yet.',
    },
    {
      id: 'docucomp-license',
      label: 'DocuComp',
      scope: 'certification',
      status: lic.hasDocucomp || lic.hasCustomUrl || lic.hasAcdOAnchor ? 'pass' : 'block',
      ready: lic.hasDocucomp || lic.hasCustomUrl || lic.hasAcdOAnchor,
      detail: lic.hasDocucomp
        ? `DocuComp license component detected: ${lic.href}.`
        : lic.hasCustomUrl || lic.hasAcdOAnchor
          ? `License preset ${lic.preset} has usable license evidence.`
          : 'No DocuComp license component or usable custom license URL detected.',
    },
    {
      id: 'keyword-anchors',
      label: 'Keywords',
      scope: 'certification',
      status: kw.total > 0 && kw.missingUuid === 0 ? 'pass' : kw.total > 0 ? 'check' : 'block',
      ready: kw.total > 0 && kw.missingUuid === 0,
      detail: kw.total === 0
        ? 'No keyword facets detected.'
        : kw.missingUuid === 0
          ? `${kw.total} keyword(s) have UUID/link evidence.`
          : `${kw.total} keyword(s), ${kw.missingUuid} missing UUID/link evidence.`,
    },
    {
      id: 'link-health',
      label: 'Links',
      scope: 'batch',
      status: hasLinkEvidence ? 'pass' : urls.length > 0 ? 'check' : 'block',
      ready: hasLinkEvidence,
      detail: hasLinkEvidence
        ? 'External CoMET linkcheck evidence is PASS.'
        : urls.length > 0
          ? `${urls.length} URL(s) detected; run WAF/batch link check for HTTP evidence.`
          : 'No URL-bearing resources detected.',
    },
    {
      id: 'uuid-integrity',
      label: 'UUIDs',
      scope: 'batch',
      status: UUID_RE.test(uuid) ? 'pass' : uuid ? 'check' : 'check',
      ready: UUID_RE.test(uuid),
      detail: UUID_RE.test(uuid)
        ? `UUID evidence detected: ${uuid}.`
        : uuid
          ? `UUID-like value needs review: ${uuid}.`
          : 'No root/CoMET UUID evidence detected; run UUID scrape or load from CoMET.',
    },
    {
      id: 'image-url',
      label: 'Images',
      scope: 'batch',
      status: imgs.length > 0 ? 'pass' : 'check',
      ready: imgs.length > 0,
      detail: imgs.length > 0
        ? `${imgs.length} image/browse graphic URL(s) detected.`
        : 'No image/browse graphic URL detected; run image URL audit if required.',
    },
    {
      id: 'waf-batch',
      label: 'WAF',
      scope: 'batch',
      status: 'check',
      ready: false,
      detail: 'WAF scraping/report evidence is not attached yet.',
    },
    {
      id: 'nodd-osdd',
      label: 'NODD/OSDD',
      scope: 'batch',
      status: catalogErrors === 0 && urls.length > 0 ? 'check' : 'block',
      ready: false,
      detail: catalogErrors === 0 && urls.length > 0
        ? 'Catalog links exist; NODD/OSDD patch-plan evidence is not attached yet.'
        : 'Catalog link requirements must pass before NODD/OSDD patch planning.',
    },
  ]
}
