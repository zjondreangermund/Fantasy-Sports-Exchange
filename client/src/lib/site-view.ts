export type SiteViewMode = "mobile" | "desktop";

export const SITE_VIEW_STORAGE_KEY = "fantasy_arena_site_view";
const APP_SESSION_VIEW_STORAGE_KEY = "fantasy_arena_app_session_view";
const DESKTOP_VIEWPORT_WIDTH = 1280;
const DESKTOP_VIEWPORT = `width=${DESKTOP_VIEWPORT_WIDTH}, viewport-fit=cover, user-scalable=yes`;
const MOBILE_VIEWPORT = "width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=yes";

export function isNativeMobileApp(): boolean {
  if (typeof window === "undefined") return false;
  const capacitor = (window as any).Capacitor;
  return typeof capacitor?.isNativePlatform === "function"
    ? Boolean(capacitor.isNativePlatform())
    : Boolean(capacitor && capacitor.getPlatform?.() !== "web");
}

export function isInstalledMobileApp(): boolean {
  if (typeof window === "undefined") return false;
  const native = isNativeMobileApp();
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
    const storage = isInstalledMobileApp() ? window.sessionStorage : window.localStorage;
    const key = isInstalledMobileApp() ? APP_SESSION_VIEW_STORAGE_KEY : SITE_VIEW_STORAGE_KEY;
    const stored = storage.getItem(key);
    return stored === "desktop" || stored === "mobile" ? stored : null;
  } catch {
    return null;
  }
}

function persistSiteViewMode(mode: SiteViewMode) {
  if (typeof window === "undefined") return;
  try {
    if (isInstalledMobileApp()) {
      // Standalone web installs may keep a session-scoped override. The native
      // Fantasy Arena APK has its own mobile shell and does not expose this toggle.
      window.sessionStorage.setItem(APP_SESSION_VIEW_STORAGE_KEY, mode);
    } else {
      window.localStorage.setItem(SITE_VIEW_STORAGE_KEY, mode);
    }
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

  // The native APK is a dedicated phone experience. Force a device-width
  // viewport before React paints so stale web/PWA desktop preferences can never
  // squeeze the native interface into a 1280px desktop canvas.
  if (isNativeMobileApp()) return "mobile";

  const queryMode = querySiteViewMode();
  if (queryMode) return queryMode;

  const stored = storedSiteViewMode();
  if (stored) return stored;

  // Keep the existing standalone PWA behavior unchanged. Ordinary browsers
  // remain mobile unless Desktop view is explicitly chosen and saved.
  if (isInstalledMobileApp()) return "desktop";
  return "mobile";
}

export function applySiteView(mode: SiteViewMode): SiteViewMode {
  if (typeof document === "undefined") return mode;
  const effectiveMode: SiteViewMode = isNativeMobileApp() ? "mobile" : mode;
  const previousMode = document.documentElement.dataset.siteView as SiteViewMode | undefined;
  const isInteractiveSwitch = Boolean(previousMode && previousMode !== effectiveMode);
  const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (viewport) {
    // Never force a fractional initial-scale for desktop mode. Mobile Chromium
    // can choose the overview scale for the fixed 1280px web/PWA desktop view.
    viewport.setAttribute("content", effectiveMode === "desktop" ? DESKTOP_VIEWPORT : MOBILE_VIEWPORT);
  }

  document.documentElement.dataset.siteView = effectiveMode;
  persistSiteViewMode(effectiveMode);
  window.dispatchEvent(new CustomEvent<SiteViewMode>("fantasy-arena:site-view", { detail: effectiveMode }));

  if (isInteractiveSwitch) {
    clearQueryViewOverride();
    window.setTimeout(() => window.location.reload(), 0);
  } else {
    window.setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
  }
  return effectiveMode;
}

export function initializeSiteView(): SiteViewMode {
  return applySiteView(getSiteViewMode());
}
