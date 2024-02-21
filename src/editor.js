import fs from 'socket:fs'
import path from 'socket:path'

import Tonic from '@socketsupply/tonic'
import { EditorView } from 'codemirror'
import { tags as t } from '@lezer/highlight'
import { defaultKeymap } from '@codemirror/commands'
import { EditorState, Compartment } from '@codemirror/state'
import { drawSelection, keymap, lineNumbers } from '@codemirror/view'

import { syntaxHighlighting, defaultHighlightStyle, HighlightStyle } from '@codemirror/language'

import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { cpp } from '@codemirror/lang-cpp'
import { yaml } from '@codemirror/lang-yaml'
import { javascript } from '@codemirror/lang-javascript'

const base00 = 'var(--tonic-primary)', // black
  base01 = 'var(--tonic-info)', // dark grey
  base02 = '#434c5e',
  base03 = 'var(--tonic-secondary)' // grey

// Snow Storm
const base04 = '#d8dee9', // grey
  base05 = '#e5e9f0', // off white
  base06 = '#eceff4' // white

// Frost
const base07 = '#8fbcbb', // moss green
  base08 = '#88c0d0', // ice blue
  base09 = '#81a1c1', // water blue
  base0A = '#5e81ac' // deep blue

// Aurora
const base0b = 'var(--tonic-accent)',
  base0C = 'var(--tonic-info)',
  base0D = 'var(--tonic-primary)',
  base0E = 'var(--tonic-success)',
  base0F = 'var(--tonic-accent)'

const invalid = '#d30102',
  darkBackground = base06,
  highlightBackground = darkBackground,
  background = 'transparent',
  tooltipBackground = base05,
  selection = darkBackground,
  cursor = 'var(--tonic-accent)'

/// The editor theme styles for Basic Light.
export const basicLightTheme = EditorView.theme(
  {
    '&': {
      color: base00,
      backgroundColor: background
    },

    '.cm-content': {
      caretColor: cursor
    },

    '&.cm-editor': {
      height: '100%'
    },

    '.cm-scroller': {
      overflow: 'auto'
    },

    '&.cm-focused': {
      outline: 'none !important'
    },

    '&.cm-focused .cm-cursor, .cm-dropCursor': {
      border: '1px solid var(--tonic-accent)',
      width: '8px',
      background: 'var(--tonic-accent) !important'
    },

    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
      { backgroundColor: 'var(--tonic-selection)' },

    '.cm-panels': { backgroundColor: darkBackground, color: base03 },
    '.cm-panels.cm-panels-top': { borderBottom: '2px solid black' },
    '.cm-panels.cm-panels-bottom': { borderTop: '2px solid black' },

    '.cm-searchMatch': {
      backgroundColor: '#72a1ff59',
      outline: `1px solid ${base03}`
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: base05
    },

    '.cm-activeLine': { backgroundColor: highlightBackground },
    '.cm-selectionMatch': { backgroundColor: base05 },

    '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
      outline: `1px solid ${base03}`
    },

    '&.cm-focused .cm-matchingBracket': {
      backgroundColor: base06
    },

    '.cm-gutters': {
      backgroundColor: 'var(--tonic-background)',
      color: 'var(--tonic-border-accent)',
      paddingRight: '4px',
      paddingLeft: '12px',
      border: 'none',
      borderRight: '1px solid var(--tonic-border)'
    },

    '.cm-activeLineGutter': {
      backgroundColor: highlightBackground
    },

    '.cm-foldPlaceholder': {
      backgroundColor: 'transparent',
      border: 'none',
      color: '#ddd'
    },

    '.cm-tooltip': {
      border: 'none',
      backgroundColor: tooltipBackground
    },
    '.cm-tooltip .cm-tooltip-arrow:before': {
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent'
    },
    '.cm-tooltip .cm-tooltip-arrow:after': {
      borderTopColor: tooltipBackground,
      borderBottomColor: tooltipBackground
    },
    '.cm-tooltip-autocomplete': {
      '& > ul > li[aria-selected]': {
        backgroundColor: highlightBackground,
        color: base03
      }
    }
  },
  { dark: false }
)

/// The highlighting style for code in the Basic Light theme.
export const basicLightHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: base0A },
  {
    tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName],
    color: base0C
  },
  { tag: [t.variableName], color: base0C },
  { tag: [t.function(t.variableName)], color: base0A },
  { tag: [t.labelName], color: base09 },
  {
    tag: [t.color, t.constant(t.name), t.standard(t.name)],
    color: base0A
  },
  { tag: [t.definition(t.name), t.separator], color: base0E },
  { tag: [t.brace], color: base07 },
  {
    tag: [t.annotation],
    color: invalid
  },
  {
    tag: [t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace],
    color: base08
  },
  {
    tag: [t.typeName, t.className],
    color: base0D
  },
  {
    tag: [t.operator, t.operatorKeyword],
    color: base0E
  },
  {
    tag: [t.tagName],
    color: base0F
  },
  {
    tag: [t.squareBracket],
    color: base0b
  },
  {
    tag: [t.angleBracket],
    color: base0C
  },
  {
    tag: [t.attributeName],
    color: base0D
  },
  {
    tag: [t.regexp],
    color: base0A
  },
  {
    tag: [t.quote],
    color: base01
  },
  { tag: [t.string], color: base0C },
  {
    tag: t.link,
    color: base07,
    textDecoration: 'underline',
    textUnderlinePosition: 'under'
  },
  {
    tag: [t.url, t.escape, t.special(t.string)],
    color: base0C
  },
  { tag: [t.meta], color: base08 },
  { tag: [t.comment], color: base02, fontStyle: 'italic' },
  { tag: t.strong, fontWeight: 'bold', color: base0A },
  { tag: t.emphasis, fontStyle: 'italic', color: base0A },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.heading, fontWeight: 'bold', color: base0A },
  { tag: t.special(t.heading1), fontWeight: 'bold', color: base0A },
  { tag: t.heading1, fontWeight: 'bold', color: base0A },
  {
    tag: [t.heading2, t.heading3, t.heading4],
    fontWeight: 'bold',
    color: base0A
  },
  {
    tag: [t.heading5, t.heading6],
    color: base0A
  },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: base0C },
  {
    tag: [t.processingInstruction, t.inserted],
    color: base07
  },
  {
    tag: [t.contentSeparator],
    color: base0D
  },
  { tag: t.invalid, color: base02 }
])

const extensions = [
  drawSelection(),
  lineNumbers(),
  keymap.of(defaultKeymap),
  basicLightTheme,
  syntaxHighlighting(basicLightHighlightStyle)
]

class AppEditor extends Tonic {
  get value () {
    return this.state.editorView.state.doc.toString()
  }

  get selection () {
    const noRanges = this.state.editorView.state.selection.ranges.length === 0
    const first = this.state.editorView.state.selection.ranges[0]
    const len = this.value.length

    const nonRange = (
      (first.from === 0 && first.to === 0) ||
      (first.from === len && first.to === len)
    )

    if (nonRange || noRanges) return this.value
    const slice = this.state.editorView.state.sliceDoc(first.from, first.to)
    return slice
  }

  async writeToDisk (projectNode) {
    const app = document.querySelector('app-view')
    const dest = path.join(app.state.cwd, projectNode.id)
    await fs.promises.writeFile(dest, projectNode.data)
  }

  async loadProjectNode (projectNode) {
    if (!projectNode) return
    let str

    const fileName = projectNode.label
    let language

    if (fileName.endsWith('.css')) language = css()
    if (fileName.endsWith('.html')) language = html()
    if (fileName.endsWith('.js')) language = javascript()
    if (fileName.endsWith('.ini')) language = []
    if (fileName.endsWith('.cc')) language = cpp()

    const onChange = EditorView.updateListener.of(v => {
      if (v.docChanged) {
        projectNode.data = this.state.editorView.state.doc.toString()

        clearTimeout(this.writeDebounce)

        this.writeDebounce = setTimeout(() => {
          this.writeToDisk(projectNode)
        }, 256)
      }
    })

    if (!this.state.editorView) {
      this.state.editorView = new EditorView({
        state: EditorState.create({
          doc: projectNode.data,
          extensions: [...extensions, onChange, language]
        }),
        parent: this.firstElementChild
      })
    } else {
      this.state.editorView.setState(EditorState.create({
        doc: projectNode.data,
        extensions: [...extensions, onChange, language]
      }))
    }
  }

  render () {
    return this.html`
      <div class="editor"></div>
    `
  }
}

export { AppEditor }
export default AppEditor
