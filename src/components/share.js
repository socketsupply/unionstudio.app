import Tonic from '@socketsupply/tonic'
import { TonicDialog } from '@socketsupply/components/dialog'

export class DialogShare extends TonicDialog {
  async click (e) {
    super.click(e)

    const el = Tonic.match(e.target, '[data-event]')
    if (!el) return

    const { event } = el.dataset

    if (event === 'share') {
      const app = this.props.parent
    }
  }

  render () {
    return this.html`
      <header>
        Share Code
      </header>
      <main>
        asdfsdf
      </main>
      <footer>
        <div></div>
        <tonic-button data-event="share">Share</tonic-button>
      </footer>
    `
  }
}
