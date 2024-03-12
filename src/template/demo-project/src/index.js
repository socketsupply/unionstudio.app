import process from 'socket:process'
import path from 'socket:path'
import fs from 'socket:fs'

//
// This is the path tho where our app data is stored
//
const projectsRoot = path.join(path.DATA, 'projects')
const fileName = path.join(projectsRoot, 'demo-project', 'src', 'data.json')

//
// Read the file from the disk
//
const data = await fs.promises.readFile(fileName, 'utf8')

//
// Parse it since it was stored as a string
//
const greetings = JSON.parse(data)

//
// Print some stuff
//
console.log(`${greetings.en}, ${process.platform}!`)


