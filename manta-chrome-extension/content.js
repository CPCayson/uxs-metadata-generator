/* global chrome */

const ID = 'manta-pilot-fab-host'
const PENDING_CAPTURE_KEY = 'mantaPendingCapture'
const DEFAULT_PILOT = 'http://127.0.0.1:5173'

function readOpts(cb) {
  try {
    chrome.storage.sync.get(['pilotBaseUrl', 'showFab'], (r) => {
      const showFab = r.showFab !== false
      const base =
        typeof r.pilotBaseUrl === 'string' && r.pilotBaseUrl.trim()
          ? r.pilotBaseUrl.trim().replace(/\/$/, '')
          : DEFAULT_PILOT
      cb({ showFab, base })
    })
  } catch {
    cb({ showFab: true, base: DEFAULT_PILOT })
  }
}

function pageCapturePayload(kind = 'page') {
  const selection = window.getSelection && window.getSelection()
  const selectedText = selection ? selection.toString() : ''
  const bodyText = document.body?.innerText || document.documentElement?.innerText || ''
  const sourceText = document.documentElement?.outerHTML || ''
  const preText = [...document.querySelectorAll('pre, code, textarea')]
    .map((el) => el.innerText || el.value || '')
    .filter(Boolean)
    .join('\n\n')
  const xmlish =
    preText.match(/<\?xml|<gmd:|<gmi:|<MD_Metadata|<MI_Metadata/i)?.input ||
    sourceText.match(/<\?xml|<gmd:|<gmi:|<MD_Metadata|<MI_Metadata/i)?.input ||
    ''
  const text = xmlish || selectedText || bodyText || sourceText
  return {
    kind,
    source: 'manta-chrome-extension',
    text: String(text || '').slice(0, 750000),
    title: document.title || '',
    url: location.href,
    contentType: document.contentType || '',
  }
}

function removeFab() {
  const el = document.getElementById(ID)
  if (el) el.remove()
}

function mountFab(base) {
  removeFab()
  const host = document.createElement('div')
  host.id = ID
  host.setAttribute('data-manta-extension', '1')

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'manta-ext-fab'
  btn.setAttribute('aria-label', 'Capture this page into Manta')
  btn.title = `Capture page into Manta — ${base}`
  const ring = document.createElement('span')
  ring.className = 'manta-ext-fab__ring'
  const core = document.createElement('span')
  core.className = 'manta-ext-fab__core'
  core.textContent = 'M'
  btn.appendChild(ring)
  btn.appendChild(core)
  host.appendChild(btn)
  ;(document.body || document.documentElement).appendChild(host)

  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    e.preventDefault()
    const capture = pageCapturePayload('page')
    chrome.runtime.sendMessage({ type: 'manta-capture-open-pilot', url: base, capture })
  })
}

function isPilotPage(base) {
  try {
    const u = new URL(base)
    return window.location.origin === u.origin
  } catch {
    return false
  }
}

function dispatchCapture(capture) {
  if (!capture || typeof capture !== 'object') return
  window.dispatchEvent(new CustomEvent('manta:extension-capture', { detail: capture }))
  window.postMessage(
    {
      source: 'manta-chrome-extension',
      type: 'manta-extension-capture',
      capture,
    },
    window.location.origin,
  )
}

function deliverPendingCapture(base) {
  if (!isPilotPage(base)) return
  try {
    chrome.storage.local.get(PENDING_CAPTURE_KEY, (res) => {
      const capture = res?.[PENDING_CAPTURE_KEY]
      if (!capture) return
      ;[0, 400, 1200, 2500, 4500].forEach((delay, idx, arr) => {
        setTimeout(() => {
          dispatchCapture(capture)
          if (idx === arr.length - 1) chrome.storage.local.remove(PENDING_CAPTURE_KEY)
        }, delay)
      })
    })
  } catch {
    /* ignore */
  }
}

function sync() {
  readOpts(({ showFab, base }) => {
    deliverPendingCapture(base)
    if (!showFab) {
      removeFab()
      return
    }
    if (window.self !== window.top) return
    if (!document.body) return
    if (document.getElementById(ID)) {
      const b = document.querySelector(`#${ID} .manta-ext-fab`)
      if (b) b.title = `Capture page into Manta — ${base}`
      return
    }
    mountFab(base)
  })
}

if (window.self === window.top) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sync, { once: true })
  } else {
    sync()
  }
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && (changes.pilotBaseUrl || changes.showFab)) sync()
      if (area === 'local' && changes[PENDING_CAPTURE_KEY]) {
        readOpts(({ base }) => deliverPendingCapture(base))
      }
    })
  } catch {
    /* ignore */
  }
}
