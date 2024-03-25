import { TonicDialog } from '@socketsupply/components/dialog'

class DialogConfirm extends TonicDialog {
  async prompt (opts) {
    this.state = opts
    await this.reRender()
    await this.show()
    const result = await this.event('click')
    await this.hide()
    return result
  }

  renderCheckbox () {
    if (this.state.checkboxLabel) {
      return this.html`
        <tonic-checkbox
          label="${this.state.checkboxLabel}",
          id="T${Math.random()}"
        ></tonic-checkbox>
      `
    }
  }

  renderButtons () {
    if (!this.state.buttons) {
      return this.html`
        <tonic-button async="true" value="ok">OK</tonic-button>
      `
    }

    return this.state.buttons.map(button => {
      const isAsync = button.isAsync === true ? 'true' : 'false'

      return this.html`
        <tonic-button
          value="${button.value}"
          async="${isAsync}"
        >${button.label}</tonic-button>`
    })
  }

  render () {
    const {
      message,
      title = 'Confirm',
      type = 'warning'
    } = this.state

    return this.html`
      <header>${title}</header>
      <main>
        <tonic-icon
          symbol-id="${type}"
          size="24px"
        ></tonic-icon>
        <div class="message">
          ${message}
        </div>
        ${this.renderCheckbox()}
      </main>
      <footer>
        ${this.renderButtons()}
      </footer>
    `
  }
}

export default DialogConfirm
export { DialogConfirm }
