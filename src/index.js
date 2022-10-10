'use strict'

import Tonic from '@socketsupply/tonic'
import components from '@socketsupply/components'
import io from '@socketsupply/io'

import { EditorView } from 'codemirror'
import { tags } from '@lezer/highlight'
import { defaultKeymap } from '@codemirror/commands'
import { drawSelection, keymap } from '@codemirror/view'

import { syntaxHighlighting, defaultHighlightStyle, HighlightStyle } from '@codemirror/language'

import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { javascript } from '@codemirror/lang-javascript'

window.io = io

const metaKeys = ['Tab', 'Meta', 'Shift', 'Control', 'Alt', 'Backspace']

components(Tonic)

const theme = EditorView.theme({
  '&': {
    color: 'var(--tonic-primary)',
    backgroundColor: 'transparent',
    bottom: 0,
    top: 0,
    left: 0,
    right: 0,
    position: 'absolute'
  },
  '.cm-editor': {
    position: 'absolute !important'
  },
  '.cm-content': {
    caretColor: 'var(--tonic-accent)',
    fontFamily: 'var(--tonic-monospace)'
  },
  '&.cm-focused': {
    outline: 'none !important'
  },
  '&.cm-focused .cm-cursor': {
    border: '1px solid var(--tonic-accent)',
    width: '8px',
    background: 'var(--tonic-accent) !important'
  },
  '&.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--tonic-selection)'
  },
  '.cm-selectionBackground': {
    backgroundColor: 'var(--tonic-accent)'
  },
  '.cm-gutter': {
    height: 'auto'
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--tonic-primary)',
    borderRight: '1px solid var(--tonic-border)'
  },
  '.cm-activeLine': {
    backgroundColor: 'transparent',
    color: 'var(--tonic-primary)'
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: 'var(--tonic-primary)'
  }
})

const highlighter = HighlightStyle.define([
  { tag: tags.string, color: '#000000' }
])

class AppContainer extends Tonic {
  constructor () {
    super()
    this.editors = {}
  }

  createEditor (selector, language, doc = '') {
    const extensions = [
      drawSelection(),
      keymap.of(defaultKeymap),
      syntaxHighlighting(defaultHighlightStyle),
      syntaxHighlighting(highlighter),
      theme,
      EditorView.domEventHandlers({
        keydown: (event, view) => {
          const isMetaKey = metaKeys.includes(event.key)

          if (event.metaKey) {
            switch (event.key) {
              case 'r': case 'i': case 'l': case 'n':
              case '1': case '2': case '3': case '4':
                return
            }
          }

          if (isMetaKey) return

          event.preventDefault()

          const state = view.viewState.state
          const range = state.selection.ranges[0]

          view.dispatch({
            changes: {
              from: range.from,
              to: range.to,
              insert: event.key
            },
            selection: { anchor: range.from + 1 }
          })
        }
      }),
      EditorView.updateListener.of(update => {
        if (update.view.selector === '#js-out') return
        if (update.docChanged) this.eval()
      })
    ]

    if (language) extensions.push(language)

    const editor = new EditorView({
      doc,
      extensions,
      parent: document.querySelector(selector)
    })

    editor.selector = selector

    return editor
  }

  async setupWindow () {
    window.parent.setTitle('Scratches')

    const len = this.editors.output.state.doc.length
    this.editors.output.dispatch({
      effects: EditorView.scrollIntoView(len)
    })

    window.log = (...args) => {
      const content = args.join(' ') + '\n'
      const len = this.editors.output.state.doc.length

      this.editors.output.dispatch({
        changes: { from: len, insert: content },
        effects: EditorView.scrollIntoView(len + content)
      })
    }

    let itemsMac = ''

    if (process.platform === 'mac') {
      itemsMac = `
        Hide: h + CommandOrControl
        Hide Others: h + Control + Meta
        ---
      `
    }

    const menu = `
      Serverless Studio:
        About Scratches: _
        ---
        ${itemsMac}
        Quit: q + CommandOrControl
      ;

      File:
        Save Project: s + CommandOrControl
      ;

      Edit:
        Cut: x + CommandOrControl
        Copy: c + CommandOrControl
        Paste: v + CommandOrControl
        Delete: _
        Select All: a + CommandOrControl
      ;

      View:
        HTML: 1 + CommandOrControl
        CSS: 2 + CommandOrControl
        JS: 3 + CommandOrControl
        Console: 4 + CommandOrControl
        ---
        Clear Console: n + CommandOrControl
        Toggle Labels: l + CommandOrControl
      ;

      Output:
        Responsive: R + CommandOrControl
        Toggle Output: 5 + CommandOrControl
        Toggle Portrait Or Landscape: p + CommandOrControl
        ---
        iOS: _
        Android: _
      ;

      Build:
        Build for Android: s + CommandOrControl
        Build for iOS: s + CommandOrControl
        Build for Linux: s + CommandOrControl
        Build for MacOS: s + CommandOrControl
        Build for Windows: s + CommandOrControl
      ;
    `

    await window.parent.setMenu({ index: 0, value: menu })

    window.addEventListener('menuItemSelected', e => {
      console.log(e.detail)
      this.onMenuSelection(e.detail.title)
    })

    this.eval()
  }

  onMenuSelection (command) {
    switch (command) {
      case 'JS': {
        const split = document.querySelector('#split-js')
        split.toggle('top')
        break
      }

      case 'Console': {
        const split = document.querySelector('#split-js')
        split.toggle('bottom')
        break
      }

      case 'HTML': {
        const split = document.querySelector('#split-pres')
        split.toggle('left')
        break
      }

      case 'CSS': {
        const split = document.querySelector('#split-pres')
        split.toggle('right')
        break
      }

      case 'Toggle Labels': {
        document.body.classList.toggle('no-labels')
        break
      }

      case 'Clear Output': {
        this.clearOutput()
        break
      }

      case 'Evaluate Source': {
        this.eval(true)
        break
      }
    }
  }

  click (e) {
    const el = Tonic.match(e.target, '.editor')
    if (!el) return

    for (const editor of Object.values(this.editors)) {
      if (editor.selector === `#${el.id}`) {
        console.log(editor)
        editor.contentDOM.focus()
      }
    }
  }

  input (e) {
    const el = Tonic.match(e.target, '[data-event]')
    if (!el) return

    const { event } = el.dataset

    if (event === 'zoom') {
      const iframe = document.querySelector('iframe')
      const scale = Math.max(Number(el.value), 6)
      iframe.style.transform = `scale(${scale}%)`
    }
  }

  async eval () {
    const doc = this.template(
      this.editors.html.state.doc,
      this.editors.css.state.doc,
      this.editors.js.state.doc
    )

    window.localStorage.html = this.editors.html.state.doc
    window.localStorage.css = this.editors.css.state.doc
    window.localStorage.js = this.editors.js.state.doc
    window.localStorage.output = this.editors.output.state.doc

    try {
      await io.fs.promises.writeFile('temp.html', doc)
    } catch (err) {
      console.log('unable to write to disk', err)
      return
    }

    const frame = document.querySelector('iframe')
    frame.contentWindow.location.reload()
  }

  async connected () {
    this.editors.js = this.createEditor('#js-in', javascript(), window.localStorage.js)
    this.editors.html = this.createEditor('#markup', html(), window.localStorage.html)
    this.editors.css = this.createEditor('#css', css(), window.localStorage.css)
    this.editors.output = this.createEditor('#js-out', undefined, window.localStorage.output)
    this.setupWindow()
  }

  template (html, css, js) {
    return `<!doctype html>
      <html>
        <style>${css}</style>
        <body>${html}</body>
        <script type="module">
          console.log = console.error = console.warn = window.top.log;
          const io = window.top.io

          try {
            ${js}
          } catch (err) {
            console.error(err)
          }
        </script>
      </html>
    `
  }

  render () {
    const sep = process.platform === 'win' ? '\\' : '/'
    const src = [process.cwd(), 'temp.html'].join(sep)

    return this.html`
      <header>
        <tonic-button type="icon" size="18px" symbol-id="play" data-event="run">
        </tonic-button>
        <tonic-button type="icon" size="18px" symbol-id="package" data-event="package">
        </tonic-button>
        <tonic-select id="device">
          <option>Android</option>
          <option>iPhone 12</option>
          <option selected>iPhone 14</option>
          <option>iPad</option>
          <option>Linux</option>
          <option>MacOS</option>
          <option>Windows</option>
        </tonic-select>
        <tonic-toggle id="simulator" label="Simulator">
        </tonic-toggle>
        <span></span>
        <tonic-range width="100%" value="35" data-event="zoom" id="zoom">
        </tonic-range>
      </header>
      <tonic-split id="split-main" type="horizontal">
        <tonic-split-top height="60%">

          <tonic-split id="split-input" type="vertical">
            <tonic-split-left width="30%">
              <label class="title">SCRIPT</label>
              <section>
                <div class="editor" id="js-in"></div>
              </section>
            </tonic-split-left>

            <tonic-split-right width="60%">
              <tonic-split id="split-pres" type="vertical">
                <tonic-split-left width="50%">
                  <label class="title">HTML</label>
                  <section>
                    <div class="editor" id="markup"></div>
                  </section>
                </tonic-split-left>
                <tonic-split-right width="50%">
                  <label class="title">CSS</label>
                  <section>
                    <div class="editor" id="css"></div>
                  </section>
                </tonic-split-right>
              </tonic-split>
            </tonic-split-right>
          </tonic-split>

        </tonic-split-top>

        <tonic-split-bottom height="40%">
          <tonic-split id="split-output" type="vertical">
            <tonic-split-left width="50%">
              <label class="title">CONSOLE</label>
              <section>
                <div class="editor" id="js-out"></div>
              </section>
            </tonic-split-left>
            <tonic-split-right width="50%">
              <label class="title">RENDER</label>
              <section class="render">
                <iframe
                  src="${src}"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  sandbox="allow-forms allow-same-origin allow-scripts"
                ></iframe>
              </section>
            </tonic-split-right>
          </tonic-split>
        </tonic-split-bottom>
      </tonic-split close="split-main">
    `
  }
}

window.addEventListener('DOMContentLoaded', () => {
  Tonic.add(AppContainer)
})
