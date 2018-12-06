const sep = document.querySelector('body > .sep')
const editor = document.querySelector('article.editor')
const output = document.querySelector('article.output')
const body = document.body

let dragging = false

const cancel = () => (dragging = false)
const start = () => (dragging = true)

sep.addEventListener('mousedown', start)
sep.addEventListener('mouseup', cancel)

document.body.addEventListener('mousemove', e => {
  if (!dragging) return

  const w = body.offsetWidth
  const h = body.offsetHeight

  const outsideWidthBounds = (e.clientX < 100) || (e.clientX > (w - 100))
  const outsideHeightBounds = (e.clientY < 35) || (e.clientY > (h - 50))

  if (outsideWidthBounds || outsideHeightBounds) {
    return cancel()
  }

  const p = (e.clientX / w) * 100

  editor.style.width = p + '%'
  sep.style.left = p + '%'
  output.style.width = (100 - p) + '%'
})

document.body.addEventListener('mouseenter', cancel)
document.body.addEventListener('mouseleave', cancel)
document.body.addEventListener('mouseup', cancel)
