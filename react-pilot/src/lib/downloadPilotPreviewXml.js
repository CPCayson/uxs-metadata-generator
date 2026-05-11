/**
 * Download profile-built XML preview — same filename convention as XmlToolsBar.
 *
 * @param {import('../core/registry/types.js').EntityProfile} profile
 * @param {object} pilotState
 * @param {(msg: string) => void} [onStatus]
 * @returns {boolean} whether a download was started
 */
export function downloadPilotPreviewXml(profile, pilotState, onStatus) {
  if (typeof profile.buildXmlPreview !== 'function') return false
  const xml = profile.buildXmlPreview(pilotState) || ''
  const baseId = profile.getExportId?.(pilotState) ?? 'metadata'
  const id = String(baseId || 'metadata').replace(/[^\w.-]+/g, '_') || 'metadata'
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${id}-preview.xml`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  onStatus?.('Preview XML download started.')
  return true
}
