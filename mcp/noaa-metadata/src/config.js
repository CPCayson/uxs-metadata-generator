import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
]

const DEFAULT_KEYWORDS = [
  'metadata',
  'cruisepack',
  'cruise pack',
  'oer',
  'ncei',
  'uxs',
  'gcmd',
  'iso 19115',
  '19115-2',
  'comet',
  'onestop',
  'bedi',
  'granule',
  'collection',
]

export function packageRoot() {
  return path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
}

export function defaultConfigPath() {
  return path.join(packageRoot(), 'config', 'allowlist.json')
}

export function credentialsPath() {
  return process.env.NOAA_MCP_GOOGLE_CREDENTIALS
    || path.join(packageRoot(), 'config', 'oauth-client.json')
}

export function tokenPath() {
  return process.env.NOAA_MCP_GOOGLE_TOKEN
    || path.join(os.homedir(), '.config', 'noaa-metadata-mcp', 'google-token.json')
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

export function loadConfig() {
  const cfgPath = process.env.NOAA_MCP_CONFIG || defaultConfigPath()
  const cfg = readJsonIfExists(cfgPath) || {}
  const mode = cfg.mode === 'allAccessible' ? 'allAccessible' : 'allowlist'
  const allowedFolders = Array.isArray(cfg.allowedFolders) ? cfg.allowedFolders : []
  const allowedSharedDrives = Array.isArray(cfg.allowedSharedDrives) ? cfg.allowedSharedDrives : []
  const maxSearchResults = Number.isFinite(Number(cfg.maxSearchResults)) ? Math.max(1, Math.min(100, Number(cfg.maxSearchResults))) : 25
  const maxExtractBytes = Number.isFinite(Number(cfg.maxExtractBytes)) ? Math.max(1000, Number(cfg.maxExtractBytes)) : 500000
  return {
    configPath: cfgPath,
    mode,
    allowedFolders,
    allowedSharedDrives,
    maxSearchResults,
    maxExtractBytes,
    metadataKeywords: Array.isArray(cfg.metadataKeywords) && cfg.metadataKeywords.length
      ? cfg.metadataKeywords.map(String)
      : DEFAULT_KEYWORDS,
  }
}

export function assertCanSearchAll(config) {
  if (config.mode === 'allAccessible') return
  const hasAllowedFolders = config.allowedFolders.some((f) => f?.id)
  const hasAllowedSharedDrives = config.allowedSharedDrives.some((d) => d?.id)
  if (!hasAllowedFolders && !hasAllowedSharedDrives) {
    throw new Error(
      `No Google Drive allowlist configured. Copy config/allowlist.example.json to ${config.configPath} and add folder/shared-drive IDs, or set mode to "allAccessible" intentionally.`,
    )
  }
}

export function ensureTokenDir() {
  fs.mkdirSync(path.dirname(tokenPath()), { recursive: true })
}
