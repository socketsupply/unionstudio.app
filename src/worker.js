import path from 'socket:path'
import { lookup } from 'socket:mime'
import fs from 'socket:fs'

const mount = '/user/home'
const navigatorPath = path.DATA.replace(path.HOME, mount)

export default async function (req, env, ctx) {
  const url = new URL(req.url)

  const pattern = new URLPattern({ pathname: '/preview/*' })
  const route = pattern.exec(url)

  if (!route) return

  const p = path.join(navigatorPath, route.pathname.groups[0])

  const res = await fetch(p)
  let data = await res.text()

  if (url.pathname.endsWith('index.html')) {
    data = data.replace(/<html(?:[^\n\r]*)>/, `<html style="zoom: ${url.searchParams.get('zoom')}">`)
  }

  const types = await lookup(path.extname(url.pathname).slice(1))
  const type = types[0]?.mime ?? ''

  const headers = {
    'Content-Type': type,
    'Cache-Control': 'no-cache'
  }

  return new Response(data, { status: 200, headers })
}
