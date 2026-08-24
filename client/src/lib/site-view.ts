export type SiteViewMode = "mobile" | "desktop";

export const SITE_VIEW_STORAGE_KEY = "fantasy_arena_site_view";
const DESKTOP_VIEWPORT_WIDTH = 1280;
const DESKTOP_VIEWPORT = `width=${DESKTOP_VIEWPORT_WIDTH}, viewport-fit=cover, user-scalable=yes`;
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

function querySiteViewMode(): SiteViewMode | null {
  if (typeof window === "undefined") return null;
  try {
    const queryMode = new URLSearchParams(window.location.search).get("view");
    return queryMode === "desktop" || queryMode === "mobile" ? queryMode : null;
  } catch {
    return null;
  }
}

function storedSiteViewMode(): SiteViewMode | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(SITE_VIEW_STORAGE_KEY);
    return stored === "desktop" || stored === "mobile" ? stored : null;
  } catch {
    return null;
  }
}

function persistSiteViewMode(mode: SiteViewMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SITE_VIEW_STORAGE_KEY, mode);
  } catch {
    // Restricted WebViews can still use the current in-memory view.
  }
}

function clearQueryViewOverride() {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("view")) return;
    url.searchParams.delete("view");
    const relative = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", relative);
  } catch {
    // A stale query override is harmless until the next normal navigation.
  }
}

export function getSiteViewMode(): SiteViewMode {
  if (typeof window === "undefined") return "mobile";
  const queryMode = querySiteViewMode();
  if (queryMode) return queryMode;
  const stored = storedSiteViewMode();
  if (stored) return stored;

  // Installed Android/iOS/PWA opens in the same full desktop layout as the PC
  // website. Ordinary mobile browsers stay mobile unless Desktop view is chosen.
  return isInstalledMobileApp() ? "desktop" : "mobile";
}

export function applySiteView(mode: SiteViewMode): SiteViewMode {
  if (typeof document === "undefined") return mode;
  const previousMode = document.documentElement.dataset.siteView as SiteViewMode | undefined;
  const isInteractiveSwitch = Boolean(previousMode && previousMode !== mode);
  const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (viewport) {
    // Never force a fractional initial-scale for desktop mode. Android WebView
    // and mobile Chromium render more sharply when they select the overview
    // scale for the fixed 1280px layout viewport, matching Desktop site mode.
    viewport.setAttribute("content", mode === "desktop" ? DESKTOP_VIEWPORT : MOBILE_VIEWPORT);
  }

  document.documentElement.dataset.siteView = mode;
  persistSiteViewMode(mode);
  window.dispatchEvent(new CustomEvent<SiteViewMode>("fantasy-arena:site-view", { detail: mode }));

  if (isInteractiveSwitch) {
    // A ?view= query used to win over the saved button choice, and dynamic
    // viewport replacement is unreliable in Android WebView. Remove the stale
    // override and reload so both Desktop -> Mobile and Mobile -> Desktop are
    // deterministic and the new viewport exists before React paints.
    clearQueryViewOverride();
    window.setTimeout(() => window.location.reload(), 0);
  } else {
    window.setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
  }
  return mode;
}

export function initializeSiteView(): SiteViewMode {
  return applySiteView(getSiteViewMode());
}
