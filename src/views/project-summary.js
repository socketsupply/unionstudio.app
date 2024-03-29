import Tonic from '@socketsupply/tonic'

class ViewProjectSummary extends Tonic {
  show () {
    this.classList.add('show')
  }

  hide () {
    this.classList.remove('show')
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
