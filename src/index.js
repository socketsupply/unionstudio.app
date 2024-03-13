import fs from 'socket:fs'
import path from 'socket:path'
import process from 'socket:process'
import application from 'socket:application'
import { network, Encryption, sha256 } from 'socket:network'
import vm from 'socket:vm'
import { inspect, format } from 'socket:util'
import { spawn, exec } from 'socket:child_process'

import Tonic from '@socketsupply/tonic'
import components from '@socketsupply/components'

import Database from './db/index.js'

import { AppTerminal } from './components/terminal.js'
import { AppProject } from './components/project.js'
import { AppProperties } from './components/properties.js'
import { AppSprite } from './components/sprite.js'
import { AppEditor } from './components/editor.js'

components(Tonic)

class AppView extends Tonic {
  constructor () {
    super()
    this.editors = {}
    this.state.zoom = {}
    this.previewWindows = {}

    this.setAttribute('platform', process.platform)

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
      this.reloadPreviewWindows()
    })

    window.addEventListener('window-closed', async e => {
      const data = e.detail.data

      const previewWindowSettings = this.state.settings.previewWindows[data - 1]
      if (!previewWindowSettings) return

      previewWindowSettings.active = false

      // we will need to update the properties panel to reflect the new state
      const coProperties = document.querySelector('app-properties')
      coProperties.reRender()

      const currentProject = this.state.currentProject
      const notifications = document.querySelector('#notifications')

      // if the user currently has the config file open in the editor...
      if (currentProject.label === 'settings.json' && currentProject.parent.id === 'root') {
        const coEditor = document.querySelctor('app-editor')

        try {
          coEditor.value = JSON.stringify(this.state.settings, null, 2)
        } catch (err) {
          return notifications.create({
            type: 'error',
            title: 'Unable to save config file',
            message: err.message
          })
        }
      }

      // write the settings file to disk, its a well known location
      try {
        const pathToSettingsFile = path.join(path.DATA, 'projects', 'settings.json')
        await fs.promises.writeFile(pathToSettingsFile, JSON.stringify(this.state.settings))
      } catch (err) {
        return notifications.create({
          type: 'error',
          title: 'Unable to save config file',
          message: err.message
        })
      }
    })
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
          const basePath = path.relative('template', fullPath)
          const destPath = path.join(path.DATA, 'projects', basePath)
          await fs.promises.mkdir(path.dirname(destPath), { recursive: true })
          await fs.promises.writeFile(destPath, file)
        }
      }
    }

    try {
      await readDir('template')
    } catch (err) {
      console.error('Error initiating read directory operation:', err)
    }
  }

  getCurrentProjectPath () {
    let currentProjectPath = this.state.currentProject?.id

    if (!currentProjectPath) {
      currentProjectPath = path.join(path.DATA, 'projects', 'demo-project')
    }

    currentProjectPath = path.join(currentProjectPath, this.state.settings.rootFile)
    return currentProjectPath.replace(path.DATA, '/preview')
  }

  async reloadPreviewWindows () {
    clearTimeout(this.debounce)
    this.debounce = setTimeout(() => {
      const currentProjectPath = this.getCurrentProjectPath() 

      for (const w of Object.values(this.previewWindows)) {
        const indexParams = new URLSearchParams({
          device: w.device,
          zoom: this.state.zoom[w.index] || '1'
        }).toString()

        w.navigate([currentProjectPath, indexParams].join('?'))
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

    if (!this.state.userScript) {
      const res = await fetch('./preview.js')
      this.state.userScript = await res.text()
    }

    const term = document.querySelector('app-terminal')
    const screenSize = await application.getScreenSize()

    for (let i = 0; i < this.state.settings.previewWindows.length; i++) {
      const index = i + 1
      const preview = this.state.settings.previewWindows[i]

      if (!preview.active) {
        const w = this.previewWindows[index]
        if (w) {
          delete this.state.zoom[index]
          await w.close()
        }
        continue
      }

      let width = screenSize.width * 0.6
      let height = screenSize.height * 0.6
      const scale = preview.scale || 1
      const platform = preview.platform || process.platform

      if (/\d+x\d+/.test(preview.resolution)) {
        const size = preview.resolution.split('x')
        width = size[0]
        height = size[1]
      }

      let hostOS = process.platform

      if (preview.platform === 'ios') hostOS = 'iphoneos'
      if (preview.platform === 'android') hostOS = 'android'

      const indexParams = new URLSearchParams({
        device: preview.device,
        zoom: this.state.zoom[index] || '1'
      }).toString()

      let currentProjectPath = this.getCurrentProjectPath() 

      const opts = {
        __runtime_primordial_overrides__: {
          arch: 'arm64',
          'host-operating-system': hostOS,
          platform
        },
        config: {
          webview_auto_register_service_workers: false,
          webview_service_worker_frame: false
        },
        path: [currentProjectPath, indexParams].join('?'),
        index: index,
        frameless: preview.frameless,
        closable: true,
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
        const w = await application.createWindow(opts)
        w.device = preview.device

        w.channel.addEventListener('message', e => {
          if (e.data.log) {
            return term.writeln(e.data.log.join(' '))
          }

          if (e.data.debug) {
            return term.writeln(e.data.debug.join(' '))
          }

          if (e.data.error) {
            return term.error(e.data.error.join(' '))
          }

          if (e.data.warn) {
            return term.warn(e.data.warn.join(' '))
          }

          if (e.data.info) {
            return term.info(e.data.info.join(' '))
          }

          this.state.zoom[w.index] = e.data.zoom || 1
        })

        this.previewWindows[w.index] = w
      } catch (err) {
        console.log(err)
      }
    }
  }

  async initData () {
    if (process.env.DEBUG === '1') {
      const databases = await window.indexedDB.databases()
      for (const { name } of databases) await Database.drop(name)
    }

    this.db = {
      channels: await Database.open('shares'),
      state: await Database.open('state')
    }

    Database.onerror = err => {
      console.error(err)

      const notifications = document.querySelector('#notifications')
      notifications?.create({
        type: 'error',
        title: 'Unhandled Database Error',
        message: err.message
      })
    }

    //
    // Create a default clusterId (used as the default group)
    //
    const clusterId = await Encryption.createClusterId('socket-app-studio')

    const { data: dataPeer } = await this.db.state.has('peer')

    if (!dataPeer) {
      const signingKeys = await Encryption.createKeyPair()
      await this.db.state.put('peer', {
        config: {
          peerId: await Encryption.createId(),
          clusterId
        }
      })
    }


  }

  async initApplication () {
    const notifications = document.querySelector('#notifications')
    const settingsFile = path.join(path.DATA, 'projects', 'settings.json')

    let exists
    let settings

    try {
      exists = await fs.promises.stat(settingsFile)
    } catch (err) {
      console.log(err)
    }

    if (!exists) {
      const defaultProjectDir = path.join(path.DATA, 'projects', 'demo-project')
      await fs.promises.mkdir(defaultProjectDir, { recursive: true })
      await this.installTemplates()
    }

    try {
      settings = JSON.parse(await fs.promises.readFile(settingsFile, 'utf8'))
    } catch {
      // NOPE
      return
    }

    this.state.settings = settings

    this.activatePreviewWindows()
  }


  async createProject () {
    const dest = path.join(path.DATA, 'projects', 'new-project')
    await fs.promises.mkdir(dest, { recursive: true })

    //
    // TODO(@heapwolf) check that exec is accepting cwd correctly
    //
    const c = await spawn('ssc', ['init'], { stdin: false, cwd: dest })

    c.on('exit', () => {
      const project = document.querySelector('app-project')
      project.load()
    })
  }

  //
  // this app must bundle the platform-specific ssc binary
  //
  async exportProject () {
    const project = document.querySelector('app-project')
    const node = project.getNodeByProperty('id', 'project')

    const args = [
      'build',
      '-r'
      // TODO allow config for -w
    ]

    const coDevice = document.querySelector('#device')
    if (coDevice.option.dataset.value) {
      args.push(coDevice.option.dataset.value) // --platform=P
    }

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
    const cwd = this.state.currentProject.id
    const c = this.childprocess = await spawn('ssc', args, { stdin: false, cwd })

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
        New Project: n + CommandOrControl
        ---
        Reset Demo Project: _
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

      case 'New Project': {
        this.createProject()
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
        term.writeln(inspect(...data.args))
      }

      if (data.method === 'console.error') {
        term.error(inspect(...data.args))
      }

      if (data.method === 'console.warn') {
        term.warn(inspect(...data.args))
      }

      if (data.method === 'console.info') {
        term.info(inspect(...data.args))
      }

      if (data.method === 'console.debug') {
        term.writeln(inspect(...data.args))
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
    await navigator.serviceWorker.ready

    await this.initData()
    await this.initApplication()

    return this.html`
      <header>
        <span class="spacer"></span>
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

        <tonic-button type="icon" size="18px" symbol-id="eval" title="Evalulate The Current Code In The Editor" data-event="eval">
        </tonic-button>

        <span class="spacer"></span>
        <tonic-button
          type="icon"
          size="18px"
          symbol-id="plus"
          title="Add a shared project"
          data-event="get-share"
        >
        </tonic-button>
        <tonic-button
          type="icon"
          size="18px"
          symbol-id="link"
          title="Share this project"
          data-event="put-share"
        >
        </tonic-button>
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
