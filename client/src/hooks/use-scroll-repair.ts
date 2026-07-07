import { useEffect } from "react";

function isElement(value: EventTarget | null): value is HTMLElement {
  return value instanceof HTMLElement;
}

function isInsideModal(target: EventTarget | null) {
  if (!isElement(target)) return false;
  return Boolean(target.closest('[role="dialog"], [data-radix-dialog-content], [data-vaul-drawer], .fixed.inset-0'));
}

function isHorizontalScroller(target: EventTarget | null) {
  if (!isElement(target)) return false;
  return Boolean(target.closest('[role="tablist"], .arena-filter-chips, .mobile-x-scroll, .stat-x-scroll, .player-stats-scroll, .admin-wide-scroll, [data-mobile-x-scroll="true"]'));
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
  root.style.overscrollBehaviorY = "contain";

  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  document.body.style.height = `${viewportHeight}px`;
}

export function useScrollRepair(routeKey?: string) {
  useEffect(() => {
    let raf = 0;
    let touchY = 0;
    let touchX = 0;
    let lastY = 0;
    let lastTime = 0;
    let velocity = 0;
    let momentum = 0;

    const stopMomentum = () => {
      if (momentum) cancelAnimationFrame(momentum);
      momentum = 0;
    };

    const scheduleRepair = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const root = getRoot();
        if (root) repairRootGeometry(root);
      });
    };

    const scrollRoot = (deltaY: number) => {
      const root = getRoot();
      if (!root || root.scrollHeight <= root.clientHeight + 1) return;
      const max = root.scrollHeight - root.clientHeight;
      root.scrollTop = Math.max(0, Math.min(max, root.scrollTop + deltaY));
    };

    const onWheel = (event: WheelEvent) => {
      const root = getRoot();
      if (!root || isInsideModal(event.target)) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if (nearestScrollableY(event.target, root, event.deltaY)) return;
      if (root.scrollHeight <= root.clientHeight + 1) return;

      event.preventDefault();
      scrollRoot(event.deltaY);
    };

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      stopMomentum();
      touchY = touch.clientY;
      touchX = touch.clientX;
      lastY = touch.clientY;
      lastTime = performance.now();
      velocity = 0;
    };

    const onTouchMove = (event: TouchEvent) => {
      const root = getRoot();
      const touch = event.touches[0];
      if (!root || !touch || isInsideModal(event.target)) return;

      const dx = touch.clientX - touchX;
      const dyFinger = touch.clientY - touchY;
      if (Math.abs(dx) > Math.abs(dyFinger) && isHorizontalScroller(event.target)) return;

      const deltaY = lastY - touch.clientY;
      if (Math.abs(deltaY) < 0.5) return;
      if (nearestScrollableY(event.target, root, deltaY)) return;
      if (root.scrollHeight <= root.clientHeight + 1) return;

      event.preventDefault();
      scrollRoot(deltaY * 1.35);

      const now = performance.now();
      const dt = Math.max(8, now - lastTime);
      velocity = (deltaY / dt) * 16.67;
      lastY = touch.clientY;
      lastTime = now;
    };

    const onTouchEnd = () => {
      let v = velocity * 1.9;
      const step = () => {
        if (Math.abs(v) < 0.25) {
          momentum = 0;
          return;
        }
        scrollRoot(v);
        v *= 0.92;
        momentum = requestAnimationFrame(step);
      };
      if (Math.abs(v) > 0.8) momentum = requestAnimationFrame(step);
    };

    scheduleRepair();
    const timeouts = [80, 250, 700, 1400].map((ms) => window.setTimeout(scheduleRepair, ms));

    window.addEventListener("resize", scheduleRepair);
    window.visualViewport?.addEventListener("resize", scheduleRepair);
    window.addEventListener("orientationchange", scheduleRepair);
    document.addEventListener("wheel", onWheel, { capture: true, passive: false });
    document.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
    document.addEventListener("touchmove", onTouchMove, { capture: true, passive: false });
    document.addEventListener("touchend", onTouchEnd, { capture: true, passive: true });
    document.addEventListener("touchcancel", stopMomentum, { capture: true, passive: true });

    return () => {
      cancelAnimationFrame(raf);
      stopMomentum();
      timeouts.forEach((id) => window.clearTimeout(id));
      window.removeEventListener("resize", scheduleRepair);
      window.visualViewport?.removeEventListener("resize", scheduleRepair);
      window.removeEventListener("orientationchange", scheduleRepair);
      document.removeEventListener("wheel", onWheel, true);
      document.removeEventListener("touchstart", onTouchStart, true);
      document.removeEventListener("touchmove", onTouchMove, true);
      document.removeEventListener("touchend", onTouchEnd, true);
      document.removeEventListener("touchcancel", stopMomentum, true);
    };
  }, [routeKey]);
}
