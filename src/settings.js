const settings = {
  editorOptions: {
    cursorWidth: 20,
    fontSize: 14,
    tabSize: 2,
    wordWrapColums: 80,
    lineNumbers: 'on'
  },
  extensionLanguageMappings: {
    '.hh': 'cpp',
    '.cxx': 'cpp',
    '.cc': 'cpp',
    '.c': 'cpp',
    '.js': 'javascript'
  },
  root: 'src',
  previewWindows: [
    {
      title: 'iPhone 15',
      aspectRatio: '9:19.5',
      arch: 'arm64',
      resolution: '1179×2556',
      active: true,
      radius: '48.5',
      margin: '6.0',
      scale: 4
    },
    {
      title: 'Samsung Galaxy 23',
      aspectRatio: '9:19.5',
      arch: 'arm64',
      resolution: '1080x2340',
      radius: '48.5',
      margin: '6.0',
      active: false,
      scale: 4
    },
    {
      title: 'iPad',
      arch: 'arm64',
      aspectRatio: '4:3',
      resolution: '1024×768',
      radius: '48.5',
      margin: '6.0',
      active: false,
      scale: 4
    },
    {
      title: 'Desktop',
      active: false,
      scale: 1
    }
  ]
}

export { settings }
export default settings
