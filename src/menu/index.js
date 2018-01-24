const { app, Menu } = require('electron').remote

const setLabel = e => {
  window.localStorage.theme = e.label
  window.events.emit('editor:theme', e.label)
}

const template = [
  {
    label: 'Edit',
    submenu: [
      {role: 'undo'},
      {role: 'redo'},
      {type: 'separator'},
      {role: 'cut'},
      {role: 'copy'},
      {role: 'paste'},
      {role: 'pasteandmatchstyle'},
      {role: 'delete'},
      {role: 'selectall'}
    ]
  },
  {
    label: 'View',
    submenu: [
      {role: 'toggledevtools'},
      {type: 'separator'},
      {role: 'resetzoom'},
      {role: 'zoomin'},
      {role: 'zoomout'},
      {type: 'separator'},
      {role: 'togglefullscreen'}
    ]
  },
  {
    role: 'window',
    submenu: [
      {role: 'minimize'}
    ]
  },
  {
    label: 'Options',
    submenu: [
      {
        label: 'Document Window Show',
        type: 'checkbox',
        checked: JSON.parse(window.localStorage.sandbox || false),
        click: () => {
          window.events.emit('sandbox:toggle')
        }
      },
      {
        label: 'Document Window On Top',
        type: 'checkbox',
        checked: JSON.parse(window.localStorage.sanboxOnTop || false),
        click: () => {
          window.events.emit('sandbox:ontop')
        }
      },
      {type: 'separator'},
      {
        label: 'Hide output panel',
        type: 'checkbox',
        checked: JSON.parse(window.localStorage.hideOutput || false),
        click: () => {
          window.events.emit('output:toggle')
        }
      },
      {
        label: 'Line Numbers',
        type: 'checkbox',
        checked: JSON.parse(window.localStorage.lineNumbers || false),
        click: () => {
          window.events.emit('editor:linenumbers')
        }
      },
      {
        label: 'Try Matching Lines',
        type: 'checkbox',
        checked: JSON.parse(window.localStorage.matchingLines || false),
        click: () => {
          window.events.emit('matchinglines')
        }
      },
      {type: 'separator'},
      {
        label: 'Set Working Directory',
        click: () => {
          window.events.emit('cwd')
        }
      }
    ]
  },
  {
    label: 'Theme',
    submenu: [
      { label: 'Light', click: setLabel },
      { label: 'Dark', click: setLabel }
    ]
  }
]

if (process.platform === 'darwin') {
  template.unshift({
    label: app.getName(),
    submenu: [
      {role: 'about'},
      {type: 'separator'},
      {role: 'services', submenu: []},
      {type: 'separator'},
      {role: 'hide'},
      {role: 'hideothers'},
      {role: 'unhide'},
      {type: 'separator'},
      {role: 'quit'}
    ]
  })
}

const menu = Menu.buildFromTemplate(template)
Menu.setApplicationMenu(menu)
