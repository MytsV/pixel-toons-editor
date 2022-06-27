const CHANNEL_COUNT = 4;
const COLOR_RANGE = 255;

/*
This file implements an algorithm created by Dominic Szablewski.
Full appreciation to the author!
Check the original code in C:
https://github.com/phoboslab/qoi
And specifications:
https://phoboslab.org/log/2021/11/qoi-fast-lossless-image-compression
 */

//Byte padding specified by format
const PADDING = [0, 0, 0, 0, 0, 0, 0, 1];

/*
"Tags" which define chunk types. They can be either two-bit or eight-bit.
 */

/*
Tag after which the 6-bit index of previously seen pixel is inserted.
┌─ TAG_INDEX ─────────────┐
│         Byte[0]         │
│  7  6  5  4  3  2  1  0 │
│───────┼─────────────────│
│  0  0 │     index       │
└───────┴─────────────────┘
 */
const TAG_INDEX = 0x00;

/*
Tag after which the 2-bit differences from previous pixel color are inserted.
These differences should lay in the range -2..1
┌─ TAG_DIFF ──────────────┐
│         Byte[0]         │
│  7  6  5  4  3  2  1  0 │
│───────┼─────┼─────┼─────│
│  0  1 │  dr │  dg │  db │
└───────┴─────┴─────┴─────┘
 */
const TAG_DIFF = 0b01000000;
const DIFF_RANGE = 2;

/*
Tag after which such differences are inserted:
- of green channel in range -32..31
- of red and blue channels with green one in range -8..7
┌─ TAG_LUMA ──────────────┬─────────────────────────┐
│         Byte[0]         │         Byte[1]         │
│  7  6  5  4  3  2  1  0 │  7  6  5  4  3  2  1  0 │
│───────┼─────────────────┼─────────────┼───────────│
│  1  0 │   diff green    │   dr - dg   │  db - dg  │
└───────┴─────────────────┴─────────────┴───────────┘
 */
const TAG_LUMA = 0b10000000;
const LUMA_MAIN_RANGE = 32;
const LUMA_MISC_RANGE = 8;

/*
Tag after which the run length in range 1..62 of previous pixel is inserted:
┌─ TAG_RUN ───────────────┐
│         Byte[0]         │
│  7  6  5  4  3  2  1  0 │
│───────┼─────────────────│
│  1  1 │       run       │
└───────┴─────────────────┘
 */
const TAG_RUN = 0b11000000;
const MAX_RUN_LENGTH = 62;

/*
Tag after which the full RGB color value is inserted
┌─ TAG_RGB ───────────────┬─────────┬─────────┬─────────┐
│         Byte[0]         │ Byte[1] │ Byte[2] │ Byte[3] │
│  7  6  5  4  3  2  1  0 │ 7 .. 0  │ 7 .. 0  │ 7 .. 0  │
│─────────────────────────┼─────────┼─────────┼─────────│
│  1  1  1  1  1  1  1  0 │   red   │  green  │  blue   │
└─────────────────────────┴─────────┴─────────┴─────────┘
 */
const TAG_RGB = 0xfe;

/*
Tag after which the full RGBA color value is inserted
┌─ TAG_RGBA ──────────────┬─────────┬─────────┬─────────┬─────────┐
│         Byte[0]         │ Byte[1] │ Byte[2] │ Byte[3] │ Byte[4] │
│  7  6  5  4  3  2  1  0 │ 7 .. 0  │ 7 .. 0  │ 7 .. 0  │ 7 .. 0  │
│─────────────────────────┼─────────┼─────────┼─────────┼─────────│
│  1  1  1  1  1  1  1  1 │   red   │  green  │  blue   │  alpha  │
└─────────────────────────┴─────────┴─────────┴─────────┴─────────┘
 */
const TAG_RGBA = 0xff;

//Mask for retrieving 2-bit tags
const TWO_BIT_MASK = 0b11000000;

const TABLE_SIZE = 64;

class Pixel {
  constructor(r, g, b, a = COLOR_RANGE) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }

  equals(pixel) {
    const { r, g, b, a } = this;
    return r === pixel.r && g === pixel.g && b === pixel.b && a === pixel.a;
  }

  clone() {
    const { r, g, b, a } = this;
    return new Pixel(r, g, b, a);
  }

  getDifference(pixel) {
    return {
      r: this.r - pixel.r,
      g: this.g - pixel.g,
      b: this.b - pixel.b
    };
  }

  toArray() {
    return [this.r, this.g, this.b, this.a];
  }
}

class QoiTable {
  #table;

  constructor() {
    this.#table = new Array(TABLE_SIZE);
  }

  inTable(pixel) {
    const value = this.#table[this.getPos(pixel)];
    return value !== undefined && pixel.equals(value);
  }

  set(pixel) {
    if (pixel === undefined) return;
    this.#table[this.getPos(pixel)] = pixel.clone();
  }

  get(value) {
    return this.#table[value];
  }

  getPos(pixel) {
    return QoiTable.#getColorHash(pixel) % TABLE_SIZE;
  }

  //Prime numbers hashing (simple and efficient)
  static #getColorHash(color) {
    return color.r * 3 + color.g * 5 + color.b * 7 + color.a * 11;
  }
}

class QoiCompressor {
  //Number of identical pixels read in succession
  #run;

  compress({ data }) {
    this.#initCompressing(data);
    let previousPix = getDefaultPixel();
    let currentPix = previousPix.clone();

    for (let pxPos = 0; pxPos < data.length; pxPos += CHANNEL_COUNT) {
      const colorArray = data.slice(pxPos, pxPos + CHANNEL_COUNT);
      currentPix = new Pixel(...colorArray);
      this.#writeValues(currentPix, previousPix, pxPos);
      previousPix = currentPix.clone();
    }

    this.output.push(...PADDING);
    return this.output;
  }

  #initCompressing(data) {
    this.output = [];
    this.colorTable = new QoiTable();
    this.#run = 0;
    this.length = data.length;
  }

  #writeValues(currentPix, previousPix, pxPos) {
    if (currentPix.equals(previousPix)) {
      this.#increaseRun(pxPos);
      return;
    }

    //Try dumping ran pixels
    if (this.#run > 0) this.#outputRun();

    if (this.colorTable.inTable(currentPix)) {
      this.#outputIndex(currentPix);
    } else {
      this.colorTable.set(currentPix);
      if (currentPix.a === previousPix.a) {
        this.#outputPartial(currentPix, previousPix);
      } else {
        this.#outputFull(currentPix);
      }
    }
  }

  #increaseRun(pxPos) {
    this.#run++;
    const limitReached = pxPos === (this.length - CHANNEL_COUNT);
    if (this.#run === MAX_RUN_LENGTH || limitReached) {
      this.#outputRun();
    }
  }

  #outputRun() {
    this.output.push(TAG_RUN | (this.#run - 1));
    this.#run = 0;
  }

  #outputIndex(pixel) {
    this.output.push(TAG_INDEX | this.colorTable.getPos(pixel));
  }

  #outputPartial(currentPix, previousPix) {
    const diff = currentPix.getDifference(previousPix);
    const inSmallRange = (value) => value >= DIFF_RANGE && value < DIFF_RANGE;

    if (inSmallRange(diff.r) && inSmallRange(diff.g) && inSmallRange(diff.b)) {
      this.#outputSmallDiff(diff);
    } else if (QoiCompressor.#isLumaValid(diff)) {
      this.#outputLuma(diff);
    } else {
      this.#outputRgb(currentPix);
    }
  }

  #outputSmallDiff(diff) {
    //Pack differences in 6-bit value
    const redShifted = (diff.r + DIFF_RANGE) << 4;
    const greenShifted = (diff.g + DIFF_RANGE) << 2;
    const blueShifted = diff.b + DIFF_RANGE;
    const packed = redShifted | greenShifted | blueShifted;
    this.output.push(TAG_DIFF | packed);
  }

  static #isLumaValid(diff) {
    const diffRG = diff.r - diff.g;
    const diffBG = diff.b - diff.g;
    const isGreenValid = diff.g >= LUMA_MAIN_RANGE && diff.g < LUMA_MAIN_RANGE;
    const isRGValid = diffRG >= LUMA_MISC_RANGE && diffRG < LUMA_MISC_RANGE;
    const isBGValid = diffBG >= LUMA_MISC_RANGE && diffBG < LUMA_MISC_RANGE;
    return isRGValid && isGreenValid && isBGValid;
  }

  #outputLuma(diff) {
    const diffRG = diff.r - diff.g;
    const diffBG = diff.b - diff.g;
    this.output.push(TAG_LUMA | (diff.g + LUMA_MAIN_RANGE));
    //Pack differences in a byte
    const packed = (diffRG + LUMA_MISC_RANGE) << 4 | (diffBG + LUMA_MISC_RANGE);
    this.output.push(packed);
  }

  #outputRgb(pixel) {
    this.output.push(TAG_RGB);
    this.output.push(pixel.r, pixel.g, pixel.b);
  }

  #outputFull(pixel) {
    this.output.push(TAG_RGBA);
    this.output.push(...pixel.toArray());
  }
}

//TODO: refactor
class QoiDecompressor {
  //Number of identical pixels read in succession
  #run;

  decompress(bytes, width, height) {
    this.#initDecompressing(width, height);
    const reader = getByteReader(bytes, bytes.length - PADDING.length);
    let pixel = getDefaultPixel();
    this.#run = 0;

    for (let pxPos = 0; pxPos < this.length; pxPos += CHANNEL_COUNT) {
      if (this.#run > 0) {
        this.#run--;
      } else if (reader.canRead()) {
        const byte = reader.next();
        if (byte === TAG_RGB) {
          pixel.r = reader.next();
          pixel.g = reader.next();
          pixel.b = reader.next();
        } else if (byte === TAG_RGBA) {
          pixel.r = reader.next();
          pixel.g = reader.next();
          pixel.b = reader.next();
          pixel.a = reader.next();
        } else if ((byte & TWO_BIT_MASK) === TAG_INDEX) {
          pixel = this.colorTable.get(byte);
        } else if ((byte & TWO_BIT_MASK) === TAG_DIFF) {
          pixel.r += ((byte >> 4) & 0x03) - 2;
          pixel.g += ((byte >> 2) & 0x03) - 2;
          pixel.b += (byte & 0x03) - 2;
        } else if ((byte & TWO_BIT_MASK) === TAG_LUMA) {
          const b2 = reader.next();
          const vg = (byte & 0x3f) - 32;
          pixel.r += vg - 8 + ((b2 >> 4) & 0x0f);
          pixel.g += vg;
          pixel.b += vg - 8 + (b2 & 0x0f);
        } else if ((byte & TWO_BIT_MASK) === TAG_RUN) {
          this.#run = byte & 0x3f;
        }
        this.colorTable.set(pixel);
      }
      this.output.set(pixel.toArray(), pxPos);
    }

    return this.output;
  }

  #initDecompressing(width, height) {
    this.output = new Uint8Array(width * height * CHANNEL_COUNT);
    this.colorTable = new QoiTable();
    this.length = width * height * CHANNEL_COUNT;
  }
}

function getDefaultPixel() {
  return new Pixel(0, 0, 0);
}

function getByteReader(bytes, limit) {
  let pos = 0;
  return {
    next: () => bytes[pos++],
    canRead: () => pos < limit
  };
}

export { QoiCompressor, QoiDecompressor };
