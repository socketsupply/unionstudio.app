import Tonic from '@socketsupply/tonic'
import fs from 'socket:fs'
import path from 'socket:path'
import { exec } from 'socket:child_process'
import { Encryption, sha256 } from 'socket:network'

import * as ini from '../lib/ini.js'

class AppProperties extends Tonic {
  constructor () {
    super()
  }

  async change (e) {
    const el = Tonic.match(e.target, '[data-event]')
    if (!el) return

    const { event, section, value } = el.dataset

    const app = this.props.parent
    const notifications = document.querySelector('#notifications')
    const editor = document.querySelector('app-editor')
    const project = document.querySelector('app-project')

    if (event === 'preview') {
      const pathToSettingsFile = path.join(path.DATA, 'projects', 'settings.json')
      const previewWindow = app.state.settings.previewWindows.find(o => o.title === value)

      if (previewWindow) {
        previewWindow.active = !previewWindow.active

        const currentProject = app.state.currentProject

        // if the user currently has the config file open in the editor...
        if (currentProject.label === 'settings.json' && currentProject.parent.id === 'root') {
          try {
            editor.value = JSON.stringify(app.state.settings, null, 2)
          } catch (err) {
            return notifications.create({
              type: 'error',
              title: 'Unable to save config file',
              message: err.message
            })
          }
        }

        try {
          const str = JSON.stringify(app.state.settings)
          await fs.promises.writeFile(pathToSettingsFile, str)
        } catch (err) {
          return notifications?.create({
            type: 'error',
            title: 'Error',
            message: 'Unable to update settings'
          })
        }

        app.activatePreviewWindows()
      }
    }

    if (event === 'property') {
      const node = project.getNodeByProperty('id', 'socket.ini')
      node.data = ini.set(node.data, section, el.id, el.value)

      const dest = path.join(app.state.cwd, node.id)
      await fs.promises.writeFile(dest, node.data)

      editor.loadProjectNode(node)

      notifications?.create({
        type: 'info',
        title: 'Note',
        message: 'A restart of the app your building may be required.'
      })
    }
  }

  async click (e) {
    const el = Tonic.match(e.target, '[data-event]')
    if (!el) return

    const { event, propertyValue } = el.dataset

    if (event === 'copy-link') {
      navigator.clipboard.writeText(el.value)
    }

    if (event === 'publish') {
      const coDialogPublish = document.querySelector('dialog-publish')
      if (coDialogPublish) coDialogPublish.show()
    }
  }

  async loadProjectNode (node) {
    this.reRender()
    return true
  }

  async render () {
    let src = ''

    const app = this.props.parent
    const settings = app.state.settings
    const currentProject = app.state.currentProject
    const cwd = currentProject?.id

    if (currentProject) {
      try {
        const pathToConfigFile = path.join(cwd, 'socket.ini')
        src = await fs.promises.readFile(pathToConfigFile, 'utf8')
      } catch (err) {
        const notifications = document.querySelector('#notifications')
        notifications?.create({
          type: 'error',
          title: 'Error',
          message: err.message
        })
      }
    }

    const previewWindows = []

    if (settings?.previewWindows) {
      let index = 0

      if (Array.isArray(settings.previewWindows)) {
        for (const w of settings.previewWindows) {
          if (!w.title) continue
          previewWindows.push(this.html`
            <tonic-checkbox
              id="${w.title}-${String(index++)}"
              data-event="preview"
              data-value="${w.title}"
              checked="${String(w.active)}"
              data-aspect-ratio="${w.aspectRatio}"
              data-resolution="${w.resolution}"
              label="${w.title}"
              title="${w.description || ''}"
            ></tonic-checkbox>
          `)
        }
      }
    }

    let bundleId = ini.get(src, 'meta', 'bundle_identifier')
    if (bundleId) bundleId = bundleId.replace(/"/g, '')

    let sharedSecret = ''

    const { data: hasBundle } = await app.db.projects.has(bundleId)

    if (hasBundle) {
      const { data: dataBundle } = await app.db.projects.get(bundleId)
      sharedSecret = dataBundle.sharedSecret
    } else if (cwd) {
      //
      // The clusterId is hard coded for now.
      //
      const cluster = await sha256('socket-app-studio', { bytes: true })
      const clusterId = cluster.toString('base64')

      sharedSecret = (await Encryption.createId()).toString('hex')
      const sharedKey = await Encryption.createSharedKey(sharedSecret)
      const derivedKeys = await Encryption.createKeyPair(sharedKey)

      const subcluster = Buffer.from(derivedKeys.publicKey)
      const subclusterId = subcluster.toString('base64')

      //
      // Projects are keyed off the bundleId
      //
      await app.db.projects.put(bundleId, {
        bundleId,
        clusterId,
        subclusterId,
        sharedKey,
        sharedSecret // TODO(@heapwolf): encrypt sharedSecret via initial global password
      })

      //
      // We need to tell the network to start listening for this subcluster
      //
      await app.initNetwork()
    }

    let projectUpdates = []
    let gitStatus = { stdout: '' }

    if (cwd) {
      //
      // If there is a current project, check if its been git initialized.
      //
      try {
        await fs.promises.stat(path.join(cwd, '.git'))
      } catch (err) {
        try {
          gitStatus = await exec('git init', { cwd })
        } catch (err) {
          gitStatus.stderr = err.message
        }

        if (gitStatus?.stderr.includes('command not found')) {
          projectUpdates.push(this.html`
            <tonic-toaster-inline
              id="git-not-installed"
              dismiss="false"
              display="true"
            >Git is not installed and is required to use this program.
            </tonic-toaster-inline>
          `)
        }
      }

      //
      // Try to get the status of the project to tell the user what
      // has changed and help them decide if they should publish.
      //
      try {
        gitStatus = await exec('git status --porcelain', { cwd })
      } catch (err) {
        gitStatus.stderr = err.message
      }

      projectUpdates = this.html`
        <pre id="project-status"><code>No changes.</code></pre>
      `

      if (!gitStatus.stderr && gitStatus.stdout.length) {
        projectUpdates = this.html`
          <pre id="project-status"><code>${gitStatus.stdout}</code></pre>
          <tonic-button
            id="publish"
            data-event="publish"
            width="180px"
            class="pull-right"
          >Publish Changes</tonic-button>
        `
      }
    }

    return this.html`
      <tonic-accordion id="options" selected="preview-windows">
        <h3>App Settings</h3>
        <tonic-accordion-section
          name="preview-windows"
          id="preview-windows"
          label="Preview Windows"
        >
          ${previewWindows}
        </tonic-accordion-section>

        <h3>Project Settings</h3>
        <tonic-accordion-section
          name="application"
          id="application"
          label="Desktop Features"
        >
          <tonic-checkbox data-section="build" id="headless" checked="${ini.get(src, 'build', 'headless')}" data-event="property" label="Headless" title="Headless"></tonic-checkbox>
          <tonic-checkbox data-section="application" id="tray" checked="${ini.get(src, 'application', 'tray')}" label="Tray" data-event="property" title="Tray"></tonic-checkbox>
          <tonic-checkbox data-section="application" id="agent" checked="${ini.get(src, 'application', 'agent')}" data-event="property" label="Agent" title="Agent"></tonic-checkbox>
        </tonic-accordion-section>
        <tonic-accordion-section
          name="permissions"
          id="permissions"
          label="Permissions"
        >
          <tonic-checkbox data-section="permissions" id="allow_fullscreen" checked="${ini.get(src, 'permissions', 'allow_fullscreen')}" data-event="property" label="Full Screen"></tonic-checkbox>
          <tonic-checkbox data-section="permissions" id="allow_microphone" checked="${ini.get(src, 'permissions', 'allow_microphone')}" data-event="property" label="Microphone"></tonic-checkbox>
          <tonic-checkbox data-section="permissions" id="allow_camera" checked="${ini.get(src, 'permissions', 'allow_camera')}" data-event="property" label="Camera"></tonic-checkbox>
          <tonic-checkbox data-section="permissions" id="allow_user_media" checked="${ini.get(src, 'permissions', 'allow_user_media')}" data-event="property" label="User Media"></tonic-checkbox>
          <tonic-checkbox data-section="permissions" id="allow_geolocation" checked="${ini.get(src, 'permissions', 'allow_geolocation')}" data-event="property" label="Geolocation"></tonic-checkbox>
          <tonic-checkbox data-section="permissions" id="allow_notifications" checked="${ini.get(src, 'permissions', 'allow_notifications')}" data-event="property" label="Notifications"></tonic-checkbox>
          <tonic-checkbox data-section="permissions" id="allow_sensors" checked="${ini.get(src, 'permissions', 'allow_sensors')}" data-event="property" label="Sensors"></tonic-checkbox>
          <tonic-checkbox data-section="permissions" id="allow_clipboard" checked="${ini.get(src, 'permissions', 'allow_clipboard')}" data-event="property" label="Clipboard"></tonic-checkbox>
          <tonic-checkbox data-section="permissions" id="allow_bluetooth" checked="${ini.get(src, 'permissions', 'allow_bluetooth')}" data-event="property" label="Bluetooth"></tonic-checkbox>
          <tonic-checkbox data-section="permissions" id="allow_data_access" checked="${ini.get(src, 'permissions', 'allow_data_access')}" data-event="property" label="Data Access"></tonic-checkbox>
          <tonic-checkbox data-section="permissions" id="allow_airplay" checked="${ini.get(src, 'permissions', 'allow_airplay')}" data-event="property" label="AirPlay"></tonic-checkbox>
          <tonic-checkbox data-section="permissions" id="allow_hotkeys" checked="${ini.get(src, 'permissions', 'allow_hotkeys')}" data-event="property" label="AirPlay"></tonic-checkbox>
        </tonic-accordion-section>
        <tonic-accordion-section
          name="share-settings"
          id="share-settings"
          label="Sharing"
        >
          <tonic-input
            label="Project Link"
            id="shared-secret"
            symbol-id="copy-icon"
            position="right"
            data-event="copy-link"
            value="${sharedSecret}"
            readonly="true"
          ></tonic-input>

          <label>Project Status</label>
          ${projectUpdates}
        </tonic-accordion-section>
      </tonic-accordion>
    `
  }
}

export { AppProperties }
export default AppProperties
