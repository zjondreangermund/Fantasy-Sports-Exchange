/**
 * The production card renderer performs portrait background cleanup in the browser.
 * Keep the proxy hook dependency-free so Railway can stream the original image when
 * JavaScript cleanup is unavailable or the browser falls back to the source portrait.
 */
export async function cleanPlayerPortrait(input: Buffer): Promise<Buffer> {
  return input;
}
