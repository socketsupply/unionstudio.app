import Tonic from '@socketsupply/tonic'
import fs from 'socket:fs'
import ini from 'ini'

const isNumber = s => !isNaN(parseInt(s, 10))

const getObjectValue = (o = {}, path = '') => {
  const parts = path.split('.')
  let value = o

  for (const p of parts) {
    if (!value) return false
    value = value[p]
  }

  return value
}

const setObjectValue = (o = {}, path = '', v) => {
  const parts = path.split('.')
  let value = o

  let last = parts.pop()
  if (!last) return

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]

    if (!value[p]) {
      value[p] = isNumber(parts[i + 1]) ? [] : {}
    }
    value = value[p]
  }

  value[last] = v
  return o
}

function trim (string) {
  const lines = string.split(/\r?\n/)

  let leadingSpaces = 0

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== '') {
      leadingSpaces = lines[i].search(/\S/)
      break
    }
  }

  for (let i = 0; i < lines.length; i++) {
    lines[i] = lines[i].slice(leadingSpaces).trimRight()
  }

  if (lines[0] === '') lines.shift()
  return lines.join('\n')
}

class AppProperties extends Tonic {
  constructor () {
    super()
  }

  async click (e) {
    const el = Tonic.match(e.target, '[data-event]')
    if (!el) return

    const { event, propertyPath, propertyValue } = el.dataset

    const editor = document.querySelector('app-editor')
    const project = document.querySelector('app-project')


    if (event === 'property') {
      const project = document.querySelector('app-project')
      const node = project.getNodeByProperty('id', 'socket.ini')
      const data = ini.parse(node.data)
      setObjectValue(propertyPath, propertyValue)
    }

    if (event === 'insert-native-extension') {
      await project.insert({
        label: 'extension.cc',
        id: 'templates/extension.cc'
      })

      const node = project.getNodeByProperty('id', 'templates/index.js')
      project.revealNode(node.id)

      node.data = trim(`
        import extension from 'socket:extension'
        import ipc from 'socket:ipc'
      `) + node.data

      node.data += trim(`
        //
        // Native Extension example
        //
        const simple = await extension.load('simple-ipc-ping')
        const result = await ipc.request('simple.ping', { value: 'hello world' })
        console.log(result.data, 'hello world')

        await simple.unload()
      `)

      editor.loadProjectNode(node)
    }

    if (event === 'insert-wasm-extension') {
      await project.insert({
        label: 'wasm-extension.cc',
        id: 'templates/wasm-extension.cc'
      })
    }

    if (event === 'insert-service-worker') {
      await project.insert({
        label: 'service-worker.c',
        id: 'templates/service-worker.c'
      })
    }

    if (event === 'insert-worker-thread') {
      const exists = project.getNodeByProperty('id', 'src/worker-thread.js')
      if (exists) return

      await project.insert({
        source: 'templates/worker-thread.js',
        node: {
          label: 'worker-thread.js',
          id: 'src/worker-thread.js'
        }
      })

      const node = project.getNodeByProperty('id', 'src/index.js')

      if (!node.data.includes('socket:worker_threads')) {
        node.data = trim(`
          import { Worker } from 'socket:worker_threads'
        `) + node.data
      }

      if (!node.data.includes('socket:process')) {
        node.data = trim(`
          import process from 'socket:process'
        `) + node.data
      }

      node.data += trim(`
        //
        // Create a worker from the new file
        //

        // send some initial data through to the worker
        const sampleData = new TextEncoder().encode('hello world')

        // create the worker
        const worker = new Worker('./worker-thread.js', {
          workerData: { sampleData },
          stdin: true,
          stdout: true
        })

        // listen to messages from the worker
        worker.on('message', console.log)
        worker.on('error', console.error)
        worker.stdout.on('data', console.log)
      `)

      editor.loadProjectNode(node)
    }

    if (event === 'insert-web-worker') {
      await project.insert({
        label: 'web-worker.c',
        id: 'templates/web-worker.c'
      })
    }
  }

  connected () {
    // this.updated()
  }

  /* updated () {
    let data = {}
    if (project) {
      const project = document.querySelector('app-project')
      const node = project.getNodeByProperty('id', 'socket.ini')
      data = ini.parse(node.data)
    }
  } */

  render () {
    const { data } = this.props

    return this.html`
      <tonic-accordion id="options">
        <tonic-accordion-section
          name="bucket-test-1"
          id="bucket-test-1"
          data="preview"
          label="Desktop Features"
        >
          <div class="option">
            <tonic-checkbox id="build_headless" checked="false" label="Headless" title="Headless"></tonic-checkbox>
            <p>The app's primary window is initially hidden.</p> 
          </div>

          <div class="option">
            <tonic-checkbox id="tray" checked="false" label="Tray" title="Tray"></tonic-checkbox>
            <p>An icon is placed in the omni-present system menu (aka Tray). Clicking it triggers an event.</p>
          </div>

          <div class="option">
            <tonic-checkbox id="application_agent" checked="false" label="Agent" title="Agent"></tonic-checkbox>
            <p>Apps do not appear in the task switcher or on the Dock.</p>
          </div>
        </tonic-accordion-section>
        <tonic-accordion-section
          name="bucket-test-2"
          id="bucket-test-2"
          label="Permissions">
            <div class="option">
              <tonic-checkbox id="permissions_allow_fullscreen" checked="false" label="Full Screen"></tonic-checkbox>
              <p>Allow/Disallow fullscreen in application</p>
            </div>
            <div class="option">
              <tonic-checkbox id="permissions_allow_microphone" label="Microphone" checked="false"></tonic-checkbox>
              <p>Allow/Disallow microphone in application</p>
            </div>
            <div class="option">
              <tonic-checkbox id="permissions_allow_camera" checked="false" label="Camera"></tonic-checkbox>
              <p>Allow/Disallow camera in application</p>
            </div>
            <div class="option">
              <tonic-checkbox id="permissions_allow_user_media" checked="false" label="User Media"></tonic-checkbox>
              <p>Allow/Disallow user media (microphone + camera) in application</p>
            </div>
            <div class="option">
              <tonic-checkbox id="permissions_allow_geolocation" checked="false" label="Geolocation"></tonic-checkbox>
              <p>Allow/Disallow geolocation in application</p>
            </div>
            <div class="option">
              <tonic-checkbox id="permissions_allow_notifications" checked="false" label="Notifications"></tonic-checkbox>
              <p>Allow/Disallow notifications in application</p>
            </div>
            <div class="option">
              <tonic-checkbox id="permissions_allow_sensors" checked="false" label="Sensors"></tonic-checkbox>
              <p>Allow/Disallow sensors in application</p>
            </div>
            <div class="option">
              <tonic-checkbox id="permissions_allow_clipboard" checked="false" label="Clipboard"></tonic-checkbox>
              <p>Allow/Disallow clipboard in application</p>
            </div>
            <div class="option">
              <tonic-checkbox id="permissions_allow_bluetooth" checked="false" label="Bluetooth"></tonic-checkbox>
              <p>Allow/Disallow bluetooth in application</p>
            </div>
            <div class="option">
              <tonic-checkbox id="permissions_allow_data_access" checked="false" label="Data Access"></tonic-checkbox>
              <p>Allow/Disallow data access in application</p>
            </div>
            <div class="option">
              <tonic-checkbox id="permissions_allow_airplay" checked="false" label="AirPlay"></tonic-checkbox>
              <p>Allow/Disallow AirPlay access in application (macOS/iOS) only</p>
            </div>
            <div class="option">
              <tonic-checkbox id="permissions_allow_hotkeys" checked="false" label="AirPlay"></tonic-checkbox>
              <p>Allow/Disallow HotKey binding registration (desktop only)</p>
            </div>
        </tonic-accordion-section>
        <tonic-accordion-section
          name="bucket-test-3"
          id="bucket-test-3"
          label="Web Workers"
        >
          <div class="option">
            <p>
              Inserts a JavaScript snippet for building a Web Worker. A Web Worker is a seperate thread (aka a local-backend), that you can communicate with using JavaScript.
              <tonic-button
                data-event="insert-web-worker"
              >Insert</tonic-button>
            </p>
          </div>
        </tonic-accordion-section>
        <tonic-accordion-section
          name="insert-worker-thread"
          id="insert-worker-thread-section"
          label="Worker Threads"
        >
          <div class="option">
            <p>
              Inserts a JavaScript snippet for building a Web Worker. A Web Worker is a seperate thread (aka a local-backend), that you can communicate with using JavaScript.
              <tonic-button
                data-event="insert-worker-thread"
              >Insert</tonic-button>
            </p>
          </div>
        </tonic-accordion-section>
        <tonic-accordion-section
          name="bucket-test-4"
          id="bucket-test-4"
          label="Service Workers"
        >
          <div class="option">
            <p>
              Inserts a JavaScript snippet for building a Service Worker. A Service Worker is a seperate thread (aka a local-backend), that you can communicate with from a route like "/foo/bar/bazz".
              <tonic-button
                data-event="insert-service-worker"
              >Insert</tonic-button>
           </p>
          </div>
        </tonic-accordion-section>
        <tonic-accordion-section
          name="bucket-test-5"
          id="bucket-test-5"
          label="Native Extensions">
          <div class="option">
            <p>
              Creates a file called 'extension.cc', and inserts JavaScript code into index.js that can be used to load it.
              <tonic-button
                data-event="insert-native-extension"
              >Insert</tonic-button>
            </p>
          </div>
        </tonic-accordion-section>
        <tonic-accordion-section
          name="bucket-test-6"
          id="bucket-test-6"
          label="WASM Extensions">
          <div class="option">
            <p>
              An example of how to build a WASM extension.
              <tonic-button
                data-event="insert-wasm-extension"
              >Insert</tonic-button>
            </p>
          </div>
        </tonic-accordion-section>
      </tonic-accordion>
    `
  }
}

export { AppProperties }
export default AppProperties
