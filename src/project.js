import fs from 'socket:fs'
import path from 'socket:path'
import Tonic from '@socketsupply/tonic'

const EXPANDED_STATE = 1
const CLOSED_STATE = 0
const NOT_SELECTED = 0
const IS_SELECTED = 1

class AppProject extends Tonic {
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

  getNodeByProperty (prop, value) {
    return this.walk(this.state.tree, node => {
      if (node[prop] === value) return node
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

  exportData (prefix) {
    this.walk(this.state.tree, node => {
      const p = path.join(prefix, node.id)
      fs.mkdir(path.dirname(p), { recursive: true })
      fs.promises.writeFile(p, node.data)
    })
  }

  click (e) {
    const el = Tonic.match(e.target, '[data-path]')
    if (!el) return

    if (e.detail === 2) {
      return
    }

    const node = this.getNodeFromElement(el)
    if (!node) this.getNodeFromElement(el.parentElement)
    if (!node) return

    const isIcon = Tonic.match(e.target, '.toggle')
    return this.clickNode(node, isIcon)
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

  async onSelection (node, isToggle) {
    if (!isToggle && node.children.length === 0) {
      const editor = document.querySelector('app-editor')
      editor.loadProjectNode(node)
    }
  }

  async connected () {
    const tree = {
      id: 'root',
      children: []
    }

    let headers = []
    const modules = [...document.querySelectorAll('.collectable')]

    for (const module of modules) {
      headers = [...headers, ...module.querySelectorAll('h1, h2, h3, h4')]
    }

    const node = {
      id: 'project',
      selected: 0,
      state: 1,
      type: 'dir',
      label: 'Project',
      children: [
        {
          id: 'src',
          selected: 0,
          state: 1,
          type: 'dir',
          label: 'src',
          children: [
            {
              id: 'src/index.css',
              label: 'index.css',
              data: await fs.promises.readFile('templates/index.css', 'utf8'),
              icon: 'file',
              selected: 0,
              state: 0,
              children: []
            },
            {
              id: 'src/index.html',
              label: 'index.html',
              data: await fs.promises.readFile('templates/index.html', 'utf8'),
              icon: 'file',
              selected: 0,
              state: 0,
              children: []
            },
            {
              id: 'src/index.js',
              label: 'index.js',
              data: await fs.promises.readFile('templates/index.js', 'utf8'),
              icon: 'file',
              selected: 1,
              state: 1,
              children: []
            },
          ],
        },
        {
          id: 'socket.ini',
          label: 'socket.ini',
          data: await fs.promises.readFile('templates/socket.ini', 'utf8'),
          icon: 'file',
          selected: 0,
          state: 0,
          children: []
        }
      ]
    }

    tree.children.push(node)

    tree.children.push({
      id: 'examples',
      selected: 0,
      state: 0,
      label: 'Examples',
      children: [
        {
          id: 'examples/buffers.js',
          label: 'buffers.js',
          data: await fs.promises.readFile('examples/buffers.js', 'utf8'),
          icon: 'file',
          selected: 0,
          state: 0,
          children: []
        },
        {
          id: 'examples/child_process.js',
          label: 'child_process.js',
          data: await fs.promises.readFile('examples/child_process.js', 'utf8'),
          icon: 'file',
          selected: 0,
          state: 0,
          children: []
        },
        {
          id: 'examples/network.js',
          label: 'network.js',
          data: await fs.promises.readFile('examples/network.js', 'utf8'),
          icon: 'file',
          selected: 0,
          state: 0,
          children: []
        },
        {
          id: 'examples/path.js',
          label: 'path.js',
          data: await fs.promises.readFile('examples/path.js', 'utf8'),
          icon: 'file',
          selected: 0,
          state: 0,
          children: []
        },
        {
          id: 'examples/require.js',
          label: 'require.js',
          data: await fs.promises.readFile('examples/require.js', 'utf8'),
          icon: 'file',
          selected: 0,
          state: 0,
          children: []
        },
      ]
    })

    const editor = document.querySelector('app-editor')
    editor.loadProjectNode(node.children[0].children[2])

    this.load(tree)
  }

  async insert (node, parent) {
    node = {
      data: await fs.promises.readFile(node.id, 'utf8'),
      icon: 'file',
      selected: 0,
      state: 0,
      children: [],
      ...node,
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

  load (value) {
    this.state.tree = value
    this.reRender()
  }

  renderNode (node, path) {
    if (!node) return ''
    if (!node.children) return ''

    const children = []

    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]
      const hasChildren = child.children && child.children.length

      // if (hasChildren) {
      //  children.push(this.renderNode(child.children))
      // }

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
