import { getTransferables } from 'socket:vm'
import hooks from 'socket:hooks'

let port

export async function evaluate (source) {
  const blob = new globalThis.Blob([source], { type: 'text/javascript' })
  const url = URL.createObjectURL(blob)
  return await import(url)
}

export async function init (options) {
  if (port) {
    port.close()
  }

  if (options.port) {
    port = options.port
    port.start()
  }

  Object.assign(globalThis.console, {
    log (...args) {
      if (!port) {
        return
      }

      const transfer = args
        .map(getTransferables)
        .reduce((array, transfer) => array.concat(transfer), [])

      port.postMessage({ method: 'console.log', args }, { transfer })
    },

    error (...args) {
      if (!port) {
        return
      }

      const transfer = args
        .map(getTransferables)
        .reduce((array, transfer) => array.concat(transfer), [])

      port.postMessage({ method: 'console.error', args }, { transfer })
    },

    debug (...args) {
      if (!port) {
        return
      }

      const transfer = args
        .map(getTransferables)
        .reduce((array, transfer) => array.concat(transfer), [])

      port.postMessage({ method: 'console.debug', args }, { transfer })
    },
  })
}

hooks.onError((event) => {
  if (event.error) {
    console.error(event.error)
  }
})

export default { init, evaluate }
