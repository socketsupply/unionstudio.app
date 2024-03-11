import process from 'socket:process'
import path from 'socket:path'
import fs from 'socket:fs'

//
// This is the path tho where our app data is stored
//
const filename = path.join(path.DATA, 'src', 'dummy.json')

//
// Read the file from the disk
//
const data = await fs.promises.readFile(filename, 'utf8')

//
// Parse it since it was stored as a string
//
const greetings = JSON.parse(data)

//
// Print some stuff
//
console.log(`${greetings.greeting1}, ${process.platform}!`)

