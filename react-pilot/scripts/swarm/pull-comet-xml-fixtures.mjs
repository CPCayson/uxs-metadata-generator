import fs from 'node:fs'
import path from 'node:path'

function parseArgs(argv) {
  const args = {
    uuidFile: 'fixtures/mission/comet-uuids.txt',
    outDir: 'fixtures/mission',
    cometBase: process.env.COMET_BASE_URL || 'https://data.noaa.gov/cedit',
    sessionId: process.env.COMET_SESSION_ID || '',
    /** @type {string[]} */
    uuidsFromCli: [],
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--uuid-file') args.uuidFile = argv[++i]
    else if (a === '--uuid') {
      const id = String(argv[++i] || '').trim()
      if (id) args.uuidsFromCli.push(id)
    } else if (a === '--out-dir') args.outDir = argv[++i]
    else if (a === '--comet-base') args.cometBase = argv[++i]
    else if (a === '--session-id') args.sessionId = argv[++i]
  }
  return args
}

function readUuidList(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
}

function sanitizeName(uuid) {
  return uuid.replace(/[^a-zA-Z0-9_-]/g, '_')
}

async function fetchCometIsoXml(cometBase, sessionId, uuid) {
  const base = cometBase.replace(/\/$/, '')
  const url = `${base}/metadata/${encodeURIComponent(uuid)}?transform=convert-comet-to-iso19115-2`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/xml',
      Cookie: `JSESSIONID=${sessionId}`,
    },
    redirect: 'manual',
  })
  const body = await res.text()
  return { status: res.status, body }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.sessionId) {
    console.error('Missing COMET_SESSION_ID (or --session-id).')
    process.exit(1)
  }

  let uuids = [...args.uuidsFromCli]
  if (!uuids.length) {
    if (!fs.existsSync(args.uuidFile)) {
      console.error(`UUID file not found: ${args.uuidFile}`)
      console.error('Create it or pass one or more --uuid <id>')
      process.exit(1)
    }
    uuids = readUuidList(args.uuidFile)
  }
  if (!uuids.length) {
    console.error(`No UUIDs (use --uuid or list them in ${args.uuidFile})`)
    process.exit(1)
  }

  fs.mkdirSync(args.outDir, { recursive: true })
  const failures = []
  let written = 0

  for (const uuid of uuids) {
    const { status, body } = await fetchCometIsoXml(args.cometBase, args.sessionId, uuid)
    if (status < 200 || status >= 300) {
      failures.push({ uuid, status, error: body.slice(0, 300) })
      continue
    }
    const trimmed = body.trim().toLowerCase()
    if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
      failures.push({ uuid, status, error: 'Received HTML response (likely expired session)' })
      continue
    }
    const fileName = `${sanitizeName(uuid)}.xml`
    const outPath = path.join(args.outDir, fileName)
    fs.writeFileSync(outPath, body, 'utf8')
    written += 1
    console.log(`Pulled ${uuid} -> ${outPath}`)
  }

  console.log(`Pulled ${written}/${uuids.length} XML fixture(s).`)
  if (failures.length) {
    console.error(`Failed pulls: ${failures.length}`)
    for (const f of failures) {
      console.error(`- ${f.uuid} [${f.status}] ${f.error}`)
    }
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
