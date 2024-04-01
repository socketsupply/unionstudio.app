import Tonic from '@socketsupply/tonic'

class PatchRequests extends Tonic {
  async click (e) {
    const el = Tonic.match(e.target, '[data-event]')
    if (!el) return

    const app = this.props.app
    const row = el.closest('.row')
    const value = row.dataset.value

    const { data: patch } = await app.db.patches.get(value)

    const { event } = el.dataset

    if (event === 'view') {
      const coProjectSummary = document.querySelector('view-project-summary')
      const coEditor = document.querySelector('app-editor')
      const name = (patch.patchId || patch.headers.parent.slice(6)) + '.patch'

      coEditor.loadProjectNode({
        isReadOnly: true,
        id: name,
        label: name,
        value: patch.src
      })

      coProjectSummary.hide()
    }

    if (event === 'apply') {
      console.log('APPLY', patch)
    }

    if (event === 'trash') {
      console.log('TRASH', patch)
    }

    if (event === 'trust') {
      const { data: hasKey } = await app.db.keys.has(patch.headers.from)

      if (!hasKey) {
        await app.db.keys.put(patch.headers.from, patch.publicKey)
        this.reRender()
        return
      }

      await app.db.keys.del(patch.headers.from)
      this.reRender()
    }
  }

  async render () {
    const app = this.props.app

    const { data: dataPatches } = await app.db.patches.readAll()

    const patches = []

    for (const [patchId, patch] of dataPatches.entries()) {
      const ts = (new Date(patch.headers.date)).getTime()
      let statusIcon = 'warning'
      let statusTitle = 'This patch is not associated with a trusted public key. Click here to trust it.'
      const { data: hasKey } = await app.db.keys.has(patch.headers.from)

      if (hasKey && patch.publicKey && patch.headers.from) {
        const { data: dataKey } = await app.db.keys.get(patch.headers.from)

        const savedB64pk = Buffer.from(dataKey || '').toString('base64')
        const thisB64pk = Buffer.from(patch.publicKey || '').toString('base64')

        if (dataKey && savedB64pk === thisB64pk) {
          statusIcon = 'info'
          statusTitle = 'This patch is associated with a trusted public key. Click here to untrust it.'
        } else {
          statusIcon = 'danger'
          statusTitle = 'This patch may have been tampered with. Click here to override the assessment.'
        }
      }

      patches.push(this.html`
        <div class="row" data-event="view" data-value=${patchId}>
          <span>${patch.headers.from}</span>
          <span><relative-date ts="${ts}"></relative-date></span>
          <span>${patch.summary.split('\n').pop()}</span>
          <span class="actions">
            <tonic-button type="icon" symbol-id="plus-icon" title="Apply the patch" size="16px" data-event="apply"></tonic-button>
            <tonic-button type="icon" symbol-id="${statusIcon}-icon" title="${statusTitle}" size="16px" data-event="trust"></tonic-button>
            <tonic-button type="icon" symbol-id="trash-icon" title="Discard this patch" size="16px" data-event="trash"></tonic-button>
          </span>
        </div>
      `)
    }

    return this.html`
      <h2>Patch Requests</h2>
      <div class="patches">
        <div class="thead">
          <span>Author</span>
          <span>Date</span>
          <span>Summary</span>
        </div>
        <div class="tbody">
          ${patches}
        <div>
      </div>
    `
  }
}

export default PatchRequests
export { PatchRequests }
