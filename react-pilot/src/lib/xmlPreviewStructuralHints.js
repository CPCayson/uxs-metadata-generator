/**
 * Lightweight checks on generated preview XML — surfaces schema / tooling issues early.
 *
 * @param {string} xml
 * @returns {{ messages: string[], hasSchemaLocation: boolean }}
 */
export function analyzeMissionPreviewXml(xml) {
  const s = String(xml || '')
  const head = s.slice(0, 4000)
  const messages = []

  const hasSchemaLocation = /\bxsi:schemaLocation\s*=/.test(head)
  if (!hasSchemaLocation) {
    messages.push(
      'No xsi:schemaLocation on the root element — many desktop validators require it; adding the GMI schema URL often removes hundreds of “cannot resolve” errors.',
    )
  } else if (/xsi:schemaLocation\s*=\s*"[^"]*https:\/\/data\.noaa\.gov\/resources\/iso19139\/schema\.xsd/.test(head)) {
    messages.push(
      'schemaLocation points at data.noaa.gov iso19139 — some offline validators still fail; try the OGC gmi.xsd URL from the preview header comment or use an online schema-aware validator.',
    )
  }

  return { messages, hasSchemaLocation }
}
