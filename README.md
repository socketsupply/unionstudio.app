![logo](docs/logos/256x256.png)

A javascript and node.js scratchpad.

Download the latest release [here](https://github.com/heapwolf/scratches/releases).

# DESCRIPTION
This is an editor that evaluates your source text as you type. It's
electron, so you have the node and browser APIs. Careful to only use
code you trust.

# HOW IT WORKS
Your script will get evaluated when you stop typing. Use `console.log('hello')`
to get output in the right-hand panel.

![screenshot](docs/screenshot.png)

To use modules from npm, just set your working directory to a place where
those modules are installed. For example you can create a directory (call
it whatever you want)...

```bash
mkdir ~/sandbox
cd sandbox
npm install preact
```

You can also start the app from the command line. You could create
a symbolic link to the binary if you often start it from the commandline...

```
/Applications/Scratches.app/Contents/MacOS/Scratches .
```

