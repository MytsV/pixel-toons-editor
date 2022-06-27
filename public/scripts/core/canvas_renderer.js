/*
Set of functions which define how canvas is rendered into HTML.
 */
import { Color } from '../utilities/color.js';
import { BmpEncoder, BmpVersions } from '../utilities/bmp_encoder.js';
import { applyImageMixin } from '../utilities/image.js';
import {
  bytesToBase64,
  setImageBase64
} from '../utilities/bytes_conversion.js';

/*
Constants associated with zoom system
 */

const ZOOM_MAX = 5;
const ZOOM_MIN = 1;
const ZOOM_STEP = 1;

const TRANSLATION = 50;

/*
A class for managing graphic representation of canvas
 */
class CanvasRenderer {
  constructor() {
    this.canvasWrapper = document.getElementById('canvas-wrapper');
    this.canvasLayers = document.getElementById('canvas-layers');
    this.zoomValue = 1;
  }

  appendCanvas(canvas) {
    const width = canvas.element.width;
    const height = canvas.element.height;

    this.canvasWrapper.style.aspectRatio = width / height;
    this.#setUpElement(canvas.element);
    CanvasRenderer.#setUpBackground(width, height);
    this.adjustSize();
  }

  /*
  Layers are redrawn each time the canvas changes.
  For optimization we convert background image to BMP format.
  Rendering is done with <div> tag, which doesn't update
   */
  static #setUpBackground(width, height) {
    const image = new ImageData(width, height);
    applyImageMixin(image);
    toBasicBackground(image);
    CanvasRenderer.#setUpImage('canvas-background', image);
  }

  setOverlay(canvas) {
    const image = canvas ? canvas.getJoinedImage() : null;
    CanvasRenderer.#setUpImage('canvas-overlay', image);
  }

  static #setUpImage(id, image) {
    const imageElement = document.getElementById(id);
    const clearImage = () => {
      imageElement.style.backgroundImage = '';
    };

    if (!image) {
      clearImage();
      return;
    }

    const encoder = new BmpEncoder(BmpVersions.BMP_32);
    const data = bytesToBase64(encoder.encode(image));
    if (encoder.isLastEncodedTransparent()) {
      clearImage();
    } else {
      setImageBase64(imageElement, data);
    }
  }

  #setUpElement(canvasElement) {
    //Disable right click context menu on canvas
    canvasElement.oncontextmenu = () => false;
    canvasElement.classList.add('canvas-element');
    //Canvas is wrapped to manage zooming
    this.canvasLayers.appendChild(canvasElement);
  }

  removeCanvases() {
    this.canvasLayers.innerHTML = '';
  }

  zoomIn() {
    this.#zoom(ZOOM_STEP);
  }

  zoomOut() {
    this.#zoom(-ZOOM_STEP);
  }

  #zoom(step) {
    if (!this.#canScale(step)) {
      throw Error('Attempting to overflow zoom value');
    }
    this.zoomValue += step;
    this.adjustSize();
  }

  adjustSize() {
    //If canvas is zoomed, than we don't center the canvas
    handleCentering(this.canvasWrapper, this.zoomValue <= 1);
    setWrapperSize(this.canvasWrapper, this.zoomValue);
  }

  #canScale(step) {
    const newValue = this.zoomValue + step;
    return newValue >= ZOOM_MIN && newValue <= ZOOM_MAX;
  }
}

//Colors for creating a basic grey-white background
const BACKGROUND_COLOR_WHITE = '#ffffff';
const BACKGROUND_COLOR_GREY = '#e3e3e3';

//Function to turn image into a basic grey-white "transparent" background
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
  //Make sure that neighbouring pixels are always of different color
  if (i % 2 !== j % 2) {
    return BACKGROUND_COLOR_WHITE; //First pixel is always white
  } else {
    return BACKGROUND_COLOR_GREY;
  }
}

function handleCentering(element, centered) {
  const centerTransformation = `translate(-${TRANSLATION}%, -${TRANSLATION}%)`;
  element.style.transform = centered ? centerTransformation : 'none';
  element.style.left = centered ? `${TRANSLATION}%` : '0pt';
  element.style.top = centered ? `${TRANSLATION}%` : '0pt';
}

function setWrapperSize(wrapper, zoomValue) {
  const { offsetWidth: width, offsetHeight: height } = wrapper;
  const parent = wrapper.parentElement;
  const { offsetWidth: parentWidth, offsetHeight: parentHeight } = parent;

  const maxPercent = `${zoomValue * 100}%`;
  const unset = 'auto';

  const toWidth = width * parentHeight >= parentWidth * height;
  wrapper.style.width = toWidth ? maxPercent : unset;
  wrapper.style.height = toWidth ? unset : maxPercent;
}

export { CanvasRenderer };
