import Tonic from '@socketsupply/tonic'
import { Encryption, sha256 } from 'socket:network'

class ViewProjectSummary extends Tonic {
  show () {
    this.classList.add('show')
  }

  hide () {
    this.classList.remove('show')
  }

  async click (e) {
    const elCopy = Tonic.match(e.target, '[symbol-id="copy-icon"]')

    if (elCopy) {
      navigator.clipboard.writeText(elCopy.nextElementSibling.value)
      return
    }

    const el = Tonic.match(e.target, '[data-event]')
    if (!el) return

    const { event } = el.dataset

    if (event === 'publish') {
      const coDialogPublish = document.querySelector('dialog-publish')
      if (coDialogPublish) coDialogPublish.show()
    }
  }

  async change (e) {
    const el = Tonic.match(e.target, '[data-event]')
    if (!el) return

    const { event, section, value } = el.dataset

    const app = this.props.parent
    const currentProject = app.state.currentProject

    const notifications = document.querySelector('#notifications')
    const editor = document.querySelector('app-editor')
    const project = document.querySelector('app-project')

    const { data: dataProject } = await app.db.projects.get(currentProject.projectId)

    if (event === 'org' || event === 'shared-secret') {
      if (event === 'org') {
        dataProject.org = el.value
        dataProject.clusterId = await sha256(el.value, { bytes: true })
      }

      if (event === 'shared-secret') {
        const sharedKey = await Encryption.createSharedKey(el.value)
        const derivedKeys = await Encryption.createKeyPair(sharedKey)
        const subclusterId = Buffer.from(derivedKeys.publicKey)

        dataProject.sharedKey = sharedKey
        dataProject.sharedSecret = el.value
        dataProject.subclusterId = subclusterId
      }

      await app.db.projects.put(currentProject.projectId, dataProject)
      await app.initNetwork()
      this.reRender()
    }
  }

  async render () {
    const app = this.props.parent
    const currentProject = app.state.currentProject

    if (!currentProject) return this.html``

    const { data: dataProject } = await app.db.projects.get(currentProject.projectId)

    let items

    if (dataProject.waiting) {
      items = this.html`
        <div class="empty-state">
          <p>Waiting...</p>
        </div>
      `
    }

    if (!dataProject.waiting) {
      items = this.html`
        <div class="sharing">
          <tonic-input
            label="Organization"
            id="org-name"
            data-event="org"
            spellcheck="false"
            value="${dataProject.org}"
          ></tonic-input>

          <tonic-input
            label="Shared Secret"
            id="shared-secret"
            data-event="shared-secret"
            spellcheck="false"
            value="${dataProject.sharedSecret}"
          ></tonic-input>

          <tonic-input
            label="Project Link"
            id="project-link"
            symbol-id="copy-icon"
            position="right"
            spellcheck="false"
            readonly="true"
            value="union://${dataProject.sharedSecret}?id=${encodeURIComponent(dataProject.bundleId)}&org=${dataProject.org}"
          ></tonic-input>

          <tonic-button
            id="publish"
            data-event="publish"
            width="100%"
            class="pull-right"
          >Commit & Publish</tonic-button>

          <git-status id="git-status" app=${app} parent=${this}>
          </git-status>

          <patch-requests id="patch-requests" app=${app} parent=${this}>
          </patch-requests>
        </div>
      `
    }

    return this.html`
      <header class="component">
        <span>${currentProject.label}</span>
      </header>
      <div class="container">
        ${items}
      </div>
    `
  }
}

export default ViewProjectSummary
export { ViewProjectSummary }
