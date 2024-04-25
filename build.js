#!/usr/bin/env node
//
// Most newer modules don't need to be bundled. But the monaco
// and xterm packages rely on bundler-features heavily.
//
import esbuild from 'esbuild'

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
    minify: true,
    format: 'iife',
    outbase: 'node_modules/monaco-editor/esm/',
    outdir: 'src/lib'
  })

  const params = {
    entryPoints: ['src/vendor.js'],
    format: 'esm',
    bundle: true,
    minify: true,
    sourcemap: false,
    loader: {
      '.ttf': 'file'
    }
  }

  const target = process.env.PREFIX

  if (!target) {
    console.log('This script should not be run directly. It will be run by the SSC command.')
    process.exit(0)
  }

  const opts = {
    ...params,
    outdir: target
  }

  await esbuild.build(opts)
}

main(process.argv.slice(2))
