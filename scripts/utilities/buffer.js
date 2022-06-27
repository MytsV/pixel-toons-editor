const BITS_IN_BYTE = 8;

/*
A class that represents a writable array of bytes.
Created for easier work with byte size and different types of written values.
Has similar interface to the Node.js Buffer class, but doesn't require offset.
This Buffer is more like a simple "disguised" Stack.
 */
class Buffer {
  #data;

  constructor() {
    this.#data = [];
  }

  writeString(string) {
    this.writeArray(stringToByteArray(string));
  }

  write16Integer(number) {
    this.writeInteger(16 / BITS_IN_BYTE, number);
  }

  write32Integer(number) {
    this.writeInteger(32 / BITS_IN_BYTE, number);
  }

  writeInteger(bytes, number) {
    const array = intToByteArray(number, bytes);
    this.writeArray(array);
  }

  writeByte(byte) {
    this.#data.push(byte);
  }

  writeArray(array) {
    this.#data.push(...array);
  }

  get data() {
    return Uint8Array.from(this.#data);
  }

  get length() {
    return this.#data.length;
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
    array[i] = number >> BITS_IN_BYTE * i;
  }
  return array;
}

class ByteReader {
  #data;

  constructor(data) {
    this.#data = data;
    this.pos = 0;
  }

  readByte() {
    return this.#data[this.pos++];
  }

  readString(length) {
    const array = this.#data.slice(this.pos, this.pos + length);
    this.pos += length;
    return String.fromCharCode(...array);
  }

  readInteger(length) {
    const array = this.#data.slice(this.pos, this.pos + length);
    this.pos += length;
    let result = 0;
    let shifter = 0;
    for (let i = 0; i < array.length; i++) {
      result += array[i] * (2 ** shifter);
      shifter += 8;
    }
    return result;
  }

  readArray(length) {
    const array = this.#data.slice(this.pos, this.pos + length);
    this.pos += length;
    return array;
  }
}

export { Buffer, ByteReader };
