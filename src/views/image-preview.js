import fs from 'socket:fs'
import path from 'socket:path'

import Tonic from '@socketsupply/tonic'

import Config from '../lib/config.js'

class ViewImagePreview extends Tonic {
  async click (e) {
    const el = Tonic.match(e.target, '[data-event]')
    if (!el) return

    const { event, value } = el.dataset

    const pickerOpts = {
      types: [
        {
          description: 'Images',
          accept: {
            'image/*': ['.png']
          }
        }
      ],
      excludeAcceptAllOption: true,
      multiple: false
    }

    if (event === 'size') {
      const [fileHandle] = await window.showOpenFilePicker(pickerOpts)

      /* const kFileSystemHandleFullName = Object
          .getOwnPropertySymbols(data)
          .find(s => s.description === 'kFileSystemHandleFullName')
         const pathToFile = fileHandle[kFileSystemHandleFullName]
      */

      const file = fileHandle?.getFile()

      if (file) {
        const buf = await file.arrayBuffer()

        if (value === 'all') {
          const imagePreview = this.querySelector('.image-preview')
          const blob = new Blob([buf], { type: 'image/png' })
          const url = URL.createObjectURL(blob)
          ;[...imagePreview.querySelectorAll('img')].forEach(img => (img.src = url))
          return
        }

        const blob = await resizePNG(buf, parseInt(value))

        el.src = URL.createObjectURL(blob)
      }
    }
  }

  show () {
    this.classList.add('show')
  }

  hide () {
    this.classList.remove('show')
  }

  async load (projectNode) {
    this.state.pathToFile = projectNode.id
    this.reRender()
  }

  async render () {
    const app = this.props.parent
    const currentProject = app.state.currentProject
    const config = new Config(currentProject?.id)

    if (!currentProject) return this.html``

    const templateSizes = async platform => {
      const spec = await config.get(platform, 'icon_sizes')

      return spec.replace(/"/g, '')
        .split(' ')
        .map(pair => {
          let { 0: size, 1: scale } = pair.split('@')
          scale = parseInt(scale)

          const src = this.state.pathToFile.replace(path.HOME, '/user/home')
          const scaled = size * scale

          return this.html`
            <div class="size">
              <img data-event="size" width="${scaled}px" height="${scaled}px" src="${src}">
              <label>${pair}</label>
            </div>   
          `
        })
    }

    return this.html`
      <div class="top">
        <h1>Icon Preview</h1>
        <tonic-button data-event="size" data-value="all">Update</tonic-button>
      </div>

      <div class="bottom">
        <h2>MacOS</h2>
        <div class="icon-grid">${await templateSizes('mac')}</div>

        <h2>iOS</h2>
        <div class="icon-grid">${await templateSizes('ios')}</div>

        <h2>Linux</h2>
        <div class="icon-grid">${await templateSizes('linux')}</div>

        <h2>Windows</h2>
        <div class="icon-grid">${await templateSizes('win')}</div>
      </div>
    `
  }
}

export { ViewImagePreview }
export default ViewImagePreview
