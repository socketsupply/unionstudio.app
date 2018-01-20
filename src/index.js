const events = require('events')
const { remote } = require('electron')

window.events = new events.EventEmitter()

window.onbeforeunload = function (e) {
  if (!remote.getGlobal('quitting')) return false
}

function ready () {
  require('editor')
  require('menu')
}

document.addEventListener('DOMContentLoaded', ready)
