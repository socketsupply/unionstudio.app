import { getTransferables } from 'socket:vm'

let port

export async function evaluate (source) {
  const blob = new globalThis.Blob([source], { type: 'text/javascript' })
  const url = URL.createObjectURL(blob)
  return await import(url)
}

export async function init (options) {
  port = options.port
  port.start()

  Object.assign(globalThis.console, {
    log: (...args) => {
      const transfer = args
        .map(getTransferables)
        .reduce((array, transfer) => array.concat(transfer), [])

      port.postMessage({ method: 'console.log', args }, { transfer })
    }
  })
}

export default { init, evaluate }
