#!/usr/bin/env node
import path from 'node:path'
import fs from 'node:fs/promises'

import Minifier from 'clean-css'
import esbuild from 'esbuild'

const minifier = new Minifier({ advanced: true })

const css = async (src, dest) => {
  const RE = /@import ['"]([^'" ]+)['"];/g
  const reqs = []
  let str = await fs.readFile(src, 'utf8')

  str.replace(RE, (_, p) => {
    reqs.push(css(path.resolve(path.dirname(src), p)))
  })

  const data = await Promise.all(reqs)
  str = str.replace(RE, () => data.shift())

  const min = minifier.minify(str)

  if (!dest) return min.styles
  return fs.writeFile(dest, min.styles)
}

const cp = async (a, b) => fs.cp(
  path.resolve(a),
  path.join(b, path.basename(a)),
  { recursive: true, force: true }
)

async function copy (target) {
  await css(
    path.join('src', 'css', 'index.css'),
    path.join(target, 'index.css')
  )

  //
  // Copy the rest of the files that we care about.
  //
  await cp('src/index.html', target)
  await cp('src/temp.html', target)
  await cp('src/icon.png', target)
}

async function main () {
  const params = {
    entryPoints: ['src/index.js'],
    format: 'esm',
    bundle: true,
    minify: false,
    sourcemap: true,
    keepNames: true
  }

  //
  // During development, this script will be started by npm and it
  // will be passed the target directory for the build artifacts.
  //
  // During a build, this script will be called by the `op` command.
  // In this case the target directory for the build artifacts will
  // be provided as the argument at index 2.
  //
  let target = process.argv.find(s => s.includes('--watch='))

  if (target) {
    target = path.resolve(target.split('=')[1])
    esbuild.serve({ servedir: target }, params)
  } else {
    params.outdir = path.resolve(process.argv[2])
    await esbuild.build({
      ...params,
      minifyWhitespace: false,
      minifyIdentifiers: true,
      minifySyntax: true
    })
  }

  // await esbuild.build({ ...params, entryPoints: ['src/backend.js'], platform: 'node', format: 'cjs' })

  // Not writing a package json to your project could be a security risk
  await fs.writeFile(path.join(params.outdir, 'package.json'), '{}')

  if (!params.outdir) {
    console.log('Did not receive the build target path as an argument!')
    process.exit(1)
  }

  copy(params.outdir)
}

main()
