/*
Useful mixin functions for working with ImageData class
Created to avoid complications in working with pixel color array
 */

import { Color } from './color.js';

const mixin = {
  setPixelColor,
  getPixelPosition,
  getPixelColor,
  clone,
  append
};

const applyImageMixin = (imageData) => {
  Object.assign(imageData, mixin);
};

//The number is four, because we use RGBA as our main format
const COLOR_PARAMETERS = 4;

//Set color to a pixel with (i, j) coordinates
function setPixelColor(i, j, { r, g, b, alpha }) {
  const position = this.getPixelPosition(i, j);

  const colorArray = [r, g, b, alpha];
  for (let i = 0; i < colorArray.length; i++) {
    this.data[position + i] = colorArray[i];
  }
}

//Get color of a pixel with (i, j) coordinates
function getPixelColor(i, j) {
  const position = this.getPixelPosition(i, j);

  const colorArray = [];
  for (let i = 0; i < COLOR_PARAMETERS; i++) {
    colorArray[i] = this.data[position + i];
  }
  return new Color(...colorArray);
}

//Get array index of a pixel with (i, j) coordinates
function getPixelPosition(i, j) {
  return (j * this.width + i) * COLOR_PARAMETERS;
}

//Prototype pattern implementation
function clone() {
  const cloned = new ImageData(this.width, this.height);
  cloned.data.set(this.data);
  applyImageMixin(cloned);
  return cloned;
}

//Blend multiple images together
function append(...images) {
  const appendedData = this.clone();
  for (let i = 0; i < this.width; i++) {
    for (let j = 0; j < this.height; j++) {
      const color = images.reduce((accumulator, curr) => {
        const currColor = curr.getPixelColor(i, j);
        return accumulator.blend(currColor);
      }, appendedData.getPixelColor(i, j));
      appendedData.setPixelColor(i, j, color);
    }
  }
  return appendedData;
}

/*
Image is an instance of ImageData class.
Amount is an integer, which is bigger or equal to 1.
We use simple integer scaling.
 */
function scale(image, degree) {
  if (degree < 1 || (degree | 0) !== degree) {
    throw Error('Illegal degree value');
  }

  const scaled = new ImageData(image.width * degree, image.height * degree);
  let scaledPos = 0;
  for (let i = 0; i < image.height; i++) {
    const row = [];

    for (let j = 0; j < image.width; j++) {
      const dataPos = (i * image.width + j) * COLOR_PARAMETERS;
      const color = image.data.slice(dataPos, dataPos + COLOR_PARAMETERS);
      for (let k = 0; k < degree; k++) {
        row.push(...color);
      }
    }

    for (let k = 0; k < degree; k++) {
      scaled.data.set(row, scaledPos);
      scaledPos += image.width * COLOR_PARAMETERS * degree;
    }
  }
  return scaled;
}

export { applyImageMixin, scale };
