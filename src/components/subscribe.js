import fs from 'socket:fs'
import path from 'socket:path'
import { Encryption } from 'socket:network'
import { spawn, exec } from 'socket:child_process'

import Tonic from '@socketsupply/tonic'
import { TonicDialog } from '@socketsupply/components/dialog'

export class DialogSubscribe extends TonicDialog {
  async show () {
    super.show()
    await this.reRender()
  }

  async render () {
    return this.html`
      <header>
        Create Subscription
      </header>
      <main>
        <p>
          Enter the unique shared secret for the project you want to subscribe to.
        </p>

        <tonic-input
          id="name-subscribe"
          label="Name of Project"
          width="100%"
        >
        </tonic-input>

        <tonic-input
          id="shared-secret-subscribe"
          label="Project Link"
          width="100%"
        >
        </tonic-input>
      </main>
      <footer>
        <div></div>
        <tonic-button width="164px" data-event="force">Subscribe</tonic-button>
      </footer>
    `
  }
}
