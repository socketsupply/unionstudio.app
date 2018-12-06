const events = require('events')
const { remote } = require('electron')

window.events = new events.EventEmitter()

window.onbeforeunload = function (e) {
  if (process.platform === 'win32') return
  if (!remote.getGlobal('quitting')) {
    const win = remote.getCurrentWindow()
    win.minimize()
    return false
  }
}

require('./menu')

function ready () {
  require('./splitter')
  require('./editor')
}

document.addEventListener('DOMContentLoaded', ready)
