/**
 * Map tutorial sample text to a fill-in pilot state for mission XML preview.
 * Rules + regexes only (no AI). See {@link pilotStateWithReportFromTutorialSample}.
 *
 * @module lib/tutorialSampleToPilotState
 */

import { defaultPilotState } from './pilotValidation.js'
import { missionProfile } from '../profiles/mission/missionProfile.js'

const DEFAULTS = {
  title:     'Tutorial sample dataset',
  abstract:  'Generated from the tutorial email or document sample for preview only.',
  fileId:    'TUTORIAL_FILE_ID_001',
  startDate: '2024-05-05T15:10',
  endDate:   '2024-05-06T12:00',
  west:  '-120.4',
  east:  '-120.0',
  south: '36.2',
  north: '36.4',
  email:  'jane.researcher@noaa.gov',
  doi:    '10.7289/V5EXAMPLE01',
  landing: 'https://example.org/dataset/leg18-eagleray',
  format:  'NetCDF-4',
  license: 'CC-BY-4.0',
}

/**
 * @param {string} raw
 * @returns {string}
 */
function stripEmailThreadNoise(raw) {
  return String(raw)
    .replace(/\r\n/g, '\n')
    .replace(/^On .+wrote:.*$/gim, '')
    .replace(/^>.*$/gm, '')
    .replace(/^-----\s*Original Message\s*-----[\s\S]*$/gim, '')
    .trim()
}

/**
 * @param {string} t
 * @returns {Map<string, string>}
 */
function labeledMap(t) {
  const m = new Map()
  for (const line of t.split('\n')) {
    const lv = line.match(
      /^\s*(?:[0-9]+[.)、]|\*|-|•)?\s*([^:：]{2,48})\s*[:：]\s*(.+)$/,
    )
    if (lv) m.set(lv[1].replace(/\s+/g, ' ').trim().toLowerCase(), lv[2].trim())
  }
  return m
}

/**
 * @typedef {{ field: string, detail: string }} TutorialExtractionItem
 * @typedef {{
 *   fromText: TutorialExtractionItem[],
 *   defaulted: string[],
 *   tips: string[],
 * }} TutorialExtractionReport
 */

/**
 * @param {Record<string, string | null | undefined>} picked
 * @param {string[]} defaultedKeys
 * @param {string[]} [tips]
 * @returns {TutorialExtractionReport}
 */
function makeReport(picked, defaultedKeys, tips = []) {
  const fromText = /** @type {TutorialExtractionItem[]} */ ([])
  for (const [k, v] of Object.entries(picked)) {
    if (v != null && String(v).trim() !== '') {
      fromText.push({ field: k, detail: String(v).length > 120 ? `${String(v).slice(0, 120)}…` : String(v) })
    }
  }
  return { fromText, defaulted: [...defaultedKeys], tips: [...tips] }
}

/**
 * @param {'email' | 'document'} kind
 * @param {string} text
 * @returns {{ state: object, report: TutorialExtractionReport }}
 */
export function pilotStateWithReportFromTutorialSample(kind, text) {
  const base = defaultPilotState()
  const tRaw = String(text ?? '')
  const t    = kind === 'email' ? stripEmailThreadNoise(tRaw) : tRaw
  const lab  = labeledMap(t)
  const tips = /** @type {string[]} */ ([])

  /** @type {Record<string, string | null>} */
  const p = {
    'mission.fileId':     null,
    'mission.title':      null,
    'mission.abstract':   null,
    'mission.startDate':  null,
    'mission.endDate':     null,
    'mission.west':        null,
    'mission.east':        null,
    'mission.south':       null,
    'mission.north':      null,
    'mission.email':      null,
    'mission.doi':        null,
    'distribution.landingUrl': null,
    'distribution.format':     null,
    'distribution.license':   null,
  }
  const setv = (k, v) => { if (v && String(v).trim()) p[k] = v.trim() }

  if (kind === 'email') {
    const bodyTitle = t.match(/Title:\s*([^\n]+)/i)
    if (bodyTitle) setv('mission.title', bodyTitle[1])
    if (!p['mission.title']) {
      const subj = t.match(/Subject:\s*(?:\[[^\]]+\]\s*)?([^\n]+)/i)
      if (subj) {
        setv('mission.title', subj[1].replace(/^\[EXT\]\s*/i, '').trim())
        tips.push('No inline “Title:” line — used the email Subject.')
      }
    }
    const ab = t.match(
      /Abstract[^:]*:\s*([\s\S]+?)(?=\n-|\n[A-Z0-9][^:\n]{0,30}:\s*|\n—|\nBest|\n$)/i,
    )
    if (ab) setv('mission.abstract', ab[1].replace(/\s*\n+\s*/g, ' ').trim())

    const fromE = t.match(/From:\s*[^<\n]*<([a-z0-9._%+-]+@[^>\s]+)>/i) || t.match(/From:\s*([a-z0-9._%+-]+@[a-z0-9.-]+)/i)
    if (fromE) setv('mission.email', fromE[1].toLowerCase())
    const cont = t.match(/Primary contact:\s*([a-z0-9._%+-]+@[a-z0-9.-]+)/i)
    if (cont) setv('mission.email', cont[1].toLowerCase())

    const fid = t.match(/file\s*ID:\s*([A-Z0-9_]+)/i) || t.match(/Collection file ID:\s*([A-Z0-9_]+)/i)
    if (fid) setv('mission.fileId', fid[1])
    const dr = t.match(/Time window:\s*([0-9T:.-]+Z?)\s+to\s+([0-9T:.-]+Z?)/i)
    if (dr) {
      setv('mission.startDate', dr[1].replace(/Z$/, ''))
      setv('mission.endDate',   dr[2].replace(/Z$/, ''))
    }
    const doiM = t.match(/(?:DOI[:\s(]*)?(10\.\d{4,9}\/[^\s),.;]+)/i)
    if (doiM) setv('mission.doi', doiM[1])
    if (!p['mission.doi']) {
      const anyDoi = t.match(/(10\.\d{4,9}\/[^\s),.;\]]+)/i)
      if (anyDoi) setv('mission.doi', anyDoi[1].replace(/[),.;]+$/, ''))
    }
    const url = t.match(/https?:\/\/[^\s)<>"]+/i)
    if (url) setv('distribution.landingUrl', url[0].replace(/[),.;]+$/, ''))
    const bbox = t.match(
      /W\/E\/S\/N:\s*(-?[0-9.]+)\s*\/\s*(-?[0-9.]+)\s*\/\s*(-?[0-9.]+)\s*\/\s*(-?[0-9.]+)/i,
    ) || t.match(
      /West\s*(-?[0-9.]+).{0,12}East\s*(-?[0-9.]+).{0,12}South\s*(-?[0-9.]+).{0,12}North\s*(-?[0-9.]+)/i,
    )
    if (bbox) {
      setv('mission.west', bbox[1])
      setv('mission.east', bbox[2])
      setv('mission.south', bbox[3])
      setv('mission.north', bbox[4])
    }
    if (tRaw.length - t.length > 30) {
      tips.push('Stripped common quoted-reply / “On … wrote” noise before parsing.')
    }
  } else {
    const tm = t.match(
      /Time:\s*([0-9T:.-]+Z?)\s*[→\->-]\s*([0-9T:.-]+Z?)/i,
    ) || t.match(
      /([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:]{4,8}Z?)\s*→\s*([0-9T:.-]+Z?)/i,
    )
    if (tm) {
      setv('mission.startDate', tm[1].replace(/Z$/, ''))
      setv('mission.endDate',   tm[2].replace(/Z$/, ''))
    }
    const tLine = t.match(/Title:\s*([^\n]+)/i) || (lab.get('title') ? { 1: lab.get('title') } : null)
    if (tLine) setv('mission.title', tLine[1])
    if (lab.get('title') && !p['mission.title']) setv('mission.title', /** @type {string} */ (lab.get('title')))

    const ex = t.match(
      /West\s*(-?[0-9.]+)(?:,|\s)+East\s*(-?[0-9.]+)(?:,|\s)+South\s*(-?[0-9.]+)(?:,|\s)+North\s*(-?[0-9.]+)/i,
    )
    if (ex) {
      setv('mission.west', ex[1])
      setv('mission.east', ex[2])
      setv('mission.south', ex[3])
      setv('mission.north', ex[4])
    }
    const boxLine = lab.get('bounding box')
    if (boxLine) {
      const b = String(boxLine).match(
        /West\s*(-?[0-9.]+).{0,6}East\s*(-?[0-9.]+).{0,6}South\s*(-?[0-9.]+).{0,6}North\s*(-?[0-9.]+)/i,
      )
      if (b) {
        setv('mission.west', b[1])
        setv('mission.east', b[2])
        setv('mission.south', b[3])
        setv('mission.north', b[4])
      }
    }
    const tid = t.match(/granule id:\s*([A-Z0-9_]+)/i) || t.match(/File\s*\/\s*granule id:\s*([A-Z0-9_]+)/i) || t.match(/id:\s*([A-Z0-9_]+)/i)
    if (tid) setv('mission.fileId', tid[1])
    if (t.match(/CC-BY-4\.0/i)) setv('distribution.license', 'CC-BY-4.0')
    if (t.match(/NetCDF/i))    setv('distribution.format', 'NetCDF-4')
  }

  for (const [k, v] of lab) {
    if (k.includes('format') && v)         setv('distribution.format', v)
    if ((k.includes('license') || k.includes('use/')) && v) setv('distribution.license', v)
  }

  const merged = {
    fileId:     p['mission.fileId']     || DEFAULTS.fileId,
    title:      p['mission.title']     || DEFAULTS.title,
    abstract:   p['mission.abstract']  || DEFAULTS.abstract,
    startDate:  p['mission.startDate']  || DEFAULTS.startDate,
    endDate:    p['mission.endDate']  || DEFAULTS.endDate,
    west:       p['mission.west']  ?? DEFAULTS.west,
    east:       p['mission.east']  ?? DEFAULTS.east,
    south:      p['mission.south'] ?? DEFAULTS.south,
    north:      p['mission.north'] ?? DEFAULTS.north,
    email:      p['mission.email']  || DEFAULTS.email,
    doi:        p['mission.doi']    || DEFAULTS.doi,
    landing:    p['distribution.landingUrl'] || DEFAULTS.landing,
    format:     p['distribution.format']  || DEFAULTS.format,
    license:    p['distribution.license']  || DEFAULTS.license,
  }

  const defKeys = []
  for (const key of [
    'mission.fileId', 'mission.title', 'mission.abstract', 'mission.startDate', 'mission.endDate',
    'mission.west', 'mission.east', 'mission.south', 'mission.north', 'mission.email', 'mission.doi',
    'distribution.landingUrl', 'distribution.format', 'distribution.license',
  ]) {
    if (p[key] == null || String(p[key]).trim() === '') defKeys.push(key)
  }

  if (fromTextCount(p) === 0) {
    tips.push('No field patterns found — all core keys use the built-in template. Add lines like "Title: …" or a W/E/S/N line.')
  } else {
    if (!p['mission.abstract'] && merged.abstract === DEFAULTS.abstract) {
      tips.push('Add a 2–3 sentence "Abstract: …" block for a realistic ISO record.')
    }
  }

  const rep = makeReport(p, defKeys, tips)

  const state = missionProfile.sanitize(
    buildMerge(base, merged),
  )

  return { state, report: rep }
}

/**
 * @param {Record<string, string | null>} p
 * @returns {number}
 */
function fromTextCount(p) {
  return Object.values(p).filter((v) => v != null && String(v).trim() !== '').length
}

/**
 * @param {'email' | 'document'} kind
 * @param {string} text
 * @returns {object}
 */
export function pilotStateFromTutorialSample(kind, text) {
  return pilotStateWithReportFromTutorialSample(kind, text).state
}

/**
 * @param {object} base
 * @param {object} p
 */
function buildMerge(base, p) {
  return {
    ...base,
    mission: {
      ...base.mission,
      fileId:     p.fileId,
      title:      p.title,
      abstract:   p.abstract,
      startDate:  p.startDate,
      endDate:    p.endDate,
      west:       p.west,
      east:       p.east,
      south:      p.south,
      north:      p.north,
      individualName: 'Jane Researcher',
      org:   'NOAA (tutorial)',
      email: p.email,
      doi:   p.doi,
    },
    distribution: {
      ...base.distribution,
      format:     p.format,
      license:    p.license,
      landingUrl: p.landing,
    },
  }
}
