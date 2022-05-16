import { BmpEncoder, bmpVersions } from '../utilities/bmp_encoder.js';
import { bytesToUrl, downloadLocalUrl } from '../utilities/bytes_conversion.js';
import { BucketFill, Eraser, Pencil } from './tools.js';
import { setupColorPicker } from './canvas_renderer.js';

class StateButtons {
  constructor() {
    this.undoButton = document.getElementById('undo-button');
    this.redoButton = document.getElementById('redo-button');
  }

  refresh(file) {
    this.undoButton.onclick = () => file.canvas.undo();
    this.redoButton.onclick = () => file.canvas.redo();
  }
}

class FileMenu {
  constructor(createNewFile) {
    this.createNewFile = createNewFile; //A function passed from the context
    this.#setUpModal();
    this.#setUpButtons();
    this.#setUpExporter();
    this.#setUpCreateFinish();
  }

  refresh(file) {
    this.file = file;
  }

  #setUpModal() {
    this.modal = document.getElementById('file-create-modal');
    window.onclick = (event) => {
      if (event.target === this.modal) {
        this.#hideModal();
      }
    };
  }

  #setUpButtons() {
    const createButton = document.getElementById('file-create');
    const clearButton = document.getElementById('file-clear');
    createButton.onclick = () => this.create();
    clearButton.onclick = () => this.clear();
  }

  #setUpCreateFinish() {
    const createFinishButton = document.getElementById('file-create-finish');
    createFinishButton.onclick = () => {
      const inputWidth = document.getElementById('width-input');
      const inputHeight = document.getElementById('height-input');
      this.createNewFile(inputWidth.value, inputHeight.value);
      this.#hideModal();
    };
  }

  #setUpExporter() {
    const button = document.getElementById('export-button');
    button.onclick = () => this.exportImage();
  }

  create() {
    this.#showModal();
  }

  clear() {
    if (!this.file) throw Error('Open a file first to clear the canvas');
    this.createNewFile(this.file.width, this.file.height);
  }

  exportImage() {
    if (!this.file) throw Error('There is no image to export');
    const image = this.file.canvas.getJoinedImage();
    const encoder = new BmpEncoder(image, bmpVersions.bmp32);
    downloadLocalUrl(bytesToUrl(encoder.encode()), 'image.bmp');
  }

  #showModal() {
    this.modal.style.display = 'block';
  }

  #hideModal() {
    this.modal.style.display = 'none';
  }
}

//A wrapper class for tool which defines its display. In the future it will also include icons
class ToolInfo {
  constructor(tool, name) {
    this.tool = tool;
    this.name = name;
    this.element = this.#createElement();
  }

  #createElement() {
    const element = document.createElement('div');
    element.id = this.name.toLowerCase();
    element.classList.add('single-tool', 'label-panel', 'main-panel');
    element.appendChild(getTextElement(this.name));
    return element;
  }
}

class Toolbar {
  chosen;
  static #activeClass = 'active-tool';

  constructor() {
    this.toolsInfo = [
      new ToolInfo(new Pencil(), 'Pencil'),
      new ToolInfo(new Eraser(), 'Eraser'),
      new ToolInfo(new BucketFill(), 'Bucket Fill')
    ];
    this.container = document.getElementById('tools');
    this.toolsInfo.forEach((toolInfo) => this.container.appendChild(toolInfo.element));
  }

  refresh(file) {
    this.file = file;
    this.#setChosen(this.toolsInfo[0]);
    this.toolsInfo.forEach((toolInfo) => {
      toolInfo.element.onclick = () => this.#setChosen(toolInfo);
    });
    this.container.appendChild(setupColorPicker(this.file.canvas)); //To be refactored
  }

  #setChosen(toolInfo) {
    if (this.chosen) {
      this.chosen.tool.disable();
      this.chosen.element.classList.remove(Toolbar.#activeClass);
    }
    this.chosen = toolInfo;
    this.chosen.tool.link(this.file.canvas);
    this.chosen.element.classList.add(Toolbar.#activeClass);
  }
}

function getTextElement(text) {
  const textElement = document.createElement('span');
  textElement.innerText = text;
  textElement.classList.add('text');
  return textElement;
}

export { StateButtons, FileMenu, Toolbar };
