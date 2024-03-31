/**
 * Represents a parsed Git patch, including its headers, summary, and body.
 * The `Patch` class takes a raw patch string as input and parses it into
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

    if (currentHeader && headerBuffer.length > 0) {
      if (currentHeader === 'subject') {
        const firstLineOfSubject = headerBuffer[0].replace(/\[PATCH\]\s*/i, '')
        this.headers.parent = firstLineOfSubject.trim()
      }
      this.headers[currentHeader] = headerBuffer.join(' ')
    }
  }
}
