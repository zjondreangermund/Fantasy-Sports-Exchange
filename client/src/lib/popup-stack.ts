// Popup layers live outside app/page transforms. Opening a child always places
// it above the currently visible parent; closed layers are removed and reusable.
const active = new Map<HTMLElement, number>();
export const POPUP_BASE_LAYER = 10000;
export function registerPopup(node: HTMLElement, minimum = POPUP_BASE_LAYER) {
  active.delete(node);
  const layer = Math.max(POPUP_BASE_LAYER, minimum, ...[...active.values()].map(value => value + 10));
  active.set(node, layer);
  return layer;
}
export function unregisterPopup(node: HTMLElement) { active.delete(node); }
export function isTopPopup(node: HTMLElement | null) {
  if (!node) return false;
  let top: HTMLElement | undefined, layer = -1;
  for (const [element, value] of active) if (value > layer) { top = element; layer = value; }
  return !top || top === node || top.contains(node);
}
