#!/usr/bin/env node
/**
 * Fetch N CoMET collection records as ISO 19115-2 XML (mission-authoring inputs).
 *
 * Requires a live CoMET session:
 *   export COMET_SESSION_ID='...'   # JSESSIONID after login at data.noaa.gov/cedit
 *   export COMET_BASE_URL='https://data.noaa.gov/cedit'   # optional override
 *
 * Usage:
 *   node scripts/swarm/export-comet-mission-forms.mjs --record-group YOUR_GROUP --count 10
 *   npm run swarm:export:comet:missions -- --record-groups-file fixtures/mission/my-groups.txt --count 10
 *   npm run swarm:export:comet:missions -- --record-group Manta --record-group "user@noaa.gov | Personal Repository"
 *
 * CoMET UI: Filters → Record Group on Metadata Records List (e.g. /cedit/formContent)
 * matches this same string. Groups may be WAF-linked for publishing; API access is still
 * membership-scoped—you only enumerate rows for groups your JSESSIONID may use (not arbitrary
 * "Other User | Personal Repository" labels in the global dropdown unless you belong there).
 *
 * Outputs:
 *   --out-dir/fixtures/mission/comet-export-YYYYMMDD-HHMMSS/
 *     manifest.json   (uuids + sourceRecordGroup CoMET dropdown label)
 *     <uuid>.xml      (one file per record)
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { metadataListFromCometSearchJson } from '../../src/lib/cometSearchPayload.js'

const swarmDir = path.dirname(fileURLToPath(import.meta.url))
const pilotRoot = path.resolve(swarmDir, '../..')

function parseArgs(argv) {
  const args = {
    cometBase: process.env.COMET_BASE_URL || 'https://data.noaa.gov/cedit',
    sessionId: process.env.COMET_SESSION_ID || '',
    /** @type {string[]} */
    recordGroups: [],
    recordGroupsFile: '',
    editState: '',
    count: 10,
    searchMax: 200,
    outDir: '',
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--comet-base') args.cometBase = argv[++i]
    else if (a === '--session-id') args.sessionId = argv[++i]
    else if (a === '--record-group') {
      const line = String(argv[++i] || '').trim()
      if (line) args.recordGroups.push(line)
    } else if (a === '--record-groups-file') args.recordGroupsFile = argv[++i]
    else if (a === '--edit-state') args.editState = String(argv[++i] || '').trim()
    else if (a === '--count') args.count = Math.max(1, Number(argv[++i] || '10'))
    else if (a === '--search-max') args.searchMax = Math.max(10, Number(argv[++i] || '200'))
    else if (a === '--out-dir') args.outDir = argv[++i]
  }
  return args
}

function loadRecordGroupsFromFile(filePath) {
  const p = String(filePath || '').trim()
  if (!p) return []
  const abs = path.isAbsolute(p)
    ? p
    : [path.resolve(process.cwd(), p), path.join(pilotRoot, p)].find((candidate) => fs.existsSync(candidate)) || p
  if (!fs.existsSync(abs)) return []
  const text = fs.readFileSync(abs, 'utf8')
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, '').trim())
    .filter(Boolean)
}

/**
 * Dedupe UUIDs; walk groups in file order until `need` rows or groups exhausted.
 *
 * @param {string[]} recordGroups
 * @param {(rg: string) => Promise<{ rows: Array<{ uuid: string, fileIdentifier: string, name: string, editState: string }>, totalCount?: number }>} searchFn
 */
async function gatherMergedRows(recordGroups, need, searchFn) {
  /** @typedef {{ uuid: string, fileIdentifier: string, name: string, editState: string, sourceRecordGroup: string }} MRow */
  /** @type {MRow[]} */
  const merged = []
  /** @type {Map<string, true>} */
  const seenUuid = new Map()
  /** @type {Array<{ recordGroup: string, totalCount?: number, added: number }>} */
  const perGroup = []

  for (const rg of recordGroups) {
    const { rows, totalCount } = await searchFn(rg.trim())
    let addedHere = 0
    for (const r of rows) {
      if (seenUuid.has(r.uuid)) continue
      seenUuid.set(r.uuid, true)
      merged.push({ ...r, sourceRecordGroup: rg.trim() })
      addedHere += 1
      if (merged.length >= need) {
        perGroup.push({ recordGroup: rg.trim(), totalCount, added: addedHere })
        return { merged: merged.slice(0, need), perGroup }
      }
    }
    perGroup.push({ recordGroup: rg.trim(), totalCount, added: addedHere })
  }
  return { merged, perGroup }
}

async function searchComet({ cometBase, sessionId, recordGroup, max, editState }) {
  const base = cometBase.replace(/\/$/, '')
  const url = new URL(`${base}/metadata/search`)
  url.searchParams.set('recordGroup', recordGroup)
  url.searchParams.set('format', 'json')
  url.searchParams.set('max', String(max))
  if (String(editState || '').trim()) url.searchParams.set('editState', String(editState).trim())
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Cookie: `JSESSIONID=${sessionId}`,
    },
    redirect: 'manual',
  })
  const body = await res.text()
  if (res.status >= 300 && res.status < 400) {
    throw new Error(
      `CoMET search redirected (${res.status}) — session likely expired or not logged in. Refresh JSESSIONID.`,
    )
  }
  if (!res.ok) {
    throw new Error(`CoMET search failed (${res.status}): ${body.slice(0, 400)}`)
  }
  let parsed
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new Error(`CoMET search returned non-JSON: ${body.slice(0, 200)}`)
  }
  const raw = metadataListFromCometSearchJson(parsed)
  const rows = raw
    .map((r) => ({
      uuid: String(r.uuid || '').trim(),
      fileIdentifier: String(r.fileIdentifier || '').trim(),
      name: String(r.name || '').trim(),
      editState: String(r.editState || '').trim(),
    }))
    .filter((r) => r.uuid)
  const totalCount =
    parsed && typeof parsed === 'object' && 'totalCount' in parsed
      ? /** @type {any} */ (parsed).totalCount
      : undefined
  return { rows, totalCount }
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

function safeFileBase(uuid) {
  return uuid.replace(/[^a-zA-Z0-9-]/g, '_')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.sessionId) {
    console.error('Set COMET_SESSION_ID (or pass --session-id).')
    console.error('Login at https://data.noaa.gov/cedit and copy JSESSIONID from the cookie.')
    process.exit(1)
  }
  const fromFile = loadRecordGroupsFromFile(args.recordGroupsFile)
  const rawList = [...fromFile, ...args.recordGroups].map((s) => String(s || '').trim()).filter(Boolean)
  const recordGroups = []
  const rgSeen = new Set()
  for (const rg of rawList) {
    if (rgSeen.has(rg)) continue
    rgSeen.add(rg)
    recordGroups.push(rg)
  }
  if (!recordGroups.length) {
    console.error('Pass one or more --record-group "<label>" or --record-groups-file <path>')
    console.error('(Use exact strings from CoMET Search → record group dropdown.)')
    process.exit(1)
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const outDir =
    args.outDir ||
    path.join(pilotRoot, 'fixtures', 'mission', `comet-export-${stamp}`)
  fs.mkdirSync(outDir, { recursive: true })

  console.log(`Record groups (${recordGroups.length}): ${recordGroups.join(' | ')}`)
  console.log(`Search max ${args.searchMax}${args.editState ? ` editState=${args.editState}` : ''} …`)

  const { merged: pick, perGroup } = await gatherMergedRows(recordGroups, args.count, (rg) =>
    searchComet({
      cometBase: args.cometBase,
      sessionId: args.sessionId,
      recordGroup: rg,
      max: args.searchMax,
      editState: args.editState,
    }),
  )
  if (!pick.length) {
    console.error('No records matched any group.')
    for (const g of perGroup) {
      const tc = g.totalCount != null ? ` totalCount=${g.totalCount}` : ''
      console.error(`  • ${g.recordGroup}:${tc}`)
    }
    process.exit(1)
  }
  if (pick.length < args.count) {
    console.warn(`Only ${pick.length} unique record(s) across groups (requested ${args.count}).`)
  }

  console.log(`Fetching ISO XML for ${pick.length} record(s) into:\n  ${outDir}\n`)

  const manifest = {
    generatedAt: new Date().toISOString(),
    recordGroups,
    editStateFilter: args.editState || undefined,
    searchPerRecordGroup: perGroup,
    cometBase: args.cometBase.replace(/\/$/, ''),
    requestedCount: args.count,
    files: [],
    failures: [],
  }

  for (const row of pick) {
    const { status, body } = await fetchCometIsoXml(args.cometBase, args.sessionId, row.uuid)
    const trimmed = body.trim().toLowerCase()
    if (status < 200 || status >= 300 || trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
      manifest.failures.push({
        uuid: row.uuid,
        status,
        snippet: body.slice(0, 240),
      })
      console.error(`FAIL ${row.uuid} [${status}]`)
      continue
    }
    if (!trimmed.startsWith('<')) {
      manifest.failures.push({ uuid: row.uuid, status, snippet: body.slice(0, 240) })
      console.error(`FAIL ${row.uuid} non-XML`)
      continue
    }
    const baseName = safeFileBase(row.uuid)
    const xmlPath = path.join(outDir, `${baseName}.xml`)
    fs.writeFileSync(xmlPath, body, 'utf8')
    manifest.files.push({
      uuid: row.uuid,
      name: row.name,
      fileIdentifier: row.fileIdentifier,
      editState: row.editState,
      sourceRecordGroup: row.sourceRecordGroup,
      path: path.relative(pilotRoot, xmlPath),
    })
    console.log(`OK   ${row.uuid} → ${path.basename(xmlPath)}`)
  }

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
  console.log(`\nmanifest.json written. Success: ${manifest.files.length}, failed: ${manifest.failures.length}`)

  if (manifest.failures.length && !manifest.files.length) process.exit(1)
  if (manifest.failures.length) process.exit(2)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
