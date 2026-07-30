import sharp from "sharp";

const MAX_OUTPUT_SIZE = 640;

function isBorderBackground(r: number, g: number, b: number, a: number): boolean {
  if (a <= 24) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const luminance = (r * 0.2126) + (g * 0.7152) + (b * 0.0722);
  return luminance >= 218 && max - min <= 38;
}

function removeConnectedLightBackground(data: Buffer, width: number, height: number, channels: number): Buffer {
  if (channels < 4 || width <= 0 || height <= 0) return data;

  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;

  const enqueue = (index: number) => {
    if (index < 0 || index >= pixelCount || visited[index]) return;
    const offset = index * channels;
    if (!isBorderBackground(data[offset], data[offset + 1], data[offset + 2], data[offset + 3])) return;
    visited[index] = 1;
    queue[tail++] = index;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }

  for (let index = 0; index < pixelCount; index += 1) {
    if (!visited[index]) continue;
    data[index * channels + 3] = 0;
  }

  // Lightly feather the cutout edge so hair and shoulders do not look jagged.
  for (let index = 0; index < pixelCount; index += 1) {
    if (visited[index]) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    const touchesRemoved =
      (x > 0 && visited[index - 1]) ||
      (x + 1 < width && visited[index + 1]) ||
      (y > 0 && visited[index - width]) ||
      (y + 1 < height && visited[index + width]);
    if (!touchesRemoved) continue;
    const offset = index * channels;
    if (isBorderBackground(data[offset], data[offset + 1], data[offset + 2], data[offset + 3])) {
      data[offset + 3] = Math.min(data[offset + 3], 110);
    }
  }

  return data;
}

export async function cleanPlayerPortrait(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input, { failOn: "none" })
    .rotate()
    .resize({
      width: MAX_OUTPUT_SIZE,
      height: MAX_OUTPUT_SIZE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cleaned = removeConnectedLightBackground(data, info.width, info.height, info.channels);

  return sharp(cleaned, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}
