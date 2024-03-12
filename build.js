#!/usr/bin/env node
import path from 'node:path'
import fs from 'node:fs/promises'

import esbuild from 'esbuild'

const __dirname = path.dirname(new URL(import.meta.url).pathname)

const cp = async (a, b) => fs.cp(
  path.resolve(a),
  path.join(b, path.basename(a)),
  { recursive: true, force: true }
)

async function copy (target) {
  await cp('src/index.html', target)
  await cp('src/vm.js', target)
  await cp('src/preview.js', target)
  await cp('src/worker.js', target)
  await cp('icons/icon.png', target)
  await cp('src/template', target)
  await cp('src/fonts', target)
  await cp('src/lib', target)
  await cp('src/css', target)
}

async function main (argv) {
  const workerEntryPoints = [
    'vs/language/json/json.worker.js',
    'vs/language/css/css.worker.js',
    'vs/language/html/html.worker.js',
    'vs/language/typescript/ts.worker.js',
    'vs/editor/editor.worker.js'
  ]

  await esbuild.build({
    entryPoints: workerEntryPoints.map((entry) => `node_modules/monaco-editor/esm/${entry}`),
    bundle: true,
    minify: false,
    format: 'iife',
    outbase: 'node_modules/monaco-editor/esm/',
    outdir: 'src'
  })

  const params = {
    entryPoints: ['src/index.js'],
    format: 'esm',
    bundle: true,
    minify: false,
    sourcemap: false,
    external: ['socket:*', 'node:*'],
    loader: {
      '.ttf': 'file'
    }
  }

  const target = process.env.PREFIX

  const opts = {
    ...params,
    outdir: target
  }
  await esbuild.build(opts)
  await copy(target)
}

main(process.argv.slice(2))
