const { contextBridge, ipcRenderer } = require('electron')

function deliverCapture(capture) {
  if (!capture || typeof capture !== 'object') return
  window.postMessage(
    {
      source: 'manta-desktop',
      type: 'manta-extension-capture',
      capture,
    },
    window.location.origin,
  )
}

contextBridge.exposeInMainWorld('mantaDesktop', {
  isDesktop: true,
  getInfo: () => ipcRenderer.invoke('manta:desktop-info'),
  onCapture: (callback) => {
    if (typeof callback !== 'function') return () => {}
    const handler = (_event, capture) => callback(capture)
    ipcRenderer.on('manta:desktop-capture', handler)
    return () => ipcRenderer.removeListener('manta:desktop-capture', handler)
  },
})

ipcRenderer.on('manta:desktop-capture', (_event, capture) => {
  deliverCapture(capture)
})
