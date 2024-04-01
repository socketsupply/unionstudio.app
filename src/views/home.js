import application from 'socket:application'
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

  async click (e) {
    const el = Tonic.match(e.target, '[data-event]')
    if (!el) return

    const { event } = el.dataset

    if (event === 'upgrade') {
      const opts = {
        config: {
          webview_auto_register_service_workers: false,
          webview_service_worker_frame: false
        },
        path: 'pages/account.html',
        index: 14,
        closable: true,
        maximizable: false,
        title: 'Signup',
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: '10x26',
        backgroundColorDark: 'rgba(46, 46, 46, 1)',
        backgroundColorLight: 'rgba(255, 255, 255, 1)',
        resizable: false,
        width: 450,
        height: 300
      }

      const w = await application.createWindow(opts)

      w.channel.addEventListener('message', e => {
        console.log(e.data)
      })
    }
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
    const avatar = dataUser.avatar || ''

    return this.html`
      <header class="component">
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
      </header>

      <div class="content">
        <tonic-tab-panel id="tab-panel-news">
          <div class="empty-state">
            <span>No new items...</span>
          </div>
        </tonic-tab-panel>

        <tonic-tab-panel id="tab-panel-docs">
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
          <section>
            <tonic-profile-image
              id="profile-image-example-editable"
              size="120px"
              src="${avatar}"
              data-event="change-avatar"
              editable="true"
            >
            </tonic-profile-image>

            <div class="buttons">
              <tonic-button
                id="profile-regenerate-keypair"
                data-event="regenerate-keypair"
                width="180px"
              >Regenerate Keys</tonic-button>
              <!-- tonic-button
                id="profile-upgrade"
                data-event="upgrade"
                width="140px"
              >Upgrade</tonic-button -->
            </div>

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
      </div>
    `
  }
}

export default ViewHome
export { ViewHome }
