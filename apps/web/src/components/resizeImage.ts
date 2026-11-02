type Options = {
  /** The longest side, in pixels. */
  maxSide: number;
  /** Crop to a centered square, for a profile picture. */
  square?: boolean;
  quality?: number;
};

/**
 * A photo from the phone, ready to upload: small enough for the server's limit and for a bad
 * connection. Drawing it on a canvas also leaves its metadata behind, including where it was
 * taken, and bakes in its rotation.
 */
export async function resizeImage(file: Blob, options: Options): Promise<Blob> {
  const { maxSide, square = false, quality = 0.85 } = options;
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const side = Math.min(bitmap.width, bitmap.height);
  const crop = square
    ? {
        x: (bitmap.width - side) / 2,
        y: (bitmap.height - side) / 2,
        width: side,
        height: side,
      }
    : { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
  const scale = Math.min(1, maxSide / Math.max(crop.width, crop.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(crop.width * scale);
  canvas.height = Math.round(crop.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available');
  context.drawImage(
    bitmap,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not read the image'))),
      'image/jpeg',
      quality,
    );
  });
}
