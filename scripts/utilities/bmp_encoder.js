import { Buffer } from './buffer.js';

/*
There is a native implementation of canvas BMP conversion,
but it is not supported by all browsers.
And, after all, why not have fun?
 */

const BITS_IN_BYTE = 8;
const MAX_COLOR_PARAMETERS = 4; //In RGBA format
const EMPTY_VALUE = 0x00;

class BmpVersion {
  constructor(perPixel, infoHeaderSize) {
    this.bitCount = perPixel;
    this.infoHeaderSize = infoHeaderSize;
  }
}

/*
Refer to this link to know more about versions:
https://en.wikipedia.org/wiki/BMP_file_format
 */
const BmpVersions = Object.freeze({
  //BMP24 format uses BITMAPINFOHEADER
  BMP_24: new BmpVersion(24, 0x28),
  //BMP32 format uses BITMAPV4HEADER
  BMP_32: new BmpVersion(32, 0x6C),
});

/*
Only supports BMP24 and BMP32 format for now.
 */
class BmpEncoder {
  static #headerSize = 0x0E;
  #infoHeaderSize;
  #perPixel;

  #buffer;
  #lastTransparent;

  constructor(version = BmpVersions.BMP_24) {
    this.#perPixel = version.bitCount / BITS_IN_BYTE;
    this.#infoHeaderSize = version.infoHeaderSize;
    this.dataOffset = BmpEncoder.#headerSize + this.#infoHeaderSize;
  }

  /*
  Creates a byte array which represents an image file of BMP24 or BMP32 format.
  Refer to this link if you want to know more about BMP file format:
  http://www.ece.ualberta.ca/~elliott/ee552/studentAppNotes/2003_w/misc/bmp_file_format/bmp_file_format.htm
  The comment lines represent structures of format in a format:
  Name | Size | Offset | Description
   */
  encode(imageData) {
    this.#buffer = new Buffer();
    this.#setUpEncoding(imageData);
    this.#setHeader();
    this.#setInfoHeader(imageData);
    this.#setExtendedInfoHeader();
    this.#offsetImage();
    this.#setPixelData(imageData);
    return this.#buffer.data;
  }

  #setUpEncoding({ width, height }) {
    this.padding = this.#is32() ? 0 : width % MAX_COLOR_PARAMETERS;
    const rowLength = this.#perPixel * width + this.padding;
    this.bitmapSize = rowLength * height;
    this.fileSize = this.dataOffset + this.bitmapSize;
  }

  #setHeader() {
    //Signature | 2 bytes | 0x00 | Special value BM
    this.#buffer.writeString('BM');
    //FileSize | 4 bytes | 0x02 | File size in bytes
    this.#buffer.write32Integer(this.fileSize);
    //Reserved | 4 bytes | 0x06 | Filled with 0 bytes
    this.#buffer.write32Integer(EMPTY_VALUE);
    //DataOffset | 4 bytes | 0x0A | From file start to bitmap data start
    this.#buffer.write32Integer(this.dataOffset);
  }

  #setInfoHeader({ width, height }) {
    //Size | 4 bytes | 0x0E | Size of InfoHeader
    this.#buffer.write32Integer(this.#infoHeaderSize);
    //Width | 4 bytes | 0x12 | Horizontal width in pixels
    this.#buffer.write32Integer(width);
    //Height | 4 bytes | 0x16 | Vertical height in pixels
    this.#buffer.write32Integer(height);
    //Planes | 2 bytes | 0x1A | Number of planes = 1
    this.#buffer.write16Integer(1);
    //Bits Per Pixel | 2 bytes | 0x1C | 24 or 32, depending on format
    this.#buffer.write16Integer(this.#perPixel * BITS_IN_BYTE);
    this.#setCompression();
    //ImageSize | 4 bytes | 0x22 | Size of the raw bitmap data
    this.#buffer.write32Integer(this.bitmapSize);

    /*
    The following structures are always filled with 0 bytes:
    XPixelsPerM | 4 bytes | 0x26 | Horizontal resolution: Pixels/meter
    YPixelsPerM | 4 bytes | 0x2A | Vertical resolution: Pixels/meter
    Colors Used | 4 bytes | 0x2E | Number of actually used colors
    Important Colors | 4 bytes | 0x32 | Number of important colors
     */
    const skippedByteCount = 16;
    this.#buffer.writeInteger(skippedByteCount, EMPTY_VALUE);
  }

  #setCompression() {
    /*
    We use BI_BITFIELDS compression only for BMP32 format
    BI_RGB in BMP24 instead
    */
    const BI_BITFIELDS = 0x03;
    const BI_RGB = 0x00;
    const compressionType = this.#is32() ? BI_BITFIELDS : BI_RGB;
    //Compression | 4 bytes | 0x1E | 0x00 for BI_RGB, 0x03 for BI_BITFIELDS
    this.#buffer.write32Integer(compressionType);
  }

  #setExtendedInfoHeader() {
    //Only used in BMP32 format with BI_BITFIELDS compression
    if (!this.#is32()) return;

    //Masks are defined by little endian byte order and RGBA format

    //Red channel bitmask | 4 bytes | 0x36 | 0x000000FF
    this.#buffer.write32Integer(0x000000FF);
    //Green channel bitmask | 4 bytes | 0x3A | 0x0000FF00
    this.#buffer.write32Integer(0x0000FF00);
    //Blue channel bitmask | 4 bytes | 0x3E | 0x00FF0000
    this.#buffer.write32Integer(0x00FF0000);
    //Alpha channel bitmask | 4 bytes | 0x42 | 0xFF000000
    this.#buffer.write32Integer(0xFF000000);
  }

  //Fill buffer with empty bytes
  #offsetImage() {
    const skippedByteCount = this.dataOffset - this.#buffer.length;
    this.#buffer.writeInteger(skippedByteCount, EMPTY_VALUE);
  }

  #setPixelData({ width, height, data }) {
    const bytes = new Uint8Array(this.bitmapSize);
    let position = 0x00;
    this.#lastTransparent = true;
    for (let i = height - 1; i >= 0; i--) {
      for (let j = 0; j < width; j++) {
        const dataPos = (i * width + j) * MAX_COLOR_PARAMETERS;
        const color = data.slice(dataPos, dataPos + this.#perPixel);
        this.#handleTransparency(color);
        this.#transformColorArray(color);
        bytes.set(color, position);
        position += this.#perPixel;
      }
      position += this.padding;
    }
    this.#buffer.writeArray(bytes);
  }

  #handleTransparency(color) {
    const alphaPos = 3;
    if (color[alphaPos] > 0) {
      this.#lastTransparent = false;
    }
  }

  //Initially it is in RGBA format
  #transformColorArray(color) {
    if (this.#is32()) {
      //Color is stored in RGBA order, so we don't change anything
    } else {
      const rPos = 0;
      const bPos = 2;
      /* Color is stored in reversed BGR order.
        Swapping parameter R with B */
      [color[rPos], color[bPos]] = [color[bPos], color[rPos]];
    }
  }

  #is32() {
    return this.#perPixel === MAX_COLOR_PARAMETERS;
  }

  /*
  Determines if the last encoded image was fully transparent
  May be beneficial for web applications,
  as there is a bug with viewing transparent images in some browsers.
   */
  isLastEncodedTransparent() {
    return this.#lastTransparent;
  }
}

export { BmpEncoder, BmpVersions };
