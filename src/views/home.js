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

  async change (e) {
    const el = Tonic.match(e.target, '[data-event]')
    if (!el) return

    const { event } = el.dataset

    const app = this.props.parent
    const { data: dataUser } = await app.db.state.get('user')

    if (event === 'change-bio') {
      dataUser.bio = el.value
      await app.db.set('user', dataUser)
    }

    if (event === 'change-avatar') {
      let img = new Image()
      img.src = el.state.data

      /* const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')

      canvas.width = 120
      canvas.height = 120

      context.drawImage(img, 0, 0, 120, 120)
      dataUser.avatar = canvas.toDataURL('image/jpeg', 0.5) */

      dataUser.avatar = el.state.data
      await app.db.state.put('user', dataUser)
    }
    
    if (event === 'copy-public-key') {
      navigator.clipboard.writeText(el.value)
    }
  }

  async render () {
    const app = this.props.parent
    const { data: dataUser } = await app.db.state.get('user')

    const publicKey = Buffer.from(dataUser.publicKey).toString('base64')
    const bio = dataUser.bio || ''

    return this.html`
      <section class="hero">
        <h1><b>Union</b> App Studio</h1>
      </section>
      <section class="main">
        <tonic-tabs selected="tab-news" id="home-tabs">
          <tonic-tab
            id="tab-news"
            for="tab-panel-news"
          >What's New</tonic-tab>
          <tonic-tab
            id="tab-docs"
            for="tab-panel-docs"
          >Docs</tonic-tab>
          <tonic-tab
            id="tab-profile"
            for="tab-panel-profile"
          >Profile</tonic-tab>
        </tonic-tabs>

        <tonic-tab-panel id="tab-panel-news">
          <h2>What's New!</h2>
          <label class="panel-label">A social feed of code that you can subscribe to.</label>
          <section>
            Content One
          </section>
        </tonic-tab-panel>

        <tonic-tab-panel id="tab-panel-docs">
          <h2>Platform Documentation</h2>
          <label class="panel-label">This section provides all documents for the current version of Socket Runtime.</label>
          <section>
            <tonic-input
              width="100%"
              placeholder="Search..."
              id="docs-search"
              symbol-id="search-icon"
              position="right"
            ></tonic-input>
          </section>
        </tonic-tab-panel>

        <tonic-tab-panel id="tab-panel-profile">
          <h2>User Profile</h2>
          <label class="panel-label">Your profile information is used to secure and share code with others.</label>
          <section>
            <tonic-profile-image
              id="profile-image-example-editable"
              size="120px"
              src="${dataUser.avatar}"
              data-event="change-avatar"
              editable="true">
            </tonic-profile-image>

            <tonic-button
              id="profile-regenerate-keypair"
              data-event="regenerate-keypair"
              width="180px"
            >Regenerate Keys</tonic-button>

            <tonic-textarea
              label="Bio"
              rows="4"
              resize="none"
              value="${bio}"
              maxlength="512"
              data-event="change-bio"
              placeholder="Hi. I'm a hacker..."
              id="profile-bio"
            ></tonic-textarea>

            <tonic-textarea
              label="Public Key (base64)"
              rows="4"
              resize="none"
              value="${publicKey}"
              readonly="true"
              data-event-"copy-public-key"
              id="profile-public-key"
            ></tonic-textarea>
          </section>
        </tonic-tab-panel>
      </section>
    `
  }
}

export default ViewHome
export { ViewHome }
