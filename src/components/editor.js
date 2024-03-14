import fs from 'socket:fs'
import path from 'socket:path'
import { lookup } from 'socket:mime'

import * as monaco from 'monaco-editor'
import Tonic from '@socketsupply/tonic'

import { resizePNG } from '../lib/icon.js'

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

class AppEditor extends Tonic {
  get value () {
    return this.editor.getValue()
  }

  set value (s) {
    this.editor.setValue(s)
  }

  async click (e) {
    const el = Tonic.match(e.target, '[data-event]')
    if (!el) return

    const { event, value } = el.dataset

    const pickerOpts = {
      types: [
        {
          description: 'Images',
          accept: {
            'image/*': ['.png']
          }
        }
      ],
      excludeAcceptAllOption: true,
      multiple: false
    }

    if (event === 'size') {
      const [fileHandle] = await window.showOpenFilePicker(pickerOpts)

      /* const kFileSystemHandleFullName = Object
          .getOwnPropertySymbols(data)
          .find(s => s.description === 'kFileSystemHandleFullName')
         const pathToFile = fileHandle[kFileSystemHandleFullName]
      */

      const file = fileHandle.getFile()
      const buf = await file.arrayBuffer()

      if (value === 'all') {
        const imagePreview = this.querySelector('.image-preview')
        const blob = new Blob([buf], { type: 'image/png' })
        const url = URL.createObjectURL(blob)
        ;[...imagePreview.querySelectorAll('img')].forEach(img => (img.src = url))
        return
      }

      const blob = await resizePNG(buf, parseInt(value))

      el.src = URL.createObjectURL(blob)
    }
  }

  get selection () {
    this.editor.getModel().getValueInRange(this.editor.getSelection())
  }

  async writeToDisk (projectNode, data) {
    const app = document.querySelector('app-view')
    const preview = document.querySelector('app-preview')

    try {
      await fs.promises.writeFile(projectNode.id, data)
    } catch (err) {
      console.error(`Unable to write to ${dest}`, err)
    }

    this.props.parent.reloadPreviewWindows()
  }

  async loadProjectNode (projectNode) {
    if (!projectNode) return

    const parent = this.props.parent
    const ext = path.extname(projectNode.id)
    const type = await lookup(ext.slice(1))
    const elImagePreview = document.querySelector('.image-preview')
    elImagePreview.style.display = 'none'

    if (type.length) {
      if (/image/.test(type[0].mime)) {
        elImagePreview.style.display = 'grid'
        // Display a preview for this type.
        return
      }
    }

    this.projectNode = projectNode

    const fileName = projectNode.label
    const imagePreview = this.querySelector('.image-preview')

    if (projectNode.isDirectory && fileName === 'icons') {
      const iconPath = path.join(projectNode.id, 'icon.png')
      const data = await fs.promises.readFile(iconPath)
      const blob = new Blob([data], { type: 'image/png' })
      const url = URL.createObjectURL(blob)
      ;[...imagePreview.querySelectorAll('img')].forEach(img => (img.src = url))
      imagePreview.classList.add('show')
      return
    }

    imagePreview.classList.remove('show')

    if (!projectNode.isDirectory && this.editor) {
      const ext = path.extname(projectNode.id)

      const mappings = parent.state.settings.extensionLanguageMappings
      const lang = mappings[ext] || ext.slice(1)
      monaco.editor.setModelLanguage(this.editor.getModel(), lang)
      let data = await fs.promises.readFile(projectNode.id, 'utf8')

      if (path.extname(projectNode.id) === '.json') {
        try {
          data = JSON.stringify(JSON.parse(data), null, 2)
        } catch {}
      }
      this.editor.setValue(data)
    }
  }

  refreshColors (theme) {
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

  async refreshSettings () {
    const parent = this.props.parent
    this.editor.updateOptions(parent.state.settings?.editorOptions || {})
  }

  connected () {
    let theme
    const parent = this.props.parent

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

    this.refreshSettings()

    const model = this.editor.getModel()

    model.onDidChangeContent(async () => {
      if (!this.projectNode) return
      const value = this.editor.getValue()
      const coTerminal = document.querySelector('app-terminal')
      const coProperties = document.querySelector('app-properties')

      if (this.projectNode.label === 'settings.json' && this.projectNode.parent.id === 'root') {

        try {
          this.props.parent.state.settings = JSON.parse(value)
        } catch (err) {
          coTerminal.error(`Unable to parse settings file (${err.message})`)
          return
        }
        coTerminal.info(`Settings file updated.`)
        coProperties.reRender()
        parent.activatePreviewWindows()
      }

      this.writeToDisk(this.projectNode, value)
    })

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
      this.refreshColors(event.matches ? 'tonic-dark' : 'tonic-light')
    })

    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    this.refreshColors(isDark ? 'tonic-dark' : 'tonic-light')
    this.loadAPIs()
  }

  render () {
    return this.html`
      <div class="image-preview">
        <div class="top">
          <h1>Icon Preview</h1>
          <tonic-button data-event="size" data-value="all">Update</tonic-button>
        </div>
        <div class="bottom">
          <div class="size size-128">
            <img data-event="size" data-value="128">
            <label>128x128</label>
          </div>
          <div class="size size-64">
            <img data-event="size" data-value="64">
            <label>64x64</label>
          </div>
          <div class="size size-32">
            <img data-event="size" data-value="32">
            <label>32x32</label>
          </div>
          <div class="size size-16">
            <img data-event="size" data-value="16">
            <label>16x16</label>
          </div>
        </div>
      </div>
      <div class="editor"></div>
    `
  }
}

export { AppEditor }
export default AppEditor
