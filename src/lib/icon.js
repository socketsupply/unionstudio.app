import fs from 'socket:fs'
import path from 'socket:path'

/**
 * Resizes a PNG image given as an ArrayBuffer to a specified width and height, and returns the resized image as a Blob.
 * 
 * This function converts the ArrayBuffer to a Blob, creates an object URL for it, and loads it into an Image element.
 * After resizing the image by drawing it on a canvas, the canvas is then converted back into a Blob.
 * 
 * @param {ArrayBuffer} imageArrayBuffer The ArrayBuffer of the PNG image to be resized.
 * @param {number} targetWidth The target width of the resized image.
 * @param {number} targetHeight The target height of the resized image.
 * @returns {Promise<Blob>} A promise that resolves with the resized image as a Blob.
 */
export function resizePNG (imageArrayBuffer, size) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([imageArrayBuffer], {type: 'image/png'});
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(img, 0, 0, size, size);

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to resize image'));
        }
      }, 'image/png');

      // Clean up the object URL
      URL.revokeObjectURL(url);
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
}


/**
 * Converts a PNG file to an ICO file.
 * @param {string} pngFilePath Path to the source PNG file.
 */
export async function convertToICO (bytes) {
  const icoHeader = Buffer.alloc(6)
  icoHeader.writeUInt16LE(0, 0) // Reserved
  icoHeader.writeUInt16LE(1, 2) // Type (1 = ICO)
  icoHeader.writeUInt16LE(1, 4) // Number of images

  const icoDirEntry = Buffer.alloc(16);
  const imageSize = bytes.length;
  const width = 256 // Assuming 256x256
  const height = 256

  icoDirEntry.writeUInt8(width === 256 ? 0 : width, 0) // Width, 0 for 256
  icoDirEntry.writeUInt8(height === 256 ? 0 : height, 1) // height, 0 for 256
  icoDirEntry.writeUInt8(0, 2) // Color palette
  icoDirEntry.writeUInt8(0, 3) // Reserved
  icoDirEntry.writeUInt16LE(1, 4) // Color planes
  icoDirEntry.writeUInt16LE(32, 6) // Bits per pixel
  icoDirEntry.writeUInt32LE(imageSize, 8) // Image size
  icoDirEntry.writeUInt32LE(22, 12) // Offset of BMP or PNG data from the beginning of the ICO/CUR file

  return Buffer.concat([icoHeader, icoDirEntry, bytes])
}
