import { useEffect } from "react";

function getRoot() {
  return document.querySelector<HTMLElement>("[data-app-scroll-root]");
}

export function useScrollRepair(routeKey?: string) {
  useEffect(() => {
    const root = getRoot();

    document.documentElement.style.removeProperty("overflow");
    document.documentElement.style.removeProperty("height");
    document.body.style.removeProperty("overflow");
    document.body.style.removeProperty("height");

    if (root) {
      root.style.removeProperty("height");
      root.style.removeProperty("max-height");
      root.style.removeProperty("min-height");
      root.style.removeProperty("overflow-y");
      root.style.removeProperty("overflow-x");
      root.style.removeProperty("touch-action");
      root.style.removeProperty("overscroll-behavior-y");
      root.style.removeProperty("-webkit-overflow-scrolling");
      root.scrollTop = 0;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [routeKey]);
}
