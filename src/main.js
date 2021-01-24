'use strict'

const path = require('path')
const electron = require('electron')
const createMenu = require('./menu')

const {
  app,
  BrowserWindow,
  ipcMain: ipc
} = electron

let mainWindow = null

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.commandLine.appendSwitch('js-flags', '--harmony')

if (process.argv[1]) {
  const cwd = path.join(process.argv[1], 'node_modules')
  global.cwd = path.resolve(cwd)
}

app.on('before-quit', () => {
  global.quitting = true
})

function ready () {
  const display = electron.screen.getPrimaryDisplay()

  let width = Math.floor(display.workAreaSize.width * 0.7)
  let height = Math.floor(display.workAreaSize.height * 0.9)

  //
  // Don't make the window bigger than 1440x900 on massive screens
  //
  if (width > 1440) width = 1440
  if (height > 900) height = 900

  const iconfiletype = process.platform === 'win32' ? 'ico' : 'png'
  const icon = path.resolve(__dirname, `../static/icon.${iconfiletype}`)

  const windowOptions = {
    width,
    height,
    icon,
    minWidth: 400,
    minHeight: 250,
    textAreasAreResizable: false,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    }
  }

  mainWindow = new BrowserWindow(windowOptions)
  const loc = `file://${path.join(__dirname, '..', 'static', 'index.html')}`
  mainWindow.loadURL(loc)

  let previewWindow = new BrowserWindow({
    icon,
    closable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  previewWindow.loadURL('data:text/html,')

  ipc.on('message', (_, arg, ...values) => {
    switch (arg) {
      case 'preview': {
        previewWindow.loadURL(values[0])
      }
    }
  })

  ipc.on('response', (_, ...values) => {
    mainWindow.send('message', 'response', ...values)
  })

  createMenu({}, (arg, ...values) => {
    switch (arg) {
      case 'inspect': {
        previewWindow.openDevTools()
        break
      }

      default:
        mainWindow.send('message', arg, ...values)
    }
  })

  mainWindow.on('closed', () => {
    previewWindow.destroy()
    previewWindow = null
    mainWindow = null
    app.quit()
  })
}

app.on('ready', ready)
