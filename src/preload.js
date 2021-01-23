const _setImmediate = setImmediate
const _clearImmediate = clearImmediate

const { ipcRenderer } = require('electron')

process.once('loaded', () => {
  global.setImmediate = _setImmediate
  global.clearImmediate = _clearImmediate
  global.ipc = ipcRenderer
  global.process = process
})
