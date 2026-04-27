import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { google } from 'googleapis'
import { DEFAULT_SCOPES, credentialsPath, ensureTokenDir, loadConfig, tokenPath } from './config.js'

const GOOGLE_DOC_EXPORTS = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain',
}

function parseCredentials() {
  const file = credentialsPath()
  if (!fs.existsSync(file)) {
    throw new Error(`Google OAuth client credentials not found at ${file}`)
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
  const cfg = raw.installed || raw.web || raw
  const redirectUri = cfg.redirect_uris?.[0] || 'http://localhost'
  return {
    clientId: cfg.client_id,
    clientSecret: cfg.client_secret,
    redirectUri,
  }
}

export function makeOAuthClient() {
  const { clientId, clientSecret, redirectUri } = parseCredentials()
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

export async function authorize() {
  const oauth2Client = makeOAuthClient()
  const tokenFile = tokenPath()
  if (fs.existsSync(tokenFile)) {
    oauth2Client.setCredentials(JSON.parse(fs.readFileSync(tokenFile, 'utf8')))
    return oauth2Client
  }
  throw new Error(`Google token not found at ${tokenFile}. Run: npm --prefix mcp/noaa-metadata run auth`)
}

export async function runAuthFlow() {
  const oauth2Client = makeOAuthClient()
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: DEFAULT_SCOPES,
    prompt: 'consent',
  })
  console.error('\nOpen this URL in your browser and approve read-only access:\n')
  console.error(authUrl)
  const rl = readline.createInterface({ input, output })
  const code = await rl.question('\nPaste the authorization code here: ')
  rl.close()
  const { tokens } = await oauth2Client.getToken(code.trim())
  ensureTokenDir()
  fs.writeFileSync(tokenPath(), JSON.stringify(tokens, null, 2))
  console.error(`\nSaved token to ${tokenPath()}`)
}

export async function driveClient() {
  const auth = await authorize()
  return google.drive({ version: 'v3', auth })
}

function escapeDriveQuery(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function metadataKeywordQuery(keywords) {
  const terms = keywords
    .map((kw) => String(kw || '').trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((kw) => `name contains '${escapeDriveQuery(kw)}'`)
  return terms.length ? `(${terms.join(' or ')})` : ''
}

function baseFields() {
  return 'nextPageToken, files(id, name, mimeType, description, webViewLink, parents, driveId, modifiedTime, size, owners(displayName,emailAddress))'
}

export async function listAllowedDrivesAndFolders() {
  const config = loadConfig()
  return {
    mode: config.mode,
    configPath: config.configPath,
    allowedFolders: config.allowedFolders,
    allowedSharedDrives: config.allowedSharedDrives,
    maxSearchResults: config.maxSearchResults,
  }
}

export async function searchDriveMetadataFiles({ query = '', mimeTypes = [], maxResults } = {}) {
  const config = loadConfig()
  const drive = await driveClient()
  const q = []
  q.push('trashed = false')
  if (query) {
    q.push(`fullText contains '${escapeDriveQuery(query)}' or name contains '${escapeDriveQuery(query)}'`)
  } else {
    const kw = metadataKeywordQuery(config.metadataKeywords)
    if (kw) q.push(kw)
  }
  if (Array.isArray(mimeTypes) && mimeTypes.length) {
    q.push(`(${mimeTypes.map((mt) => `mimeType = '${escapeDriveQuery(mt)}'`).join(' or ')})`)
  }

  const pageSize = Math.min(Number(maxResults) || config.maxSearchResults, config.maxSearchResults)
  const results = []

  if (config.mode === 'allAccessible') {
    const res = await drive.files.list({
      q: q.join(' and '),
      pageSize,
      fields: baseFields(),
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    })
    results.push(...(res.data.files || []))
  } else {
    for (const folder of config.allowedFolders.filter((f) => f?.id)) {
      const res = await drive.files.list({
        q: [...q, `'${escapeDriveQuery(folder.id)}' in parents`].join(' and '),
        pageSize,
        fields: baseFields(),
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      })
      results.push(...(res.data.files || []).map((file) => ({ ...file, allowlistSource: folder.label || folder.id })))
    }
    for (const sharedDrive of config.allowedSharedDrives.filter((d) => d?.id)) {
      const res = await drive.files.list({
        q: q.join(' and '),
        pageSize,
        fields: baseFields(),
        corpora: 'drive',
        driveId: sharedDrive.id,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      })
      results.push(...(res.data.files || []).map((file) => ({ ...file, allowlistSource: sharedDrive.label || sharedDrive.id })))
    }
  }

  const deduped = [...new Map(results.map((file) => [file.id, file])).values()]
  return deduped.slice(0, pageSize)
}

export async function getFileMetadata(fileId) {
  const drive = await driveClient()
  const res = await drive.files.get({
    fileId,
    supportsAllDrives: true,
    fields: 'id, name, mimeType, description, webViewLink, parents, driveId, modifiedTime, size, owners(displayName,emailAddress)',
  })
  return res.data
}

export async function extractFileText(fileId, { maxBytes } = {}) {
  const config = loadConfig()
  const limit = Math.min(Number(maxBytes) || config.maxExtractBytes, config.maxExtractBytes)
  const drive = await driveClient()
  const meta = await getFileMetadata(fileId)
  const exportMime = GOOGLE_DOC_EXPORTS[meta.mimeType]
  let response
  if (exportMime) {
    response = await drive.files.export({ fileId, mimeType: exportMime }, { responseType: 'arraybuffer' })
  } else {
    response = await drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'arraybuffer' })
  }
  const buf = Buffer.from(response.data)
  const clipped = buf.subarray(0, limit)
  return {
    metadata: meta,
    truncated: buf.length > limit,
    bytesRead: clipped.length,
    text: clipped.toString('utf8'),
  }
}

export async function downloadAllowedFile(fileId, outputDir) {
  const data = await extractFileText(fileId)
  const safeName = String(data.metadata.name || fileId).replace(/[^\w.-]+/g, '_')
  const targetDir = path.resolve(outputDir || path.join(process.cwd(), 'noaa-metadata-downloads'))
  fs.mkdirSync(targetDir, { recursive: true })
  const target = path.join(targetDir, safeName.endsWith('.txt') ? safeName : `${safeName}.txt`)
  fs.writeFileSync(target, data.text)
  return { path: target, metadata: data.metadata, bytesWritten: Buffer.byteLength(data.text, 'utf8'), truncated: data.truncated }
}
