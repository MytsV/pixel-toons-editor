import { CanvasRenderer } from './core/canvas_renderer.js';
import { AnimationFile } from './core/canvas.js';
import { bytesToUrl } from './utilities/bytes_conversion.js';
import { BmpEncoder, bmpVersions } from './utilities/bmp_encoder.js';
import { FileMenu, StateButtons, Toolbar } from './core/ui_elements.js';

let file;
const renderer = new CanvasRenderer();
let elements = [];

window.onload = () => {
  elements = [
    new StateButtons(),
    new FileMenu(createNewFile),
    new Toolbar()
  ];
};

function createNewFile(width, height) {
  file = new AnimationFile(width, height);

  renderer.removeCanvases();
  renderer.appendCanvas(file.canvas);

  elements.forEach((element) => element.refresh(file));
  setUpUserInterface();
}


/*
NOT REFACTORED ZONE
These functions will turn into classes in ui_elements.js or new key shorcuts handler
 */

function setUpUserInterface() {
  assignLayerButtons();
  setUpUpdateListener();
}

/*
Handling of zoom
 */

const zoomCodes = {
  '+': true,
  '=': true,
  '-': false,
  '_': false
};

document.addEventListener('keypress', (event) => {
  const index = Object.keys(zoomCodes).indexOf(event.key);
  if (index !== -1) {
    renderer.zoom(zoomCodes[event.key]);
  }
});

/*
Handling of layer-specific functions
 */

function assignLayerButtons() {
  const addLayerButton = document.getElementById('add-layer-button');
  const removeLayerButton = document.getElementById('remove-layer-button');
  const moveUpLayerButton = document.getElementById('move-up-layer-button');
  const moveDownLayerButton = document.getElementById('move-down-layer-button');
  const uniteLayerButton = document.getElementById('unite-layer-button');

  addLayerButton.onclick = () => file.canvas.appendLayer();
  removeLayerButton.onclick = () => file.canvas.removeLayer(file.canvas.drawnLayerID);
  moveUpLayerButton.onclick = () => file.canvas.moveLayerUp(file.canvas.drawnLayerID);
  moveDownLayerButton.onclick = () => file.canvas.moveLayerDown(file.canvas.drawnLayerID);
  uniteLayerButton.onclick = () => {
    const currentIndex = file.canvas.layers.findIndex((layer) => layer.id === file.canvas.drawnLayerID);
    file.canvas.mergeLayers(file.canvas.drawnLayerID, file.canvas.layers[currentIndex - 1].id);
  };
}

function setUpUpdateListener() {
  setLayerMenu();
  file.canvas.listenToUpdates(setLayerMenu);
}

function setLayerMenu() {
  const layers = file.canvas.layers;
  const container = document.getElementById('layer-container');
  container.innerHTML = '';

  for (let i = layers.length - 1; i >= 0; i--) { //Iterate the list in reversed order
    const layer = layers[i];
    const layerElement = document.createElement('div');
    layerElement.appendChild(getLayerImage(layer));

    appendLayerName(layer, layerElement);
    handleLayerClasses(layer, layerElement);
    // eslint-disable-next-line no-loop-func
    layerElement.onclick = () => {
      file.canvas.switchLayer(layer.id);
    };
    layerElement.appendChild(getVisibilityButton(layer));

    container.appendChild(layerElement);
  }
}

function appendLayerName(layer, layerElement) {
  const name = document.createElement('span');
  name.classList.add('text');
  name.classList.add('layer-name');
  name.innerText = `Layer ${layer.id}`;
  layerElement.appendChild(name);
}

function handleLayerClasses(layer, layerElement) {
  layerElement.classList.add('layer-element');
  if (layer.id === file.canvas.drawnLayerID) {
    layerElement.classList.add('layer-element-selected');
  }
}

function getVisibilityButton(layer) {
  const visibilityButton = document.createElement('div');
  visibilityButton.classList.add('visibility-button');
  if (!layer.visible) {
    visibilityButton.classList.add('visibility-button-inactive');
  }
  visibilityButton.onclick = () => {
    layer.visible = !layer.visible;
    file.canvas.redraw();
  };
  return visibilityButton;
}

const IMAGE_POS = 0;
const layerCache = new Map(); //Keys are layer IDs, values - URLs of layer images

function getLayerImage(layer) {
  const imageElement = document.createElement('div');
  imageElement.classList.add('layer-image');
  imageElement.style.aspectRatio = renderer.canvasWrapper.style.aspectRatio;

  let url;

  if (file.canvas.drawnLayerID !== layer.id && layerCache.has(layer.id)) {
    url = layerCache.get(layer.id);
  } else {
    const image = layer.context.getImageData(IMAGE_POS, IMAGE_POS, layer.virtualCanvas.width, layer.virtualCanvas.height);
    const encoder = new BmpEncoder(image, bmpVersions.bmp32); //Render image with transparency
    const data = encoder.encode();
    url = bytesToUrl(data);
  }

  layerCache.set(layer.id, url);
  imageElement.style.backgroundImage = `url(${url})`;
  return imageElement;
}

window.addEventListener('resize', () => renderer.adjustSize());
