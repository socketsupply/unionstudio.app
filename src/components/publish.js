import fs from 'socket:fs'
import path from 'socket:path'
import { exec, execSync } from 'socket:child_process'

import Tonic from 'npm:@socketsupply/tonic'
import { TonicDialog } from 'npm:@socketsupply/components/dialog'

export class DialogPublish extends TonicDialog {
  click (e) {
    super.click(e)

    const el = Tonic.match(e.target, '[data-event]')
    if (!el) return

    if (el.dataset.event === 'close') {
      super.hide()
    }
  }

  async publish (type, value) {
    const app = this.props.parent
    const currentProject = app.state.currentProject
    const { data: dataProject } = await app.db.projects.get(currentProject.bundleId)

    const opts = {
      // TODO(@heapwolf): probably chain with previousId
    }

    let subcluster = app.socket.subclusters.get(dataProject.subclusterId)

    // user created a new subcluster but it's not yet been activated.
    if (!subcluster) {
      subcluster = await app.socket.subcluster({ sharedKey: dataProject.sharedKey })
    }

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

      try {
        output = await exec(`git commit -m "${currentHash}" -m "${commitMessage}"`, { cwd })
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
        let output
        try {
          output = await execSync('git format-patch -1 HEAD --stdout', { cwd })
        } catch (err) {
          console.error(err)
          output = err.message
          return
        }

        console.log(output)
        this.publish('patch', Buffer.from(output)) // into the background
      }

      const coProjectSummary = document.querySelector('view-project-summary')
      coProjectSummary.reRender()
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
