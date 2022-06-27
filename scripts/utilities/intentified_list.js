const mixin = {
  byIdentifier,
  getIndex,
  remove,
  getReorderedList,
};

function IdentifiedList(array = []) {
  Object.assign(array, mixin);
  return array;
}

function byIdentifier(id) {
  const element = this.find((element) => element.id === id);
  if (!element) {
    throw Error(`There is no element with id ${id}`);
  }
  return element;
}

function getReorderedList(id, position) {
  if (position < 0 || position >= this.length) {
    throw Error('Cannot reorder element: position is out of bounds');
  }
  const newList = this.remove(id);
  const element = this.byIdentifier(id);

  if (position >= this.length) {
    newList.push(element);
  } else {
    //We insert the element at certain index, deleting 0 items
    newList.splice(position, 0, element);
  }

  return newList;
}

function getIndex(id) {
  return this.findIndex((element) => element.id === id);
}

function remove(id) {
  const filteredArray = this.filter((element) => element.id !== id);
  return new IdentifiedList(filteredArray);
}

export { IdentifiedList };
