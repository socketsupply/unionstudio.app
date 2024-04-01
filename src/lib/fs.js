import fs from 'socket:fs'
import path from 'socket:path'

export async function rm (directory) {
  const files = await fs.promises.readdir(directory, { withFileTypes: true })

  for (const file of files) {
    const filePath = path.join(directory, file.name)

    if (file.isDirectory()) {
      await rm(filePath)
    } else {
      await fs.promises.unlink(filePath)
    }
  }

  await fs.promises.rmdir(directory)
}

export async function cp (srcDir, destDir) {
  await fs.promises.mkdir(destDir, { recursive: true })
  const files = await fs.promises.readdir(srcDir, { withFileTypes: true })

  for (const file of files) {
    const srcPath = path.join(srcDir, file.name)
    const destPath = path.join(destDir, file.name)

    if (file.isDirectory()) {
      await cp(srcPath, destPath)
    } else {
      await fs.promises.copyFile(srcPath, destPath, fs.constants.COPYFILE_FICLONE)
    }
  }
}
