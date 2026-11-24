export function prepareImage(
  url: string,
  createImage: () => HTMLImageElement = () => new Image()
): { ready: Promise<void>; release: () => void } {
  const image = createImage();
  let cancel: () => void = () => {};
  const ready = new Promise<void>((resolve, reject) => {
    let settled = false;
    let decoding = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      if (error) reject(error);
      else resolve();
    };
    const loaded = () => {
      if (settled || decoding) return;
      decoding = true;
      if (typeof image.decode === 'function') {
        image.decode().then(
          () => finish(),
          () => finish(new Error('Image could not be decoded'))
        );
      } else {
        finish();
      }
    };
    const timeout = setTimeout(
      () => finish(new Error('Image load timed out')),
      30000
    );
    cancel = () => finish();
    image.onload = loaded;
    image.onerror = () => finish(new Error('Image could not be loaded'));
    image.src = url;
    if (image.complete && image.naturalWidth > 0) loaded();
  });
  return {
    ready,
    release: () => {
      cancel();
      image.src = '';
    },
  };
}

export function preloadImages(
  urls: string[],
  createImage: () => HTMLImageElement = () => new Image()
): Promise<void> {
  const images = urls.map((url) => prepareImage(url, createImage));
  const release = () => images.forEach((image) => image.release());
  return Promise.all(images.map((image) => image.ready)).then(
    () => release(),
    (error) => {
      release();
      throw error;
    }
  );
}
