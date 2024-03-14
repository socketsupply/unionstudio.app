import fs from 'socket:fs'
import path from 'socket:path'
import { Encryption } from 'socket:network'
import { spawn, exec } from 'socket:child_process'

import Tonic from '@socketsupply/tonic'
import { TonicDialog } from '@socketsupply/components/dialog'

export class DialogPublish extends TonicDialog {
  async publish (value) {
    const app = this.props.parent

    console.log(app.socket)
  }

  async show () {
    super.show()
    await this.reRender()
  }

  async * render () {
    const app = this.props.parent
    const currentProject = app.state.currentProject
    const cwd = currentProject?.id

    if (!cwd) return this.html``

    yield this.html`
      <tonic-loader></tonic-loader>
    `

    const { data: dataPeer } = await app.db.state.get('peer')
    let sharedSecret = this.state.sharedSecret || await Encryption.createId()

    // if there is no subscription for this, create one
    if (!dataPeer.config?.clusterId) {
      // TODO(@heapwolf): project ids should be agnostic of paths in case the user wants to change the path
      await app.db.subscriptions.put(currentProject.id, {
        name: currentProject.label,
        clusterId,
        channelId: scid,
        sharedKey,
        description: 'The default channel.',
        rateLimit: 32,
        lastUpdate: Date.now(),
        nicks: 1,
        unread: 0,
        mentions: 0
      })
    }

    const notifications = document.querySelector('#notifications')
    const coTerminal = document.querySelector('app-terminal')

    let output = { stdout: '' }

    // Check if the project is a git directory.
    try {
      await fs.promises.stat(path.join(cwd, '.git'))
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

    // try to get the status of the project
    try {
      output = await exec('git status', { cwd })
    } catch (err) {
      output.stderr = err.message
    }

    if (output.stderr) {
      coTerminal.error(output.stderr)
      return this.html``
    }

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

    if (!output.stdout.includes('nothing to commit')) {
      // try to commit the code to the project
      try {
        output = await exec('git commit -m "share"', { cwd })
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

      try {
        output = await exec('git show HEAD', { cwd })
      } catch (err) {
        output.stderr = err.message
      }

      if (output.stderr) {
        await this.hide()
        coTerminal.error(output.stderr)
        return this.html``
      }

      // Now we're ready to share the diff, which can be applied as a patch when
      // received by another user who is subscribing to this user's subcluster.
      // this.publish(output.stdout)
    }

    return this.html`
      <header>
        Publish
      </header>
      <main>
        <p>
          This is a unique shared secret for <b>${app.state.currentProject.label}</b>,
          share it only with people that you want to access this code.
        </p>

        <tonic-input
          id="shared-secret-publish"
          label="Shared Secret"
          symbol-id="copy-icon"
          position="right"
          readonly="true"
          width="100%"
          value="${sharedSecret.toString('hex')}"
        >
        </tonic-input>
      </main>
      <footer>
        <div></div>
        <!-- tonic-button width="164px" data-event="force">Force Publish</tonic-button -->
      </footer>
    `
  }
}
