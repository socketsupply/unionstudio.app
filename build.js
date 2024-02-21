#!/usr/bin/env node
import path from 'node:path'
import fs from 'node:fs/promises'

import esbuild from 'esbuild'

const cp = async (a, b) => fs.cp(
  path.resolve(a),
  path.join(b, path.basename(a)),
  { recursive: true, force: true }
)

async function copy (target) {
  await cp('src/index.html', target)
  await cp('src/vm.js', target)
  await cp('icons/icon.png', target)
  await cp('src/templates', target)
  await cp('src/examples', target)
  await cp('src/css', target)
}

async function main (argv) {
  const params = {
    entryPoints: ['src/index.js'],
    format: 'esm',
    bundle: true,
    minify: false,
    sourcemap: true,
    external: ['socket:*', 'node:*'],
    keepNames: true
  }

  const target = process.env.PREFIX

  const opts = {
    ...params,
    outdir: target,
    minifyWhitespace: false,
    minifyIdentifiers: true,
    minifySyntax: true
  }
  await esbuild.build(opts)
  await copy(target)
}

main(process.argv.slice(2))
