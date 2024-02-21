import { createRequire } from 'socket:module'
const require = createRequire(import.meta.url)

//
// Required configuration in the socket.ini file...
//
// [build]
// env[] = SOCKET_MODULE_PATH_PREFIX
//
// [env]
// SOCKET_MODULE_PATH_PREFIX = "node_modules"
//

const ini = require('@npm/ini')
const parsed = ini.parse(`
[foo]
bar = bazz
`)

console.log(parsed)
