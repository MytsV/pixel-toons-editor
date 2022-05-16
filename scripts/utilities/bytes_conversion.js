const bytesToBase64 = (data) => window.btoa(data.reduce((prev, curr) => prev + String.fromCharCode(curr), ''));

const bytesToUrl = (data) => {
  const blob = new Blob([data]);
  // Converting the blob into a Blob URL (a special url that points to an object in the browser's memory)
  return URL.createObjectURL(blob);
};

const downloadLocalUrl = (url, filename) => {
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);

  link.dispatchEvent(
    new MouseEvent('click', {
      view: window
    })
  );

  document.body.removeChild(link);
};

export { bytesToUrl, downloadLocalUrl, bytesToBase64 };
