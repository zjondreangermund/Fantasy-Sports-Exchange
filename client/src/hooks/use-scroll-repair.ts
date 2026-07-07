import { useEffect } from "react";

function isElement(value: EventTarget | null): value is HTMLElement {
  return value instanceof HTMLElement;
}

function isInsideModal(target: EventTarget | null) {
  if (!isElement(target)) return false;
  return Boolean(target.closest('[role="dialog"], [data-radix-dialog-content], [data-vaul-drawer], .fixed.inset-0'));
}

function canScrollY(element: HTMLElement, deltaY: number) {
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;
  if (!/(auto|scroll|overlay)/.test(overflowY)) return false;
  if (element.scrollHeight <= element.clientHeight + 1) return false;
  if (deltaY > 0) return element.scrollTop + element.clientHeight < element.scrollHeight - 1;
  if (deltaY < 0) return element.scrollTop > 1;
  return false;
}

function nearestScrollableY(target: EventTarget | null, root: HTMLElement, deltaY: number) {
  if (!isElement(target)) return null;
  let node: HTMLElement | null = target;
  while (node && node !== document.body && node !== document.documentElement) {
    if (node !== root && canScrollY(node, deltaY)) return node;
    if (node === root) break;
    node = node.parentElement;
  }
  return null;
}

function getRoot() {
  return document.querySelector<HTMLElement>("[data-app-scroll-root]");
}

function repairRootGeometry(root: HTMLElement) {
  const header = document.querySelector<HTMLElement>("header");
  const headerHeight = header?.getBoundingClientRect().height || 0;
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const height = Math.max(240, viewportHeight - headerHeight);

  root.style.height = `${height}px`;
  root.style.maxHeight = `${height}px`;
  root.style.minHeight = "0px";
  root.style.overflowY = "auto";
  root.style.overflowX = "hidden";
  root.style.webkitOverflowScrolling = "touch";
  root.style.touchAction = "pan-y";

  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  document.body.style.height = `${viewportHeight}px`;
}

export function useScrollRepair(routeKey?: string) {
  useEffect(() => {
    let touchY = 0;
    let raf = 0;

    const scheduleRepair = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const root = getRoot();
        if (root) repairRootGeometry(root);
      });
    };

    const onWheel = (event: WheelEvent) => {
      const root = getRoot();
      if (!root || isInsideModal(event.target)) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if (nearestScrollableY(event.target, root, event.deltaY)) return;
      if (root.scrollHeight <= root.clientHeight + 1) return;

      event.preventDefault();
      root.scrollTop += event.deltaY;
    };

    const onTouchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY || 0;
    };

    const onTouchMove = (event: TouchEvent) => {
      const root = getRoot();
      if (!root || isInsideModal(event.target)) return;
      const currentY = event.touches[0]?.clientY || touchY;
      const deltaY = touchY - currentY;
      if (Math.abs(deltaY) < 2) return;
      if (nearestScrollableY(event.target, root, deltaY)) return;
      if (root.scrollHeight <= root.clientHeight + 1) return;

      event.preventDefault();
      root.scrollTop += deltaY;
      touchY = currentY;
    };

    scheduleRepair();
    const timeouts = [80, 250, 700, 1400].map((ms) => window.setTimeout(scheduleRepair, ms));

    window.addEventListener("resize", scheduleRepair);
    window.visualViewport?.addEventListener("resize", scheduleRepair);
    window.addEventListener("orientationchange", scheduleRepair);
    document.addEventListener("wheel", onWheel, { capture: true, passive: false });
    document.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
    document.addEventListener("touchmove", onTouchMove, { capture: true, passive: false });

    return () => {
      cancelAnimationFrame(raf);
      timeouts.forEach((id) => window.clearTimeout(id));
      window.removeEventListener("resize", scheduleRepair);
      window.visualViewport?.removeEventListener("resize", scheduleRepair);
      window.removeEventListener("orientationchange", scheduleRepair);
      document.removeEventListener("wheel", onWheel, true);
      document.removeEventListener("touchstart", onTouchStart, true);
      document.removeEventListener("touchmove", onTouchMove, true);
    };
  }, [routeKey]);
}
