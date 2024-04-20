import fs from 'socket:fs'
import path from 'socket:path'
import process from 'socket:process'
import application from 'socket:application'
import { network, Encryption } from 'socket:network'
import vm from 'socket:vm'
import { inspect, format } from 'socket:util'
import { spawn, exec } from 'socket:child_process'

import Tonic from 'npm:@socketsupply/tonic'
import components from 'npm:@socketsupply/components'
import Indexed from 'npm:@socketsupply/indexed'

import { Patch } from './git-data.js'
import { cp, rm } from './lib/fs.js'

import { RelativeDate } from './components/relative-date.js'
import { GitStatus } from './components/git-status.js'
import { PatchRequests } from './components/patch-requests.js'
import { AppEditor } from './components/editor.js'
import { AppTerminal } from './components/terminal.js'
import { AppProject } from './components/project.js'
import { AppProperties } from './components/properties.js'
import { AppSprite } from './components/sprite.js'
import { DialogConfirm } from './components/confirm.js'
import { DialogPublish } from './components/publish.js'
import { DialogSubscribe } from './components/subscribe.js'

import { ViewHome } from './views/home.js'
import { ViewImagePreview } from './views/image-preview.js'
import { ViewProjectSummary } from './views/project-summary.js'

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
        const coEditor = document.querySelector('app-editor')

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
        const pathToSettingsFile = path.join(path.DATA, 'settings.json')
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

  getCurrentProjectPath () {
    let currentProjectPath = this.state.currentProject?.id
    if (!currentProjectPath) return

    currentProjectPath = path.join(currentProjectPath, this.state.settings?.rootFile || 'src')
    return currentProjectPath.replace(path.DATA, '/preview')
  }

  async reloadPreviewWindows () {
    if (!this.state.currentProject) return
    if (this.state.currentProject.id === 'home') return

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
    const len = this.state.settings.previewWindows.length

    for (let i = 0; i < len; i++) {
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
        index,
        path: '',
        frameless: preview.frameless,
        closable: true,
        maximizable: false,
        radius: preview.radius, // ie '48.5',
        margin: preview.margin, // ie '6.0',
        title: preview.title,
        titlebarStyle: preview.titlebarStyle, // ie 'hiddenInset'
        windowControlOffsets: preview.windowControlOffsets, // ie '10x26'
        // backgroundColorDark: 'rgba(46, 46, 46, 0.1)',
        // backgroundColorLight: 'rgba(255, 255, 255, 0.1)',
        aspectRatio: preview.aspectRatio, // ie '9:19.5'
        width: Math.floor(width / scale),
        height: Math.floor(height / scale)
      }

      const currentProjectPath = this.getCurrentProjectPath()
      if (currentProjectPath) {
        opts.path = [currentProjectPath, indexParams].join('?')
      }

      opts.userScript = this.state.userScript

      if (scale > 1) {
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
      }
    }
  }

  async initNetwork () {
    const { data: dataPeer } = await this.db.state.get('peer')
    const { data: dataUser } = await this.db.state.get('user')

    const signingKeys = {
      publicKey: dataUser.publicKey,
      privateKey: dataUser.privateKey
    }

    let socket = this.socket

    if (!this.socket) {
      const opts = { ...dataPeer, signingKeys }
      socket = this.socket = await network(opts)

      socket.on('#ready', async (info) => {
        const coTerminal = document.querySelector('app-terminal')

        if (coTerminal) {
          coTerminal.info(`Peer Ready (address=${info.address}:${info.port}, nat=${info.natName})`)
        }

        for (const sub of [...socket.subclusters.values()]) {
          await sub.join()
        }
      })

      socket.on('#data', (...args) => console.log)
    } else {
      // If the user has changed the clusterId and or subclusterId, we need to tell the peer about it
      // TODO(@heapwolf): we need a nice way to send config updates to the peer worker.
    }

    const coTerminal = document.querySelector('app-terminal')
    const { data: dataProjects } = await this.db.projects.readAll()

    for (const [bundleId, project] of dataProjects.entries()) {
      if (socket.subclusters.get(project.subclusterId)) {
        continue
      }

      const subcluster = await socket.subcluster({ sharedKey: project.sharedKey })
      // console.log(`Initialized network cluster for ${project.label}`)

      subcluster.on('patch', async (value, packet) => {
        if (!packet.verified) return // gtfoa
        if (packet.index !== -1) return // not interested
        coTerminal.info(`Received patch for ${project.label}.`)

        const pid = Buffer.from(packet.packetId).toString('hex')
        const key = [bundleId, pid].join('\xFF')

        const { data: hasPacket } = await this.db.patches.has(key)
        if (hasPacket) return

        const message = Buffer.from(value.data).toString()
        const patch = new Patch(message)

        patch.publicKey = Buffer.from(packet.usr2)
        patch.patchId = pid

        await this.db.patches.put(key, patch)

        // if the project is showing, re-render it to show the new patch
        const coProject = document.querySelector('view-project-summary.show')
        if (coProject) coProject.reRender()
      })
    }
  }

  async createProject (opts = {}) {
    const name = opts.name || 'project-' + Math.random().toString(16).slice(2, 8)
    const bundleId = 'com.' + name
    const org = 'union-app-studio'
    const sharedSecret = opts.sharedSecret || (await Encryption.createId()).toString('base64')
    const sharedKey = await Encryption.createSharedKey(sharedSecret)
    const derivedKeys = await Encryption.createKeyPair(sharedKey)
    const clusterId = await Encryption.createClusterId(org)
    const subclusterId = Buffer.from(derivedKeys.publicKey)

    const project = {
      label: name,
      waiting: opts.waiting || false,
      path: opts.path || path.join(path.DATA, name),
      org,
      bundleId,
      clusterId,
      subclusterId,
      sharedKey,
      sharedSecret
    }

    await this.db.projects.put(bundleId, project)
    await fs.promises.mkdir(project.path, { recursive: true })

    try {
      await exec('ssc init', { cwd: project.path })
      await exec('git init', { cwd: project.path })
    } catch (err) {
      console.error(err)
    }

    return project
  }

  async initData () {
    if (process.env.RESET === '1') {
      await rm(path.DATA)
      const databases = await window.indexedDB.databases()
      for (const { name } of databases) await Indexed.drop(name)
      process.exit(0)
    }

    this.db = {
      projects: await Indexed.open('projects'),
      // patches are the primary type of data associated with a
      // channel a patch can be reviewed, applied or discarded.
      // in the future this could include other things like build
      // artifacts, messages, comments, etc.
      patches: await Indexed.open('patches'),
      // this is a table of trusted public keys. when a user sees a
      // patch and they decide they want to trust the user who sent
      // it, they can chose to trust the signer and save the public key.
      keys: await Indexed.open('keys'),
      // state contains state data for the underlying peer.
      state: await Indexed.open('state')
    }

    Indexed.onerror = err => {
      console.error(err)

      const notifications = document.querySelector('#notifications')
      notifications?.create({
        type: 'error',
        title: 'Unhandled Indexed Error',
        message: err.message
      })
    }

    //
    // Create a default clusterId (used as the default group)
    //
    const clusterId = await Encryption.createClusterId('union-app-studio')

    const { data: dataPeer } = await this.db.state.has('peer')

    if (dataPeer) return

    await this.db.state.put('peer', {
      config: {
        peerId: await Encryption.createId(),
        clusterId
      }
    })

    await this.db.state.put('user', {
      ...(await Encryption.createKeyPair())
    })

    this.createProject()
  }

  async initApplication () {
    const userSettingsFile = path.join(path.DATA, 'settings.json')

    let settings

    try {
      await fs.promises.stat(userSettingsFile)
    } catch (err) {
      const settings = await fs.promises.readFile('settings.json')
      await fs.promises.writeFile(userSettingsFile, settings)
    }

    try {
      settings = JSON.parse(await fs.promises.readFile(userSettingsFile, 'utf8'))
    } catch (err) {
      console.log('NO SETTINGS', err)
      return
    }

    this.state.settings = settings

    this.activatePreviewWindows()
  }

  async addSharedProject () {
    const coDialogSubscribe = document.querySelector('dialog-subscribe')
    if (coDialogSubscribe) coDialogSubscribe.show()
  }

  async togglePreviewMode () {
    const coPreviewModeButton = document.querySelector('#toggle-preview-mode')
    coPreviewModeButton.classList.toggle('selected')

    this.state.settings.previewMode = !this.state.settings.previewMode
    this.saveSettingsFile()
  }

  async saveSettingsFile () {
    const pathToSettingsFile = path.join(path.DATA, 'settings.json')
    const notifications = document.querySelector('#notifications')
    const coTabs = document.querySelector('editor-tabs')
    const coEditor = document.querySelector('app-editor')

    // if the user currently has the config file open in the editor...
    if (coTabs.tab?.isRootSettingsFile) {
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

    try {
      const str = JSON.stringify(this.state.settings)
      await fs.promises.writeFile(pathToSettingsFile, str)
    } catch (err) {
      return notifications?.create({
        type: 'error',
        title: 'Error',
        message: 'Unable to update settings'
      })
    }
  }

  //
  // this app must bundle the platform-specific ssc binary
  //
  async exportProject () {
    const args = [
      'build',
      '-r'
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
    const env = { SSC_PARENT_LOG_SOCKET: process.env.SSC_LOG_SOCKET }
    const c = this.childprocess = await spawn('ssc', args, { cwd, env })

    c.stdout.on('data', data => {
      term.writeln(Buffer.from(data).toString().trim())
    })

    c.stderr.on('data', data => {
      term.writeln(Buffer.from(data).toString().trim())
    })

    c.once('exit', (code) => {
      term.writeln(`OK! ${code}`)
      this.childprocess = null
    })

    c.once('error', (code) => {
      term.writeln(`NOT OK! ${code}`)
      this.childprocess = null
    })
  }

  async initMenu () {
    let itemsMac = ''

    if (process.platform === 'darwin') {
      itemsMac = `
        Hide: h + CommandOrControl
        Hide Others: h + Control + Meta
        ---
      `
    }

    const menu = `
      Union App Studio:
        About Union App Studio: _
        ---
        ${itemsMac}
        Quit: q + CommandOrControl
      ;

      File:
        Save: s + CommandOrControl
        New Project: N + CommandOrControl
        Add Shared Project: G + CommandOrControl
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
        Evaluate Source: r + CommandOrControl + Shift
        Toggle Realtime Preview: k + CommandOrControl + Shift
        ---
        Android: _
        iOS: _
        Linux: _
        MacOS: _
        Windows: _
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
        await this.createProject()
        const coProject = document.querySelector('app-project')
        coProject.load()
        break
      }

      case 'Save': {
        const coEditor = document.querySelector('app-editor')
        coEditor.saveCurrentTab()
        break
      }

      case 'Find': {
        const coEditor = document.querySelector('app-editor')
        coEditor.editor.getAction('actions.find').run()
        break
      }

      case 'Add Shared Project': {
        this.addSharedProject()
        break
      }

      case 'Toggle Properties': {
        document.querySelector('#split-main').toggle('right')
        break
      }

      case 'Toggle Project': {
        const coSplit = document.querySelector('#split-editor')
        coSplit.toggle('left')

        //
        // if the project has been closed, we dont want the tabs to
        // go under the traffic lights.
        //
        if (process.platform === 'darwin') {
          const coTabs = document.querySelector('#editor-tabs')
          if (coSplit.firstElementChild.style.visibility === 'hidden') {
            coTabs.classList.add('inset')
          } else {
            coTabs.classList.remove('inset')
          }
        }

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

    if (event === 'preview-mode') {
      this.togglePreviewMode()
    }

    if (event === 'create-new-project') {
      await this.createProject()
      const coProject = document.querySelector('app-project')
      coProject.load()
    }

    if (event === 'add-shared-project') {
      this.addSharedProject()
    }
  }

  async connected () {
    this.initMenu()
  }

  async render () {
    await navigator.serviceWorker.ready

    await this.initData()
    await this.initNetwork()
    await this.initApplication()

    const previewMode = this.state.settings?.previewMode === true ? 'selected' : ''

    return this.html`
      <tonic-split id="split-main" type="vertical">
        <tonic-split-left width="80%">
          <tonic-split id="split-editor" type="vertical">
            <tonic-split-left width="25%">
              <header class="component" id="header-project">
                <span class="spacer"></span>
                <tonic-button
                  type="icon"
                  size="18px"
                  symbol-id="plus-icon"
                  title="Create a new project"
                  data-event="create-new-project"
                >
                </tonic-button>
                <tonic-button
                  type="icon"
                  size="24px"
                  symbol-id="collaborate-icon"
                  title="Subscribe to a shared project"
                  data-event="add-shared-project"
                >
                </tonic-button>
              </header>
              <app-project id="app-project" parent=${this}></app-project>
            </tonic-split-left>

            <tonic-split-right width="75%">
              <tonic-split id="split-input" type="horizontal">
                <tonic-split-top height="80%">
                  <app-editor id="editor" parent=${this}></app-editor>

                  <view-home id="view-home" parent=${this}></view-home>
                  <view-project-summary id="project-summary" parent=${this}></view-project-summary>
                  <view-image-preview id="image-preview" parent=${this}></view-image-preview>
                </tonic-split-top>
                <tonic-split-bottom height="20%">
                  <app-terminal id="app-terminal" parent=${this}></app-terminal>
                </tonic-split-bottom>
              </tonic-split>
            </tonic-split-right>
          </tonic-split>
        </tonic-split-left>

        <tonic-split-right width="20%">
          <header class="component" id="header-properties">

            <tonic-button
              type="icon"
              size="18px"
              symbol-id="play-icon"
              title="Build & Run The Project"
              data-event="run"
            >
            </tonic-button>

            <tonic-button
              type="icon"
              size="22px"
              symbol-id="run-icon"
              title="Evalulate The current selection or all code in the editor"
              data-event="eval"
            >
            </tonic-button>

            <tonic-button
              type="icon"
              size="24px"
              symbol-id="speed-icon"
              id="toggle-preview-mode"
              class="${previewMode}"
              title="Toggle real-time preview mode, save changes as you type"
              data-event="preview-mode"
            >
            </tonic-button>

            <span class="spacer"></span>
          </header>
          <app-properties id="app-properties" parent=${this}></app-properties>
        </tonic-split-right>
      </tonic-split>

      <dialog-publish
        id="dialog-publish"
        width="50%"
        height="30%"
        parent=${this}
      >
      </dialog-publish>

      <dialog-subscribe
        id="dialog-subscribe"
        width="65%"
        height="30%"
        parent=${this}
      >
      </dialog-subscribe>

      <dialog-confirm
        id="dialog-confirm"
        width="50%"
        height="30%"
      >
      </dialog-confirm>

      <app-sprite></app-sprite>
    `
  }
}

window.onload = () => {
  Tonic.add(RelativeDate)
  Tonic.add(AppEditor)
  Tonic.add(AppProperties)
  Tonic.add(AppProject)
  Tonic.add(AppSprite)
  Tonic.add(AppTerminal)
  Tonic.add(AppView)
  Tonic.add(GitStatus)
  Tonic.add(PatchRequests)
  Tonic.add(DialogConfirm)
  Tonic.add(DialogPublish)
  Tonic.add(DialogSubscribe)
  Tonic.add(ViewHome)
  Tonic.add(ViewImagePreview)
  Tonic.add(ViewProjectSummary)
}
