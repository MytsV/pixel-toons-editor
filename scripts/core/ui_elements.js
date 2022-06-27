import { BmpEncoder, BmpVersions } from '../utilities/bmp_encoder.js';
import * as conv from '../utilities/bytes_conversion.js';
import { BucketFill, Eraser, Pencil, Pointer, Tool } from './tools.js';
import { PxtDecoder, PxtEncoder } from '../utilities/pxt.js';
import { GifEncoder, GifFrame } from '../utilities/gif_encoder.js';
import { Color } from '../utilities/color.js';

const HIDE_DISPLAY = 'none';
const SHOW_DISPLAY = 'block';

class VariableDependentButtons {
  constructor() {
    this.buttons = new Map();
  }

  addButton(id, listener) {
    const element = document.getElementById(id);
    const closureListener = (variable) => (event) => {
      event.stopPropagation();
      listener(variable);
    };
    this.buttons.set(element, closureListener);
  }

  enableButtons(variable) {
    for (const [element, listener] of this.buttons) {
      element.onclick = listener(variable);
    }
  }
}

class Modal {
  constructor(id) {
    this.element = document.getElementById(id);
  }

  #setUpEvents() {
    window.onclick = (event) => {
      if (event.target === this.element) {
        this.hide();
      }
    };
  }

  show() {
    this.element.style.display = SHOW_DISPLAY;
    this.#setUpEvents();
  }

  hide() {
    this.element.style.display = HIDE_DISPLAY;
  }
}

//TODO: refactoring
class DropDownPopup {
  constructor(elements) {
    this.items = elements;
  }

  enable(x, y) {
    this.element = document.createElement('div');
    this.element.classList.add('drop-down-menu');
    for (const [key, value] of Object.entries(this.items)) {
      const item = document.createElement('div');
      item.classList.add('drop-down-item', 'text', 'button');
      item.innerText = key;
      item.onclick = () => {
        value();
        this.disable();
      };
      this.element.appendChild(item);
    }

    const offsetSide = 20;
    document.body.appendChild(this.element);

    const left = x - offsetSide;
    const top = y;
    this.element.style.position = 'absolute';
    this.element.style.left = left + 'px';
    this.element.style.top = top + 'px';

    this.element.onmouseleave = () => this.disable();
  }

  disable() {
    document.body.removeChild(this.element);
    this.element.onmouseleave = undefined;
  }
}

class UiElement {
  constructor() {
    if (new.target === UiElement) {
      throw Error('Abstract class cannot be instantiated');
    }
    this.buttons = new VariableDependentButtons();
  }

  refresh() {
  }
}

export class StateButtons extends UiElement {
  constructor() {
    super();
    this.buttons.addButton('undo', (canvas) => canvas.undo());
    this.buttons.addButton('redo', (canvas) => canvas.redo());
  }

  refresh({ canvas }) {
    this.buttons.enableButtons(canvas);
  }
}

const FILE_SIZE_LIMIT = 250;

export class FileMenu extends UiElement {
  constructor(createNewFile, openFile) {
    super();
    this.#setUpDependentButtons();

    this.createNewFile = createNewFile; //A function passed from the context
    this.openNewFile = openFile;
    this.#setUpNewButton();
    this.#setUpCreateFinish();
    FileMenu.#setUpLimit();
  }

  refresh(file) {
    this.buttons.enableButtons(file);
    this.#setUpNewButton(file);
  }

  #setUpDependentButtons() {
    this.buttons.addButton('clear-file', ({ canvas }) => this.#clear(canvas));
    this.buttons.addButton('export-image', () => {
      FileMenu.#exportImage();
    });
    this.buttons.addButton('export-to-bmp', ({ canvas }) => {
      const image = canvas.getJoinedImage();
      const encoder = new BmpEncoder(BmpVersions.BMP_32);
      const data = encoder.encode(image);
      conv.downloadLocalUrl(conv.bytesToUrl(data), 'image.bmp');
    });
    this.buttons.addButton('export-to-gif', (file) => {
      const encoder = new GifEncoder();
      const frames = file.frames.map((frame) => GifFrame.from(frame));
      const data = encoder.encode(frames);
      conv.downloadLocalUrl(conv.bytesToUrl(data), 'image.gif');
    });
  }

  #clear(canvas) {
    this.createNewFile(canvas.width, canvas.height);
  }

  static #exportImage() {
    const modal = new Modal('file-export-modal');
    modal.show();
  }

  #setUpNewButton(file) {
    this.createModal = new Modal('file-create-modal');
    const elements = {
      'New': () => this.createModal.show(),
      'Open': () => this.#open(),
      'Save': () => this.#save(file),
    };
    const button = document.getElementById('create-file');
    const dropdown = new DropDownPopup(elements);
    button.onclick = (event) => {
      dropdown.enable(event.clientX, event.clientY);
    };
  }

  //TODO: refactoring
  #open() {
    const button = document.createElement('input');
    button.type = 'file';
    const openNewFile = this.openNewFile;
    button.oninput = () => {
      const reader = new FileReader();
      reader.onload = function() {
        const arrayBuffer = this.result;
        const array = new Uint8Array(arrayBuffer);

        const file = new PxtDecoder().decode(array);
        openNewFile(file);
      };
      reader.readAsArrayBuffer(button.files[0]);
    };
    document.body.appendChild(button);
    button.dispatchEvent(new MouseEvent('click', { view: window }));
    document.body.removeChild(button);
  }

  #save(file) {
    const encoder = new PxtEncoder();
    const data = encoder.encode(file);
    const decoder = new PxtDecoder();
    decoder.decode(data);
    conv.downloadLocalUrl(conv.bytesToUrl(data), 'image.pxt');
  }

  #setUpCreateFinish() {
    const createFinishButton = document.getElementById('create-file-final');
    const inRange = (value) => value > 0 && value <= FILE_SIZE_LIMIT;
    createFinishButton.onclick = () => {
      const inputWidth = document.getElementById('width-input');
      const inputHeight = document.getElementById('height-input');
      if (!inRange(inputWidth.value) || !inRange(inputHeight.value)) {
        throw Error('Size values are illegal');
      }
      this.createNewFile(inputWidth.value, inputHeight.value);
      this.createModal.hide();
    };
  }

  static #setUpLimit() {
    const limit = document.getElementById('limit');
    limit.innerText = `Size limit is ${FILE_SIZE_LIMIT}x${FILE_SIZE_LIMIT}`;
  }
}

//A wrapper class for tool which defines its display
class ToolInfo {
  constructor(tool, name) {
    this.tool = tool;
    this.name = name;
    this.element = this.#createElement();
  }

  #createElement() {
    const element = document.createElement('div');
    element.id = this.name.toLowerCase();
    element.classList.add('single-tool');
    this.#setImage();
    element.appendChild(this.image);
    return element;
  }

  #setImage() {
    this.image = document.createElement('img');
    this.image.classList.add('tool-image');
    this.disable();
  }

  enable() {
    const imageName = this.name.toLowerCase();
    this.image.src = `./images/${imageName}-active.png`;
  }

  disable() {
    const imageName = this.name.toLowerCase();
    this.image.src = `./images/${imageName}.png`;
  }
}

export class Toolbar extends UiElement {
  constructor() {
    super();

    this.toolsInfo = [
      new ToolInfo(new Pencil(), 'Pencil'),
      new ToolInfo(new Eraser(), 'Eraser'),
      new ToolInfo(new BucketFill(), 'Bucket Fill')
    ];
    this.pointer = new Pointer();

    this.container = document.getElementById('tools');
    this.#setUpTools();
    this.chosen = this.toolsInfo[0];
  }

  refresh({ canvas }) {
    this.#setChosen(this.chosen, canvas);
    this.buttons.enableButtons(canvas);
    this.#setUpPointer(canvas);
  }

  #setUpTools() {
    this.toolsInfo.forEach((toolInfo) => {
      this.container.appendChild(toolInfo.element);
      this.buttons.addButton(toolInfo.element.id, (canvas) => {
        this.#setChosen(toolInfo, canvas);
      });
    });
  }

  #setChosen(toolInfo, canvas) {
    if (this.chosen) {
      this.chosen.tool.disable();
      this.chosen.disable();
    }
    this.chosen = toolInfo;
    this.chosen.tool.link(canvas);
    this.chosen.enable();
  }

  #setUpPointer(canvas) {
    this.pointer.link(canvas);
  }
}

export class ZoomButtonsManager extends UiElement {
  constructor(renderer) {
    super();
    this.buttons.addButton('zoom-in', () => renderer.zoomIn());
    this.buttons.addButton('zoom-out', () => renderer.zoomOut());
  }

  refresh() {
    this.buttons.enableButtons();
  }
}

export class ShortcutsMenu extends UiElement {
  constructor(manager) {
    super();
    this.manager = manager;
    this.modal = new Modal('shortcuts-modal');
    this.classList = ['white-panel', 'label-panel', 'text-ordinary'];
    this.#setUpButton();
    this.#setUpShortcuts();
  }

  #setUpShortcuts() {
    const container = document.getElementById('shortcuts-table');
    const shortcuts = this.manager.shortcuts;
    for (const [keybinding, shortcut] of shortcuts) {
      const name = this.#getNameElement(shortcut);
      const bindingElement = this.#getBindingElement(keybinding);
      container.appendChild(name);
      container.appendChild(bindingElement);
    }
  }

  #getNameElement(shortcut) {
    const name = document.createElement('div');
    name.classList.add(...this.classList);
    name.innerText = shortcut.name;
    return name;
  }

  #getBindingElement(keybinding) {
    const bindingElement = document.createElement('div');
    bindingElement.classList.add(...this.classList);
    bindingElement.innerText = keybinding;
    return bindingElement;
  }

  #setUpButton() {
    const button = document.getElementById('shortcuts');
    button.onclick = () => {
      this.modal.show();
    };
  }
}

class RangePopup {
  constructor(min, max, name) {
    this.name = name;
    this.#setUpInput(min, max);
    this.#setUpElement();
  }

  #setUpInput(min, max) {
    this.input = document.createElement('input');
    this.input.type = 'range';
    this.input.min = min;
    this.input.max = max;
  }

  #setUpElement() {
    const id = `${this.name.toLowerCase()}-range`;
    this.element = document.createElement('div');
    this.element.id = id;
    this.element.classList.add('range-popup');
    this.nameElement = getTextElement(this.#getText(this.input.value));
    this.element.appendChild(this.nameElement);
    this.element.appendChild(this.input);
  }

  enable(x, y, setValue) {
    const offset = 15;
    this.element.style.display = SHOW_DISPLAY;
    document.body.appendChild(this.element);

    const rect = this.element.getBoundingClientRect();
    const left = x - rect.width + offset;
    const top = y - rect.height + offset;
    this.element.style.position = 'absolute';
    this.element.style.left = left + 'px';
    this.element.style.top = top + 'px';

    this.element.onmouseleave = () => this.disable();
    this.input.oninput = () => {
      const value = this.input.value;
      this.nameElement.innerText = this.#getText(value);
      setValue(value);
    };
  }

  updateValue(value) {
    this.input.value = value;
    this.nameElement.innerText = this.#getText(value);
  }

  disable() {
    this.element.style.display = HIDE_DISPLAY;
    this.element.onmouseout = undefined;
    document.body.removeChild(this.element);
  }

  #getText(value) {
    return `${this.name}: ${value}`;
  }
}

const MIN_DURATION = 100;
const MAX_DURATION = 1000;
const popupDuration = new RangePopup(MIN_DURATION, MAX_DURATION, 'Duration');

export class FrameBox {
  constructor(file, frameIndex) {
    this.file = file;
    this.frame = file.frames[frameIndex];
    this.frameIndex = frameIndex;
    this.element = this.#createElement();
    this.#setUpElementClasses();
    this.#appendFrameImage();
    this.#appendFrameLabel();
  }

  #createElement() {
    const element = document.createElement('div');
    element.onclick = () => {
      this.file.switchFrame(this.frame.id);
    };
    return element;
  }

  #setUpElementClasses() {
    this.element.classList.add('entity');
    if (this.frame.id === this.file.currentId) {
      this.element.classList.add('entity-selected');
    }
  }

  #appendFrameLabel() {
    const container = document.createElement('div');
    container.classList.add('entity-label');
    const name = getTextElement('Frame ' + this.frame.id);
    container.appendChild(name);
    container.appendChild(this.#getDurationElement());
    this.element.appendChild(container);
  }

  #getDurationElement() {
    const duration = document.createElement('div');
    duration.classList.add('frame-duration');
    const image = document.createElement('img');
    const text = document.createElement('div');
    text.innerText = `${this.frame.duration}ms`;
    duration.appendChild(image);
    duration.appendChild(text);

    const setValue = (value) => {
      this.frame.duration = parseInt(value);
    };
    duration.onclick = (event) => {
      popupDuration.enable(event.clientX, event.clientY, setValue);
      popupDuration.updateValue(this.frame.duration);
    };

    return duration;
  }

  #appendFrameImage() {
    const image = document.createElement('div');
    image.classList.add('entity-image');

    const url = this.#getFrameImageUrl();
    conv.setImageUrl(image, url);

    this.element.appendChild(image);
  }

  #getFrameImageUrl() {
    const image = this.frame.canvas.getJoinedImage();
    //Render image with transparency
    const encoder = new BmpEncoder(BmpVersions.BMP_32);
    const data = encoder.encode(image);
    return encoder.isLastEncodedTransparent() ? '' : conv.bytesToUrl(data);
  }
}

class FrameMenu extends UiElement {
  constructor() {
    super();
    this.#setUpButtons();
    this.label = document.getElementById('show-frames');
  }

  #setUpButtons() {
    this.buttons.addButton('add-entity', (file) => file.appendFrame());
    this.buttons.addButton('duplicate-entity', (file) => {
      file.duplicateFrame(file.currentId);
    });
    this.buttons.addButton('move-entity-up', (file) => {
      file.moveFrameUp(file.currentId);
    });
    this.buttons.addButton('move-entity-down', (file) => {
      file.moveFrameDown(file.currentId);
    });
    this.buttons.addButton('remove-entity', (file) => {
      file.removeFrame(file.currentId);
    });
    this.buttons.addButton('merge-entities', () => {
      throw Error('Merge operation is not implemented for frames');
    });
  }

  #setUpOpacity() {
    this.overlayElement = document.getElementById('canvas-overlay');
    this.opacity.onclick = (event) => {
      event.stopPropagation();
    };
    this.opacity.oninput = () => {
      this.overlayElement.style.opacity = this.opacity.value;
    };
  }

  refresh(file) {
    this.buttons.enableButtons(file);
    FrameMenu.#updateFrames(file);
    file.canvas.listenToUpdates(() => FrameMenu.#updateFrames(file));
    this.#refreshLabel(file);
  }

  static #updateFrames(file) {
    const list = document.getElementById('entity-list');
    list.innerHTML = '';

    //Iterate the list in reversed order
    for (let i = file.frames.length - 1; i >= 0; i--) {
      const frameBox = new FrameBox(file, i);
      list.appendChild(frameBox.element);
    }
  }

  #refreshLabel(file) {
    const baseLabel = 'Frames';
    const frames = file.frames;

    if (frames.length <= 1) {
      this.label.innerText = baseLabel;
      return;
    }

    const currentPos = frames.getIndex(file.currentId) + 1;
    this.label.innerText = baseLabel + ` (${currentPos}/${frames.length})`;
  }
}

const MIN_OPACITY = 0;
const MAX_OPACITY = 255;
const popupOpacity = new RangePopup(MIN_OPACITY, MAX_OPACITY, 'Opacity');

class LayerBox {
  static #imageCache = new Map();

  constructor(canvas, layerIndex) {
    this.canvas = canvas;
    this.layer = canvas.layers[layerIndex];
    this.element = this.#createElement();
    this.#setUpElementClasses();
    this.#appendLayerImage();
    this.#appendLayerName();
    this.#appendVisibilityButton();
  }

  #createElement() {
    const element = document.createElement('div');
    element.onclick = () => {
      this.canvas.switchLayer(this.layer.id);
    };
    return element;
  }

  #setUpElementClasses() {
    this.element.classList.add('entity');
    if (this.layer.id === this.canvas.drawnId) {
      this.element.classList.add('entity-selected');
    }
  }

  #appendLayerName() {
    const name = getTextElement(this.layer.name);
    name.classList.add('entity-name');
    this.element.appendChild(name);
  }

  #appendVisibilityButton() {
    this.visibilityButton = document.createElement('div');
    this.#setVisibility(this.visibilityButton);
    const setValue = (value) => {
      this.layer.opacity = parseInt(value) / MAX_OPACITY;
      this.canvas.redraw();
      this.#setVisibility(this.visibilityButton);
    };
    this.visibilityButton.onclick = (event) => {
      popupOpacity.enable(event.clientX, event.clientY, setValue);
      popupOpacity.updateValue(this.layer.opacity * MAX_OPACITY);
    };
    this.element.appendChild(this.visibilityButton);
  }

  #setVisibility(button) {
    button.classList.remove(...button.classList);
    button.classList.add('visibility-button');
    if (this.layer.opacity <= 0) {
      button.classList.add('visibility-button-inactive');
    }
  }

  #appendLayerImage() {
    const image = document.createElement('div');
    image.classList.add('entity-image');

    const url = this.#getLayerImageUrl();
    LayerBox.#imageCache.set(this.layer, url);
    conv.setImageUrl(image, url);

    this.element.appendChild(image);
  }

  #getLayerImageUrl() {
    const layer = this.layer;
    const isLayerDrawnOn = this.canvas.drawnId === layer.id;
    const isCached = LayerBox.#imageCache.has(layer);
    if (!isLayerDrawnOn) {
      if (isCached) {
        return LayerBox.#imageCache.get(layer);
      }
    } else if (!isCached) {
      LayerBox.#imageCache.clear();
    }

    const imagePosition = [0, 0];
    const { width, height } = layer;
    const image = layer.context.getImageData(...imagePosition, width, height);

    //Render image with transparency
    const encoder = new BmpEncoder(BmpVersions.BMP_32);
    const data = encoder.encode(image);
    return encoder.isLastEncodedTransparent() ? '' : conv.bytesToUrl(data);
  }
}

class LayerMenu extends UiElement {
  constructor() {
    super();
    this.#setUpButtons();
    this.container = document.getElementById('entity-list');
  }

  #setUpButtons() {
    this.buttons.addButton('add-entity', (canvas) => {
      LayerMenu.#addLayer(canvas);
    });
    this.buttons.addButton('remove-entity', (canvas) => {
      LayerMenu.#removeLayer(canvas);
    });
    this.buttons.addButton('move-entity-up', (canvas) => {
      LayerMenu.#moveLayerUp(canvas);
    });
    this.buttons.addButton('move-entity-down', (canvas) => {
      LayerMenu.#moveLayerDown(canvas);
    });
    this.buttons.addButton('merge-entities', (canvas) => {
      LayerMenu.#mergeLayers(canvas);
    });
    this.buttons.addButton('duplicate-entity', (canvas) => {
      LayerMenu.#duplicateLayer(canvas);
    });
  }

  refresh({ canvas }) {
    this.buttons.enableButtons(canvas);
    this.#updateLayers(canvas);
    this.#setFixationListener(canvas);
  }

  #updateLayers(canvas) {
    const layerBoxes = [];
    //Iterate the list in reversed order
    for (let i = canvas.layers.length - 1; i >= 0; i--) {
      const layerBox = new LayerBox(canvas, i);
      layerBoxes.push(layerBox.element);
    }

    this.container.innerHTML = '';

    layerBoxes.forEach((box) => this.container.appendChild(box));
  }

  #setFixationListener(canvas) {
    canvas.listenToUpdates(() => this.#updateLayers(canvas));
  }

  static #addLayer(canvas) {
    canvas.appendLayer();
  }

  static #removeLayer(canvas) {
    const removedId = canvas.drawnId;
    canvas.removeLayer(removedId);
  }

  static #moveLayerUp(canvas) {
    const movedId = canvas.drawnId;
    canvas.moveLayerUp(movedId);
  }

  static #moveLayerDown(canvas) {
    const movedId = canvas.drawnId;
    canvas.moveLayerDown(movedId);
  }

  static #mergeLayers(canvas) {
    const mergedId = canvas.drawnId;
    const currentIndex = canvas.layers.getIndex(mergedId);
    const bottomLayer = canvas.layers[currentIndex - 1];
    canvas.mergeLayers(mergedId, bottomLayer.id);
  }

  static #duplicateLayer(canvas) {
    const duplicatedId = canvas.drawnId;
    canvas.duplicateLayer(duplicatedId);
  }
}

const LAYERS_ID = 'show-layers';
const FRAMES_ID = 'show-frames';

export class EntityChooser extends UiElement {
  constructor() {
    super();
    this.#setUpButtons();
  }

  refresh(file) {
    this.buttons.enableButtons();
    this.file = file;
    if (!this.chosen || this.chosen === LAYERS_ID) {
      this.#showLayers();
    } else {
      this.#showFrames();
    }
  }

  #setUpButtons() {
    this.buttons.addButton(LAYERS_ID, () => {
      this.#showLayers();
    });
    this.buttons.addButton(FRAMES_ID, () => {
      this.#showFrames();
    });
  }

  #showLayers() {
    const menu = new LayerMenu();
    menu.refresh(this.file);
    EntityChooser.#changeActive(FRAMES_ID, LAYERS_ID);
    this.chosen = LAYERS_ID;
  }

  #showFrames() {
    const menu = new FrameMenu();
    menu.refresh(this.file);
    EntityChooser.#changeActive(LAYERS_ID, FRAMES_ID);
    this.chosen = FRAMES_ID;
  }

  static #changeActive(previousId, currentId) {
    const activeId = 'entity-chosen';
    document.getElementById(previousId).classList.remove(activeId);
    document.getElementById(currentId).classList.add(activeId);
  }
}

export class Preview extends UiElement {
  #savedFrames;

  constructor() {
    super();
    this.#setUpButtons();
    this.#setUpElements();
    this.encoder = new BmpEncoder(BmpVersions.BMP_32);
    this.playing = false;
  }

  #setUpButtons() {
    this.buttons.addButton('preview-menu', (file) => this.#preview(file));
  }

  #setUpElements() {
    this.background = document.getElementById('canvas-background');
    this.container = document.getElementById('preview');
  }

  refresh(file) {
    this.buttons.enableButtons(file);
  }

  #preview(file) {
    if (!this.playing) this.#play(file);
    else this.#stop();
  }

  #play(file) {
    this.#showPreviewElement();
    this.playing = true;
    this.timeouts = [];

    const changeImage = this.#getImageChanger(file.frames);
    changeImage();
  }

  #getImageChanger(frames) {
    let index = 0;
    this.#savedFrames = new Map();

    const changeImage = () => {
      if (!this.playing) {
        return;
      }

      const frame = frames[index];
      this.#setImage(this.#getImageData(frame));
      this.timeouts.push(window.setTimeout(changeImage, frame.duration));
      index++;
      if (index >= frames.length) {
        index = 0;
      }
    };
    return changeImage;
  }

  #getImageData(frame) {
    let data;
    if (this.#savedFrames.has(frame.id)) {
      data = this.#savedFrames.get(frame.id);
    } else {
      const image = frame.canvas.getJoinedImage();
      const encoded = this.encoder.encode(image);
      const isFullyTransparent = this.encoder.isLastEncodedTransparent();
      data = isFullyTransparent ? null : conv.bytesToBase64(encoded);
    }
    return data;
  }

  #stop() {
    this.playing = false;
    this.#setImage(null);
    this.#hidePreviewElement();
    this.timeouts.forEach((id) => window.clearTimeout(id));
  }

  #setImage(url) {
    if (url) {
      conv.setImageBase64(this.container, url);
    } else {
      this.container.style.backgroundImage = '';
    }
  }

  #showPreviewElement() {
    this.container.style.display = SHOW_DISPLAY;
    const frontIndex = 2;
    this.background.style.zIndex = frontIndex.toString();
  }

  #hidePreviewElement() {
    this.container.style.display = HIDE_DISPLAY;
    const backIndex = 0;
    this.background.style.zIndex = backIndex.toString();
  }
}

export class ColorPicker {
  constructor() {
    this.picker = document.getElementById('picker-input');
    this.picker.oninput = () => {
      Tool.color = Color.fromHex(this.picker.value);
    };
  }
}

function getTextElement(text) {
  const textElement = document.createElement('span');
  textElement.innerText = text;
  textElement.classList.add('text');
  return textElement;
}
