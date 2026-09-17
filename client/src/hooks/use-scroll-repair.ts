import { useEffect, useLayoutEffect } from "react";
import { isNativeMobileApp } from "../lib/site-view";

function getRoot() {
  return document.querySelector<HTMLElement>("[data-app-scroll-root]");
}

export function useScrollRepair(routeKey?: string) {
  useEffect(() => {
    const html = document.documentElement;

    if (isNativeMobileApp()) {
      // Android WebView variants disagree about nested overflow scrolling inside
      // a fixed 100dvh flex shell. Give the native APK one document-level scroll
      // authority instead of locking html/body and asking an inner element to
      // consume every vertical gesture.
      html.classList.remove("app-scroll-locked");
      html.classList.add("native-document-scroll");
      return () => html.classList.remove("native-document-scroll");
    }

    html.classList.add("app-scroll-locked");
    return () => html.classList.remove("app-scroll-locked");
  }, []);

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (isNativeMobileApp()) {
        document.scrollingElement?.scrollTo({ top: 0, left: 0, behavior: "auto" });
        return;
      }
      getRoot()?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [routeKey]);
}
