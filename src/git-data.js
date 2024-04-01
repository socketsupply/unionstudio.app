// import fs from 'fs'
/**
 * Represents a parsed Git patch, including its headers, summary, and body.
 * The \`Patch\` class takes a raw patch string as input and parses it into
 * distinct components. It specifically looks for the headers section at the
 * beginning of the patch, followed by a summary section indicating files
 * changed, insertions, and deletions, and finally the diff content as the body.
 *
 * Headers are parsed into an object with lowercase keys for 'from', 'date',
 * 'subject', and 'parent'. The summary section is expected to follow the
 * headers, separated by a line of '---', and includes aggregate change
 * information. The body contains the actual diff script starting from
 * 'diff --git'.
 *
 * @class
 * @property {Object} headers - An object containing the parsed headers from the patch, including 'from', 'date', 'subject', and 'parent'.
 * @property {string} summary - The summary of the patch, detailing the files changed, and the number of insertions and deletions.
 * @property {string} body - The body of the patch, containing the diff script.
 */
export class Patch {
  headers = {
    from: '',
    date: '',
    subject: '',
    parent: ''
  }

  summary = ''
  body = ''
  src = ''

  constructor (patch) {
    this.src = patch

    const lines = patch.split('\n')
    let parsingHeaders = true
    let currentHeader = null
    let headerBuffer = []
    const summaryLines = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line === '---' && lines[i + 1] && !lines[i + 1].startsWith('diff --git')) {
        parsingHeaders = false
        if (currentHeader && headerBuffer.length > 0) {
          this.headers[currentHeader] = headerBuffer.join(' ')
          headerBuffer = []
        }
        continue
      }

      if (line.startsWith('diff --git')) {
        this.summary = summaryLines.join('\n')
        this.body = lines.slice(i).join('\n')
        break
      }

      if (parsingHeaders) {
        const headerMatch = line.match(/^(From|Date|Subject):(.*)$/)
        if (headerMatch) {
          if (currentHeader && headerBuffer.length > 0) {
            this.headers[currentHeader] = headerBuffer.join(' ')
            headerBuffer = []
          }
          currentHeader = headerMatch[1].toLowerCase()
          headerBuffer.push(headerMatch[2].trim())
        } else if (currentHeader && (line.startsWith(' ') || line.startsWith('\t'))) {
          headerBuffer.push(line.trim())
        }
      } else {
        summaryLines.push(line)
      }
    }

    this.headers.parent = this.headers.subject.split(' ')[1].trim()
    this.headers.subject = this.headers.subject.replace(this.headers.parent, '')
  }

  extractHunks (filePath) {
    const hunks = []
    const lines = this.src.split('\n')
    let capturingFile = false
    let currentHunk = null

    // Adjusted regex for file section detection
    const fileSectionRegex = new RegExp(`^diff --git a/${filePath.replace(/\./g, '\\.')} b/${filePath.replace(/\./g, '\\.')}`)

    // Adjusted regex for hunk header detection
    const hunkHeaderRegex = /^@@ -\d+(,\d+)? \+\d+(,\d+)? @@/

    lines.forEach(line => {
      if (fileSectionRegex.test(line)) {
        capturingFile = true
        return // Skip the diff --git line itself
      } else if (capturingFile && line.startsWith('diff --git')) {
        capturingFile = false // Stop capturing when a new file section starts
      }

      if (capturingFile) {
        const match = hunkHeaderRegex.exec(line)
        if (match) {
          // Start of a new hunk
          currentHunk = { headers: [match[0]], changes: [] }
          hunks.push(currentHunk)
          // Check if there's additional content on the same line following the hunk header
          if (match[0].length < line.length) {
            // Add the remaining part of the line to the changes
            currentHunk.changes.push(' ' + line.substring(match[0].length).trim())
          }
        } else if (currentHunk) {
          // Add non-header lines to the current hunk's changes
          currentHunk.changes.push(line)
        }
      }
    })

    return hunks
  }
}

// const p = new Patch(fs.readFileSync('0001-wip-ui.patch', 'utf8'))
// const di = p.extractHunks('src/components/git-status.js')

// console.log(di)
