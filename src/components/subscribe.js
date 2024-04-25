import fs from 'socket:fs'
import path from 'socket:path'
import { Encryption, sha256 } from 'socket:network'

import Tonic from '@socketsupply/tonic'
import { TonicDialog } from '@socketsupply/components/dialog'

export class DialogSubscribe extends TonicDialog {
  async show () {
    super.show()
    await this.reRender()
  }

  async click (e) {
    super.click(e)

    const el = Tonic.match(e.target, '[data-event]')
    if (!el) return

    const app = this.props.parent
    const notifications = document.querySelector('#notifications')

    const { event } = el.dataset

    if (event === 'subscribe') {
      const coInput = this.querySelector('#subscribe-shared-secret')
      const url = new URL(coInput.value.trim())

      const sharedSecret = url.searchParams.get('secret')

      // union://com.demo.project&secret=foo

      if (!sharedSecret) {
        notifications.create({
          type: 'error',
          title: 'Error',
          message: 'Invalid Project Link: expected property "secret".'
        })

        super.hide()
        return
      }

      const bundleId = url.hostname
      const clusterId = await sha256('union-app-studio', { bytes: true })
      const sharedKey = await Encryption.createSharedKey(sharedSecret)
      const derivedKeys = await Encryption.createKeyPair(sharedKey)
      const subclusterId = Buffer.from(derivedKeys.publicKey)
      const pathToProject = path.join(path.DATA, bundleId)

      try {
        await fs.promises.mkdir(pathToProject, { recursive: true })
        await execSync('git init', { cwd: pathToProject })
      } catch (err) {
        notifications.create({
          type: 'error',
          title: 'Error',
          message: err.message
        })
        super.hide()
        return
      }

      const project = {
        bundleId,
        label: bundleId,
        waiting: true,
        path: pathToProject,
        clusterId,
        subclusterId,
        sharedKey,
        sharedSecret
      }

      await app.db.projects.put(bundleId, project)
      await app.initNetwork()

      const coProject = document.querySelector('app-project')
      await this.hide()
      coProject.load()
    }
  }

  async render () {
    return this.html`
      <header>
        Create Subscription
      </header>
      <main>
        <p>
          Enter the unique link for the project you want to subscribe to. It may take up to several minutes to acquire all updates. Future updates may arrive in the form of "patch requests".
        </p>

        <tonic-input
          id="subscribe-shared-secret"
          label="Project Link"
          placeholder="union://com.beep.boop&secret=d3adc0de..."
          spellcheck="false"
          value=""
          width="100%"
        >
        </tonic-input>
      </main>
      <footer>
        <div></div>
        <tonic-button width="164px" data-event="subscribe">Subscribe</tonic-button>
      </footer>
    `
  }
}
