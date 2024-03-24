import fs from 'socket:fs'
import path from 'socket:path'

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
    const count = this.state.tabs.size

    const tab = {
      label: node.label,
      id: node.id,
      path: node.id,
      model: monaco.editor.createModel(),
      state: null,
      unsaved: false,
      index: count + 1
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

  setCurrentTabValue (data) {
    const tab = this.state.tabs.get(this.state.selectedTabId)
    if (!tab) return

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

  click (e) {
    const el = Tonic.match(e.target, '[data-event]')
    if (!el) return

    const { event } = el.dataset

    if (event === 'select') {
      this.selectTab(el.dataset.id)
    }

    if (event === 'close') {
      const parent = el.closest('.tab')
      const id = parent.dataset.id
      if (!this.state.tabs.has(id)) return

      const tab = this.state.tabs.get(id)
      this.remove(id)

      // if this tab was selected
      if (this.state.selectedTabId === id) {
        // check if there are any other tabs
        if (this.state.tabs.size > 0) {
          const tabs = [...this.state.tabs.values()]
          const previousSibling = tabs.find(t => t.index < tab.index)
          if (previousSibling) {
            previousSibling.selected = true
            this.state.selectedTabId = previousSibling.id
            this.selectTab(previousSibling.id)
          }
        }
      }

      this.reRender()
    }
  }

  async render () {
    let tabs

    if (this.state.tabs?.size) {
      tabs = [...this.state.tabs.values()].map(tab => {
        const selected = tab.selected ? 'selected' : ''
        const unsaved = tab.unsaved ? 'unsaved' : ''

        return this.html`
          <div class="tab ${selected} ${unsaved}" data-event="select" data-id="${tab.id}">
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

  async writeToDisk (pathToFile, data) {
    const app = this.props.parent

    try {
      await fs.promises.writeFile(pathToFile, data)
    } catch (err) {
      console.error(`Unable to write to ${pathToFile}`, err)
    }

    app.reloadPreviewWindows()
  }

  async loadProjectNode (projectNode) {
    if (!projectNode) return

    this.state.projectNode = projectNode

    const app = this.props.parent

    if (!projectNode.isDirectory) {
      const tabs = this.querySelector('editor-tabs')

      if (projectNode.label === 'settings.json' && projectNode.parent.id === 'root') {
        projectNode.isRootSettingsFile = true
      }

      tabs.add(projectNode)

      const ext = path.extname(projectNode.id)

      const mappings = app.state.settings.extensionLanguageMappings
      const lang = mappings[ext] || ext.slice(1)
      monaco.editor.setModelLanguage(this.editor.getModel(), lang)
      let data = await fs.promises.readFile(projectNode.id, 'utf8')

      if (path.extname(projectNode.id) === '.json') {
        try {
          data = JSON.stringify(JSON.parse(data), null, 2)
        } catch {}
      }

      tabs.setCurrentTabValue(data)
    }
  }

  refreshColors (event) {
    const isDark = event || (window.matchMedia('(prefers-color-scheme: dark)'))
    const theme = isDark.matches ? 'tonic-dark' : 'tonic-light'

    const styles = window.getComputedStyle(document.body)

    const colors = {
      background: rgbaToHex(styles.getPropertyValue('--tonic-background').trim()),
      primary: rgbaToHex(styles.getPropertyValue('--tonic-primary').trim()),
      info: rgbaToHex(styles.getPropertyValue('--tonic-info').trim()),
      dark: rgbaToHex(styles.getPropertyValue('--tonic-dark').trim()),
      accent: rgbaToHex(styles.getPropertyValue('--tonic-accent').trim()),
      error: rgbaToHex(styles.getPropertyValue('--tonic-error').trim()),
      success: rgbaToHex(styles.getPropertyValue('--tonic-success').trim())
    }

    const base = `vs${theme.includes('dark') ? '-dark' : ''}`
    monaco.editor.defineTheme(theme, {
      base,
      inherit: true,
      rules: [
        {
          token: 'identifier',
          foreground: colors.primary
        },
        {
          token: 'comment',
          foreground: colors.info
        },
        {
          token: 'keyword',
          foreground: colors.accent
        },
        {
          token: 'string',
          foreground: colors.info
        },
        {
          token: 'number',
          foreground: colors.accent
        },
        {
          token: 'punctuation',
          foreground: colors.primary
        }
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
    const coTerminal = document.querySelector('app-terminal')

    if (tab.isRootSettingsFile) {
      try {
        app.state.settings = JSON.parse(value)
      } catch (err) {
        coTerminal.error(`Unable to parse settings file (${err.message})`)
        return
      }

      coTerminal.info('Settings file updated.')
      app.activatePreviewWindows()
    }

    clearTimeout(this.debouncePropertiesRerender)
    this.debouncePropertiesRerender = setTimeout(() => {
      const coProperties = document.querySelector('app-properties')
      coProperties.reRender()
    }, 1024)

    this.writeToDisk(tab.path, value)
  }

  connected () {
    let theme
    const app = this.props.parent

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
