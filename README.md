![screenshot](docs/logos/256x256.png)

A javascript/node.js scratchpad.

Download the latest release [here](https://github.com/0x00A/scratches/releases).

# DESCRIPTION
This is just a simple editor that evaluates your source text as you type. It's
electron, so you have the node and browser APIs.

# HOW IT WORKS
Your script will get evaluated when you stop typing. Use `console.log('hello')`
to get output in the right-hand panel.

![screenshot](docs/light.png)


Includes a dark mode and a document window to play with.

![docwindow](docs/dark.png)

To use modules from npm, just set your working directory to a place where
those modules are installed. For example you can create a directory (call
it whatever you want)...

```bash
mkdir ~/sandbox
cd sandbox
npm install preact
```

Then you can set your `Working Directory` to `~/sandbox` from the `Options`
menu...

![image](https://user-images.githubusercontent.com/136109/35237999-7f5bafd0-ffac-11e7-8533-e74e2279725e.png)


You can also start `Scratches` from the command line. You could create
a symbolic link to the binary if you often start it from the commandline...

```
/Applications/Scratches.app/Contents/MacOS/Scratches .
```

