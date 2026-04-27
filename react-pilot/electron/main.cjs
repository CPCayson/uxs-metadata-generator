const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')

const isDev = Boolean(process.env.ELECTRON_START_URL)
const startUrl = process.env.ELECTRON_START_URL || ''

let mainWindow = null
let pendingCapture = null

function appRoot() {
  return app.getAppPath()
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    title: 'Manta Metadata Desktop',
    backgroundColor: '#020617',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingCapture) {
      mainWindow.webContents.send('manta:desktop-capture', pendingCapture)
      pendingCapture = null
    }
  })

  if (isDev) {
    mainWindow.loadURL(startUrl)
  } else {
    mainWindow.loadFile(path.join(appRoot(), 'dist', 'index.html'))
  }
}

async function openMetadataFile() {
  if (!mainWindow) return
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open metadata file',
    properties: ['openFile'],
    filters: [
      { name: 'Metadata files', extensions: ['xml', 'json', 'txt', 'csv'] },
      { name: 'All files', extensions: ['*'] },
    ],
  })
  if (result.canceled || !result.filePaths[0]) return

  const filePath = result.filePaths[0]
  const text = await fs.readFile(filePath, 'utf8')
  const capture = {
    kind: 'file',
    source: 'manta-desktop',
    title: path.basename(filePath),
    url: filePath,
    contentType: '',
    text: text.slice(0, 750000),
    capturedAt: new Date().toISOString(),
  }
  mainWindow.webContents.send('manta:desktop-capture', capture)
}

function installMenu() {
  const template = [
    ...(process.platform === 'darwin'
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        }]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Metadata File...',
          accelerator: 'CmdOrCtrl+O',
          click: () => void openMetadataFile(),
        },
        { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

ipcMain.handle('manta:desktop-info', () => ({
  platform: process.platform,
  version: app.getVersion(),
  isDesktop: true,
}))

app.whenReady().then(() => {
  installMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
