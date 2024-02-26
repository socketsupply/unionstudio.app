import { spawn } from 'socket:child_process'

const c = spawn('ls', ['-la'])

c.stdout.on('data', data => {
  console.log(Buffer.from(data).toString())
})

c.on('exit', (code) => console.log('OK!', code))
c.on('error', () => console.log('NOT OK!'))


