import Tonic from '@socketsupply/tonic'
import { TonicDialog } from '@socketsupply/components/dialog'

import { spawn, exec } from 'socket:child_process'

export class DialogShare extends TonicDialog {
  async click (e) {
    super.click(e)

    const el = Tonic.match(e.target, '[data-event]')
    if (!el) return

    const { event } = el.dataset

    const notifications = document.querySelector('#notifications')

    if (event === 'share') {
      const app = this.props.parent
      const cwd = app.state.currentProject.id

      console.log('operating in', cwd)

      let output = {}

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

          return notifications.create({
            type: 'error',
            title: 'Unable to commit code',
            message: output.stderr
          })
        }
      }

      console.log('initialized')

      // try to get the status of the project
      try {
        output = await exec('git status', { cwd })
      } catch (err) {
        output.stderr = err.message
      }

      if (output.stderr) {
        return notifications.create({
          type: 'error',
          title: 'Unable to get project status',
          message: output.stderr
        })
      }
      
      console.log('status ok')

      try {
        output = await exec('git', ['add', '-A'], { cwd })
      } catch (err) {
        output.stderr = err.message
      }

      if (output.stderr) {
        return notifications.create({
          type: 'error',
          title: 'Unable to get project status',
          message: output.stderr
        })
      }

      console.log('add ok')
      // try to commit the code to the project
      try {
        output = await exec('git', ['commit', '-m', '"share"'], { cwd })
      } catch (err) {
        output.stderr = err.message
      }

      if (output.stderr) {
        return notifications.create({
          type: 'error',
          title: 'Unable to commit to project',
          message: output.stderr
        })
      }
      console.log('commit ok')

      // Now we can share
    }
  }

  render () {
    return this.html`
      <header>
        Share Code
      </header>
      <main>
        
      </main>
      <footer>
        <div></div>
        <tonic-button data-event="share">Share</tonic-button>
      </footer>
    `
  }
}
