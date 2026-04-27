#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import {
  downloadAllowedFile,
  extractFileText,
  getFileMetadata,
  listAllowedDrivesAndFolders,
  searchDriveMetadataFiles,
} from './googleDrive.js'
import { canExtractText, isMetadataCandidate, summarizeMetadataText } from './extractors.js'

function textResponse(data) {
  return {
    content: [
      {
        type: 'text',
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      },
    ],
  }
}

function fileSummary(file) {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime,
    webViewLink: file.webViewLink,
    driveId: file.driveId,
    allowlistSource: file.allowlistSource,
    owners: file.owners?.map((o) => ({ name: o.displayName, email: o.emailAddress })),
    metadataCandidate: isMetadataCandidate(file),
    extractableText: canExtractText(file.mimeType || ''),
  }
}

const server = new McpServer(
  { name: 'noaa-metadata-mcp', version: '0.1.0' },
  {
    instructions: [
      'Use read-only Google OAuth credentials.',
      'Prefer allowlisted folders/shared drives.',
      'Use tools for NOAA/OER/UxS/BEDI/CoMET metadata discovery and extraction only.',
      'Do not mass-download unrelated files; summarize candidates before extraction.',
    ].join('\n'),
  },
)

server.registerTool(
  'list_allowed_sources',
  {
    description: 'Show the Google Drive allowlist/search mode and configured folder/shared-drive sources.',
    inputSchema: z.object({}),
  },
  async () => textResponse(await listAllowedDrivesAndFolders()),
)

server.registerTool(
  'search_drive_metadata_files',
  {
    description: 'Search Google Drive/Shared Drives for NOAA metadata-relevant files using read-only OAuth and configured allowlists.',
    inputSchema: z.object({
      query: z.string().optional().describe('Optional search query. If omitted, metadata keyword defaults are used.'),
      mimeTypes: z.array(z.string()).optional().describe('Optional Drive MIME types to restrict results.'),
      maxResults: z.number().int().min(1).max(100).optional(),
    }),
  },
  async ({ query, mimeTypes, maxResults }) => {
    const files = await searchDriveMetadataFiles({ query, mimeTypes, maxResults })
    return textResponse(files.map(fileSummary))
  },
)

server.registerTool(
  'get_drive_file_metadata',
  {
    description: 'Fetch metadata for one Google Drive file by ID.',
    inputSchema: z.object({
      fileId: z.string().min(1),
    }),
  },
  async ({ fileId }) => textResponse(fileSummary(await getFileMetadata(fileId))),
)

server.registerTool(
  'extract_metadata_from_file',
  {
    description: 'Extract text from an allowed Google Drive file and summarize metadata signals. Works best for Docs, Sheets, XML, JSON, CSV, and text files.',
    inputSchema: z.object({
      fileId: z.string().min(1),
      maxBytes: z.number().int().min(1000).max(2000000).optional(),
    }),
  },
  async ({ fileId, maxBytes }) => {
    const extracted = await extractFileText(fileId, { maxBytes })
    return textResponse({
      file: fileSummary(extracted.metadata),
      truncated: extracted.truncated,
      bytesRead: extracted.bytesRead,
      summary: summarizeMetadataText(extracted.text),
    })
  },
)

server.registerTool(
  'download_allowed_file_text',
  {
    description: 'Download text/exported text from an allowed file into a local output directory for later review.',
    inputSchema: z.object({
      fileId: z.string().min(1),
      outputDir: z.string().optional(),
    }),
  },
  async ({ fileId, outputDir }) => textResponse(await downloadAllowedFile(fileId, outputDir)),
)

server.registerTool(
  'summarize_cruisepack_candidates',
  {
    description: 'Search for cruise pack / OER / UxS candidate files and summarize the strongest metadata-looking results.',
    inputSchema: z.object({
      query: z.string().optional(),
      maxResults: z.number().int().min(1).max(50).optional(),
    }),
  },
  async ({ query, maxResults }) => {
    const files = await searchDriveMetadataFiles({
      query: query || 'cruise pack OER NCEI metadata UxS',
      maxResults,
    })
    return textResponse(files.map(fileSummary).filter((file) => file.metadataCandidate || file.extractableText))
  },
)

server.registerTool(
  'browser_test_plan_for_catalog_page',
  {
    description: 'Generate a browser automation checklist for testing Manta embedded metadata UI on a catalog/CoMET-like page.',
    inputSchema: z.object({
      url: z.string().url(),
      focus: z.enum(['manta-widget', 'scanner', 'readiness', 'comet', 'full-flow']).optional(),
    }),
  },
  async ({ url, focus = 'full-flow' }) => textResponse({
    url,
    focus,
    steps: [
      'Open the page with Browser MCP/browser automation.',
      'Confirm the Manta widget or embedded panel is visible.',
      'Run a validation/readiness check and capture visible errors/warnings.',
      'Open scanner/Lens if available and verify accept/reject suggestions.',
      'Confirm readiness labels distinguish local editor checks from external preflight.',
      'If CoMET is available, run preflight and record PASS/WARN/BLOCK details.',
    ],
  }),
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('NOAA Metadata MCP running on stdio')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exit(1)
})
