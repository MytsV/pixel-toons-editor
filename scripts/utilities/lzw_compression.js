const MAX_BLOCK_SIZE = 255;
const BITS_IN_BYTE = 8;
const MAX_TABLE_SIZE = (1 << /* Max code size */ 12) - 1;

/*
A class that represents a mapping of pixel indices combinations to codes.
The codes are just positions at which entries were inserted.
 */
class CodeTable {
  constructor(codeSize) {
    this.colorBits = codeSize;
    this.clearCode = 1 << this.colorBits;
    this.endCode = this.clearCode + 1;
    this.#clear();
  }

  #clear() {
    this.codes = new Map();
    this.nextUnused = this.endCode + 1;
    this.codeSize = this.colorBits + 1;
  }

  getNewCode(previous, current) {
    const hash = CodeTable.#getHash(previous, current);
    const hasCode = this.codes.has(hash);
    return hasCode ? this.codes.get(hash) : null;
  }

  set(previous, current) {
    //Stop populating the table when its size exceeds limit
    if (this.nextUnused >= MAX_TABLE_SIZE) return;

    const hash = CodeTable.#getHash(previous, current);
    this.codes.set(hash, this.nextUnused++);

    const size = 1 << this.codeSize;
    /*
    If the next entry will be bigger than the maximally supported one,
    we increase the code size
     */
    if (this.nextUnused > size) {
      this.codeSize++;
    }
  }

  static #getHash(previous, current) {
    return (previous << 8) | current;
  }
}

/*
A class that represents a writable buffer of bytes.
For additional compression, the code bits are packed into bytes.
They are stacked from the left:
001 -> 110 results in 001110
If there is overflow of BITS_IN_BYTE value, we add redundant bits to a new byte.
 */
class LZWOutput {
  constructor(codeTable) {
    this.table = codeTable;
    this.accumulator = 0;
    this.accumulatorLength = 0;
    this.bytes = [];
  }

  write(code) {
    //Pack [codeSize] bits into a byte
    this.accumulator |= code << this.accumulatorLength;
    this.accumulatorLength += this.table.codeSize;
    while (this.accumulatorLength >= BITS_IN_BYTE) {
      this.bytes.push(this.#cropAccumulator());
      this.accumulator >>= BITS_IN_BYTE;
      this.accumulatorLength -= BITS_IN_BYTE;
    }
  }

  //Append the code which means table reinitialising
  writeClearCode() {
    this.write(this.table.clearCode);
  }

  //Append the code which means the end of pixel data
  writeEndCode() {
    this.write(this.table.endCode);
  }

  get() {
    //If there is something left in accumulator, dump it into a byte
    if (this.accumulatorLength > 0) {
      this.bytes.push(this.#cropAccumulator());
    }

    const data = [];
    //Before pixel data we output minimal code size
    data.push(this.table.colorBits);

    //Each block starts with its length and is followed by [length] bytes
    const addBlock = (start, length) => {
      data.push(length);
      data.push(...this.bytes.slice(start, start + length));
    };

    const { length } = this.bytes;
    for (let i = 0; i < this.bytes.length; /* Don't perform any operation */) {
      if (length - i >= MAX_BLOCK_SIZE) {
        addBlock(i, MAX_BLOCK_SIZE);
        i += MAX_BLOCK_SIZE;
      } else {
        addBlock(i, length - i);
        break;
      }
    }

    return data;
  }

  #cropAccumulator() {
    return this.accumulator & 0xFF;
  }
}

/*
Lempel–Ziv–Welch (LZW) is a universal lossless data compression algorithm
created by Abraham Lempel, Jacob Ziv, and Terry Welch.
Pleaser refer to this link for details:
https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch
 */
class LzwCompressor {
  constructor(colorBits) {
    this.table = new CodeTable(colorBits);
    this.output = new LZWOutput(this.table);
  }

  compress(input) {
    this.output.writeClearCode();

    let previous = input[0];
    for (const current of input.slice(1)) {
      const newCode = this.table.getNewCode(previous, current);
      if (newCode !== null) {
        previous = newCode;
      } else {
        this.output.write(previous);
        this.table.set(previous, current);
        previous = current;
      }
    }

    this.output.write(previous);
    this.output.writeEndCode();
    return this.output.get();
  }
}

export { LzwCompressor };
