const CodeMirror = require('codemirror')
const { remote } = require('electron')
const path = require('path')

require('codemirror/mode/javascript/javascript')
require('codemirror/addon/edit/matchbrackets')

const opts = {
  tabSize: 2,
  lineNumbers: JSON.parse(window.localStorage.lineNumbers || 'false'),
  styleActiveLine: false,
  matchBrackets: true,
  theme: window.localStorage.theme || 'light'
}

document.body.setAttribute('data-theme', opts.theme.toLowerCase())

const editor = CodeMirror.fromTextArea(
  document.getElementById('editor'),
  Object.assign({}, opts, {
    autofocus: true,
    mode: 'javascript',
    gutters: ['CodeMirror-lint-markers'],
    lint: true
  })
)

const output = CodeMirror.fromTextArea(
  document.getElementById('output'),
  Object.assign({}, opts, { readOnly: true })
)

setTimeout(() => {
  editor.refresh()
  output.refresh()
}, 128)

let sandbox = new remote.BrowserWindow({
  width: 450,
  height: 400,
  minWidth: 150,
  minHeight: 200,
  title: 'Document Window',
  alwaysOnTop: JSON.parse(window.localStorage.sandboxOnTop || 'false')
})

sandbox.loadURL(`file://${__dirname}/../../../static/blank.html`)

sandbox.webContents.on('did-finish-load', () => {
  const str = window.localStorage.input || ''
  editor.setValue(str)
  render(str)
})

if (!window.localStorage.sandbox) {
  sandbox.hide()
}

if (window.localStorage.hideOutput) {
  document.body.classList.add('hide-output')
}

async function render (s) {
  window.localStorage.input = s

  s = s
    .replace(/`/g, '\\`')
    .replace(/\${/g, '\\${')
    .replace(/\\n/g, '\\\\n')

  s = s.split('\n').map((line, lineno) => {
    return line.replace(/console\.log\(/g, () => {
      return `console.log(${lineno}, `
    })
  }).join('\n')

  let result = await sandbox.webContents.executeJavaScript(`
    window.__output = []

    try {
      eval(\`(function() { ${s}; })()\`)
      window.__output
    } catch (ex) {
      ex.stack
    }
  `)

  if (typeof result === 'string') {
    if (/SyntaxError: Unexpected token ;/.test(result)) return

    const lines = result.split('\n').slice(0, -4)
    const message = lines.shift()
    const stack = lines.map(line => {
      const info = line.split(' ')
      return `  at ${info[info.length - 1].slice(0, -1)}`
    }).join('\n')

    return output.setValue([message, stack].join('\n'))
  }

  if (result.length === 0) {
    return output.setValue('')
  }

  result = result.filter(Boolean)

  result = result.map(chunk => {
    const line = parseInt(chunk.split(' ')[0], 10)
    const content = chunk.replace(/^\d+ /, '')
    return { line, content }
  })

  if (window.localStorage.matchingLines) {
    const last = result[result.length - 1].line
    output.setValue(Array(last || 1).fill('\n').join(''))

    result.forEach(chunk => {
      const content = chunk.content.replace(/\\n/g, '\n')
      output.replaceRange(content, { line: chunk.line })
    })
  } else {
    result = result
      .map(chunk => chunk.content)
      .join('\n')
      .replace(/\\n/g, '\n')
    output.setValue(result)
  }
}

let renderTimeout = null

editor.on('change', event => {
  const str = editor.getValue()
  clearTimeout(renderTimeout)
  renderTimeout = setTimeout(() => render(str), 512)
})

//
// Window events
//
window.events.on('cwd', p => {
  remote.dialog.showOpenDialog({ properties: ['openDirectory'] }, (p) => {
    if (!p[0]) return

    const cwd = /node_modules\/?$/.test(p[0])
      ? p[0]
      : path.join(p[0], 'node_modules')

    sandbox.webContents.send('cwd', cwd)
    render(editor.getValue())
  })
})

window.events.on('matchinglines', () => {
  if (window.localStorage.matchingLines) {
    delete window.localStorage.matchingLines
  } else {
    window.localStorage.matchingLines = true
  }
  render(editor.getValue())
})

window.events.on('output:toggle', () => {
  if (window.localStorage.hideOutput) {
    document.body.classList.remove('hide-output')
    delete window.localStorage.hideOutput
  } else {
    document.body.classList.add('hide-output')
    window.localStorage.hideOutput = true
  }
})

window.events.on('sandbox:ontop', () => {
  if (window.localStorage.sandboxOnTop) {
    sandbox.setAlwaysOnTop(false)
    delete window.localStorage.sandboxOnTop
  } else {
    window.localStorage.sandboxOnTop = true
    sandbox.setAlwaysOnTop(true)
  }
})

window.events.on('sandbox:toggle', () => {
  if (window.localStorage.sandbox) {
    sandbox.hide()
    delete window.localStorage.sandbox
  } else {
    sandbox.show()
    window.localStorage.sandbox = true
  }
})

window.events.on('editor:theme', name => {
  name = name.toLowerCase()
  document.body.setAttribute('data-theme', name)
  editor.setOption('theme', name)
  output.setOption('theme', name)
})

window.events.on('editor:linenumbers', () => {
  const state = opts.lineNumbers = !opts.lineNumbers
  window.localStorage.lineNumbers = state
  editor.setOption('lineNumbers', state)
  output.setOption('lineNumbers', state)
})
