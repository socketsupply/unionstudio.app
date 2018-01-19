const EventEmitter = require('events').EventEmitter
window.events = new EventEmitter()

function ready () {
  require('editor')
  require('menu')
}

document.addEventListener('DOMContentLoaded', ready)
