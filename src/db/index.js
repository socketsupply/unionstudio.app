const getStore = (db, loc, type = 'readwrite') => {
  const tx = db.transaction(loc, type)
  return { tx, store: tx.objectStore(loc) }
}

const getRange = o => {
  const exLower = typeof o.lt !== 'undefined'
  const exUpper = typeof o.gt !== 'undefined'

  const range = window.IDBKeyRange

  if ((o.lte || o.lt) && (o.gte || o.gt)) {
    const args = [
      o.gte || o.gt,
      o.lte || o.lt,
      exLower,
      exUpper
    ]

    return range.bound(...args)
  }

  if (o.lte || o.lt) {
    return range.upperBound(o.lte || o.lt, exLower)
  }

  if (o.gte || o.gt) {
    return range.lowerBound(o.gte || o.gt, exUpper)
  }
}

export class Indexed {
  constructor (loc) {
    this._loc = loc
    this._db = null
  }

  static async open (...args) {
    const indexed = new Indexed(...args)
    return await indexed.init()
  }

  static async drop (loc) {
    return new Promise(resolve => {
      const r = window.indexedDB.deleteDatabase(loc)
      r.onsuccess = () => resolve({ data: true })
      r.onerror = event => resolve({ err: event.target })
      r.onblocked = event => resolve({ err: event.target })
    })
  }

  init () {
    return new Promise(resolve => {
      const r = window.indexedDB.open(this._loc)
      const loc = this._loc

      r.onerror = event => {
        throw event.target
      }

      r.onupgradeneeded = (event) => {
        this._db = event.target.result
        const opts = { keyPath: 'key' }
        const store = this._db.createObjectStore(loc, opts)

        store.transaction.oncomplete = event => {
          resolve(this)
        }
      }

      r.onsuccess = (event) => {
        this._db = event.target.result
        resolve(this)
      }
    })
  }

  count () {
    return new Promise(resolve => {
      const { store } = getStore(this._db, this._loc)
      const r = store.count()
      r.onsuccess = () => resolve({ data: r.result || 0 })
      r.onerror = event => resolve({ err: event.target })
      r.onblocked = event => resolve({ err: event.target })
    })
  }

  has (key) {
    return new Promise(resolve => {
      const { store } = getStore(this._db, this._loc)
      const r = store.get(key)
      r.onerror = event => {
        if (Indexed.onerror) Indexed.onerror(event.target)
        resolve({ err: event.target })
      }
      r.onsuccess = function (event) {
        resolve({ data: typeof this.result !== 'undefined' })
      }
    })
  }

  get (key) {
    return new Promise(resolve => {
      const { store } = getStore(this._db, this._loc, 'readonly')
      const r = store.get(key)
      r.onerror = event => {
        if (Indexed.onerror) Indexed.onerror(event.target)
        resolve({ err: event.target })
      }
      r.onsuccess = function (event) {
        if (typeof this.result === 'undefined') {
          return resolve({ err: new Error('Not Found') })
        }
        resolve({ data: this.result.value })
      }
    })
  }

  put (key, value) {
    return new Promise(resolve => {
      const { store } = getStore(this._db, this._loc)
      const r = store.put({ key, value })
      r.onerror = event => {
        if (Indexed.onerror) Indexed.onerror(event.target)
        resolve({ err: event.target })
      }
      r.onsuccess = event => resolve({})
    })
  }

  del (key) {
    return new Promise(resolve => {
      const { store } = getStore(this._db, this._loc)
      const r = store.delete(key)
      r.onerror = event => {
        if (Indexed.onerror) Indexed.onerror(event.target)
        resolve({ err: event.target })
      }
      r.onsuccess = event => resolve({})
    })
  }

  batch (ops) {
    return new Promise(resolve => {
      const { tx, store } = getStore(this._db, this._loc)
      tx.onerror = event => {
        if (Indexed.onerror) Indexed.onerror(event.target)
        resolve({ err: event.target })
      }
      tx.oncomplete = event => resolve({})

      const eachOp = op => {
        if (op.type === 'put') {
          store.put({ key: op.key, value: op.value })
        }

        if (op.type === 'del') {
          store.delete(op.key)
        }
      }

      ops.forEach(eachOp)
    })
  }

  readAll (opts) {
    return new Promise(resolve => {
      this.read(opts).then(({ events }) => {
        const rows = new Map()
        events.onerror = err => {
          if (Indexed.onerror) Indexed.onerror(err)
          resolve({ err })
        }
        events.ondata = (key, value) => rows.set(key, value)
        events.onend = () => resolve({ data: rows })
      })
    })
  }

  read (opts = {}) {
    return new Promise(resolve => {
      const { store } = getStore(this._db, this._loc, 'readonly')
      const r = store.openCursor(getRange(opts), opts.reverse ? 'prevunique' : undefined)
      const events = {}
      let count = 0
      resolve({ events })

      function onError (event) {
        if (Indexed.onerror) Indexed.onerror(event.target)
        if (events.onerror) events.onerror(event.target)
      }

      async function onSuccess (event) {
        const cursor = event.target.result

        if (cursor) {
          const r = store.get(this.result.key)

          r.onerror = event => {
            if (Indexed.onerror) Indexed.onerror(event.target)
            if (events.onerror) events.onerror(event.target)
          }

          r.onsuccess = function (event) {
            if (events.ondata) events.ondata(this.result.key, this.result.value)

            if (opts.limit && (count++ === (opts.limit - 1))) {
              if (events.onend) return events.onend()
              return
            }
            cursor.continue()
          }
        } else {
          if (events.onend) events.onend()
        }
      }

      r.onerror = onError
      r.onsuccess = onSuccess
    })
  }
}

export default Indexed
