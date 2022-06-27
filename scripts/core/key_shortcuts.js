/*
The decision is to link keybindings with clickable buttons by the buttons' ids.
If needed, there will be an abstraction for shortcut with fire method created,
which could include other types of shortcuts.
 */
class InterfaceShortcut {
  static #event = new Event('click');

  constructor(id) {
    this.id = id;
    this.name = this.#getName();
  }

  fire() {
    const button = document.getElementById(this.id);
    button.dispatchEvent(InterfaceShortcut.#event);
  }

  #getName() {
    const parts = this.id.split('-');
    parts[0] = InterfaceShortcut.#capitalize(parts[0]);
    return parts.reduce((prev, curr) => `${prev} ${curr}`, '');
  }

  static #capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }
}

/*
A parsed keybinding should have such format:
First - modifiers, separated by a +, in strict order:
ctrl, then shift, then alt.
Ctrl is converted to Command key on macOS.
After modifiers goes exactly ONE key.
 */
const interfaceShortcuts = {
  'ctrl+shift+f': new InterfaceShortcut('create-file'),
  'ctrl+shift+c': new InterfaceShortcut('clear-file'),
  'ctrl+shift+e': new InterfaceShortcut('export-image'),
  'p': new InterfaceShortcut('pencil'),
  'e': new InterfaceShortcut('eraser'),
  'b': new InterfaceShortcut('bucket fill'),
  '=': new InterfaceShortcut('zoom-in'),
  '-': new InterfaceShortcut('zoom-out'),
  'ctrl+z': new InterfaceShortcut('undo'),
  'ctrl+y': new InterfaceShortcut('redo'),
  'shift+a': new InterfaceShortcut('add-layer'),
  'shift+r': new InterfaceShortcut('remove-layer'),
  'shift+u': new InterfaceShortcut('move-layer-up'),
  'shift+d': new InterfaceShortcut('move-layer-down'),
  'shift+m': new InterfaceShortcut('merge-layers'),
  'shift+c': new InterfaceShortcut('duplicate-layer'),
  'shift+e': new InterfaceShortcut('rename-layer')
};

class ShortcutManager {
  constructor() {
    this.shortcuts = new Map(Object.entries(interfaceShortcuts));
  }

  enable() {
    window.onkeydown = (event) => {
      const keybinding = parseKeybinding(event).toLowerCase();
      if (this.shortcuts.has(keybinding)) {
        //We keep browser shortcuts from working
        event.preventDefault();
        const shortcut = this.shortcuts.get(keybinding);
        shortcut.fire();
      }
    };
    window.onkeypress = () => (event) => event.preventDefault();
    window.onkeyup = () => (event) => event.preventDefault();
  }
}

const modifierParsing = getModifierParsing();

//Links parameter names of event with my parsing directives
function getModifierParsing() {
  const modifierParsing = new Map();
  const isMac = navigator.platform.indexOf('Mac') > -1;

  modifierParsing.set(isMac ? 'metaKey' : 'ctrlKey', 'ctrl');
  modifierParsing.set('shiftKey', 'shift');
  modifierParsing.set('altKey', 'alt');

  return modifierParsing;
}

function parseKeybinding(event) {
  const modifiers = [];
  for (const [key, value] of modifierParsing) {
    if (event[key]) modifiers.push(value);
  }

  let modString = '';
  for (const [index, modifier] of modifiers.entries()) {
    if (index > 0) {
      modString += '+';
    }
    modString += modifier;
  }

  if (modString.length > 0) {
    return `${modString}+${event.key}`;
  }
  return event.key;
}

export { ShortcutManager };
