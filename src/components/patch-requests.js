import Tonic from '@socketsupply/tonic'
import { exec } from 'socket:child_process'

class PatchRequests extends Tonic {
  async render () {
    const app = this.props.app

    const { data: dataPatches } = await app.db.patches.readAll()

    let patches = []

    for (const [patchId, patch] of dataPatches.entries()) {
      const meta = {}

      patches.push(this.html`
        <tr>
          <td>
            <tonic-button type="icon" symbol-id="plus-icon" size="16px" data-event="apply" data-value="${patchId}"></tonic-button>
            <tonic-button type="icon" symbol-id="search-icon" size="16px" data-event="load" data-value="${patchId}"></tonic-button>
          </td>
          <td>${patch.headers.from}</td>
          <td>${patch.headers.date}</td>
          <td>${patch.summary.split('\n').pop()}</td>
        </tr>
      `)
    }

    return this.html`
      <h2>Patch Requests</h2>
      <table class="patches">
        <thead>
          <th>Actions</th>
          <th>Author</th>
          <th>Date</th>
          <th>Summary</th>
        </thead>
        <tbody>
          ${patches}
        <tbody>
      </table>
    `
  }
}

export default PatchRequests
export { PatchRequests }
