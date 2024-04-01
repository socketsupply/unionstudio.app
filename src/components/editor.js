import fs from 'socket:fs'
import path from 'socket:path'
import { sha256 } from 'socket:network'

import * as monaco from 'monaco-editor'
import Tonic from '@socketsupply/tonic'

function rgbaToHex (rgbaString) {
  const rgbaValues = rgbaString.match(/\d+/g)

  const r = parseInt(rgbaValues[0])
  const g = parseInt(rgbaValues[1])
  const b = parseInt(rgbaValues[2])

  const a = Math.round(parseFloat(rgbaValues[3]) * 255)

  const rHex = r.toString(16).padStart(2, '0')
  const gHex = g.toString(16).padStart(2, '0')
  const bHex = b.toString(16).padStart(2, '0')
  const aHex = a.toString(16).padStart(2, '0')

  return `#${rHex}${gHex}${bHex}${aHex}`
}

globalThis.MonacoEnvironment = {
  getWorkerUrl: function (moduleId, label) {
    if (label === 'json') {
      return 'lib/vs/language/json/json.worker.js'
    }

    if (label === 'css' || label === 'scss' || label === 'less') {
      return 'lib/vs/language/css/css.worker.js'
    }

    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return 'lib/vs/language/html/html.worker.js'
    }

    if (label === 'typescript' || label === 'javascript') {
      return 'lib/vs/language/typescript/ts.worker.js'
    }

    return 'lib/vs/editor/editor.worker.js'
  }
}

class EditorTabs extends Tonic {
  selectedTabId = null
  scrollLeft = 0
  index = 0

  constructor () {
    super()

    this.state = {
      tabs: new Map(),
      ...this.state
    }
  }

  mousewheel (e) {
    this.state.scrollLeft = this.firstElementChild.scrollLeft
  }

  updated () {
    this.firstElementChild.scrollLeft = this.state.scrollLeft
  }

  add (node) {
    const parent = this.props.parent
    const editor = document.querySelector('app-editor')

    const tab = {
      label: node.label,
      id: node.id,
      path: node.id,
      isRootSettingsFile: node.isRootSettingsFile,
      model: monaco.editor.createModel(),
      state: null,
      hash: null,
      unsaved: false,
      index: this.index++
    }

    tab.model.onDidChangeContent((...args) => editor.changes(tab, ...args))

    this.state.tabs.set(node.id, tab)
    parent.editor.setModel(tab.model)
    this.selectTab(tab.id)

    this.reRender()
  }

  remove (id) {
    if (this.state.tabs.has(id)) {
      this.state.tabs.delete(id)
    }

    this.reRender()
  }

  rename ({ oldId, newId, label }) {
    if (!this.state.tabs.has(oldId)) return

    const tab = this.state.tabs.get(oldId)
    tab.id = newId
    tab.path = newId
    tab.label = label

    this.state.tabs.delete(oldId)
    this.state.tabs.set(newId, tab)

    this.reRender()
  }

  async close (id) {
    if (!this.state.tabs.has(id)) return

    const tab = this.state.tabs.get(id)

    if (tab.unsaved) {
      this.selectTab(id)

      const coDialogConfirm = document.querySelector('dialog-confirm')
      const result = await coDialogConfirm.prompt({
        type: 'question',
        message: 'This file has changes, what do you want to do?',
        buttons: [
          { label: 'Abandon', value: 'abandon' },
          { label: 'Save', value: 'save' }
        ]
      })

      if (!result.abandon && !result.save) return

      if (result.save) {
        await this.props.parent.saveCurrentTab()
      }
    }

    this.remove(id)

    // if this tab was selected
    if (this.state.selectedTabId === id) {
      // check if there are any other tabs
      if (this.state.tabs.size > 0) {
        const tabs = [...this.state.tabs.values()]
        const previousSibling = tabs.findLast(t => t.index < tab.index)
        const nextSibling = tabs.find(t => t.index > tab.index)
        const sibling = previousSibling || nextSibling

        if (sibling) {
          sibling.selected = true
          this.state.selectedTabId = sibling.id
          this.selectTab(sibling.id)
        }
      } else {
        // there are no more tabs. empty the editor
        this.props.parent.editor.setValue('')
      }
    }

    this.reRender()
  }

  get tab () {
    return this.state.tabs.get(this.state.selectedTabId)
  }

  async setCurrentTabValue (data) {
    const tab = this.state.tabs.get(this.state.selectedTabId)
    if (!tab) return

    tab.hash = await sha256(data)
    tab.model.setValue(data)
  }

  selectTab (id) {
    if (!this.state.tabs.has(id)) return
    const parent = this.props.parent

    // if there was a previously selected tab, unselect it
    const previouslySelected = this.state.tabs.get(this.state.selectedTabId)

    if (previouslySelected) {
      previouslySelected.state = parent.editor.saveViewState()
      previouslySelected.selected = false
    }

    const tab = this.state.tabs.get(id)
    tab.selected = true

    if (tab.state) {
      parent.editor.restoreViewState(tab.state)
    }

    this.state.selectedTabId = id
    parent.editor.setModel(tab.model)
    parent.editor.focus()
    this.reRender()
  }

  async click (e) {
    const el = Tonic.match(e.target, '[data-event]')
    if (!el) return

    const { event } = el.dataset

    if (event === 'select') {
      this.selectTab(el.dataset.id)
    }

    if (event === 'close') {
      const parentTab = el.closest('.tab')
      const id = parentTab.dataset.id
      this.close(id)
    }
  }

  async render () {
    let tabs

    if (this.state.tabs?.size) {
      tabs = [...this.state.tabs.values()].map(tab => {
        const selected = tab.selected ? 'selected' : ''
        const unsaved = tab.unsaved ? 'unsaved' : ''

        return this.html`
          <div
            class="tab ${selected} ${unsaved}"
            data-event="select"
            data-id="${tab.id}"
            title="${tab.id}"
          >
            <div class="label">${tab.label}</div>
            <div class="close"><tonic-button type="icon" symbol-id="close" data-event="close" size="18px"></tonic-button></div>
          </div>
        `
      })
    }

    return this.html`
      <header class="component">${tabs}</header>
    `
  }
}

Tonic.add(EditorTabs)

class AppEditor extends Tonic {
  get value () {
    return this.editor.getValue()
  }

  set value (s) {
    this.editor.setValue(s)
  }

  get selection () {
    this.editor.getModel().getValueInRange(this.editor.getSelection())
  }

  async saveCurrentTab () {
    const coTerminal = document.querySelector('app-terminal')
    const coProperties = document.querySelector('app-properties')
    const coTabs = document.querySelector('editor-tabs')
    const coEditor = document.querySelector('app-editor')

    if (!coTabs.tab || coTabs.tab.isReadOnly) return

    const app = this.props.parent
    const value = this.editor.getValue()

    if (coTabs.tab?.isRootSettingsFile) {
      try {
        app.state.settings = JSON.parse(value)
      } catch (err) {
        coTerminal.error(`Unable to parse settings file (${err.message})`)
        return
      }

      coTerminal.info('Settings file updated.')
      coEditor.refreshColors()
      app.activatePreviewWindows()
    }

    coProperties.reRender()

    try {
      await fs.promises.writeFile(coTabs.tab.path, value)
      coTabs.tab.unsaved = false
      coTabs.reRender()
    } catch (err) {
      console.error(`Unable to write to ${coTabs.tab.path}`, err)
    }

    app.reloadPreviewWindows()
  }

  async reload () {
    this.loadProjectNode(this.state.projectNode)
  }

  async loadProjectNode (projectNode) {
    if (!projectNode) return

    this.state.projectNode = projectNode

    const app = this.props.parent

    if (!projectNode.isDirectory) {
      const tabs = this.querySelector('editor-tabs')

      tabs.add(projectNode)

      const ext = path.extname(projectNode.id)

      const mappings = app.state.settings.extensionLanguageMappings
      const lang = mappings[ext] || ext.slice(1)
      monaco.editor.setModelLanguage(this.editor.getModel(), lang)
      let data = projectNode.value || await fs.promises.readFile(projectNode.id, 'utf8')

      if (path.extname(projectNode.id) === '.json') {
        try {
          data = JSON.stringify(JSON.parse(data), null, 2)
        } catch {}
      }

      await tabs.setCurrentTabValue(data)
    }
  }

  refreshColors (event) {
    const isDark = event || (window.matchMedia('(prefers-color-scheme: dark)'))
    const theme = isDark.matches ? 'tonic-dark' : 'tonic-light'

    const styles = window.getComputedStyle(document.body)

    const colors = {
      background: rgbaToHex(styles.getPropertyValue('--tonic-background').trim()),
      primary: rgbaToHex(styles.getPropertyValue('--tonic-primary').trim()),
      secondary: rgbaToHex(styles.getPropertyValue('--tonic-secondary').trim()),
      info: rgbaToHex(styles.getPropertyValue('--tonic-info').trim()),
      dark: rgbaToHex(styles.getPropertyValue('--tonic-dark').trim()),
      accent: rgbaToHex(styles.getPropertyValue('--tonic-accent').trim()),
      error: rgbaToHex(styles.getPropertyValue('--tonic-error').trim()),
      success: rgbaToHex(styles.getPropertyValue('--tonic-success').trim())
    }

    const userColors = this.props.parent.state.settings?.userColors ?? []

    const base = `vs${theme.includes('dark') ? '-dark' : ''}`
    monaco.editor.defineTheme(theme, {
      base,
      inherit: true,
      rules: [
        { token: 'lineFile', foreground: colors.accent }, // Green for added lines
        { token: 'lineHeader', foreground: colors.info }, // Green for added lines
        { token: 'lineAdded', foreground: colors.success }, // Green for added lines
        { token: 'lineRemoved', foreground: colors.error }, // Red for removed lines

        { token: 'identifier', foreground: colors.primary },
        { token: 'keyword', foreground: colors.accent },
        { token: 'punctuation', foreground: colors.primary },

        { token: '', foreground: colors.primary },
        { token: 'invalid', foreground: 'f44747' },
        { token: 'emphasis', fontStyle: 'italic' },
        { token: 'strong', fontStyle: 'bold' },

        { token: 'variable', foreground: '74B0DF' },
        { token: 'variable.predefined', foreground: '4864AA' },
        { token: 'variable.parameter', foreground: '9CDCFE' },
        { token: 'constant', foreground: '569CD6' },
        { token: 'comment', foreground: colors.secondary },
        { token: 'number', foreground: colors.accent },
        { token: 'number.hex', foreground: '5BB498' },
        { token: 'regexp', foreground: 'B46695' },
        { token: 'annotation', foreground: 'cc6666' },
        { token: 'type', foreground: '3DC9B0' },

        { token: 'delimiter', foreground: 'DCDCDC' },
        { token: 'delimiter.html', foreground: '808080' },
        { token: 'delimiter.xml', foreground: '808080' },

        { token: 'tag', foreground: '569CD6' },
        { token: 'meta.scss', foreground: 'A79873' },
        { token: 'meta.tag', foreground: 'CE9178' },
        { token: 'metatag', foreground: colors.accent },
        { token: 'metatag.content.html', foreground: colors.primary },
        { token: 'metatag.html', foreground: '569CD6' },
        { token: 'metatag.xml', foreground: '569CD6' },
        { token: 'metatag.php', fontStyle: 'bold' },

        { token: 'key', foreground: colors.info },
        { token: 'string.key.json', foreground: colors.info },
        { token: 'string.value.json', foreground: colors.primary },

        { token: 'attribute.name', foreground: colors.info },
        { token: 'attribute.value', foreground: colors.primary },
        { token: 'attribute.value.number.css', foreground: colors.accent },
        { token: 'attribute.value.unit.css', foreground: colors.accent },
        { token: 'attribute.value.hex.css', foreground: colors.accent },

        { token: 'string', foreground: colors.primary },
        { token: 'string.sql', foreground: 'FF0000' },

        { token: 'keyword', foreground: colors.accent },
        { token: 'keyword.flow', foreground: 'C586C0' },
        { token: 'keyword.json', foreground: 'CE9178' },
        { token: 'keyword.flow.scss', foreground: '569CD6' },

        { token: 'operator.scss', foreground: '909090' },
        { token: 'operator.sql', foreground: '778899' },
        { token: 'operator.swift', foreground: '909090' },
        { token: 'predefined.sql', foreground: 'FF00FF' },
        ...userColors
      ],
      colors: {
        'editor.background': colors.background
      }
    })

    monaco.editor.setTheme(theme)
  }

  async loadAPIs (directoryPath = './socket') {
    const readDir = async (dirPath) => {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })

      entries.forEach(async (entry) => {
        const fullPath = path.join(dirPath, entry.name)

        if (entry.isDirectory()) {
          readDir(fullPath).catch(err => console.error(`Error reading directory ${fullPath}:`, err))
        } else {
          if (path.extname(fullPath) === '.ts') {
            fs.promises.readFile(fullPath, 'utf8')
              .then(sourceText => {
                monaco.languages.typescript.javascriptDefaults.addExtraLib(sourceText, `socket/${fullPath}`)
                monaco.languages.typescript.typescriptDefaults.addExtraLib(sourceText, `socket/${fullPath}`)
              })
              .catch(err => console.error(`Error reading file ${fullPath}:`, err))
          }
        }
      })
    }

    try {
      await readDir(directoryPath)
    } catch (err) {
      console.error('Error initiating read directory operation:', err)
    }
  }

  async updateSettings (options) {
    const app = this.props.parent
    this.editor.updateOptions(options || app.state.settings?.editorOptions || {})
  }

  async changes (tab, ...args) {
    const value = this.editor.getValue()
    const app = this.props.parent

    if (app.state.settings.previewMode) {
      this.saveCurrentTab()
      return
    }

    const hash = await sha256(value)

    if (hash !== tab.hash) {
      tab.unsaved = true
      tab.hash = hash

      const tabs = this.querySelector('editor-tabs')
      tabs.reRender()
    }
  }

  connected () {
    let theme

    this.editor = monaco.editor.create(this.querySelector('.editor'), {
      value: '',
      minimap: {
        enabled: false
      },
      theme,
      automaticLayout: true,
      language: 'javascript',
      renderLineHighlight: 'none'
    })

    this.updateSettings()

    monaco.languages.registerFoldingRangeProvider('patch', {
      provideFoldingRanges: function (model, context, token) {
        const hunkStartRegex = /^@@ -\d+(,\d+)? \+\d+(,\d+)? @@.*/
        const diffStartRegex = /^diff --git a\/.+ b\/.+/
        const foldingRanges = []
        let currentHunkStart = -1

        for (let i = 0; i < model.getLineCount(); i++) {
          const lineContent = model.getLineContent(i + 1)

          if (hunkStartRegex.test(lineContent)) {
            if (currentHunkStart !== -1) {
              foldingRanges.push({
                start: currentHunkStart,
                end: i,
                kind: monaco.languages.FoldingRangeKind.Region
              })
            }
            currentHunkStart = i + 1
          } else if (diffStartRegex.test(lineContent) && currentHunkStart !== -1) {
            foldingRanges.push({
              start: currentHunkStart,
              end: i,
              kind: monaco.languages.FoldingRangeKind.Region
            })
            currentHunkStart = -1
          }
        }

        if (currentHunkStart !== -1) {
          foldingRanges.push({
            start: currentHunkStart,
            end: model.getLineCount(),
            kind: monaco.languages.FoldingRangeKind.Region
          })
        }

        return foldingRanges
      }
    })

    monaco.languages.register({ id: 'patch' })

    monaco.languages.setMonarchTokensProvider('patch', {
      tokenizer: {
        root: [
          [/^index \w+\.\.\w+( \d+)?/, 'lineHeader'],
          [/^---.*/, 'lineHeader'],
          [/^\+\+\+.*/, 'lineHeader'],
          [/^@@ -\d+(,\d+)? \+\d+(,\d+)? @@.*/, 'lineHeader'],
          [/^diff --git a\/.+ b\/.+/, 'lineFile'],
          [/^From:.*<[^>]+>/, 'lineHeader'],
          [/^Date:.+/, 'lineHeader'],
          [/^Subject: \[PATCH\].+/, 'lineHeader'],
          [/^From [0-9a-fA-F]+ Mon .+/, 'lineHeader'],

          [/^\+(?!\+\+).*/, 'lineAdded'],
          [/^-(?!-).*/, 'lineRemoved']
        ]
      }
    })

    this.editor.onDidChangeModelContent(event => {
      const coTabs = document.querySelector('editor-tabs')
      this.editor.updateOptions({ readOnly: false })

      if (coTabs.tab?.label.endsWith('.patch')) {
        this.editor.updateOptions({ readOnly: true })
        this.editor.getAction('editor.foldAll').run()
      }
    })

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
      this.refreshColors(event)
    })

    this.refreshColors()
    this.loadAPIs()
  }

  render () {
    return this.html`
      <editor-tabs id="editor-tabs" parent=${this}></editor-tabs>
      <div class="editor"></div>
    `
  }
}

export { AppEditor }
export default AppEditor
