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
    this.cwd = path.join(process.env.HOME, '.local', 'share', 'socket-scratches')
    await fs.promises.mkdir(path.join(this.cwd, 'src'), { recursive: true })
  }

  //
  // this app must bundle the platform-specific ssc binary
  //
  async exportProject () {
    const project = document.querySelector('app-project')
    const node = project.getNodeByProperty('id', 'project')

    let paths = {}
    project.walk(project.state.tree.children[0], child => {
      if (child.children.length === 0) {
        const dest = child.id.replace('templates', 'src')
        paths[path.join(this.cwd, dest)] = child.data
      }
    })

    for (const [path, data] of Object.entries(paths)) {
      await fs.promises.writeFile(path, data)
    }

    const args = [
      'build',
      '-r',
      '-w'
    ]

    const term = document.querySelector('app-terminal')
    const c = this.childprocess = await spawn('ssc', args, { cwd: this.cwd })

    c.stdout.on('data', data => {
      term.writeln(Buffer.from(data).toString())
    })

    c.stderr.on('data', data => {
      term.writeln(Buffer.from(data).toString())
    })

    c.on('exit', (code) => term.writeln(`OK! ${code}`))
    c.on('error', (code) => console.log(`NOT OK! ${code}`))
  }

  async setupWindow () {
    document.title = 'Scratches'

    /* const len = this.editors.output.state.doc.length
    this.editors.output.dispatch({
      effects: EditorView.scrollIntoView(len)
    })

    window.log = (...args) => {
      const content = args.join(' ') + '\n'
      const len = this.editors.output.state.doc.length

      this.editors.output.dispatch({
        changes: { from: len, insert: content },
        effects: EditorView.scrollIntoView(len + content)
      })
    } */

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
        Clear Output: n + CommandOrControl
      ;

      Build & Run:
        Evaluate Editor Source: e + CommandOrControl
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

      case 'Evaluate Editor Source': {
        this.eval().catch(err => console.log(err))
        break
      }

      case 'Clear Output': {
        const term = document.querySelector('app-terminal')
        term.clear()
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
    }

    const editorVM = await vm.runInContext(`
      export * from '${globalThis.origin}/vm.js'
    `, { context: {} })

    const value = editor.selection || editor.value

    try {
      await editorVM.init({ port: channel.port2 })
      await editorVM.evaluate(value)
    } catch (err) {
      term.writeln(err.message)
      term.writeln(err.stack.split('\n').join('\r\n'))
      return
    }
  }

  async click (e) {
    const el = Tonic.match(e.target, '[data-event]')
    if (!el) return

    const { event } = el.dataset

    if (event === 'eval') {
      this.eval().catch(err => console.log(err))
    }

    if (event === 'run') {
      this.exportProject()
    }
  }

  async connected () {
    this.setupWindow()
  }

  render () {
    return this.html`
      <header>
        <tonic-button type="icon" size="18px" symbol-id="play" title="Build & Run The Project" data-event="run">
        </tonic-button>

        <tonic-select id="device" value="${process.platform}" title="Build Target Platform">
          <optgroup label="iOS">
            <option value="ios">iOS Preview</option>
            <option value="ios-simulator">iOS Simulator</option>
          </optgroup>

          <optgroup label="Android">
            <option value="android">Android Preview</option>
            <option value="android-emulator">Android Emulator</option>
          </optgroup>

          <optgroup label="Desktop">
            <option value="linux" disabled>Linux</option>
            <option value="darwin">MacOS</option>
            <option value="win32" disabled>Windows</option>
          </optgroup>
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
