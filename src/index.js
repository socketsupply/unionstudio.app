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
import { settings as defaultSettings } from './settings.js'

components(Tonic)

class AppView extends Tonic {
  constructor () {
    super()
    this.editors = {}
    this.state.zoom = {}
    this.previewWindows = {}

    this.setAttribute('platform', process.platform)
  }

  async installTemplates () {
    const readDir = async (dirPath) => {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)

        if (entry.isDirectory()) {
          try {
            await readDir(fullPath)
          } catch (err) {
            console.error(`Error reading directory ${fullPath}:`, err)
          }
        } else {
          const file = await fs.promises.readFile(fullPath)
          const basePath = path.relative('templates', fullPath)
          const destPath = path.join(this.state.cwd, basePath)
          await fs.promises.mkdir(path.dirname(destPath), { recursive: true })
          await fs.promises.writeFile(destPath, file)
        }
      }
    }

    try {
      await readDir('templates')
    } catch (err) {
      console.error('Error initiating read directory operation:', err)
    }
  }

  async reloadPreviewWindows () {
    clearTimeout(this.debounce)
    this.debounce = setTimeout(() => {
      for (const w of Object.values(this.previewWindows)) {
        w.navigate(this.state.indexURL + `?zoom=${this.state.zoom[w.index]}`)
      }
    }, 128)
  }

  async activatePreviewWindows () {
    if (!this.state.settings.previewWindows) {
      console.log('can not find config')
      return
    }

    if (!Array.isArray(this.state.settings.previewWindows)) {
      console.log('expect settings.previewWindows to be of type Array<Object>')
      return
    }

    for (const [k, v] of Object.entries(this.previewWindows)) {
      delete this.state.zoom[k]
      await v.close() // destroy any existing preview windows
    }

    const screenSize = await application.getScreenSize()

    for (let i = 0; i < this.state.settings.previewWindows.length; i++) {
      const preview = this.state.settings.previewWindows[i]
      if (!preview.active) continue

      let width = screenSize.width * 0.6
      let height = screenSize.height * 0.6
      const index = i + 1
      const scale = preview.scale || 1

      if (/\d+x\d+/.test(preview.resolution)) {
        const size = preview.resolution.split('x')
        width = preview.resolution = size[0]
        height = preview.resolution = size[1]
      }

      let hostOS = process.platform

      if (preview.platform === 'ios') hostOS = 'iphoneos'
      if (preview.platform === 'android') hostOS = 'android'

      const opts = {
        __runtime_primordial_overrides__: {
          arch: 'arm64',
          'host-operating-system': hostOS,
          platform: preview.platform || process.platform
        },
        path: this.state.indexURL + `?zoom=${this.state.zoom[index] || '1'}`,
        index: index,
        frameless: preview.frameless,
        closable: false,
        maximizable: false,
        radius: preview.radius, // ie '48.5',
        margin: preview.margin, // ie '6.0',
        title: preview.title,
        titleBarStyle: preview.titleBarStyle, // ie 'hiddenInset'
        trafficLightPosition: preview.trafficLightPosition, // ie '10x26'
        aspectRatio: preview.aspectRatio, // ie '9:19.5'
        width: Math.floor(width / scale),
        height: Math.floor(height / scale)
      }

      if (scale > 1) {
        opts.userScript = this.state.userScript
        opts.minWidth = Math.floor(width / scale)
        opts.minHeight = Math.floor(height / scale)
      }

      try {
        console.log(opts)
        const w = await application.createWindow(opts)

        w.channel.addEventListener('message', e => {
          this.state.zoom[w.index] = e.data.zoom || 1
        })

        this.previewWindows[w.index] = w
      } catch {}
    }
  }

  async init () {
    //
    // TODO(@heapwolf): make this.state.cwd confirgurable
    //
    const mount = '/user/home'
    this.state.navigatorPath = path.DATA.replace(path.HOME, mount)
    this.state.cwd = path.DATA

    const res = await fetch('./preview.js')
    this.state.userScript = await res.text()

    await navigator.serviceWorker.ready

    let projectExists

    const settingsFile = path.join(this.state.cwd, 'settings.json')
    const notifications = document.querySelector('#notifications')

    try {
      projectExists = await fs.promises.stat(path.join(this.state.cwd, 'socket.ini'))
    } catch {}

    if (!projectExists) {
      await fs.promises.mkdir(path.join(this.state.cwd, 'src'), { recursive: true })

      this.state.settings = defaultSettings
      await fs.promises.writeFile(settingsFile, JSON.stringify(defaultSettings))
      await this.installTemplates()
    }

    if (projectExists) {
      try {
        const str = await fs.promises.readFile(settingsFile, 'utf8')
        this.state.settings = JSON.parse(str)

        /* fs.watch(settingsFile, async () => {
          const editor = document.querySelector('app-editor')
          if (editor) {
            this.state.settings = await fs.promises.readFile(settingsFile, 'utf8')
            editor.refreshSettings()
          }
        }) */
      } catch (err) {
        notifications.create({
          type: 'error',
          title: 'Unable to read settings from ${settingsFile}',
          message: err.message
        })
      }
    }

    let webviewRoot = 'src'

    if (this.state.settings.root) {
      webviewRoot = this.state.settings.root
    }

    this.state.indexURL = path.join('/preview', webviewRoot, 'index.html')
    this.activatePreviewWindows()
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

      let dir = child.id
      let data = child.data

      if (child.id.includes('icon.assets')) {
        if (process.platform === 'win') {
          data = convertToICO(node.data)
          dir = path.join('icons', 'icon.ico')
        } else {
          dir = path.join('icons', 'icon.png')
        }
      }

      paths[path.join(this.state.cwd, dir)] = data
    })

    for (const [pathToFile, data] of Object.entries(paths)) {
      await fs.promises.mkdir(path.dirname(pathToFile), { recursive: true })
      await fs.promises.writeFile(pathToFile, data)
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
    document.title = 'Socket App Studio'

    let itemsMac = ''

    if (process.platform === 'darwin') {
      itemsMac = `
        Hide: h + CommandOrControl
        Hide Others: h + Control + Meta
        ---
      `
    }

    const menu = `
      Socket App Studio:
        About Socket App Studio: _
        ---
        ${itemsMac}
        Quit: q + CommandOrControl
      ;

      File:
        Export Project: s + CommandOrControl
        New Folder: n + CommandOrControl
        New File: N + CommandOrControl
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
        Evaluate Editor Source: r + CommandOrControl + Shift
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
  }

  async render () {
    await this.init()

    return this.html`
      <header movable>
        <span class="spacer"></span>

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

        <span class="spacer"></span>
      </header>

      <tonic-split id="split-main" type="vertical">
        <tonic-split-left width="80%">
          <tonic-split id="split-editor" type="vertical">
            <tonic-split-left width="25%">
              <app-project id="app-project" parent=${this}></app-project>
            </tonic-split-left>

            <tonic-split-right width="75%">
              <tonic-split id="split-input" type="horizontal">
                <tonic-split-top height="80%">
                  <app-editor id="editor" parent=${this}></app-editor>
                </tonic-split-top>
                <tonic-split-bottom height="20%">
                  <app-terminal id="app-terminal" parent=${this}></app-terminal>
                </tonic-split-bottom>
              </tonic-split>
            </tonic-split-right>
          </tonic-split>
        </tonic-split-left>

        <tonic-split-right width="20%">
          <app-properties id="app-properties" parent=${this}></app-properties>
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
