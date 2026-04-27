/* global chrome */

const DEFAULT_PILOT = 'http://127.0.0.1:5173'
const PENDING_CAPTURE_KEY = 'mantaPendingCapture'

async function pilotUrl() {
  const { pilotBaseUrl } = await chrome.storage.sync.get('pilotBaseUrl')
  const u = typeof pilotBaseUrl === 'string' && pilotBaseUrl.trim() ? pilotBaseUrl.trim() : DEFAULT_PILOT
  return u.replace(/\/$/, '')
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'manta-open-pilot') {
    void (async () => {
      try {
        const base = (msg.url && String(msg.url).trim()) || (await pilotUrl())
        await chrome.tabs.create({ url: base, active: true })
        sendResponse({ ok: true })
      } catch (e) {
        sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) })
      }
    })()
    return true
  }
  if (msg?.type === 'manta-capture-open-pilot') {
    void (async () => {
      try {
        const base = (msg.url && String(msg.url).trim()) || (await pilotUrl())
        const capture = {
          ...(msg.capture && typeof msg.capture === 'object' ? msg.capture : {}),
          capturedAt: new Date().toISOString(),
        }
        await chrome.storage.local.set({ [PENDING_CAPTURE_KEY]: capture })
        await chrome.tabs.create({ url: `${base}#manta-capture`, active: true })
        sendResponse({ ok: true })
      } catch (e) {
        sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) })
      }
    })()
    return true
  }
  return false
})

chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.sync.get('pilotBaseUrl', (r) => {
    if (r.pilotBaseUrl == null) {
      void chrome.storage.sync.set({ pilotBaseUrl: DEFAULT_PILOT, showFab: true })
    }
  })
})
