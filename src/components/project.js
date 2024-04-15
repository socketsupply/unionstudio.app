import application from 'socket:application'
import fs from 'socket:fs'
import path from 'socket:path'
import { lookup } from 'socket:mime'
import { cp, rm } from '../lib/fs.js'

import Tonic from '@socketsupply/tonic'

const EXPANDED_STATE = 1
const CLOSED_STATE = 0
const NOT_SELECTED = 0
const IS_SELECTED = 1

class AppProject extends Tonic {
  createCount = 0
  contextCut = null
  contextCopy = null
  contextDelete = null
  mouseIsDragging = false
  mouseIsDown = false
  mouseMoveThreshold = 0
  timeoutMouseMove = 0

  constructor () {
    super()

    window.addEventListener('keyup', e => {
      if (this.mouseIsDragging && e.key === 'Escape') {
        this.resetMouse()
        this.load()
      }
    })
  }

  /**
   * auto-sort="false"
   */
  defaults () {
    return {
      selectMode: 'leaf-only',
      autoExpand: true,
      draggable: true
    }
  }

  walk (nodes, fn) {
    nodes = Array.isArray(nodes) ? nodes.slice() : [nodes]
    while (nodes.length) {
      const node = nodes.shift()
      const shouldBail = fn(node)
      if (shouldBail) {
        return shouldBail
      }

      if (node?.children) {
        nodes.push(...node.children)
      }
    }
  }

  revealNode (id) {
    const tree = this.state.tree
    if (!tree) return

    const { node } = this.getNodeByProperty(id)
    if (!node) return

    node.state = 1
    node.selected = 0
    this.clickNode(node, false, true)
    this.reRender()
  }

  getNodeByProperty (prop, value, tree = this.state.tree) {
    return this.walk(tree, node => {
      if (node && node[prop] === value) return node
    })
  }

  getNodeFromElement (el) {
    const { path } = el.dataset
    if (!path) {
      return null
    }

    let parent = this.state.tree

    for (const position of path.split('.')) {
      if (parent && parent.children) {
        parent = parent.children[position]
      }
    }

    return parent
  }

  resetSelectedNodeState () {
    this.walk(this.state.tree, (node) => {
      node.selected = NOT_SELECTED
    })
  }

  resetLeafNodeState () {
    this.walk(this.state.tree, (node) => {
      if (node.children.length === 0) {
        node.state = CLOSED_STATE
      }
    })
  }

  resetMouse () {
    this.mouseMoveThreshold = 0
    this.removeAttribute('dragging')
    this.mouseIsDragging = false
    this.mouseIsDown = false
  }

  async renameNode (node, value) {
    const dirname = path.dirname(node.id).replace(/%20/g, ' ')
    const newId = path.join(dirname, value)
    await fs.promises.rename(node.id, newId)

    const coTabs = document.querySelector('editor-tabs')

    if (coTabs && coTabs.tab?.id === node.id) {
      coTabs.rename({ oldId: coTabs.tab.id, newId, label: value })
    }

    node.label = value
    node.id = newId

    this.load()
  }

  mousedown (e) {
    const el = Tonic.match(e.target, '[data-path]')
    if (!el) return

    const node = this.getNodeFromElement(el)
    if (!node) this.getNodeFromElement(el.parentElement)
    if (!node) return

    if (node.nonMovable) return

    this.removeAttribute('dragging')
    this.mouseMoveThreshold = 0

    this.mouseIsDown = true
    this.referenceNode = node
  }

  async mouseup (e) {
    const mouseDragged = this.mouseIsDragging
    this.resetMouse()
    const notifications = document.querySelector('#notifications')

    if (mouseDragged) {
      this.load()

      const el = Tonic.match(e.target, '[data-path]')
      const srcNode = this.referenceNode

      if (el && srcNode) {
        const destNode = this.getNodeFromElement(el)
        if (!destNode) this.getNodeFromElement(el.parentElement)
        if (!destNode) return

        let destDir = destNode.isDirectory ? destNode.id : path.dirname(destNode.id)

        // dont copy it if it's going to the place it came from
        if (srcNode.id === destDir) return
        if (path.dirname(srcNode.id) === path.dirname(destNode.id)) return
        if (path.dirname(srcNode.id) === destNode.id) return

        destDir = path.join(destDir, path.basename(srcNode.id))

        try {
          if (srcNode.isDirectory) {
            await cp(srcNode.id, destDir)
          } else {
            await fs.promises.copyFile(srcNode.id, destDir, fs.constants.COPYFILE_FICLONE)
          }
        } catch (err) {
          return notifications.create({
            type: 'error',
            title: 'Unable to copy files',
            message: err.message
          })
        }

        try {
          if (srcNode.isDirectory) {
            await rm(srcNode.id)
          } else {
            await fs.promises.unlink(srcNode.id)
          }
        } catch (err) {
          console.log(err)
          return notifications.create({
            type: 'error',
            title: 'Unable to remove files',
            message: err.message
          })
        }
      }

      this.referenceNode = null
    }
  }

  mousemove (e) {
    if (Tonic.match(e.target, '[data-event="rename"]')) {
      return // renaming, can't drag
    }

    if (this.mouseIsDown) {
      ++this.mouseMoveThreshold

      if (!this.mouseIsDragging && this.mouseMoveThreshold < 24) {
        this.mouseIsDragging = false
        return
      }

      this.mouseIsDragging = true
      this.mouseMoveThreshold = 0
      this.setAttribute('dragging', 'true')

      let placeholder = document.getElementById('tree-item-placeholder')

      if (!placeholder) {
        placeholder = document.createElement('div')
        placeholder.id = 'tree-item-placeholder'
        this.appendChild(placeholder)
      }

      const others = [...this.querySelectorAll('.hover')]
      others.forEach(el => el.classList.remove('hover'))

      const closest = e.srcElement.closest('[data-path]')
      if (closest) closest.classList.add('hover')

      placeholder.style.pointerEvents = 'none'
      placeholder.textContent = this.referenceNode.label
      placeholder.style.top = `${e.clientY + 4}px`
      placeholder.style.left = `${e.clientX + 4}px`
    }
  }

  click (e) {
    this.mouseMoveThreshold = 0

    const el = Tonic.match(e.target, '[data-path]')
    if (!el) return

    if (Tonic.match(e.target, '[data-event="rename"]')) {
      return
    }

    if (e.detail === 2) {
      return
    }

    const node = this.getNodeFromElement(el)
    if (!node) this.getNodeFromElement(el.parentElement)
    if (!node) return

    const isIcon = Tonic.match(e.target, '.toggle')
    return this.clickNode(node, isIcon)
  }

  async keyup (e) {
    const el = Tonic.match(e.target, '[data-path]')
    if (!el) return

    const node = this.getNodeFromElement(el)
    if (!node) this.getNodeFromElement(el.parentElement)
    if (!node) return

    //
    // Rename a node in the tree
    //
    if (Tonic.match(e.target, '[data-event="rename"]')) {
      if (e.key === 'Escape') {
        this.load()
      }

      if (e.key === 'Enter') {
        const value = e.target.value.trim()
        if (this.getNodeByProperty('id', value)) return
        this.renameNode(node, value)
      }
    }
  }

  async dblclick (e) {
    this.resetMouse()

    if (Tonic.match(e.target, '[data-event="rename"]')) {
      return // already renaming
    }

    const el = Tonic.match(e.target, '[data-path]')
    if (!el) return

    const node = this.getNodeFromElement(el)
    if (!node) this.getNodeFromElement(el.parentElement)
    if (!node) return

    if (node.nonMovable && node.type !== 'project') return

    const container = el.querySelector('.label')

    const input = document.createElement('input')
    input.dataset.event = 'rename'
    input.value = node.label
    input.setAttribute('spellcheck', 'false')
    input.addEventListener('blur', () => {
      container.innerHTML = ''
      container.textContent = node.label

      const value = input.value.trim()
      if (this.getNodeByProperty('id', value)) return
      this.renameNode(node, value)
    })

    container.innerHTML = ''
    container.appendChild(input)

    input.focus()
  }

  async contextmenu (e) {
    this.resetMouse()

    const el = Tonic.match(e.target, '[data-path]')
    if (!el) return

    const node = this.getNodeFromElement(el)
    if (!node) this.getNodeFromElement(el.parentElement)
    if (!node) return

    e.preventDefault()

    const notifications = document.querySelector('#notifications')

    const w = await application.getCurrentWindow()
    const value = await w.setContextMenu({
      value: `
        Cut: cut
        Copy: copy
        Paste: paste
        ---
        Delete: delete
        ---
        New Folder: new-folder
        New File: new-file
        Show Enclosing Folder: reveal-file
      `
    })

    if (value === 'new-folder') {
      const dirname = node.isDirectory ? node.id : path.dirname(node.id)
      await fs.promises.mkdir(path.join(dirname, `new-folder-${++this.createCount}`))
      this.load()
      return
    }

    if (value === 'new-file') {
      const dirname = node.isDirectory ? node.id : path.dirname(node.id)

      try {
        await fs.promises.mkdir(dirname)
      } catch {}

      await fs.promises.writeFile(path.join(dirname, `new-file-${++this.createCount}.js`), Buffer.from(''))
      this.load()
      return
    }

    if (value === 'reveal-file') {
      const w = await application.getCurrentWindow()
      await w.revealFile(path.dirname(node.id))
    }

    if (value === 'copy') {
      this.contextCopy = node
      return
    }

    if (value === 'cut') {
      this.contextCopy = node
      this.contextCut = node
      return
    }

    if (value === 'paste') {
      if (!this.contextCopy) return

      const src = node.isDirectory ? node.id : path.dirname(node.id)

      try {
        const data = await fs.promises.readFile(this.contextCopy.id)
        const dest = path.join(src, this.contextCopy.label)
        await fs.promises.writeFile(dest, data)
        this.contextCopy = null

        if (this.contextCut) {
          await fs.promises.unlink(this.contextCut.id)
          this.contextCut = null
          this.onSelection(node.parent)
        }
      } catch (err) {
        notifications.create({
          type: 'error',
          title: 'Unable to copy file',
          message: err.message
        })
      }

      this.load()
      return
    }

    if (value === 'delete') {
      if (node.type === 'project') {
        const app = this.props.parent
        await app.db.projects.del(node.id)
        await rm(node.id)
      } else if (node.isDirectory) {
        try {
          await rm(node.id)
        } catch (err) {
          notifications.create({
            type: 'error',
            title: 'Unable to delete',
            message: err.message
          })
        }
      } else {
        await fs.promises.unlink(node.id)
      }

      this.onSelection(node.parent)
      this.load()
    }
  }

  async keydown (e) {
    if (e.keyCode === 32) {
      const focused = this.querySelector('a:focus')
      if (!focused) return

      const el = Tonic.match(focused, '[data-path]')
      if (!el) return

      const node = this.getNodeFromElement(el)
      if (!node) return

      const { x, y } = focused.getBoundingClientRect()

      await this.clickNode(node, true)

      const newElement = document.elementFromPoint(x, y)
      if (newElement) newElement.focus()
    }
  }

  getProjectNode (node) {
    let parent = node

    while (parent) {
      if (parent.parent?.id === 'root') break
      parent = parent.parent
    }

    return parent
  }

  async onSelection (node, isToggle) {
    if (!isToggle) {
      const projectNode = this.getProjectNode(node)
      const coImagePreview = document.querySelector('view-image-preview')
      const coProjectSummary = document.querySelector('view-project-summary')
      const coHome = document.querySelector('view-home')

      coImagePreview.hide()
      coProjectSummary.hide()
      coHome.hide()

      // Check if the project has changed, refresh the props component
      if (this.state.currentProjectId !== projectNode.id) {
        this.props.parent.state.currentProject = projectNode
        this.props.parent.reloadPreviewWindows()

        const coProperties = document.querySelector('app-properties')
        coProperties.loadProjectNode(projectNode)
      }

      this.state.currentProjectId = projectNode.id

      if (node.type === 'project') {
        await coProjectSummary.reRender()
        coProjectSummary.show()
        return
      }

      if (node.isDirectory) return

      if (projectNode.id === 'home') {
        coHome.show()
        return
      }

      // Check if this is an image type that we can present
      const ext = path.extname(node.id)
      const type = await lookup(ext.slice(1))

      if (type.length) {
        if (/image/.test(type[0].mime)) {
          coImagePreview.load(node)
          coImagePreview.show()
          return
        }
      }

      if (node.label === 'settings.json' && node.parent.id === 'root') {
        node.isRootSettingsFile = true
      }

      // Load the code editor
      const coEditor = document.querySelector('app-editor')
      coEditor.loadProjectNode(node)
    }
  }

  async insert ({ source, node, parent }) {
    node = {
      data: await fs.promises.readFile(source, 'utf8'),
      icon: 'file',
      selected: 0,
      state: 0,
      children: [],
      ...node
    }

    if (parent) {
      parent.children.push(node)
    } else {
      const project = this.state.tree.children[0]
      project.children.push(node)
    }

    this.load(this.state.tree)
    return node
  }

  async clickNode (node, isIcon, forceOpen) {
    if (!node) return

    if (forceOpen) {
      node.state = CLOSED_STATE
    }

    if (isIcon) {
      if (node.state === EXPANDED_STATE) {
        node.state = CLOSED_STATE
      } else if (node.state === CLOSED_STATE) {
        node.state = EXPANDED_STATE
      }

      if (this.onSelection) {
        this.onSelection(node, true)
      }
    } else {
      if (/* allowSelect && */ node.selected === NOT_SELECTED) {
        this.resetSelectedNodeState()
      }

      if (!node.children.length && node.state === CLOSED_STATE) {
        this.resetLeafNodeState()
      }

      if (node.state === CLOSED_STATE) {
        node.state = EXPANDED_STATE
      }

      if (this.onSelection) {
        this.onSelection(node, false)
      }

      if (!node.disabled) {
        node.selected = IS_SELECTED
        this.lastClickedNode = node
      }
    }

    await this.reRender()
    return node
  }

  async connected () {
    this.load()
  }

  async reload () {
    this.load()
  }

  async load () {
    const app = this.props.parent
    const oldState = this.state.tree
    let oldChild = this.getNodeByProperty('id', 'home', oldState)

    const tree = {
      id: 'root',
      children: []
    }

    tree.children.push({
      id: 'home',
      parent: tree,
      selected: oldChild?.selected ?? 0,
      state: oldChild?.state ?? 0,
      isDirectory: false,
      icon: 'home-icon',
      label: 'Home',
      nonMovable: true,
      children: []
    })

    const readDir = async (dirPath, parent) => {
      let entries = []

      try {
        entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
      } catch (err) {
        console.error(err, dirPath)
      }

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        const oldChild = this.getNodeByProperty('id', fullPath, oldState)

        if (entry.name === '.git') continue

        const child = {
          id: fullPath,
          parent,
          selected: oldChild?.selected ?? 0,
          state: oldChild?.state ?? 0,
          isDirectory: entry.isDirectory(),
          label: entry.name,
          mime: await lookup(path.extname(entry.name)),
          children: []
        }

        child.icon = entry.isDirectory() ? 'folder' : 'file'

        if (parent.id === 'root' && entry.isDirectory()) {
          if (!this.props.parent.state.currentProject) {
            this.props.parent.state.currentProject = child
          }

          child.icon = 'package'
        }

        parent.children.push(child)

        //
        // TODO could do this lazily so that it only reads a level at a time,
        // which would be faster if the user has a huge number of files.
        //
        if (entry.isDirectory()) {
          try {
            await readDir(fullPath, child)
          } catch (err) {
            console.error(`Error reading directory ${fullPath}:`, err)
          }
        }
      }
    }

    const settingsId = path.join(path.DATA, 'settings.json')
    oldChild = this.getNodeByProperty('id', settingsId, oldState)

    tree.children.push({
      id: settingsId,
      parent: tree,
      selected: oldChild?.selected ?? 0,
      state: oldChild?.state ?? 0,
      isDirectory: false,
      icon: 'settings-icon',
      label: 'Settings',
      nonMovable: true,
      children: []
    })

    const { data: dataProjects } = await app.db.projects.readAll()

    for (const [projectId, project] of dataProjects.entries()) {
      const oldChild = this.getNodeByProperty('id', project.path, oldState)

      const node = {
        parent: tree,
        selected: oldChild?.selected ?? 0,
        state: oldChild?.state ?? 0,
        id: project.path,
        bundleId: project.bundleId,
        projectId,
        label: project.label,
        isDirectory: false,
        nonMovable: true,
        type: 'project',
        icon: 'package',
        children: []
      }

      if (!this.props.parent.state.currentProject) {
        this.props.parent.state.currentProject = node
        this.props.parent.reloadPreviewWindows()
      }

      tree.children.push(node)

      if (project.path) {
        try {
          await readDir(project.path, node)
          this.state.tree = tree
        } catch (err) {
          console.error('Error initiating read directory operation:', err)
          return
        }
      }
    }

    this.reRender()
  }

  renderNode (node, path) {
    if (!node) return ''
    if (!node.children) return ''

    const children = []

    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]
      const hasChildren = child.children && child.children.length

      const isSelected = child.selected
      const title = (typeof child.title) === 'string' ? child.title : ''
      let icon = child.icon

      if (!icon || icon === 'folder') {
        icon = child.state === 1 ? 'folder-open' : 'folder'
      }

      const iconColor = node.iconColor || 'var(--tonic-primary)'

      let dragdrop = ''
      let classes = ''
      const childPath = [...path, i].join('.')

      if (this.props.dragdrop === true || this.props.dragdrop === 'true') {
        classes = 'draggable droppable'

        if (window.process.platform === 'linux') {
          dragdrop = 'draggable=true droppable=true'
        } else {
          dragdrop = Tonic.unsafeRawString(`data-src="tree://${childPath}"`)
        }
      }

      const hasToggle = hasChildren > 0 || (icon === 'folder')
      children.push(this.html`
        <div class="item">
          <div
            class="handle ${classes}"
            ${dragdrop}
            data-dir="${String(child.type !== 'file')}"
            data-state="${String(child.state)}"
            data-selected="${String(isSelected)}"
            data-path="${childPath}"
            data-toggle="${String(hasToggle)}"
            title="${title}"
          >
            ${Tonic.unsafeRawString(hasToggle ? '<div class="toggle"></div>' : '')}
            <div class="region">
              <div class="node-data">
                <tonic-icon
                  symbol-id="${icon}"
                  fill="${iconColor}"
                  cached="${child.cached ? 'true' : 'false'}"
                  size="18px">
                </tonic-icon>
                <div class="label" ${child.disabled ? 'disabled' : ''}>
                  ${child.label}
                </div>
              </div>
            </div>
          </div>

          ${hasChildren ? this.renderNode(child, [...path, i]) : ''}
        </div>
      `)
    }

    return this.html`
      <div class="node">
        <div class="item">
          ${children}
        </div>
      </div>
    `
  }

  scroll (e) {
    this.state._scrollTop = this.scrollTop
  }

  updated () {
    this.scrollTop = this.state._scrollTop
  }

  render () {
    this.classList.add('tonic-project')

    if (!this.state.tree) {
      return this.html`<tonic-loader></tonic-loader>`
    }

    return this.renderNode(this.state.tree, [])
  }
}

export { AppProject }
export default AppProject
