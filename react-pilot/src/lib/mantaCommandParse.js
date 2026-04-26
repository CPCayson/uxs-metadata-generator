/**
 * Best-effort parse of Manta bar / voice text into structured commands.
 * Used for testing and (future) voice control.
 *
 * @param {string} raw
 * @returns {Array<
 *   | { type: 'simple', on: boolean }
 *   | { type: 'lens', open: boolean }
 *   | { type: 'step', id: string }
 *   | { type: 'map', action: string }
 * >}
 */
export function parseMantaCommands(raw) {
  const t = String(raw || '').toLowerCase()
  const out = []

  if (t.includes('make it simple') || /\bsimple mode\b/.test(t)) {
    out.push({ type: 'simple', on: true })
  } else if (t.includes('make it full') || t.includes('not simple')) {
    out.push({ type: 'simple', on: false })
  }

  if (
    t.includes('open lens')
    || t.includes('lens mode')
    || t.includes('scanner')
    || t.includes('check the forms')
  ) {
    out.push({ type: 'lens', open: true })
  }
  if (t.includes('close lens') || t.includes('exit lens')) {
    out.push({ type: 'lens', open: false })
  }

  const stepIds = [
    'mission', 'platform', 'sensors', 'spatial', 'keywords', 'distribution',
  ]
  for (const id of stepIds) {
    if (t.includes(`go to ${id}`) || t.includes(`to ${id} step`)) {
      out.push({ type: 'step', id })
      break
    }
  }
  if (!out.some((c) => c.type === 'step') && t.includes('spatial')) {
    out.push({ type: 'step', id: 'spatial' })
  }

  if (t.includes('zoom in') || t.includes('zoom in on the map')) {
    out.push({ type: 'map', action: 'zoomIn' })
  }
  if (t.includes('zoom out')) {
    out.push({ type: 'map', action: 'zoomOut' })
  }

  return out
}
