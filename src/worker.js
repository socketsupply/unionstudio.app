import path from 'socket:path'
import { lookup } from 'socket:mime'
import application from 'socket:application'
import fs from 'socket:fs/promises'

export default async function (req, env, ctx) {
  const url = new URL(req.url)
  const pattern = new globalThis.URLPattern({ pathname: '/preview/*' })
  const route = pattern.exec(url)

  if (!route) return

  const p = path.join(path.DATA, route.pathname.groups[0])
  const params = url.searchParams

  const types = await lookup(path.extname(url.pathname).slice(1))
  const type = types[0]?.mime ?? ''

  const headers = {
    'Content-Type': type || 'text/html',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*'
  }

  let data = ''

  try {
    if (await fs.access(p, fs.constants.R_OK)) {
      data = await fs.readFile(p, 'utf8')
    } else {
      data = '<h1>Not Found</h1>'
      headers['Runtime-Preload-Injection'] = 'disabled'
    }
  } catch (err) {
    data = err.message
  }

  const windows = await application.getWindows()
  const w = Object.values(windows)[0]

  const zoom = params.get('zoom')
  const device = params.get('device')

  let bgColor = 'black'

  if (w) {
    const winfo = await w.getBackgroundColor()
    bgColor = winfo?.data
  }

  let css = `
    body::after {
      content: ' ';
      position: fixed;
      transform: translateX(-50%);
      background: ${bgColor};
      z-index: 1000;
    }
  `

  if (device === 'iphone-15') {
    css += `
      body::after {
        top: 2%;
        left: 50%;
        width: 30%;
        height: 4%;
        border-radius: 50px;
      }
    `
  }

  if (device === 'iphone-13') {
    css += `
      body::after {
        top: 0;
        left: 50%;
        width: 45%;
        height: 3.8%;
        border-radius: 0 0 10px 10px;
      }
    `
  }

  if (device === 'galaxy-23') {
    css += `
      body::after {
        top: 2%;
        left: 50%;
        width: 4.5%;
        height: 2%;
        border-radius: 99em;
      }
    `
  }

  let html = data

  if (url.pathname.endsWith('index.html')) {
    html = html.replace(/<html(?:[^\n\r]*)>/, `<html style="zoom: ${zoom}">`)
    html = html.replace('</head>', `<style>${css}</style></head>`)
  }

  return new Response(html, { status: 200, headers })
}
