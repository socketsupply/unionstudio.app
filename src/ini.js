/*
 * Update a INI file key's value by section
 */
function set (src, section, key, value) {
  const lines = src.split(/\r?\n/).map(s => s.trim())
  const exists = get(src, section, key).length

  let sectionMatch = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (!sectionMatch && (line.startsWith('[') && line.endsWith(']'))) {
      if (line.slice(1, -1) === section) {
        sectionMatch = true
        continue
      }
    }

    if (sectionMatch) {
      if (line === '') continue
      if (line[0] === ';' && !line.slice(1).includes(key)) {
        continue
      }

      if (!exists) {
        value = `${key} = ${value}`
        let deletes = 0
        if (line[0] === ';') deletes = 1
        lines.splice(i, deletes, value)
        return lines.join('\n')
      }

      const parts = line.split(/\s*=\s*/)
      if (parts[0] === key) {
        value = `${parts[0]} = ${value}`
        lines[i] = value
      }  
    }
  }

  return lines.join('\n')
}

function get (src, section, key) {
  const lines = src.split(/\r?\n/).map(s => s.trim())

  let sectionMatch = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (!sectionMatch && (line.startsWith('[') && line.endsWith(']'))) {
      if (line.slice(1, -1) === section) {
        sectionMatch = true
        continue
      }
    }

    if (sectionMatch) {
      if (line[0] === ';') continue
      if (line.trim() === '') continue
      const parts = line.split(/\s*=\s*/)
      if (parts[0] === key) return parts[1]
    }
  }

  return ''
}

export { get, set }
