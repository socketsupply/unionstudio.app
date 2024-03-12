import path from 'socket:path'
import { lookup } from 'socket:mime'
import fs from 'socket:fs'
import application from 'socket:application'

const mount = '/user/home'
const navigatorPath = path.DATA.replace(path.HOME, mount)

export default async function (req, env, ctx) {
  const url = new URL(req.url)

  const pattern = new URLPattern({ pathname: '/preview/*' })
  const route = pattern.exec(url)

  if (!route) return

  const p = path.join(navigatorPath, route.pathname.groups[0])
  const params = url.searchParams
  const res = await fetch(p)

  let data = await res.text()

  const w = await application.getCurrentWindow()
  const winfo = await w.getBackgroundColor()
  const bgColor = winfo?.data || 'black'

  let css = `
    #SOCKET_NOTCH {
      position: fixed;
      transform: translateX(-50%);
      background: ${bgColor};
      z-index: 1000;
    }
  `

  if (params.get('device') === 'iphone-15') {
    css += `
      #SOCKET_NOTCH {
        top: 2%;
        left: 50%;
        width: 35%;
        height: 4%;
        border-radius: 50px;
      }
    `
  }

  if (params.get('device') === 'iphone-13') {
    css += `
      #SOCKET_NOTCH {
        top: 0;
        left: 50%;
        width: 45%;
        height: 3.8%;
        border-radius: 0 0 10px 10px;
      }
    `
  }

  if (url.pathname.endsWith('index.html')) {
    data = data.replace(/<html(?:[^\n\r]*)>/, `<html style="zoom: ${params.get('zoom')}">`)
    data = data.replace('</body>', `<style>${css}</style><div id="SOCKET_NOTCH"></div></body>`)
  }

  const types = await lookup(path.extname(url.pathname).slice(1))
  const type = types[0]?.mime ?? ''

  const headers = {
    'Content-Type': type,
    'Cache-Control': 'no-cache'
  }

  return new Response(data, { status: 200, headers })
}
