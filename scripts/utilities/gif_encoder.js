import { Buffer } from './buffer.js';
import { LzwCompressor } from './lzw_compression.js';
import { scale } from './image.js';

const COLOR_PARAMETERS = 3;
const MAX_COLOR_PARAMETERS = 4;
const COLOR_RANGE = 256;

const RED_REGIONS = 8;
//Green color quantization will be less accurate
const GREEN_REGIONS = 4;
const BLUE_REGIONS = 8;
const MAX_COLORS = RED_REGIONS * GREEN_REGIONS * BLUE_REGIONS;

/*
A class to handle the quantization of colors => their such mapping to values,
which leaves us with less or equal to [MAX_COLORS] different ones.
Will be rarely needed because of application specifics, but why not have fun?
Uses uniform quantization algorithm. To learn more please refer to the link:
https://muthu.co/reduce-the-number-of-colors-of-an-image-using-uniform-quantization/
 */
class UniformQuantizer {
  #quantized;

  constructor(imageData) {
    this.imageData = imageData;
    //With each color quantization we change the cloned image
    this.#quantized = new ImageData(imageData.width, imageData.height);
  }

  quantize(dataPos) {
    const { data } = this.imageData;
    const [r, g, b, a] = data.slice(dataPos, dataPos + COLOR_PARAMETERS);

    /*
    The idea behind the algorithm is to split color value range (0, 255) into
    a few regions of same size. We determine the interval at which the value
    lies and take the MIDDLE value of the region.
     */
    const quantize = (value, regions) => {
      const regionSize = COLOR_RANGE / regions;
      const regionNum = value / regionSize | 0;
      return regionSize / 2 + regionNum * regionSize;
    };

    const colorQuantized = [
      quantize(r, RED_REGIONS),
      quantize(g, GREEN_REGIONS),
      quantize(b, BLUE_REGIONS),
      a
    ];

    this.#quantized.data.set(colorQuantized, dataPos);
    return colorQuantized;
  }

  get quantizedImage() {
    return this.#quantized;
  }
}

const IMAGE_SCALE = 10;

/*
A wrapper which can be created from Frame defined in canvas.js
 */
class GifFrame {
  constructor(imageData, duration) {
    this.imageData = imageData;
    this.duration = duration;
  }

  static from(canvasFrame) {
    const image = canvasFrame.canvas.getJoinedImage();
    return new GifFrame(scale(image, IMAGE_SCALE), canvasFrame.duration);
  }
}

const EMPTY_VALUE = 0x00;

class GifImageEncoder {
  #buffer;

  constructor(imageData) {
    this.imageData = imageData;
    this.table = [];
    this.#buffer = new Buffer();
    this.#initTable();
  }

  #initTable() {
    const { width, height, data } = this.imageData;
    const resolution = width * height;
    this.#setUpQuantization(resolution);
    const setColorDefault = getColorSetter(this.table, this.indices);
    const setColorQuant = getColorSetter(this.quantTable, this.quantIndices);

    for (let i = 0; i < height; i++) {
      for (let j = width - 1; j >= 0; j--) {
        const pos = i * width + j;
        const dataPos = pos * MAX_COLOR_PARAMETERS;
        const color = data.slice(dataPos, dataPos + COLOR_PARAMETERS);
        setColorDefault(color, pos);

        const colorQuantized = this.quantizer.quantize(dataPos);
        setColorQuant(colorQuantized, pos);
      }
    }

    if (this.table.length > MAX_COLORS) this.#replaceWithQuantized();
    this.#offsetTable();
  }

  #setUpQuantization(resolution) {
    this.quantizer = new UniformQuantizer(this.imageData);
    this.quantTable = [];
    this.quantIndices = new Uint8Array(resolution);
    this.indices = new Uint8Array(resolution);
  }

  #replaceWithQuantized() {
    this.table = this.quantTable;
    this.imageData = this.quantizer.quantizedImage;
    this.indices = this.quantIndices;
  }

  //Make sure the table length is a power of two
  #offsetTable() {
    const isPowerOfTwo = (x) => x && !(x & (x - 1));
    while (!isPowerOfTwo(this.table.length) || (this.table.length === 1)) {
      this.table.push(EMPTY_VALUE);
    }
  }

  /*
 The number is in reversed BGR order.
 Each color value represents two hexadecimal "digits"
  */
  static colorToNumber([ r, g, b ]) {
    const blueShift = 16;
    const greenShift = 8;
    const values = [
      b !== 0 ? b << blueShift : b,
      g !== 0 ? g << greenShift : g,
      r
    ];
    return values.reduce((prev, curr) => prev + curr);
  }

  encode() {
    this.#setLocalImageDescriptor();
    this.#setLocalColorTable();
    this.#setPixelData();
    return this.#buffer.data;
  }

  //Required. Tells the decoder how much space one frame takes
  #setLocalImageDescriptor() {
    const { width, height } = this.imageData;

    //Separator | 1 byte | Special value 2Ch
    this.#buffer.writeByte(0x2C);

    //Left | 2 byte | X position, skipped
    this.#buffer.write16Integer(EMPTY_VALUE);
    //Top | 2 byte | Y position, skipped
    this.#buffer.write16Integer(EMPTY_VALUE);

    //Width | 2 byte | Width of the image in pixels
    this.#buffer.write16Integer(width);
    //Height | 2 byte | Height of the image in pixels
    this.#buffer.write16Integer(height);

    /*
    Packed fields | 1 byte | Contains following subfields of data:
    Bit 7 - Local Color Table Flag - 1, always used
    Bit 6 - Interlace Flag - 0, not interlaced
    Bit 5 - Sort Flag - 0, not sorted
    Bit 3-4 - Reserved
    Bit 0-2 - Size of Local Color Table Entry - Number of bits per entry
     */
    const entrySize = Math.log2(this.table.length / 2);
    const fields = 0b10000000 + entrySize;
    this.#buffer.writeByte(fields);
  }

  //Optional, but set by the encoder. Triplets of BGR bytes
  #setLocalColorTable() {
    this.table.forEach((color) => {
      this.#buffer.writeInteger(COLOR_PARAMETERS, color);
    });
  }

  #setPixelData() {
    const colorBits = this.#getColorsBits();
    const compressor = new LzwCompressor(colorBits);
    const compressed = compressor.compress(this.indices);
    this.#buffer.writeArray(compressed);
    this.#buffer.writeByte(EMPTY_VALUE);
    return this.#buffer.data;
  }

  //Length of a minimal color entry in bits
  #getColorsBits() {
    return Math.log2(this.table.length);
  }
}

function getColorSetter(table, indices) {
  return (color, pos) => {
    const colorConverted = GifImageEncoder.colorToNumber(color);
    if (!table.includes(colorConverted)) {
      table.push(colorConverted);
    }
    indices.set([table.indexOf(colorConverted)], pos);
  };
}

/*
GIF (Graphics Interchange Format) is used to store
multiple bitmap images in a single file.
Please refer to this link for specification source:
https://www.w3.org/Graphics/GIF/spec-gif89a.txt
 */
class GifEncoder {
  #mainBuffer;

  /*
  Creates a byte array which represents a file of GIF89a format.
  The comment lines represent structures of format in a format:
  Name | Size | Description
   */
  encode(frames) {
    this.#mainBuffer = new Buffer();
    this.#setHeader();
    this.#setLogicalScreenDescriptor(GifEncoder.#getImageSize(frames));
    this.#setApplicationExtension();
    frames.forEach((frame) => this.#setFrameData(frame));
    this.#setTerminator();
    return this.#mainBuffer.data;
  }

  //Required. Tells the decoder it's a GIF file
  #setHeader() {
    //Signature and version | 6 bytes | Special value GIF89a
    this.#mainBuffer.writeString('GIF89a');
  }

  //Required. Tells the decoder how much space the image takes
  #setLogicalScreenDescriptor({ width, height }) {
    //Logical Screen Width | 2 bytes | Width of any frame
    this.#mainBuffer.write16Integer(width);
    //Logical Screen Height | 2 bytes | Height of any frame
    this.#mainBuffer.write16Integer(height);
    /*
    Packed fields | 1 byte | Contains following subfields of data:
    Bit 7 - Global Color Table Flag - 0, not used
    Bit 4-6 - Color Resolution - Number of bits in original palette
    Bit 3 - Color Table Sort Flag - 0, not used
    Bit 0-2 - Size of the Global Color Table - Not used
     */
    const fields = 0b00000000;
    this.#mainBuffer.writeByte(fields);

    //Background Color | 1 byte | Skipped, not used
    this.#mainBuffer.writeByte(EMPTY_VALUE);
    //Aspect Ratio | 1 byte | Skipped, not used
    this.#mainBuffer.writeByte(EMPTY_VALUE);
  }

  static #getImageSize(frames) {
    const firstFrame = frames[0].imageData;
    return {
      width: firstFrame.width,
      height: firstFrame.height
    };
  }

  //Optional. Is in need to implement infinite looping
  #setApplicationExtension() {
    //Extension introducer | 1 byte | Special value 21h
    this.#mainBuffer.writeByte(0x21);
    //Application Extension Label | 1 byte | Special value 0xFF
    this.#mainBuffer.writeByte(0xFF);
    //Byte size of block | 1 byte | Special value of 11 bytes
    this.#mainBuffer.writeByte(0x0B);
    //Special label | 11 bytes | Special value NETSCAPE2.0
    this.#mainBuffer.writeString('NETSCAPE2.0');
    //Length of data sub-block | 1 byte | Special value of 3 bytes
    this.#mainBuffer.writeByte(0x03);
    //Data block values | 3 bytes | First byte is always 0x01. Don't set others
    this.#mainBuffer.writeArray([0x01, 0x00, 0x00]);

    //Block terminator | 1 byte | Special value 00h
    this.#mainBuffer.writeByte(EMPTY_VALUE);
  }

  #setTerminator() {
    //Terminator | 1 byte | Special value 3Bh
    this.#mainBuffer.writeByte(0x3B);
  }

  #setFrameData({ imageData, duration }) {
    this.#setGraphicControlExtension(duration);
    this.#setImage(imageData);
  }

  //Optional. Controls normal animation execution
  #setGraphicControlExtension(duration) {
    //Extension introducer | 1 byte | Special value 21h
    this.#mainBuffer.writeByte(0x21);
    //Graphic Control Label | 1 byte | Special value 0xF9
    this.#mainBuffer.writeByte(0xF9);
    //Byte size of block | 1 byte | Special value of 4 bytes
    this.#mainBuffer.writeByte(0x04);
    /*
    Packed fields | 1 byte | Contains following subfields of data:
    Bit 5-7 - Reserved
    Bit 2-4 - Disposal Method - Not used
    Bit 1 - User Input Flag - Don't wait for input
    Bit 0 - Transparent Color Flag - Don't specify transparent color
     */
    const fields = 0b00000000;
    this.#mainBuffer.writeByte(fields);
    //Delay time | 2 bytes | Time in 1/100 of seconds
    const delay = duration / 10; //From milliseconds to centiseconds
    this.#mainBuffer.write16Integer(delay);

    //Transparent color index | 1 byte | Not used
    this.#mainBuffer.writeByte(EMPTY_VALUE);
    //Block terminator | 1 byte | Special value 00h
    this.#mainBuffer.writeByte(EMPTY_VALUE);
  }

  #setImage(imageData) {
    const encoder = new GifImageEncoder(imageData);
    this.#mainBuffer.writeArray(encoder.encode());
  }
}

export { GifFrame, GifEncoder };
