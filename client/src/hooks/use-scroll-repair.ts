import { useEffect, useLayoutEffect } from "react";

function getRoot() {
  return document.querySelector<HTMLElement>("[data-app-scroll-root]");
}

export function useScrollRepair(routeKey?: string) {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("app-scroll-locked");
    return () => html.classList.remove("app-scroll-locked");
  }, []);

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      getRoot()?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [routeKey]);
}
