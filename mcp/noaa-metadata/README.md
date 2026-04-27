# NOAA Metadata MCP

Local MCP server for read-only NOAA/OER/UxS/BEDI metadata discovery in Google Drive and shared drives.

This server is intentionally scoped for authorized metadata work:

- Uses normal Google OAuth.
- Requests read-only Drive and Sheets scopes.
- Supports folder/shared-drive allowlists.
- Exposes metadata-focused search/extract tools.
- Does not try to impersonate users or bypass Google Workspace controls.

## Tools

- `list_allowed_sources`
- `search_drive_metadata_files`
- `get_drive_file_metadata`
- `extract_metadata_from_file`
- `download_allowed_file_text`
- `summarize_cruisepack_candidates`
- `browser_test_plan_for_catalog_page`

## Setup

1. Install dependencies:

```bash
npm --prefix mcp/noaa-metadata install
```

2. Create a Google OAuth client for a desktop/installed app or web app.

Required APIs/scopes:

- Google Drive API
- Google Sheets API
- `https://www.googleapis.com/auth/drive.readonly`
- `https://www.googleapis.com/auth/spreadsheets.readonly`

3. Save OAuth client JSON here:

```text
mcp/noaa-metadata/config/oauth-client.json
```

The file may use either Google’s `installed` or `web` shape.

4. Create an allowlist config:

```bash
cp mcp/noaa-metadata/config/allowlist.example.json mcp/noaa-metadata/config/allowlist.json
```

Add Google Drive folder IDs and/or shared drive IDs that you are allowed to search.

Safer default:

```json
{
  "mode": "allowlist",
  "allowedFolders": [{ "id": "FOLDER_ID", "label": "Metadata folder" }],
  "allowedSharedDrives": []
}
```

If you intentionally want to search all files your Google account can access, set:

```json
{ "mode": "allAccessible" }
```

5. Complete OAuth:

```bash
npm --prefix mcp/noaa-metadata run auth
```

Open the URL, approve read-only access, and paste the authorization code. The token is saved under:

```text
~/.config/noaa-metadata-mcp/google-token.json
```

## Cursor MCP Config

Add a local stdio MCP entry in Cursor pointing to:

```bash
node /Users/connorcayson/Downloads/uSX/mcp/noaa-metadata/src/server.js
```

Example MCP config shape:

```json
{
  "mcpServers": {
    "noaa-metadata": {
      "command": "node",
      "args": ["/Users/connorcayson/Downloads/uSX/mcp/noaa-metadata/src/server.js"]
    }
  }
}
```

## Recommended Workflow

1. Use `list_allowed_sources` to confirm the search scope.
2. Use `search_drive_metadata_files` or `summarize_cruisepack_candidates`.
3. Inspect file metadata before extracting.
4. Use `extract_metadata_from_file` for likely NOAA/OER/UxS/BEDI candidates.
5. Download text only when you need local review with `download_allowed_file_text`.
6. Use browser automation separately for live app/catalog UI testing.

## Notes

- Google Docs export as plain text.
- Google Sheets export as CSV.
- XML, JSON, CSV, and text files are downloaded as text.
- Binary PDFs may not extract useful text through this first scaffold; add a PDF parser later if needed.
- Output is capped by `maxExtractBytes` in `allowlist.json`.
