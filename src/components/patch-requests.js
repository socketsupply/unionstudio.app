import Tonic from '@socketsupply/tonic'
import { exec } from 'socket:child_process'

class PatchRequests extends Tonic {
  async render () {
    const app = this.props.app

    const { data: dataPatches } = await app.db.patches.readAll()

    let patches = []

    for (const [patchId, patch] of dataPatches.entries()) {
      patches.push(this.html`
        <tr>
          <td>
            <tonic-button type="icon" symbol-id="plus-icon" data-event="apply" data-value="${patchId}"></tonic-button>
            <tonic-button type="icon" symbol-id="edit-icon" data-event="load" data-value="${patchId}"></tonic-button>
          </td>
          <td>${patch.author}</td>
          <td>${patch.date}</td>
          <td>${patch.parent}</td>
          <td>${patch.message}</td>
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
          <th>Parent</th>
          <th>Commit Message</th>
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
