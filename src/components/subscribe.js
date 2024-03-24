import fs from 'socket:fs'
import path from 'socket:path'
import { Encryption, sha256 } from 'socket:network'
import { spawn, exec } from 'socket:child_process'

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

    const { event } = el.dataset

    if (event === 'subscribe') {
      const coInput = this.querySelector('#subscribe-shared-secret')
      const url = new URL(coInput.value.trim())

      const cId = url.searchParams.get('clusterId')
      const bundleId = url.searchParams.get('bundleId')

      if (!bundleId || !cId) {
        const notifications = document.querySelector('#notifications')
        notifications.create({
          type: 'error',
          title: 'Error',
          message: 'Invalid Project Link'
        })

        super.hide()
        return
      }

      const sharedSecret = url.hostname
      const clusterId = await sha256(cId, { bytes: true })
      const sharedKey = await Encryption.createSharedKey(sharedSecret)
      const derivedKeys = await Encryption.createKeyPair(sharedKey)
      const subclusterId = Buffer.from(derivedKeys.publicKey)

      const project = {
        bundleId,
        clusterId,
        subclusterId,
        sharedKey,
        sharedSecret
      }

      await app.db.projects.put(bundleId, project)
      await app.initNetwork()
    }
  }

  async render () {
    return this.html`
      <header>
        Create Subscription
      </header>
      <main>
        <p>
          Enter the unique link for the project you want to subscribe to. You will receive updates as "patch requests".
        </p>

        <tonic-input
          id="subscribe-shared-secret"
          label="Project Link"
          placeholder="union://abc?bundleId=com.beep.boop&clusterId=haxortown"
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
