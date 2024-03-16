import fs from 'socket:fs'
import path from 'socket:path'
import { Encryption } from 'socket:network'
import { spawn, exec } from 'socket:child_process'

import Tonic from '@socketsupply/tonic'
import { TonicDialog } from '@socketsupply/components/dialog'

import * as ini from '../lib/ini.js'

export class DialogPublish extends TonicDialog {
  click (e) {
    super.click(e)

    const el = Tonic.match(e.target, '[data-event]')
    if (!el) return

    if (el.dataset.event === 'close') {
      super.hide()
    }
  }

  async getProject () {
    const app = this.props.parent
    const currentProject = app.state.currentProject
    if (!currentProject) return

    let src

    try {
      const fp = path.join(currentProject.id, 'socket.ini')
      src = await fs.promises.readFile(fp, 'utf8')
    } catch (err) {
      const notifications = document.querySelector('#notifications')
      notifications?.create({
        type: 'error',
        title: 'Error',
        message: err.message
      })

      return
    }

    let bundleId = ini.get(src, 'meta', 'bundle_identifier')
    bundleId = bundleId.replace(/"/g, '')

    const { data: hasProject } = await app.db.projects.has(bundleId)

    if (hasProject) {
      const { data: dataProject } = await app.db.projects.get(bundleId)
      return dataProject
    }
  }

  async publish (type, value) {
    const app = this.props.parent
    const settings = app.state.settings
    const dataProject = await this.getProject()

    const opts = {

    }

    const subcluster = app.socket.subclusters.get(dataProject.subclusterId)
    const packets = await subcluster.emit(type, value, opts)
  }

  async show () {
    super.show()
    await this.reRender()
  }

  async * render () {
    const app = this.props.parent
    const currentProject = app.state.currentProject
    const cwd = currentProject?.id

    const notifications = document.querySelector('#notifications')
    const coTerminal = document.querySelector('app-terminal')

    //
    // these are cases where the app just isn't initialied yet.
    //
    if (!notifications || !coTerminal) return this.html``
    if (!currentProject || !cwd) return this.html``

    //
    // these git commands might take a few seconds so show the user a spinner
    //
    yield this.html`<tonic-loader></tonic-loader>`

    let output = { stdout: '' }
    let exists = false

    //
    // Check if there is a .git directory, if not run git init.
    //
    try {
      exists = await fs.promises.stat(path.join(cwd, '.git'))
    } catch (err) {
      try {
        // if not, initialize the directory as a git project
        output = await exec('git init', { cwd })
      } catch (err) {
        output.stderr = err.message
      }

      if (output?.stderr.includes('command not found')) {
        await this.hide()
        coTerminal.error(output.stderr)
        return this.html``
      }
    }

    //
    // Get the current hash, it will go into packet.usr3
    //
    try {
      output = await exec('git rev-parse HEAD', { cwd })
    } catch (err) {
      output.stderr = err.message
      coTerminal.writeln(output.stderr)
      await this.hide()
      return this.html``
    }

    const currentHash = output.stdout.trim()
    const commitMessage = '' // TODO(@heapwolf): option user to specify

    //
    // Add any files to the repo
    //
    try {
      output = await exec('git add . --ignore-errors', { cwd })
    } catch (err) {
      output.stderr = err.message
    }

    if (output.stderr) {
      await this.hide()
      coTerminal.error(output.stderr)
      return this.html``
    }

    coTerminal.info('git add .')
    coTerminal.writeln(output.stdout)

    //
    // If there is something to commit...
    //
    if (output.stdout.includes('nothing to commit') === false) {
      //
      // Try to commit the changes.
      //
      const msg = {
        parent: currentHash,
        message: commitMessage
      }

      try {
        output = await exec(`git commit -m '${JSON.stringify(msg)}'`, { cwd })
      } catch (err) {
        output.stderr = err.message
      }

      if (output.stderr) {
        await this.hide()
        coTerminal.error(output.stderr)
        return this.html``
      }

      coTerminal.info('git commit .')
      coTerminal.writeln(output.stdout)

      if (!exists) {
        //
        // This is the first time, so publish the whole .git directory
        //
        try {
          output = await exec('git bundle create repo.bundle --all', { cwd })
        } catch (err) {
          output.stderr = err.message
          coTerminal.writeln(output.stderr)
          await this.hide()
          return this.html``
        }

        coTerminal.info('Publishing bundle')
        const data = await fs.promises.readFile(path.join(cwd, 'repo.bundle'))
        this.publish('clone', data) // into the background
      } else {
        //
        // Just publish the diff
        //
        try {
          output = await exec(`git format-patch -1 HEAD --stdout`, { cwd })
        } catch (err) {
          output.stderr = err.message
        }

        if (output.stderr) {
          coTerminal.error(output.stderr)
          await this.hide()
          return this.html``
        }

        coTerminal.info('Publishing patch')
        this.publish('patch', Buffer.from(output.stdout)) // into the background
      }

      const coProperties = document.querySelector('app-properties')
      coProperties.reRender()
    }

    return this.html`
      <header>
        Publish
      </header>
      <main>
        <h1>🎉</h1>
        <p>Success!</p>
      </main>
      <footer>
        <tonic-button data-event="close">OK</tonic-button>
      </footer>
    `
  }
}
