import fs from 'socket:fs'
import path from 'socket:path'

import Tonic from '@socketsupply/tonic'

class ViewHome extends Tonic {
  show () {
    this.classList.add('show')
  }

  hide () {
    this.classList.remove('show')
  }

  async render () {
    return this.html`
      <section class="hero">
        <h1><b>Union</b> App Studio</h1>
      </section>
      <section class="main">
        <tonic-tabs selected="tab-2" id="my-tabs">
          <tonic-tab
            id="tab-1"
            for="tab-panel-1"
          >What's New</tonic-tab>
          <tonic-tab
            id="tab-2"
            for="tab-panel-2"
          >Projects</tonic-tab>
          <tonic-tab
            id="tab-3"
            for="tab-panel-3"
          >Docs</tonic-tab>
        </tonic-tabs>

        <tonic-tab-panel id="tab-panel-1">
          Content One
        </tonic-tab-panel>

        <tonic-tab-panel id="tab-panel-2">
          Content Two
        </tonic-tab-panel>

        <tonic-tab-panel id="tab-panel-3">
          Content Three
        </tonic-tab-panel>
      </section>
    `
  }
}

export default ViewHome
export { ViewHome }
