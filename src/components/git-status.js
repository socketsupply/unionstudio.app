import Tonic from '@socketsupply/tonic'
import { exec } from 'socket:child_process'

// TODO(@heapwolf): this should be a component
class GitStatus extends Tonic {
  async render () {
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
        <tonic-toaster-inline
          id="git-not-installed"
          dismiss="false"
          display="true"
        >Git is not installed and is required to use this program.
        </tonic-toaster-inline>
      `
    }

    return this.html`
      <h2>Git Integration</h2>
      <tonic-textarea
        id="git-status"
        rows="10"
        label="Git Status"
        readonly="true"
        resize="none"
      >${gitStatus.stderr || gitStatus.stdout}</tonic-textarea>
    `
  }
}

export default GitStatus
export { GitStatus }
