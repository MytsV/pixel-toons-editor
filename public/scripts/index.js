import { CanvasRenderer } from './core/canvas_renderer.js';
import { AnimationFile } from './core/canvas.js';
import {
  FileMenu,
  LayerMenu,
  StateButtons,
  Toolbar, ZoomButtons
} from './core/ui_elements.js';
import { Shortcuts } from './core/key_shortcuts.js';

class Application {
  constructor() {
    this.canvasRenderer = new CanvasRenderer();
    this.uiElements = [
      new StateButtons(),
      new FileMenu((width, height) => this.#setNewFile(width, height)),
      new Toolbar(),
      new LayerMenu(),
      new ZoomButtons(this.canvasRenderer)
    ];
    this.shortcuts = new Shortcuts();
  }

  #setNewFile(width, height) {
    const file = new AnimationFile(width, height);
    this.canvasRenderer.removeCanvases();
    this.canvasRenderer.appendCanvas(file.canvas);
    this.uiElements.forEach((element) => element.refresh(file));
  }

  start() {
    this.shortcuts.enable();
    window.onresize = () => this.canvasRenderer.adjustSize();
  }
}

window.onload = () => {
  const application = new Application();
  application.start();
};
