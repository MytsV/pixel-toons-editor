/*
Set of functions which define how canvas is rendered into HTML.
 */
import { Color } from '../utilities/color.js';
import { BmpEncoder } from '../utilities/bmp_encoder.js';
import { applyImageMixin } from '../utilities/image.js';
import { bytesToUrl } from '../utilities/bytes_conversion.js';

/*
Constants associated with zoom system
 */

const ZOOM_MAX = 5;
const ZOOM_MIN = 1;
const ZOOM_STEP = 1;

const TRANSLATION = 50;
const backgroundId = 'canvas-background'; //Will be refactored with usage of different HTML structure

/*
A class for managing graphic representation of canvas
 */
class CanvasRenderer {
  constructor() {
    this.canvasWrapper = document.getElementById('canvas-wrapper');
    this.zoomValue = 1;
  }

  appendCanvas(canvas) {
    const width = canvas.mainElement.width;
    const height = canvas.mainElement.height;

    this.canvasWrapper.style.aspectRatio = width / height;
    this.#setUpElement(canvas.mainElement);
    CanvasRenderer.#setUpBackground(width, height);
    this.adjustSize();
  }

  /*
  Layers are redrawn each time the canvas changes.
  For optimization we convert background image to BMP format and render it with <div> tag, which doesn't update
   */
  static #setUpBackground(width, height) {
    const image = new ImageData(width, height);
    applyImageMixin(image);

    toBasicBackground(image);

    const encoder = new BmpEncoder(image);
    const url = bytesToUrl(encoder.encode());
    const imageElement = document.getElementById(backgroundId);
    imageElement.style.backgroundImage = `url(${url})`;
  }

  #setUpElement(canvasElement) {
    canvasElement.oncontextmenu = () => false; //Disable right click context menu on canvas
    canvasElement.classList.add('canvas-element');
    this.canvasWrapper.appendChild(canvasElement); //Canvas is wrapped to manage zooming
  }

  removeCanvases() {
    const children = this.canvasWrapper.children;
    for (const child of children) {
      if (child.id !== backgroundId) {
        child.remove();
      }
    }
  }

  zoom(positive) {
    if (!this.#canScale(positive)) return;
    this.zoomValue = positive ? this.zoomValue + ZOOM_STEP : this.zoomValue - ZOOM_STEP;
    this.adjustSize();
  }

  adjustSize() {
    //If canvas is zoomed, than we don't center the canvas
    handleCentering(this.canvasWrapper, this.zoomValue <= 1);
    setWrapperSize(this.canvasWrapper, this.zoomValue);
  }

  #canScale(positive) {
    if (positive) {
      return this.zoomValue <= ZOOM_MAX;
    } else {
      return this.zoomValue > ZOOM_MIN;
    }
  }
}

//Colors for creating a basic grey-white background
const BACKGROUND_COLOR_WHITE = '#ffffff';
const BACKGROUND_COLOR_GREY = '#e3e3e3';

//Function to turn image into a basic grey-white background which indicates transparency
function toBasicBackground(image) {
  for (let i = 0; i < image.width; i++) {
    for (let j = 0; j < image.height; j++) {
      const pixelColor = getClearPixelColor(i, j);
      image.setPixelColor(i, j, Color.fromHex(pixelColor));
    }
  }
}

//Get color of transparent pixel based on its coordinates
function getClearPixelColor(i, j) {
  if (i % 2 !== j % 2) { //The condition makes sure that neighbouring pixels are always of different color
    return BACKGROUND_COLOR_WHITE; //First pixel is always white
  } else {
    return BACKGROUND_COLOR_GREY;
  }
}

function handleCentering(element, centered) {
  element.style.transform = centered ? `translate(-${TRANSLATION}%, -${TRANSLATION}%)` : 'none';
  element.style.left = centered ? `${TRANSLATION}%` : '0pt';
  element.style.top = centered ? `${TRANSLATION}%` : '0pt';
}

function setWrapperSize(wrapper, zoomValue) {
  const parent = wrapper.parentElement;

  const maxPercent = `${zoomValue * 100}%`;
  const unset = 'auto';

  const toWidth = wrapper.offsetWidth * parent.offsetHeight >= parent.offsetWidth * wrapper.offsetHeight;
  wrapper.style.width = toWidth ? maxPercent : unset;
  wrapper.style.height = toWidth ? unset : maxPercent;
}

function setupColorPicker(canvas) { //To be refactored
  const colorPicker = document.createElement('input'); //Input element with type "color"
  colorPicker.type = 'color';
  colorPicker.id = 'color-picker';
  colorPicker.oninput = () => {
    canvas.state.color = Color.fromHex(colorPicker.value);
  };
  return colorPicker;
}

export { CanvasRenderer, setupColorPicker };
