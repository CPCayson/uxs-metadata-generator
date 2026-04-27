/* global chrome */

const DEFAULT_PILOT = 'http://127.0.0.1:5173'

const $ = (id) => {
  const el = document.getElementById(id)
  if (!el) throw new Error(`Missing #${id}`)
  return el
}

function setStatus(msg, isErr) {
  const s = $('status')
  s.textContent = msg
  s.className = isErr ? 'status err' : 'status'
}

function normalizeUrl(raw) {
  const t = String(raw ?? '').trim()
  if (!t) return DEFAULT_PILOT
  try {
    const u = new URL(t)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.origin + u.pathname.replace(/\/$/, '') || u.origin
  } catch {
    return null
  }
}

async function load() {
  const { pilotBaseUrl, showFab } = await chrome.storage.sync.get({
    pilotBaseUrl: DEFAULT_PILOT,
    showFab: true,
  })
  $('pilotBaseUrl').value = pilotBaseUrl || DEFAULT_PILOT
  $('showFab').checked = showFab !== false
}

function save() {
  const n = normalizeUrl($('pilotBaseUrl').value)
  if (!n) {
    setStatus('Enter a valid http(s) URL.', true)
    return
  }
  void chrome.storage.sync.set(
    { pilotBaseUrl: n, showFab: $('showFab').checked },
    () => {
      setStatus('Saved.')
    },
  )
}

function openPilot() {
  const n = normalizeUrl($('pilotBaseUrl').value) || DEFAULT_PILOT
  void chrome.runtime.sendMessage({ type: 'manta-open-pilot', url: n }, (res) => {
    if (res?.ok) setStatus('Opened tab.')
    else if (res?.error) setStatus(String(res.error), true)
  })
}

function sendCaptureToPilot(capture) {
  const n = normalizeUrl($('pilotBaseUrl').value) || DEFAULT_PILOT
  void chrome.runtime.sendMessage({ type: 'manta-capture-open-pilot', url: n, capture }, (res) => {
    if (chrome.runtime.lastError) {
      setStatus(chrome.runtime.lastError.message || 'Could not contact the extension service worker.', true)
      return
    }
    if (res?.ok) setStatus(`Sent ${String(capture.text || '').length} characters to Manta.`)
    else if (res?.error) setStatus(String(res.error), true)
    else setStatus('No response from extension service worker.', true)
  })
}

function activeTabScript(func, args = []) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0]
      if (!tab?.id) {
        reject(new Error('No active tab.'))
        return
      }
      chrome.scripting.executeScript({ target: { tabId: tab.id }, func, args }, (results) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || 'Script failed (try a normal page).'))
          return
        }
        resolve((results && results[0] && results[0].result) || null)
      })
    })
  })
}

function pageCapturePayload(kind) {
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
  const text =
    kind === 'selection' ? selectedText :
    kind === 'xml' ? (xmlish || selectedText || preText || sourceText) :
    (selectedText || bodyText)
  return {
    kind,
    text: String(text || '').slice(0, 750000),
    title: document.title || '',
    url: location.href,
    contentType: document.contentType || '',
  }
}

async function captureFromTab(kind) {
  setStatus(`Capturing ${kind}…`)
  try {
    const capture = await activeTabScript(pageCapturePayload, [kind])
    if (!capture?.text?.trim()) {
      setStatus(`No ${kind} text found in that tab.`, true)
      return
    }
    sendCaptureToPilot({ ...capture, source: 'manta-chrome-extension' })
  } catch (e) {
    setStatus(e instanceof Error ? e.message : String(e), true)
  }
}

function copySelection() {
  setStatus('Reading selection…')
  void chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0]
    if (!tab?.id) {
      setStatus('No active tab.', true)
      return
    }
    void chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        func: () => {
          const s = window.getSelection && window.getSelection()
          return s ? s.toString() : ''
        },
      },
      (results) => {
        if (chrome.runtime.lastError) {
          setStatus(chrome.runtime.lastError.message || 'Script failed (try a normal page).', true)
          return
        }
        const text = (results && results[0] && results[0].result) || ''
        if (!String(text).trim()) {
          setStatus('No text selected in that tab.', true)
          return
        }
        void navigator.clipboard.writeText(String(text))
        setStatus(`Copied ${String(text).length} characters.`)
      },
    )
  })
}

function captureFile(file) {
  if (!file) return
  setStatus(`Reading ${file.name}…`)
  const reader = new FileReader()
  reader.onload = () => {
    const text = typeof reader.result === 'string' ? reader.result : ''
    if (!text.trim()) {
      setStatus('That file did not produce text.', true)
      return
    }
    sendCaptureToPilot({
      kind: 'file',
      source: 'manta-chrome-extension',
      title: file.name,
      url: '',
      contentType: file.type || '',
      text: text.slice(0, 750000),
    })
  }
  reader.onerror = () => setStatus('Could not read that file.', true)
  reader.readAsText(file, 'UTF-8')
}

document.addEventListener('DOMContentLoaded', () => {
  void load()
  $('save').addEventListener('click', save)
  $('openPilot').addEventListener('click', openPilot)
  $('captureSelection').addEventListener('click', () => void captureFromTab('selection'))
  $('capturePage').addEventListener('click', () => void captureFromTab('page'))
  $('captureXml').addEventListener('click', () => void captureFromTab('xml'))
  $('copySelection').addEventListener('click', copySelection)
  $('fileInput').addEventListener('change', (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    captureFile(file)
  })
  const drop = $('dropZone')
  drop.addEventListener('dragover', (e) => {
    e.preventDefault()
    drop.classList.add('drop--active')
  })
  drop.addEventListener('dragleave', () => drop.classList.remove('drop--active'))
  drop.addEventListener('drop', (e) => {
    e.preventDefault()
    drop.classList.remove('drop--active')
    captureFile(e.dataTransfer?.files?.[0])
  })
})
