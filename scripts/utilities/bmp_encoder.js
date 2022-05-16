/*
There is a native implementation of canvas BMP conversion, but it is not supported by all browsers.
And, after all, why not have fun?
 */

const bitsInByte = 8;
const maxColorParameters = 4; //for RGBA format, BMP32

/*
A class that represents a writable array of bytes.
Created for easier work with byte size and different types of written values.
Has similar interface to the Node.js Buffer class.
 */
class Buffer {
  constructor(size) {
    this.data = new Uint8Array(size);
  }

  writeString(string, offset) {
    this.writeArray(stringToByteArray(string), offset);
  }

  write16Integer(number, offset) {
    this.#writeInteger(16, number, offset);
  }

  write32Integer(number, offset) {
    this.#writeInteger(32, number, offset);
  }

  #writeInteger(bits, number, offset) {
    const array = intToByteArray(number, bits / bitsInByte);
    this.writeArray(array, offset);
  }

  writeArray(array, offset) {
    this.data.set(array, offset);
  }
}

//Converts a string to ASCII code characters array
function stringToByteArray(string) {
  const array = new Uint8Array(string.length);
  for (let i = 0; i < string.length; i++) {
    array[i] = string[i].charCodeAt(0);
  }
  return array;
}

//Converts an unsigned integer into a byte array depending on integer size
function intToByteArray(number, size) {
  const array = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    array[i] = number >> bitsInByte * i;
  }
  return array;
}

class BmpVersion {
  constructor(perPixel, infoHeaderSize) {
    this.bitCount = perPixel;
    this.infoHeaderSize = infoHeaderSize;
  }
}

//Refer to this link to know more about versions https://en.wikipedia.org/wiki/BMP_file_format
const bmpVersions = Object.freeze({
  //BMP24 format uses BITMAPINFOHEADER
  bmp24: new BmpVersion(24, 0x28),
  //BMP32 format uses BITMAPV4HEADER
  bmp32: new BmpVersion(32, 0x6C),
});

/*
Only supports BMP24 and BMP32 format for now.
 */
class BmpEncoder {
  static #headerSize = 0x0E;
  #infoHeaderSize;
  #perPixel;

  #buffer;

  constructor(image, version = bmpVersions.bmp24) {
    this.#perPixel = version.bitCount / bitsInByte;
    this.#infoHeaderSize = version.infoHeaderSize;

    this.padding = this.#is32() ? 0 : image.width % maxColorParameters;
    this.pixelDataSize = (this.#perPixel * image.width + this.padding) * image.height;
    this.fileSize = BmpEncoder.#headerSize + this.#infoHeaderSize + this.pixelDataSize;

    this.#buffer = new Buffer(this.fileSize);
    this.image = image;
  }

  /*
  Creates a byte array which represents an image file of BMP24 format (opacity not included).
  Each pixel will be represented as a triplet of bytes: red, green and blue intensity accordingly.
  Refer to this link if you want to know more about BMP file format:
  http://www.ece.ualberta.ca/~elliott/ee552/studentAppNotes/2003_w/misc/bmp_file_format/bmp_file_format.htm
  The comment lines represent structures of format in a format:
  Name | Size | Offset | Description
   */
  encode() {
    this.#setHeader();
    this.#setInfoHeader();
    this.#setExtendedInfoHeader();
    this.#setPixelData();

    return this.#buffer.data;
  }

  #setHeader() {
    //Signature | 2 bytes | 0x00 | 'BM'
    this.#buffer.writeString('BM', 0x00);
    //FileSize | 4 bytes | 0x02 | File size in bytes
    this.#buffer.write32Integer(this.fileSize, 0x02);

    //Reserved | 4 bytes | 0x06 | Left filled with 0 bytes

    //DataOffset | 4 bytes | 0x0A | Offset from beginning of file to the beginning of the bitmap data
    this.#buffer.write32Integer(BmpEncoder.#headerSize + this.#infoHeaderSize, 0x0A);
  }

  #setInfoHeader() {
    //Size | 4 bytes | 0x0E | Size of InfoHeader
    this.#buffer.write32Integer(this.#infoHeaderSize, 0x0E);
    //Width | 4 bytes | 0x12 | Horizontal width in pixels
    this.#buffer.write32Integer(this.image.width, 0x12);
    //Height | 4 bytes | 0x16 | Vertical height in pixels
    this.#buffer.write32Integer(this.image.height, 0x16);
    //Planes | 2 bytes | 0x1A | Number of planes = 1
    this.#buffer.write16Integer(1, 0x1A);
    //Bits Per Pixel | 2 bytes | 0x1C | 24 or 32, depending on format
    this.#buffer.write16Integer(this.#perPixel * bitsInByte, 0x1C);
    this.#setCompression();
    //ImageSize | 4 bytes | 0x22 | Size of the raw bitmap data (including padding)
    this.#buffer.write32Integer(this.pixelDataSize, 0x22);

    /*
    The following structures are always filled with 0 bytes:
    XPixelsPerM | 4 bytes | 0x26 | Horizontal resolution: Pixels/meter
    YPixelsPerM | 4 bytes | 0x2A | Vertical resolution: Pixels/meter
    Colors Used | 4 bytes | 0x2E | Number of actually used colors
    Important Colors | 4 bytes | 0x32 | Number of important colors
     */
  }

  #setCompression() {
    //We use BI_BITFIELDS compression only for BMP32 format, BI_RGB in BMP24 instead
    const compressionType = this.#is32() ? /* BI_BITFIELDS */ 0x03 : /* BI_RGB */ 0x00;
    //Compression | 4 bytes | 0x1E | 0x00 for BI_RGB, 0x03 for BI_BITFIELDS
    this.#buffer.write32Integer(compressionType, 0x1E);
  }

  #setExtendedInfoHeader() {
    //Only used in BMP32 format with BI_BITFIELDS compression
    if (!this.#is32()) return;

    //Masks are defined by the usage of RGBA color format and little endian byte order

    //Red channel bitmask | 4 bytes | 0x36 | 0x000000FF
    this.#buffer.write32Integer(0x000000FF, 0x36);
    //Green channel bitmask | 4 bytes | 0x3A | 0x0000FF00
    this.#buffer.write32Integer(0x0000FF00, 0x3A);
    //Blue channel bitmask | 4 bytes | 0x3E | 0x00FF0000
    this.#buffer.write32Integer(0x00FF0000, 0x3E);
    //Alpha channel bitmask | 4 bytes | 0x42 | 0xFF000000
    this.#buffer.write32Integer(0xFF000000, 0x42);
  }

  #setPixelData() {
    const image = this.image;
    let position = this.#infoHeaderSize + BmpEncoder.#headerSize;

    for (let i = image.height - 1; i >= 0; i--) {
      for (let j = 0; j < image.width; j++) {
        const dataPosition = (i * image.width + j) * maxColorParameters;
        const colors = image.data.slice(dataPosition, dataPosition + this.#perPixel);
        this.#transformColorArray(colors);
        this.#buffer.writeArray(colors, position);
        position += this.#perPixel;
      }
      position += this.padding;
    }
  }

  #transformColorArray(colors) {
    if (this.#is32()) {
      //Color is stored in RGBA order, so we don't change anything
    } else {
      //Color is stored in reversed BGR order.
      swap(colors, 0, 2); //Swapping parameter R with B
    }
  }

  #is32() {
    return this.#perPixel === maxColorParameters;
  }
}

function swap(array, i, j) {
  const temp = array[i];
  array[i] = array[j];
  array[j] = temp;
}

export { BmpEncoder, bmpVersions };
