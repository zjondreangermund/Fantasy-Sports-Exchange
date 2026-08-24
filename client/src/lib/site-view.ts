export type SiteViewMode = "mobile" | "desktop";

export const SITE_VIEW_STORAGE_KEY = "fantasy_arena_site_view";
const DESKTOP_VIEWPORT_WIDTH = 1280;
const MOBILE_VIEWPORT = "width=device-width, initial-scale=1, viewport-fit=cover";

function isInstalledMobileApp(): boolean {
  if (typeof window === "undefined") return false;
  const capacitor = (window as any).Capacitor;
  const native = typeof capacitor?.isNativePlatform === "function"
    ? Boolean(capacitor.isNativePlatform())
    : Boolean(capacitor && capacitor.getPlatform?.() !== "web");
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches
    || Boolean((window.navigator as any).standalone);
  return native || standalone;
}

export function getSiteViewMode(): SiteViewMode {
  if (typeof window === "undefined") return "mobile";
  try {
    const queryMode = new URLSearchParams(window.location.search).get("view");
    if (queryMode === "desktop" || queryMode === "mobile") return queryMode;
    const stored = window.localStorage.getItem(SITE_VIEW_STORAGE_KEY);
    if (stored === "desktop" || stored === "mobile") return stored;
  } catch {
    // Storage can be unavailable in restricted WebViews; app detection still works.
  }
  return isInstalledMobileApp() ? "desktop" : "mobile";
}

export function applySiteView(mode: SiteViewMode): SiteViewMode {
  if (typeof document === "undefined") return mode;
  const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (viewport) {
    if (mode === "desktop") {
      const deviceWidth = Number(window.screen?.width || window.innerWidth || 390);
      const initialScale = Math.min(1, Math.max(0.2, deviceWidth / DESKTOP_VIEWPORT_WIDTH));
      viewport.setAttribute("content", `width=${DESKTOP_VIEWPORT_WIDTH}, initial-scale=${initialScale.toFixed(3)}, minimum-scale=0.2, maximum-scale=5, user-scalable=yes, viewport-fit=cover`);
    } else {
      viewport.setAttribute("content", MOBILE_VIEWPORT);
    }
  }

  document.documentElement.dataset.siteView = mode;
  try {
    window.localStorage.setItem(SITE_VIEW_STORAGE_KEY, mode);
  } catch {
    // A temporary view is still useful when localStorage is blocked.
  }
  window.dispatchEvent(new CustomEvent<SiteViewMode>("fantasy-arena:site-view", { detail: mode }));
  window.setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
  return mode;
}

export function initializeSiteView(): SiteViewMode {
  return applySiteView(getSiteViewMode());
}
