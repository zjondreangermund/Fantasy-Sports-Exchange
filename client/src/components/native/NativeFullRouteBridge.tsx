import * as React from "react";

/**
 * Native WebView navigation guard.
 *
 * Wouter route state is path-based. Query-only navigations (for example
 * /collection?nativeFull=1 or /account?tab=inbox) can therefore leave the
 * compact route mounted even though the URL changed. Inside the APK that feels
 * like a dead button. Force a same-WebView navigation whenever the destination
 * explicitly asks for the full live website route, or when only the query/hash
 * changes on the current path.
 */
export default function NativeFullRouteBridge() {
  React.useEffect(() => {
    const onClickCapture = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as Element | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      const shell = document.querySelector("[data-native-mobile-shell]");
      if (!anchor || !shell?.contains(anchor)) return;

      const rawHref = anchor.getAttribute("href") || "";
      if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      const current = new URL(window.location.href);
      const needsFullRoute = url.searchParams.get("nativeFull") === "1";
      const samePathQueryChange =
        url.pathname === current.pathname &&
        (url.search !== current.search || url.hash !== current.hash);

      if (!needsFullRoute && !samePathQueryChange) return;

      event.preventDefault();
      event.stopPropagation();
      window.location.assign(`${url.pathname}${url.search}${url.hash}`);
    };

    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, []);

  return null;
}
