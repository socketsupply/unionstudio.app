const { app, Menu } = require('electron')

module.exports = (args, modifier) => {
  const t = [
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteandmatchstyle' },
        { role: 'delete' },
        { role: 'selectall' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'JavaScript',
          accelerator: 'CmdOrCtrl+Shift+J',
          checked: false,
          click: e => {
            modifier('javascript')
          }
        },
        {
          label: 'JavaScript Output',
          accelerator: 'CmdOrCtrl+J',
          checked: false,
          click: e => {
            modifier('javascript-output')
          }
        },
        {
          label: 'HTML',
          accelerator: 'CmdOrCtrl+Shift+H',
          checked: false,
          click: () => {
            modifier('html')
          }
        },
        {
          label: 'CSS',
          accelerator: 'CmdOrCtrl+Shift+C',
          checked: false,
          click: () => {
            modifier('css')
          }
        },
        { type: 'separator' },
        {
          label: 'Labels',
          accelerator: 'CmdOrCtrl+Shift+L',
          checked: false,
          click: () => {
            modifier('labels')
          }
        },
        {
          label: 'Toggle Theme',
          accelerator: 'CmdOrCtrl+T',
          checked: false,
          click: () => {
            modifier('theme')
          }
        },
        { role: 'togglefullscreen' },
        {
          label: 'Inspect',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            modifier('inspect')
          }
        }
      ]
    },
    {
      role: 'window',
      submenu: [
        { role: 'minimize' }
      ]
    },
    {
      label: 'Options',
      submenu: [
        {
          label: 'Vim Mode',
          type: 'checkbox',
          checked: false,
          click: () => {
            modifier('vim')
          }
        },
        {
          label: 'Enable Typescript Support',
          type: 'checkbox',
          checked: false,
          click: () => {
            modifier('typescript')
          }
        },
        { type: 'separator' },
        {
          label: 'Clear All Panels',
          accelerator: 'CmdOrCtrl+Shift+K',
          click: () => {
            modifier('clear-all')
          }
        },
        {
          label: 'Evaluate All',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            modifier('eval')
          }
        },
        {
          label: 'Clear Script Output',
          accelerator: 'CmdOrCtrl+K',
          click: () => {
            modifier('clear-output')
          }
        },
        {
          label: 'Set Working Directory',
          click: () => {
            modifier('cwd')
          }
        }
      ]
    }
  ]

  if (process.platform === 'darwin') {
    t.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services', submenu: [] },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    })
  }

  const menu = Menu.buildFromTemplate(t)
  Menu.setApplicationMenu(menu)
}
