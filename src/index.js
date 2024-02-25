import fs from 'socket:fs'
import path from 'socket:path'
import process from 'socket:process'
import application from 'socket:application'
import vm from 'socket:vm'
import { format } from 'socket:util'
import { spawn } from 'socket:child_process'

import Tonic from '@socketsupply/tonic'
import components from '@socketsupply/components'

import { AppTerminal } from './terminal.js'
import { AppProject } from './project.js'
import { AppProperties } from './properties.js'
import { AppSprite } from './sprite.js'
import { AppEditor } from './editor.js'

components(Tonic)

class AppView extends Tonic {
  constructor () {
    super()
    this.editors = {}
    this.init()
  }

  async init () {
    this.state.cwd = path.join(process.env.HOME, '.local', 'share', 'socket-scratches')
    await fs.promises.mkdir(path.join(this.state.cwd, 'src'), { recursive: true })
  }

  //
  // this app must bundle the platform-specific ssc binary
  //
  async exportProject () {
    const project = document.querySelector('app-project')
    const node = project.getNodeByProperty('id', 'project')

    const paths = {}
    project.walk(project.state.tree.children[0], child => {
      if (child.type === 'dir') return
      paths[path.join(this.state.cwd, child.id)] = child.data
    })

    for (const [path, data] of Object.entries(paths)) {
      await fs.promises.writeFile(path, data)
    }

    const args = [
      'build',
      '-r',
      '-w'
    ]

    const coDevice = document.querySelector('#device')
    if (coDevice.option.dataset.value) args.push(coDevice.option.dataset.value)

    const term = document.querySelector('app-terminal')
    term.info(`ssc ${args.join(' ')}`)

    if (this.childprocess && !this.childprocess.killed && this.childprocess.exitCode !== null) {
      this.childprocess.kill('SIGKILL')
      term.info('Terminating existing app')

      await new Promise(resolve => {
        this.childprocess.once('close', () => {
          setTimeout(() => {
            resolve()
          }, 1200)
        })
      })
    }

    term.info('Running new instance of app')
    const c = this.childprocess = await spawn('ssc', args, { stdin: false, cwd: this.state.cwd })

    c.stdout.on('data', data => {
      term.writeln(Buffer.from(data).toString().trim())
    })

    c.stderr.on('data', data => {
      term.writeln(Buffer.from(data).toString().trim())
    })

    c.on('exit', (code) => {
      term.writeln(`OK! ${code}`)
      this.childprocess = null
    })

    c.on('error', (code) => {
      term.writeln(`NOT OK! ${code}`)
      this.childprocess = null
    })
  }

  async setupWindow () {
    document.title = 'Scratches'

    let itemsMac = ''

    if (process.platform === 'darwin') {
      itemsMac = `
        Hide: h + CommandOrControl
        Hide Others: h + Control + Meta
        ---
      `
    }

    const menu = `
      Serverless Studio:
        About Scratches: _
        ---
        ${itemsMac}
        Quit: q + CommandOrControl
      ;

      File:
        Export Project: s + CommandOrControl
        ---
        Reset Project: _
      ;

      Edit:
        Cut: x + CommandOrControl
        Copy: c + CommandOrControl
        Paste: v + CommandOrControl
        Delete: _
        ---
        Undo: z + CommandOrControl
        Redo: Z + CommandOrControl
        ---
        Select All: a + CommandOrControl
      ;

      View:
        Toggle Project: t + CommandOrControl
        Toggle Properties: p + CommandOrControl
        Toggle Output: o + CommandOrControl
        ---
        Find: f + CommandOrControl
        ---
        Clear Output: n + CommandOrControl
      ;

      Build & Run:
        Evaluate Editor Source: E + CommandOrControl + Shift
        ---
        Android: s + CommandOrControl
        iOS: s + CommandOrControl
        Linux: s + CommandOrControl
        MacOS: s + CommandOrControl
        Windows: s + CommandOrControl
      ;
    `

    await application.setSystemMenu({ index: 0, value: menu })

    window.addEventListener('menuItemSelected', e => {
      this.onMenuSelection(e.detail.title)
    })
  }

  async onMenuSelection (command) {
    switch (command) {
      case 'Clear Output': {
        const term = document.querySelector('app-terminal')
        term.clear()
        break
      }

      case 'Evaluate Editor Source': {
        this.eval().catch(err => console.error(err))
        break
      }

      case 'Find': {
        const coEditor = document.querySelector('app-editor')
        coEditor.editor.getAction('actions.find').run()
        break
      }

      case 'Toggle Properties': {
        document.querySelector('#split-main').toggle('right')
        break
      }

      case 'Toggle Project': {
        document.querySelector('#split-editor').toggle('left')
        break
      }

      case 'Toggle Output': {
        document.querySelector('#split-input').toggle('bottom')
        break
      }
    }
  }

  async eval () {
    const editor = document.querySelector('app-editor')
    const term = document.querySelector('app-terminal')
    const channel = new MessageChannel()

    channel.port1.onmessage = ({ data }) => {
      if (data.method === 'console.log') {
        term.writeln(format(...data.args))
      }

      if (data.method === 'console.error') {
        term.writeln(format(...data.args))
      }

      if (data.method === 'console.debug') {
        term.writeln(format(...data.args))
      }
    }

    try {
      // TODO(@jwerle,@heapwolf): should this be in a new context every time?
      const editorVM = await vm.runInContext(`
        export * from '${globalThis.origin}/vm.js'
      `, { context: {} })

      const value = editor.selection || editor.value

      await editorVM.init({ port: channel.port2 })
      await editorVM.evaluate(value)
    } catch (err) {
      term.writeln(format(err))
    }
  }

  async click (e) {
    const el = Tonic.match(e.target, '[data-event]')
    if (!el) return

    const { event } = el.dataset

    if (event === 'eval') {
      this.eval().catch(err => console.error(err))
    }

    if (event === 'run') {
      this.exportProject()
    }
  }

  async connected () {
    this.setupWindow()

    const tree = {
      id: 'root',
      children: []
    }

    const node = {
      id: 'project',
      selected: 0,
      state: 1,
      type: 'dir',
      label: 'Project',
      children: [
        {
          id: 'src',
          selected: 0,
          state: 1,
          type: 'dir',
          label: 'src',
          children: [
            {
              id: 'src/index.css',
              label: 'index.css',
              data: await fs.promises.readFile('templates/index.css', 'utf8'),
              icon: 'file',
              language: 'css',
              selected: 0,
              state: 0,
              children: []
            },
            {
              id: 'src/index.html',
              label: 'index.html',
              data: await fs.promises.readFile('templates/index.html', 'utf8'),
              icon: 'file',
              language: 'html',
              selected: 0,
              state: 0,
              children: []
            },
            {
              id: 'src/index.js',
              label: 'index.js',
              data: await fs.promises.readFile('templates/index.js', 'utf8'),
              language: 'javascript',
              icon: 'file',
              selected: 1,
              state: 1,
              children: []
            }
          ]
        },
        {
          id: 'icon.assets',
          label: 'icon.assets',
          data: await fs.promises.readFile('templates/icons/icon.png'),
          icon: 'file',
          selected: 0,
          state: 0,
          children: []
        },
        {
          id: 'socket.ini',
          label: 'socket.ini',
          data: await fs.promises.readFile('templates/socket.ini', 'utf8'),
          icon: 'file',
          language: 'ini',
          selected: 0,
          state: 0,
          children: []
        }
      ]
    }

    tree.children.push(node)

    tree.children.push({
      id: 'examples',
      selected: 0,
      state: 0,
      label: 'Examples',
      children: [
        {
          id: 'examples/buffers.js',
          label: 'buffers.js',
          data: await fs.promises.readFile('examples/buffers.js', 'utf8'),
          language: 'javascript',
          icon: 'file',
          selected: 0,
          state: 0,
          children: []
        },
        {
          id: 'examples/child_process.js',
          label: 'child_process.js',
          data: await fs.promises.readFile('examples/child_process.js', 'utf8'),
          language: 'javascript',
          icon: 'file',
          selected: 0,
          state: 0,
          children: []
        },
        {
          id: 'examples/network.js',
          label: 'network.js',
          data: await fs.promises.readFile('examples/network.js', 'utf8'),
          language: 'javascript',
          icon: 'file',
          selected: 0,
          state: 0,
          children: []
        },
        {
          id: 'examples/path.js',
          label: 'path.js',
          data: await fs.promises.readFile('examples/path.js', 'utf8'),
          language: 'javascript',
          icon: 'file',
          selected: 0,
          state: 0,
          children: []
        },
        {
          id: 'examples/require.js',
          label: 'require.js',
          data: await fs.promises.readFile('examples/require.js', 'utf8'),
          language: 'javascript',
          icon: 'file',
          selected: 0,
          state: 0,
          children: []
        }
      ]
    })

    this.state.tree = tree

    const project = document.querySelector('app-project')
    project.load(this.state.tree)

    const editor = document.querySelector('app-editor')
    editor.loadProjectNode(node.children[0].children[2])
  }

  render () {
    return this.html`
      <header>
        <tonic-button type="icon" size="18px" symbol-id="play" title="Build & Run The Project" data-event="run">
        </tonic-button>

        <tonic-select id="device" value="${process.platform}" title="Build Target Platform">
          <option value="ios-simulator" data-value="--platform=ios-simulator">iOS Simulator</option>
          <option value="android-emulator" data-value="--platform=android-emulator">Android Emulator</option>
          <option value="linux" data-value="" disabled>Linux</option>
          <option value="darwin" data-value="">MacOS</option>
          <option value="win32" data-value="" disabled>Windows</option>
        </tonic-select>

        <tonic-button type="icon" size="18px" symbol-id="refresh" title="Evalulate The Current Code In The Editor" data-event="eval">
        </tonic-button>
      </header>

      <tonic-split id="split-main" type="vertical">
        <tonic-split-left width="80%">
          <tonic-split id="split-editor" type="vertical">
            <tonic-split-left width="25%">
              <app-project id="app-project"></app-project>
            </tonic-split-left>

            <tonic-split-right width="75%">
              <tonic-split id="split-input" type="horizontal">
                <tonic-split-top height="80%">
                  <app-editor id="editor"></app-editor>
                </tonic-split-top>
                <tonic-split-bottom height="20%">
                  <app-terminal id="app-terminal"></app-terminal>
                </tonic-split-bottom>
              </tonic-split>
            </tonic-split-right>
          </tonic-split>
        </tonic-split-left>

        <tonic-split-right width="20%">
          <app-properties id="app-properties"></app-properties>
        </tonic-split-right>
      </tonic-split>
      <app-sprite></app-sprite>
    `
  }
}

window.onload = () => {
  Tonic.add(AppEditor)
  Tonic.add(AppProperties)
  Tonic.add(AppProject)
  Tonic.add(AppSprite)
  Tonic.add(AppTerminal)
  Tonic.add(AppView)
}
