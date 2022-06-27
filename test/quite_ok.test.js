import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  QoiCompressor,
  QoiDecompressor
} from '../public/scripts/utilities/quite_ok.js';

describe('QuiteOk compressor', () => {
  it('Can compress and decompress any image', () => testRandom());
});

const COLOR_MAX = 255;

async function testRandom() {
  const imageSize = 250;
  const parameterCount = 4;
  const colorRange =  Math.floor(Math.random() * COLOR_MAX);

  const data = new Uint8Array(imageSize * imageSize * parameterCount);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.floor(Math.random() * colorRange);
  }
  const compressed = new QoiCompressor().compress({ data });
  const decompressed = new QoiDecompressor().decompress(
    compressed,
    imageSize,
    imageSize
  );

  for (let i = 0; i < data.length; i++) {
    expect(decompressed[i]).to.equal(data[i]);
  }
}
