import Tonic from 'npm:@socketsupply/tonic'
import { Terminal } from 'npm:xterm'
import { FitAddon as Resizer } from 'npm:xterm-addon-fit'
import { SearchAddon as Search } from 'npm:xterm-addon-search'

// const SECOND = 1000
// const MAX_ROWS = 30 * SECOND

const getComputedStyle = window.getComputedStyle
const INFO = '\x1b[32mINFO\x1b[0m'
const WARN = '\x1b[33mWARN\x1b[0m'
const ERROR = '\x1b[31mERROR\x1b[0m'

/**
 * @typedef {{
 *    type: 'function' | 'website' | 'function-workspace',
 *    functionName?: string,
 *    workspaceFolder: string | null
 * }} TerminalContext
 */

class AppTerminal extends Tonic {
  constructor () {
    super()

    this.debug = true
    this.boundResizeEvent = () => this.resize()
    this.resizeTimeout = null

    /** @type {Terminal | null} */
    this._term = null
    this._lastLine = null
    this.firstFit = true

    /**
     * @type {{
     *    context: null | TerminalContext,
     *    search: null | boolean,
     *    persistLogs: null | boolean,
     *    blur: null | boolean
     * }}
     */
    this.state = {
      context: null,
      persistLogs: null,
      search: null,
      blur: null,

      ...this.state
    }
  }

  static stylesheet () {
    return `
      app-terminal {
        position: absolute;
        top: 0px;
        bottom: 0;
        left: 0;
        right: 0;
      }

      app-terminal .terminal-wrapper {
        position: absolute;
        padding: 10px;
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
        background: var(--tonic-dark);
        transition: top 0.2s ease-in-out;
        box-shadow: inset 0 18px 10px -18px var(--tonic-shadow);
        overflow: hidden;
      }

      app-terminal .terminal-wrapper > .terminal {
        position: absolute;
        top: 10px;
        bottom: 10px;
        left: 10px;
        right: 0;
        background: transparent;
      }

      app-terminal.search .terminal-wrapper {
        top: 76px;
      }
    `
  }

  show () {
    const split = document.querySelector('#split-console')
    if (split.bottom.style.height === '0px') {
      split.toggle('bottom')
    }

    this.resize()
  }

  info (s) {
    this.writeln(`${INFO} ${s}`)
  }

  warn (s) {
    this.writeln(`${WARN} ${s}`)
  }

  error (s) {
    this.writeln(`${ERROR} ${s}`)
  }

  click (e) {
    const el = Tonic.match(e.target, '[data-event]')
    if (!el) return

    const event = el.dataset.event

    if (event === 'close') {
      const app = document.querySelector('app-container')
      app.toggleTerminal()
    }

    if (event === 'clear') {
      this.clear({ deleteCache: true })
    }

    if (event === 'search') {
      this.state.search = !this.state.search
      const searchUI = this.querySelector('.search-ui')
      searchUI.classList[this.state.search ? 'add' : 'remove']('show')
      this.classList[this.state.search ? 'add' : 'remove']('search')
    }
  }

  /**
   * Set the current context. This can set the functionName
   * that is rendered in this terminal. Used to avoid double
   * tailing the same logs into the terminal buffer.
   *
   * Can also set the website context, used to decide whether
   * we should render website logs to the terminal or not.
   *
   * @param {TerminalContext} context
   */
  setContext (context) {
    this.state.context = context
  }

  /**
   * @returns {TerminalContext | null}
   */
  _getContext () {
    return this.state.context
  }

  hasTerminal () {
    return !!this._term
  }

  updated () {
    if (!this._term) return

    const el = this.querySelector('.terminal')

    const computed = getComputedStyle(el)
    const background = computed.getPropertyValue('--tonic-dark')
    const foreground = computed.getPropertyValue('--tonic-info')
    const accent = computed.getPropertyValue('--tonic-accent')

    if (background && foreground) {
      this._term.options.theme = {
        background,
        foreground,
        selection: accent,
        cursor: accent
      }
    }

    this.resize()
  }

  disconnected () {
    if (!this._term) return

    this._term.dispose()
  }

  toggleTerminal () {
    this.updated()
  }

  setTerminal (opts = {}) {
    this.state.blur = opts.blur
  }

  resize () {
    if (!this._term) return

    clearTimeout(this.resizeTimeout)
    this.resizeTimeout = setTimeout(() => {
      this.resizeFit()
    }, 32)
  }

  resizeFit () {
    this.resizer.fit()

    // For some reason the very fit() call grabs the wrong font
    // information and has weird cell width / height.
    // You have to fit it twice to get the correct fit/font/width
    if (this.firstFit) {
      this.resizer.fit()
      this.firstFit = false
    }
  }

  async clear (args = {}) {
    if (!this._term) return

    this._term.reset()
    this._term.clear()
    this._term.reset()
  }

  writeln (s) {
    if (!this._term) return
    this._term.writeln(s)
  }

  async connected () {
    const el = this.querySelector('.terminal')

    //
    // rendererType must be set to 'dom' because some kind of distortion
    // happens when it's set to the default.
    //
    this._term = new Terminal({
      allowTransparency: true,
      convertEol: true,
      fontFamily: 'FiraMono',
      rendererType: 'dom',
      fontSize: 14
    })

    this.resizer = new Resizer()
    this.search = new Search()
    // this.ligatures = new Ligatures()

    this._term.loadAddon(this.resizer)
    this._term.loadAddon(this.search)
    // this.term.loadAddon(this.ligatures)
    this._term.open(el)
    this.resizer.fit()

    this._term.options.cursorBlink = false

    this._term.attachCustomKeyEventHandler(function (e) {
      // Ctrl + C => now implements copy text.
      if (e.ctrlKey && (e.key === 'c')) {
        document.execCommand('copy')
        return false
      }
    })

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
      this.updated()
    })

    window.removeEventListener('resize', this.boundResizeEvent)
    window.addEventListener('resize', this.boundResizeEvent)

    this.updated()
  }

  keydown (e) {
    if (e.keyCode === 9) {
      e.preventDefault()
    }
  }

  render () {
    return this.html`
      <div class="terminal-wrapper">
        <div class="terminal">
        </div>
      </div>
    `
  }
}

export { AppTerminal }
