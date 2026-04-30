import fs from 'node:fs'
import path from 'node:path'

function parseArgs(argv) {
  const args = {
    fixtureDir: 'fixtures/mission',
    reportOut: 'fixtures/mission/_regression-report.json',
    proxyBase: process.env.COMET_PROXY_BASE || '',
    includeProxy: false,
    includeRoundtrip: false,
    allowWrite: false,
    recordGroup: '',
    descriptionPrefix: 'swarm-regression',
    maxFiles: 0,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--fixture-dir') args.fixtureDir = argv[++i]
    else if (a === '--report-out') args.reportOut = argv[++i]
    else if (a === '--proxy-base') args.proxyBase = argv[++i]
    else if (a === '--include-proxy') args.includeProxy = true
    else if (a === '--include-roundtrip') args.includeRoundtrip = true
    else if (a === '--allow-write') args.allowWrite = true
    else if (a === '--record-group') args.recordGroup = argv[++i]
    else if (a === '--description-prefix') args.descriptionPrefix = argv[++i]
    else if (a === '--max-files') args.maxFiles = Number(argv[++i] || '0')
  }
  return args
}

function listXmlFiles(dir) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.xml'))
    .map((name) => path.join(dir, name))
    .sort()
}

function runTemplateHygieneChecks(xml) {
  const issues = []
  if (/\{\{[^}]+\}\}/.test(xml)) issues.push('Found unresolved {{token}} placeholder(s)')
  if (/\[\*[^*]+\*\]/.test(xml)) issues.push('Found unresolved [*TOKEN*] placeholder(s)')
  if (/\{[A-Za-z0-9_]+\}\}/.test(xml)) issues.push('Found malformed brace token(s) like {TOKEN}}')
  return issues
}

function hasTag(xml, tagName) {
  const re = new RegExp(`<${tagName}(\\s|>)`, 'i')
  return re.test(xml)
}

function hasCharacterStringAtPath(xml, parentTag) {
  const re = new RegExp(`<${parentTag}(\\s|>)[\\s\\S]*?<gco:CharacterString[^>]*>\\s*[^<\\s][\\s\\S]*?<\\/gco:CharacterString>`, 'i')
  return re.test(xml)
}

function runNceiCoreChecks(xml) {
  /** @type {string[]} */
  const block = []
  /** @type {string[]} */
  const check = []

  // NCEI core fields: title, abstract, citation, bbox, temporal, keywords, license.
  if (!hasCharacterStringAtPath(xml, 'gmd:title')) block.push('Missing dataset title (gmd:title).')
  if (!hasCharacterStringAtPath(xml, 'gmd:abstract')) block.push('Missing abstract (gmd:abstract).')
  if (!hasTag(xml, 'gmd:EX_GeographicBoundingBox')) block.push('Missing geographic bounding box (gmd:EX_GeographicBoundingBox).')
  if (!hasTag(xml, 'gml:beginPosition')) block.push('Missing temporal begin position (gml:beginPosition).')

  // Citation spine: at least one identifier and one cited responsible party.
  if (!hasTag(xml, 'gmd:identifier')) block.push('Missing citation identifier block (gmd:identifier).')
  if (!hasTag(xml, 'gmd:citedResponsibleParty')) block.push('Missing citation responsible party (gmd:citedResponsibleParty).')

  // Usually required for completeness/readiness; keep as CHECK until hard-gated.
  if (!hasTag(xml, 'gmd:descriptiveKeywords')) check.push('Missing descriptive keywords (gmd:descriptiveKeywords).')

  const hasLicenseConstraint = /data license|cc0|cc by|creativecommons|docucomp\/(?:493b9ff1|10bb305d|551ecbfb)/i.test(xml)
  if (!hasLicenseConstraint) check.push('Missing detectable data license constraint statement/xlink.')

  return { block, check }
}

function runDocucompChecks(xml) {
  /** @type {string[]} */
  const block = []
  /** @type {string[]} */
  const check = []

  const hrefs = [...xml.matchAll(/xlink:href\s*=\s*"([^"]+)"/gi)].map((m) => String(m[1] || '').trim())
  const docucompRefs = hrefs.filter((h) => /data\.noaa\.gov\/docucomp\//i.test(h))

  if (hrefs.length > 0 && docucompRefs.length === 0) {
    check.push('XLinks exist but no Docucomp references were detected.')
  }

  // Flag malformed Docucomp references (must include UUID-like suffix).
  const malformed = docucompRefs.filter((h) => !/docucomp\/[0-9a-f-]{8,}$/i.test(h))
  if (malformed.length > 0) {
    block.push(`Malformed Docucomp xlink(s): ${malformed.slice(0, 2).join(', ')}`)
  }

  // Recommended common components for NOAA publishing context.
  const hasNoaaLogo = docucompRefs.some((h) => /401b6d95-a542-4309-bf52-8c9b20caeccd/i.test(h))
  if (!hasNoaaLogo) check.push('NOAA logo Docucomp component not detected (recommended).')

  const hasKnownLicenseComponent = docucompRefs.some((h) =>
    /(493b9ff1-4465-404d-bcdf-e0fe1cedb14f|10bb305d-f440-4b92-8c1c-759dd543bc51|551ecbfb-70c4-43a9-b361-3bf9fea67a75)/i.test(h),
  )
  if (!hasKnownLicenseComponent) {
    check.push('Known Docucomp license component not detected (CC0/CC BY set).')
  }

  return { block, check, docucompRefCount: docucompRefs.length }
}

function runMetadataStandardsAdvisory(xml) {
  /** @type {string[]} */
  const check = []
  // Advisory-only lane: signals for interoperability conventions.
  if (!/gmd:MD_Keywords/i.test(xml)) check.push('No MD_Keywords blocks detected for keyworded discovery profiles.')
  if (!/gmd:referenceSystemInfo|gmd:MD_ReferenceSystem/i.test(xml)) {
    check.push('No reference system block detected; some standards profiles expect CRS clarity.')
  }
  if (!/gmd:distributionInfo/i.test(xml)) {
    check.push('No distributionInfo block detected for access/interoperability expectations.')
  }
  return { check }
}

function runDsmqAdvisory(xml) {
  /** @type {string[]} */
  const check = []
  // CoMET/DSMQ readiness signal: records with DSMQ/DSMM context tend to rank better in OneStop.
  const hasDsmqSignal =
    /data stewardship maturity|dsmq|dsmm|stewardship maturity matrix/i.test(xml)
    || /gmd:dataQualityInfo/i.test(xml)
  if (!hasDsmqSignal) {
    check.push('No DSMQ/DSMM stewardship maturity signal detected (advisory for discovery ranking).')
  }
  return { check, hasDsmqSignal }
}

function runOerDbRequiredChecks(xml) {
  /** @type {Array<{ ruleId: string, message: string }>} */
  const block = []
  const rules = [
    { ruleId: 'oer_req_cruiseid', ok: /gov\.noaa\.ncei\.oer:|gov\.noaa\.ncei\.uxs:|<gmd:fileIdentifier/i.test(xml), message: 'Missing cruise/file identifier signal.' },
    { ruleId: 'oer_req_cruisename', ok: hasCharacterStringAtPath(xml, 'gmd:title'), message: 'Missing cruise/record title (gmd:title).' },
    { ruleId: 'oer_req_diveabstract', ok: hasCharacterStringAtPath(xml, 'gmd:abstract'), message: 'Missing dive/project abstract (gmd:abstract).' },
    { ruleId: 'oer_req_keywords_theme', ok: /EARTH SCIENCE|gmd:MD_Keywords/i.test(xml), message: 'Missing theme/GCMD keyword signal.' },
    { ruleId: 'oer_req_keywords_place', ok: /CONTINENT|OCEAN|SEA|gmd:MD_Keywords/i.test(xml), message: 'Missing place keyword signal.' },
    { ruleId: 'oer_req_bbox', ok: hasTag(xml, 'gmd:EX_GeographicBoundingBox'), message: 'Missing min/max lat/long bounding box.' },
    { ruleId: 'oer_req_divebegin', ok: hasTag(xml, 'gml:beginPosition'), message: 'Missing dive begin time (gml:beginPosition).' },
    { ruleId: 'oer_req_diveend', ok: hasTag(xml, 'gml:endPosition'), message: 'Missing dive end time (gml:endPosition).' },
    { ruleId: 'oer_req_depth_minmax', ok: /<gmd:minimumValue|<gmd:maximumValue/i.test(xml), message: 'Missing min/max depth values.' },
    { ruleId: 'oer_req_principals', ok: hasTag(xml, 'gmd:citedResponsibleParty'), message: 'Missing principal/contact party block.' },
    { ruleId: 'oer_req_instruments', ok: /<gmi:instrument|<gmd:MI_Instrument/i.test(xml), message: 'Missing instrument snippet(s).' },
    { ruleId: 'oer_req_platform', ok: /<gmi:platform|<gmd:MD_Platform/i.test(xml), message: 'Missing platform snippet(s).' },
  ]
  for (const r of rules) {
    if (!r.ok) block.push({ ruleId: r.ruleId, message: r.message })
  }
  return { block }
}

function summarizePublishReadiness(row) {
  const blockers = []
  const checks = []
  if ((row.localIssues || []).length > 0) blockers.push('template_hygiene')
  if ((row.nceiCore?.block || []).length > 0) blockers.push('ncei_core')
  if ((row.docucomp?.block || []).length > 0) blockers.push('docucomp')
  if ((row.oerDbRequired?.block || []).length > 0) blockers.push('oer_db_required')
  if (row.proxy?.isoValidate && row.proxy.isoValidate.semanticOk === false) blockers.push('comet_iso_validate')
  if (row.proxy?.metaservValidate && row.proxy.metaservValidate.semanticOk === false) blockers.push('metaserver_validate')
  if (row.roundtrip && !row.roundtrip.ok) blockers.push('comet_roundtrip')

  if ((row.nceiCore?.check || []).length > 0) checks.push('ncei_recommended')
  if ((row.docucomp?.check || []).length > 0) checks.push('docucomp_recommended')
  if ((row.standardsAdvisory?.check || []).length > 0) checks.push('standards_interop')
  if ((row.dsmqAdvisory?.check || []).length > 0) checks.push('dsmq_signal')

  const status = blockers.length > 0 ? 'BLOCK' : checks.length > 0 ? 'CHECK' : 'PASS'
  return { status, blockers, checks }
}

async function callProxyValidate(proxyBase, action, xmlBody, filename) {
  const url = new URL(proxyBase)
  url.searchParams.set('action', action)
  url.searchParams.set('filename', filename)
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml' },
    body: xmlBody,
  })
  const body = await res.text()
  const semanticOk = evaluateValidationSuccess(action, res.status, body)
  return { status: res.status, ok: res.ok, semanticOk, body: body.slice(0, 600) }
}

function evaluateValidationSuccess(action, status, bodyText) {
  if (status < 200 || status >= 300) return false
  const text = String(bodyText || '')
  if (action === 'isoValidate') {
    try {
      const parsed = JSON.parse(text)
      const n = Number.parseInt(String(parsed?.error_count ?? ''), 10)
      if (Number.isFinite(n)) return n === 0
    } catch {
      return false
    }
  }
  if (action === 'metaservValidate') {
    const compact = text.replace(/\s+/g, ' ').trim().toLowerCase()
    if (!compact) return false
    const hasZeroErrors = /\b0\s+errors?\b/.test(compact)
    const hasSuccess = /\b(success|validation\s+passed|is\s+valid)\b/.test(compact)
    const hasFailure = /\b(exception|fatal|validation\s+failed|invalid)\b/.test(compact)
    if (hasFailure && !hasZeroErrors) return false
    return hasZeroErrors || hasSuccess
  }
  return true
}

function extractImportedUuid(bodyText) {
  try {
    const parsed = JSON.parse(bodyText)
    const candidates = [
      parsed?.uuid,
      parsed?.id,
      parsed?.recordUuid,
      parsed?.metadataUuid,
      parsed?.result?.uuid,
      parsed?.data?.uuid,
    ]
    return candidates.find((v) => typeof v === 'string' && v.trim()) || ''
  } catch {
    return ''
  }
}

async function callProxyImportRoundtrip(proxyBase, xmlBody, filename, recordGroup, description) {
  const importUrl = new URL(proxyBase)
  importUrl.searchParams.set('action', 'import')
  importUrl.searchParams.set('recordGroup', recordGroup)
  importUrl.searchParams.set('description', description)
  const importRes = await fetch(importUrl.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml', Accept: 'application/json' },
    body: xmlBody,
  })
  const importBody = await importRes.text()
  const importedUuid = extractImportedUuid(importBody)
  if (!importRes.ok || !importedUuid) {
    return {
      ok: false,
      import: { status: importRes.status, body: importBody.slice(0, 600) },
      get: null,
      importedUuid,
    }
  }

  const getUrl = new URL(proxyBase)
  getUrl.searchParams.set('action', 'get')
  getUrl.searchParams.set('uuid', importedUuid)
  const getRes = await fetch(getUrl.toString(), {
    method: 'GET',
    headers: { Accept: 'application/xml' },
  })
  const getBody = await getRes.text()
  const looksXml = getBody.trim().startsWith('<')
  return {
    ok: getRes.ok && looksXml,
    import: { status: importRes.status, body: importBody.slice(0, 600) },
    get: { status: getRes.status, body: getBody.slice(0, 600), looksXml },
    importedUuid,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const files = listXmlFiles(args.fixtureDir)
  if (!files.length) {
    console.error(`No XML fixtures found in ${args.fixtureDir}`)
    process.exit(1)
  }
  const selectedFiles = args.maxFiles > 0 ? files.slice(0, args.maxFiles) : files
  const includeProxy = args.includeProxy && !!args.proxyBase
  const includeRoundtrip = args.includeRoundtrip && !!args.proxyBase

  const report = {
    generatedAt: new Date().toISOString(),
    fixtureDir: args.fixtureDir,
    includeProxy,
    includeRoundtrip,
    totalFiles: selectedFiles.length,
    files: [],
    summary: {
      pass: 0,
      fail: 0,
    },
  }

  if (includeRoundtrip && !args.allowWrite) {
    console.error('Roundtrip import check requires --allow-write (safety guard).')
    process.exit(1)
  }
  if (includeRoundtrip && !args.recordGroup) {
    console.error('Roundtrip import check requires --record-group "<groupName>".')
    process.exit(1)
  }

  for (const filePath of selectedFiles) {
    const xml = fs.readFileSync(filePath, 'utf8')
    const localIssues = runTemplateHygieneChecks(xml)
    const nceiCore = runNceiCoreChecks(xml)
    const docucomp = runDocucompChecks(xml)
    const standardsAdvisory = runMetadataStandardsAdvisory(xml)
    const dsmqAdvisory = runDsmqAdvisory(xml)
    const oerDbRequired = runOerDbRequiredChecks(xml)
    const row = {
      file: path.basename(filePath),
      localIssues,
      nceiCore,
      docucomp,
      oerDbRequired,
      standardsAdvisory,
      dsmqAdvisory,
      proxy: {},
      roundtrip: null,
      pass: localIssues.length === 0
        && nceiCore.block.length === 0
        && docucomp.block.length === 0
        && oerDbRequired.block.length === 0,
      publishReadiness: null,
    }

    if (includeProxy) {
      const iso = await callProxyValidate(args.proxyBase, 'isoValidate', xml, path.basename(filePath))
      const meta = await callProxyValidate(args.proxyBase, 'metaservValidate', xml, path.basename(filePath))
      row.proxy = { isoValidate: iso, metaservValidate: meta }
      if (!iso.semanticOk || !meta.semanticOk) row.pass = false
    }

    if (includeRoundtrip) {
      const description = `${args.descriptionPrefix}:${path.basename(filePath)}:${new Date().toISOString()}`
      const roundtrip = await callProxyImportRoundtrip(
        args.proxyBase,
        xml,
        path.basename(filePath),
        args.recordGroup,
        description,
      )
      row.roundtrip = roundtrip
      if (!roundtrip.ok) row.pass = false
    }

    row.publishReadiness = summarizePublishReadiness(row)

    if (row.pass) report.summary.pass += 1
    else report.summary.fail += 1
    report.files.push(row)
  }

  fs.mkdirSync(path.dirname(args.reportOut), { recursive: true })
  fs.writeFileSync(args.reportOut, JSON.stringify(report, null, 2), 'utf8')
  console.log(`Regression report written: ${args.reportOut}`)
  console.log(`Pass: ${report.summary.pass}, Fail: ${report.summary.fail}`)

  if (report.summary.fail > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
