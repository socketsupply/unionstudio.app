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
        this.setTheme()
        break
      }

      case 'clear-output': {
        this.clearOutput()
        break
      }

      case 'eval': {
        this.evaluateScript(true)
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
    let src = this.editors.scriptInput.getValue()

    if (src) {
      window.localStorage.js = src
    }

    if (window.localStorage.ts) {
      src = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
    }

    if (isSelf) {
      this.evaluateStyles()
      this.evaluateMarkup()
    }

    const iframe = this.querySelector('iframe')

    const script = `
      console.error = console.warn = console.log = function (...args) {
        window.parent.postMessage(JSON.stringify(args), '*')
      }

      try {
        ${src}
      } catch (err) {
        console.error(err.message)
      }
    `

    try {
      console.log(iframe.contentWindow.eval(script))
    } catch (err) {
      this.editors.scriptOutput.setValue(err.message)
    }
  }

  evaluateStyles (isSelf) {
    const src = this.editors.css.getValue()
    const iframe = document.getElementById('sandbox')
    window.localStorage.css = src
    iframe.contentWindow.document.head.innerHTML = `
      <style>${src}</style>
    `

    if (isSelf) {
      this.evaluateMarkup()
      this.evaluateScript()
    }
  }

  evaluateMarkup (isSelf) {
    const src = this.editors.html.getValue()
    const iframe = document.getElementById('sandbox')
    window.localStorage.html = src
    iframe.contentWindow.document.body.innerHTML = src

    if (isSelf) {
      this.evaluateStyles()
      this.evaluateScript()
    }
  }

  clearOutput () {
    this.editors.scriptOutput.setValue('')
  }

  connected () {
    window.addEventListener('message', e => {
      const editor = this.editors.scriptOutput
      const oldValue = editor.getValue()
      const newValue = e.data ? JSON.parse(e.data) : []

      editor.setValue(oldValue + '\n' + newValue.join(' '))
      editor.scrollIntoView({ line: editor.doc.lineCount() - 1 })
    })

    this.editors.scriptInput = CodeMirror.fromTextArea(
      this.querySelector('#js-in'),
      Object.assign({}, opts, { mode: 'javascript' })
    )

    this.editors.scriptOutput = CodeMirror.fromTextArea(
      this.querySelector('#js-out'),
      Object.assign({}, opts, {
        mode: 'javascript',
        readOnly: true,
        lineWrapping: true,
        wrap: true
      })
    )

    this.editors.scriptInput.on('change', e => this.evaluateScript(true))

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
      this.setTheme(true)
      this.evaluateScript(true)

      for (const editor of Object.values(this.editors)) {
        editor.on('focus', () => editor.refresh())
        editor.refresh()
      }
    }, 512)
  }

  setTheme (isSelf) {
    let theme = window.localStorage.theme

    if (!isSelf) {
      if (!theme || theme === 'light') {
        theme = window.localStorage.theme = 'dark'
      } else {
        theme = window.localStorage.theme = 'light'
      }
    }

    document.body.setAttribute('theme', theme)

    for (const editor of Object.values(this.editors)) {
      editor.setOption('theme', theme)
      editor.refresh()
    }
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
                    <label>SCRIPT</label>
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
