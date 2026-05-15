/**
 * Before merging ISO XML into an existing wizard session, optionally confirm when
 * the incoming record identifier differs from the current one.
 *
 * @module lib/pilotImportReplaceGuard
 */

import { importPilotPartialStateFromXml } from './xmlPilotImport.js'

/**
 * @param {string} xmlText
 * @returns {{ ok: true, fileId: string } | { ok: false }}
 */
export function peekIncomingMissionFileId(xmlText) {
  const raw = String(xmlText || '').trim()
  if (!raw) return { ok: false }
  const parsed = importPilotPartialStateFromXml(raw)
  if (!parsed.ok) return { ok: false }
  const id = String(parsed.partial?.mission?.fileId ?? '').trim()
  return { ok: true, fileId: id }
}

/** Prevents stacked `window.confirm` when extension/import fires twice in one turn. */
let replaceConfirmOpen = false

/**
 * @param {unknown} currentFileId
 * @param {unknown} incomingFileId
 * @returns {boolean} true when import should proceed
 */
export function confirmReplaceDifferentRecord(currentFileId, incomingFileId) {
  const cur = String(currentFileId ?? '').trim()
  const inc = String(incomingFileId ?? '').trim()
  if (!cur) return true
  if (cur === inc) return true
  if (replaceConfirmOpen) return false
  const curShort = cur.length > 48 ? `${cur.slice(0, 45)}…` : cur
  replaceConfirmOpen = true
  try {
    return window.confirm(
      `This will replace your current record (${curShort}). Continue?`,
    )
  } finally {
    replaceConfirmOpen = false
  }
}
