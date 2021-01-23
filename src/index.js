'use strict'

const Tonic = require('@optoolco/tonic')
const components = require('@optoolco/components')
const { remote } = require('electron')
const CodeMirror = require('codemirror')
const ts = require('typescript')

require('codemirror/mode/javascript/javascript')
require('codemirror/mode/htmlmixed/htmlmixed')
require('codemirror/mode/css/css')
require('codemirror/addon/edit/matchbrackets')
require('codemirror/keymap/vim')

components(Tonic)

window.onbeforeunload = function (e) {
  if (process.platform === 'win32') return
  if (!remote.getGlobal('quitting')) {
    const win = remote.getCurrentWindow()
    win.minimize()
    return false
  }
}

const opts = {
  tabSize: 2,
  styleActiveLine: false,
  matchBrackets: true,
  theme: window.localStorage.theme || 'light',
  gutters: ['CodeMirror-lint-markers'],
  lint: true
}

class MainComponent extends Tonic {
  constructor () {
    super()
    this.editors = {}

    global.ipc.on('message', (_, ...args) => this.ipc(...args))
  }

  ipc (arg, value) {
    switch (arg) {
      case 'javascript': {
        const split = document.querySelector('#split-js')
        split.toggle('top')
        break
      }

      case 'javascript-output': {
        const split = document.querySelector('#split-js')
        split.toggle('bottom')
        break
      }

      case 'html': {
        const split = document.querySelector('#split-pres')
        split.toggle('left')
        break
      }

      case 'css': {
        const split = document.querySelector('#split-pres')
        split.toggle('right')
        break
      }

      case 'labels': {
        document.body.classList.toggle('no-labels')
        break
      }

      case 'theme': {
        let theme = window.localStorage.theme

        if (!theme || theme === 'light') {
          theme = window.localStorage.theme = 'dark'
        } else {
          theme = window.localStorage.theme = 'light'
        }

        document.body.setAttribute('theme', theme)
        break
      }

      case 'typescript': {
        window.__typescript = !window.__typescript

        if (window.__typescript) {
          window.localStorage.ts = true
        } else {
          delete window.localStorage.ts
        }

        this.evaluateScript(true)
      }
    }
  }

  evaluateScript (isSelf) {
    let src = this.editors.jsInput.getValue()

    if (src) {
      window.localStorage.js = src
    }

    if (window.localStorage.ts) {
      src = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
    }

    if (isSelf) {
      this.evaluateMarkup()
      this.evaluateStyles()
    }

    const iframe = this.querySelector('iframe')

    const s = src.replace(/`/g, '\\`')

    iframe.contentWindow.document.body.innerHTML = this.editors.html.getValue()

    const script = `
      let msg = ''

      try {
        msg = (() => { ${s} })()
      } catch (err) {
        msg = err.message
      }

      window.parent.postMessage(JSON.stringify(msg), '*')
    `

    console.log(script)

    iframe.contentWindow.eval(script)
  }

  evaluateStyles (isSelf) {
    if (isSelf) {
      this.evaluateScript()
      this.evaluateMarkup()
    }

    const src = this.editors.css.getValue()
    const iframe = this.querySelector('iframe')
    window.localStorage.css = src
    iframe.contentWindow.document.head.innerHTML = `
      <style>${src}</style>
    `
  }

  evaluateMarkup (isSelf) {
    if (isSelf) {
      this.evaluateScript()
      this.evaluateStyles()
    }

    const src = this.editors.html.getValue()
    const iframe = this.querySelector('iframe')
    window.localStorage.html = src
    iframe.contentWindow.document.body.innerHTML = src
  }

  connected () {
    window.addEventListener('message', e => {
      this.editors.jsOutput.setValue(String(e.data || ''))
    })

    this.editors.jsInput = CodeMirror.fromTextArea(
      this.querySelector('#js-in'),
      Object.assign({}, opts, { mode: 'javascript' })
    )

    this.editors.jsOutput = CodeMirror.fromTextArea(
      this.querySelector('#js-out'),
      Object.assign({}, opts, {
        mode: 'javascript',
        readOnly: true,
        lineWrapping: true,
        wrap: true
      })
    )

    this.editors.jsInput.on('change', e => this.evaluateScript())

    this.editors.html = CodeMirror.fromTextArea(
      this.querySelector('#html'),
      Object.assign({}, opts, { mode: 'html' })
    )

    this.editors.html.on('change', e => this.evaluateMarkup(true))

    this.renderSandboxDocument(window.localStorage.html || '')

    this.editors.css = CodeMirror.fromTextArea(
      this.querySelector('#css'),
      Object.assign({}, opts, { mode: 'css' })
    )

    this.editors.css.on('change', e => this.evaluateStyles(true))

    setTimeout(() => {
      this.evaluateScript(true)
    }, 512)
  }

  renderSandboxDocument (s) {
    return `data:text/html,${s}`.trim()
  }

  render () {
    return this.html`
      <header>
        Scratch
      </header>

      <main>
        <tonic-split id="split-main" type="horizontal">
          <tonic-split-top height="40%">
            <iframe
              id="sandbox"
              width="100%"
              height="100%"
              sandbox=""
              src="${this.renderSandboxDocument('')}"
            ></iframe>
          </tonic-split-top>
          <tonic-split-bottom height="60%">
            <tonic-split id="split-main" type="vertical">
              <tonic-split-left width="40%">
                <tonic-split id="split-js" type="horizontal">
                  <tonic-split-top height="60%">
                    <label>JS FUNCTION BODY</label>
                    <section>
                      <textarea id="js-in">${window.localStorage.js || ''}</textarea>
                    </section>
                  </tonic-split-top>
                  <tonic-split-bottom height="40%">
                    <label>OUTPUT</label>
                    <section>
                      <textarea id="js-out"></textarea>
                    </section>
                  </tonic-split-bottom>
                </tonic-split>
              </tonic-split-left>
              <tonic-split-right width="60%">

                <tonic-split id="split-pres" type="vertical">
                  <tonic-split-left width="50%">
                    <label>HTML</label>
                    <section>
                      <textarea id="html">${window.localStorage.html || ''}</textarea>
                    </section>
                  </tonic-split-left>
                  <tonic-split-right width="50%">
                    <label>CSS</label>
                    <section>
                      <textarea id="css">${window.localStorage.css || ''}</textarea>
                    </section>
                  </tonic-split-right>
                </tonic-split>

              </tonic-split-left>
            </tonic-split>
          </tonic-split-bottom>
        </tonic-split>
      </main>
    `
  }
}

Tonic.add(MainComponent)

document.addEventListener('DOMContentLoaded', () => {})
