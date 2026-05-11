import { buildPilotImportSampleReportMarkdown } from './pilotImportSampleReport.js'

/**
 * Download Markdown import sample report (unset paths, validation, XML line diff).
 *
 * @param {{
 *   profile: import('../core/registry/types.js').EntityProfile,
 *   pilotState: object,
 *   validationEngine: import('../core/validation/ValidationEngine.js').ValidationEngine,
 *   importContext: { rawXml: string, filename?: string, warnings?: string[] } | null,
 *   onStatus?: (msg: string) => void,
 * }} args
 * @returns {boolean}
 */
export function downloadPilotImportReport({
  profile,
  pilotState,
  validationEngine,
  importContext,
  onStatus,
}) {
  if (!importContext?.rawXml?.trim()) {
    onStatus?.('Import a sample XML first — nothing to compare.')
    return false
  }
  if (typeof profile.buildXmlPreview !== 'function') {
    onStatus?.('This profile has no XML preview builder.')
    return false
  }

  const previewXml = profile.buildXmlPreview(pilotState) || ''
  const mode = pilotState?.mode || 'lenient'
  const vr = validationEngine.run({
    profile,
    state: pilotState,
    mode,
  })

  const md = buildPilotImportSampleReportMarkdown({
    profileLabel: profile.label,
    profileId: profile.id,
    pilotState,
    previewXml,
    originalXml: importContext.rawXml,
    originalFilename: importContext.filename,
    importWarnings: importContext.warnings,
    validationIssues: vr.issues ?? [],
    validationScore: vr.score,
  })

  const baseId =
    typeof profile.getExportId === 'function'
      ? profile.getExportId(pilotState)
      : String(pilotState?.mission?.fileId || 'metadata')
  const id = String(baseId || 'metadata').replace(/[^\w.-]+/g, '_') || 'metadata'
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${id}-import-report.md`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  onStatus?.('Import report download started.')
  return true
}
