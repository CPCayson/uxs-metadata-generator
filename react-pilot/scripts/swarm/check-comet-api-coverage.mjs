import fs from 'node:fs'
import path from 'node:path'

function parseArgs(argv) {
  const args = {
    proxyBase: process.env.COMET_PROXY_BASE || '',
    fixtureFile: '',
    fixtureDir: 'fixtures/mission',
    reportOut: 'fixtures/mission/_api-coverage-report.json',
    recordGroup: '',
    uuid: '',
    includeMetaserv: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--proxy-base') args.proxyBase = argv[++i]
    else if (a === '--fixture-file') args.fixtureFile = argv[++i]
    else if (a === '--fixture-dir') args.fixtureDir = argv[++i]
    else if (a === '--report-out') args.reportOut = argv[++i]
    else if (a === '--record-group') args.recordGroup = argv[++i]
    else if (a === '--uuid') args.uuid = argv[++i]
    else if (a === '--include-metaserv') args.includeMetaserv = true
  }
  return args
}

function pickFixture(args) {
  if (args.fixtureFile) return args.fixtureFile
  if (!fs.existsSync(args.fixtureDir)) return ''
  const xmls = fs
    .readdirSync(args.fixtureDir)
    .filter((f) => f.toLowerCase().endsWith('.xml'))
    .sort()
  if (!xmls.length) return ''
  return path.join(args.fixtureDir, xmls[0])
}

async function callProxy(action, proxyBase, { xmlBody = '', filename = 'record.xml', query = {}, method } = {}) {
  const url = new URL(proxyBase)
  url.searchParams.set('action', action)
  if (filename) url.searchParams.set('filename', filename)
  for (const [k, v] of Object.entries(query)) {
    if (typeof v === 'string' && v) url.searchParams.set(k, v)
  }

  const reqMethod = method || (xmlBody ? 'POST' : 'GET')
  const headers = {}
  if (xmlBody) headers['Content-Type'] = 'application/xml'
  const res = await fetch(url.toString(), {
    method: reqMethod,
    headers,
    body: xmlBody || undefined,
  })
  const body = await res.text()
  return {
    ok: res.ok,
    status: res.status,
    bodyPreview: body.slice(0, 600),
    contentType: res.headers.get('content-type') || '',
  }
}

function looksXml(text) {
  const t = String(text || '').trim()
  return t.startsWith('<')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.proxyBase) {
    console.error('Missing proxy base. Pass --proxy-base or set COMET_PROXY_BASE.')
    process.exit(1)
  }

  const fixturePath = pickFixture(args)
  if (!fixturePath || !fs.existsSync(fixturePath)) {
    console.error('No XML fixture found. Pass --fixture-file or place XML files in fixtures/mission.')
    process.exit(1)
  }
  const xml = fs.readFileSync(fixturePath, 'utf8')
  const filename = path.basename(fixturePath)

  const report = {
    generatedAt: new Date().toISOString(),
    proxyBase: args.proxyBase,
    fixturePath,
    checks: {},
    summary: { pass: 0, fail: 0 },
  }

  // Record Services coverage (core non-destructive lane)
  report.checks.isoValidate = await callProxy('isoValidate', args.proxyBase, { xmlBody: xml, filename })
  report.checks.rubric = await callProxy('rubric', args.proxyBase, { xmlBody: xml, filename })
  report.checks.resolver = await callProxy('resolver', args.proxyBase, { xmlBody: xml, filename })
  report.checks.linkcheck = await callProxy('linkcheck', args.proxyBase, { xmlBody: xml, filename })

  // Resolver must return XML-ish response.
  if (report.checks.resolver.ok && !looksXml(report.checks.resolver.bodyPreview)) {
    report.checks.resolver.ok = false
    report.checks.resolver.bodyPreview = `Non-XML resolver response: ${report.checks.resolver.bodyPreview}`
  }

  // Optional metadata/search coverage when a group is supplied.
  if (args.recordGroup) {
    report.checks.search = await callProxy('search', args.proxyBase, {
      query: { recordGroup: args.recordGroup, max: '10', format: 'json' },
      method: 'GET',
      filename: '',
    })
  }

  // Optional read/validate-by-uuid coverage when a UUID is supplied.
  if (args.uuid) {
    report.checks.get = await callProxy('get', args.proxyBase, { query: { uuid: args.uuid }, method: 'GET', filename: '' })
    report.checks.validate = await callProxy('validate', args.proxyBase, {
      query: { uuid: args.uuid, format: 'json' },
      method: 'GET',
      filename: '',
    })
  }

  // Optional legacy metaserver lane (can be slower/flakier).
  if (args.includeMetaserv) {
    report.checks.metaservValidate = await callProxy('metaservValidate', args.proxyBase, {
      xmlBody: xml,
      filename,
      method: 'POST',
    })
  }

  for (const check of Object.values(report.checks)) {
    if (check.ok) report.summary.pass += 1
    else report.summary.fail += 1
  }

  fs.mkdirSync(path.dirname(args.reportOut), { recursive: true })
  fs.writeFileSync(args.reportOut, JSON.stringify(report, null, 2), 'utf8')
  console.log(`API coverage report written: ${args.reportOut}`)
  console.log(`Pass: ${report.summary.pass}, Fail: ${report.summary.fail}`)

  if (report.summary.fail > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
