import Tonic from 'npm:@socketsupply/tonic'
import { exec } from 'socket:child_process'

class GitStatus extends Tonic {
  async * render () {
    yield this.html`
      <tonic-button
        id="publish"
        async="true"
        disabled="true"
        data-event="publish"
        width="100%"
      >Update</tonic-button>
    `

    const app = this.props.app
    const currentProject = app.state.currentProject

    const { data: dataProject } = await app.db.projects.get(currentProject.projectId)

    let gitStatus = { stdout: '', stderr: '' }

    //
    // Try to get the status of the project to tell the user what
    // has changed and help them decide if they should publish.
    //
    try {
      gitStatus = await exec('git status --porcelain', { cwd: dataProject.path })
    } catch (err) {
      gitStatus.stderr = err.message
    }

    if (gitStatus?.stderr.includes('command not found')) {
      return this.html`
        <tonic-button
          id="publish"
          disabled="true"
          data-event="publish"
          title="${gitStatus.stderr}"
          width="100%"
        >Update</tonic-button>
      `
    }

    return this.html`
      <tonic-button
        id="publish"
        data-event="publish"
        class="green"
        width="100%"
        title="There have been changes to this project"
      >Update</tonic-button>
    `
  }
}

export default GitStatus
export { GitStatus }
