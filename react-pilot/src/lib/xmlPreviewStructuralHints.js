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
  } else if (/schemas\.opengis\.net\/iso\/19115\/-2\/gmi\/1\.0\/gmi\.xsd/.test(head)) {
    messages.push(
      'schemaLocation uses the OGC gmi.xsd URL; NCEI UxS / collection template guidance uses https://data.noaa.gov/resources/iso19139/schema.xsd — align exports for NOAA downstream tooling.',
    )
  }

  return { messages, hasSchemaLocation }
}
