/**
 * Quick-action chips for a validation issue in the Manta lens tray.
 *
 * Returns 2–5 chips per issue:
 *   help   — "Why?" explains the issue
 *   fill   — field-specific quick-fill value (fires manta:set-pilot-field)
 *   action — "Safe defaults" runs whole-record auto-fix
 *
 * @param {{ field?: string, message: string, severity: string }} issue
 * @param {object} [pilotState]
 * @returns {Array<{
 *   id: string,
 *   kind: 'action' | 'help' | 'fill',
 *   label: string,
 *   action?: string,
 *   fieldPath?: string,
 *   value?: unknown,
 *   helpText?: string,
 * }>}
 */
export function getLensChipsForIssue(issue, pilotState) {
  if (!issue) return []
  const field   = issue.field || ''
  const message = issue.message || ''
  const idBase  = `${field}:${message.slice(0, 32)}`
  const chips   = []

  // ── Why? chip (always first) ─────────────────────────────────────────────
  chips.push({
    id:       `${idBase}:hint`,
    kind:     'help',
    label:    'Why?',
    helpText: message + (field ? `\n\nPath: ${field}` : ''),
  })

  // ── Field-specific fill chips ─────────────────────────────────────────────
  const ms  = pilotState?.mission   ?? {}
  const sp  = pilotState?.spatial   ?? {}
  const pl  = pilotState?.platform  ?? {}
  const dis = pilotState?.distribution ?? {}

  // Language
  if (field === 'mission.language' || message.toLowerCase().includes('language')) {
    chips.push({ id: `${idBase}:fill-lang`, kind: 'fill', label: 'Set eng', fieldPath: 'mission.language', value: 'eng' })
  }

  // Character set
  if (field === 'mission.characterSet' || message.toLowerCase().includes('character set')) {
    chips.push({ id: `${idBase}:fill-cs`, kind: 'fill', label: 'Set utf8', fieldPath: 'mission.characterSet', value: 'utf8' })
  }

  // Status
  if (field === 'mission.status' || message.toLowerCase().includes('status')) {
    chips.push({ id: `${idBase}:fill-status`, kind: 'fill', label: 'Set completed', fieldPath: 'mission.status', value: 'completed' })
  }

  // Scope code
  if (field === 'mission.scopeCode' || message.toLowerCase().includes('scope')) {
    chips.push({ id: `${idBase}:fill-scope`, kind: 'fill', label: 'Set dataset', fieldPath: 'mission.scopeCode', value: 'dataset' })
  }

  // Bounding box — flag whole-world defaults
  if (field.startsWith('spatial.') && (message.toLowerCase().includes('bounding') || message.toLowerCase().includes('bbox') || message.toLowerCase().includes('extent'))) {
    const isGlobal = sp.westLon === -180 && sp.eastLon === 180 && sp.southLat === -90 && sp.northLat === 90
    if (isGlobal) {
      chips.push({
        id: `${idBase}:fill-bbox-warn`,
        kind: 'help',
        label: 'Global bbox',
        helpText: 'Bounding box is set to global defaults (-180/180/-90/90). Replace with the actual survey area before catalog submission.',
      })
    }
  }

  // Platform type
  if (field === 'platform.platformType' || (field.startsWith('platform.') && message.toLowerCase().includes('platform'))) {
    if (!pl.platformType) {
      chips.push({ id: `${idBase}:fill-plt-auv`, kind: 'fill', label: 'Set AUV', fieldPath: 'platform.platformType', value: 'AUV' })
      chips.push({ id: `${idBase}:fill-plt-uuv`, kind: 'fill', label: 'Set UUV', fieldPath: 'platform.platformType', value: 'UUV' })
    }
  }

  // Distribution format
  if (field.startsWith('distribution.') && message.toLowerCase().includes('format')) {
    if (!dis.format) {
      chips.push({ id: `${idBase}:fill-fmt-nc`, kind: 'fill', label: 'Set NetCDF', fieldPath: 'distribution.format', value: 'NetCDF' })
    }
  }

  // Abstract too short — can't fill content, but offer guidance
  if (field === 'mission.abstract' && (message.toLowerCase().includes('short') || message.toLowerCase().includes('length') || message.toLowerCase().includes('character'))) {
    const len = String(ms.abstract || '').length
    chips.push({
      id: `${idBase}:abstract-len`,
      kind: 'help',
      label: `${len} chars`,
      helpText: `Current abstract is ${len} characters. Include: platform type, instruments, survey area, dates, and data products. Aim for 150+ characters for catalog compliance.`,
    })
  }

  // File identifier missing gov.noaa prefix
  if (field === 'mission.fileId' && message.toLowerCase().includes('identifier')) {
    const cur = String(ms.fileId || '').trim()
    if (cur && !cur.startsWith('gov.noaa')) {
      chips.push({
        id: `${idBase}:fill-fileid-prefix`,
        kind: 'fill',
        label: 'Add NCEI prefix',
        fieldPath: 'mission.fileId',
        value: `gov.noaa.ncei.uxs:${cur}`,
      })
    }
  }

  // Missing keyword UUID (KMS)
  if (field.startsWith('keywords.') && field.endsWith('.uuid') && message.toLowerCase().includes('kms')) {
    chips.push({
      id: `${idBase}:action-resolve-kms`,
      kind: 'action',
      action: 'resolve-kms',
      label: '✨ Resolve KMS',
    })
  }

  // ── Safe defaults (always last) ──────────────────────────────────────────
  chips.push({
    id:        `${idBase}:autofix`,
    kind:      'action',
    action:    'autofix',
    label:     'Safe defaults',
    secondary: true,
  })

  return chips
}
