const bytesToBase64 = (data) => {
  const dataReduced = data.reduce((prev, curr) => {
    const encoded = String.fromCharCode(curr);
    return prev + encoded;
  }, '');
  return window.btoa(dataReduced);
};

const bytesToUrl = (data) => {
  const blob = new Blob([data]);
  //Create a special url that points to an object in the browser's memory
  return URL.createObjectURL(blob);
};

const downloadLocalUrl = (url, filename) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.dispatchEvent(new MouseEvent('click', { view: window }));
  document.body.removeChild(link);
};

const setImageUrl = (element, url) => {
  const newElement = new Image();
  newElement.onload = () => {
    element.style.backgroundImage = `url(${url})`;
  };
  newElement.src = url;
};

const setImageBase64 = (element, data) => {
  const newElement = new Image();
  const value = `data:image/bmp;base64,${data}`;
  newElement.onload = () => {
    element.style.backgroundImage = `url("${value}")`;
  };
  newElement.src = value;
};

export {
  bytesToUrl,
  downloadLocalUrl,
  bytesToBase64,
  setImageUrl,
  setImageBase64
};
