const MAX_FEATURED_CANVAS_PER_PAGE = 1;
const MAX_SCENE_VIDEO_PER_PAGE = 1;

let featuredCanvasCount = 0;
let sceneVideoCount = 0;

function isDev() {
  return typeof import.meta !== "undefined" && Boolean((import.meta as any).env?.DEV);
}

function warnOnce(key: string, message: string) {
  if (!isDev()) return;
  const globalKey = `__fse_warned_${key}`;
  const root = globalThis as any;
  if (root[globalKey]) return;
  root[globalKey] = true;
  console.warn(message);
}

export function reserveFeaturedCanvasSlot() {
  const allowed = featuredCanvasCount < MAX_FEATURED_CANVAS_PER_PAGE;
  featuredCanvasCount += 1;

  if (!allowed) {
    warnOnce(
      "featured-canvas-budget",
      `[SceneBudget] More than ${MAX_FEATURED_CANVAS_PER_PAGE} featured canvas mounted on this page. Extra instances should fall back to flat rendering.`,
    );
  }

  return {
    allowed,
    release() {
      featuredCanvasCount = Math.max(0, featuredCanvasCount - 1);
    },
  };
}

export function reserveSceneVideoSlot() {
  const allowed = sceneVideoCount < MAX_SCENE_VIDEO_PER_PAGE;
  sceneVideoCount += 1;

  if (!allowed) {
    warnOnce(
      "scene-video-budget",
      `[SceneBudget] More than ${MAX_SCENE_VIDEO_PER_PAGE} scene video mounted on this page. Keep only one cinematic video layer per scene.`,
    );
  }

  return {
    allowed,
    release() {
      sceneVideoCount = Math.max(0, sceneVideoCount - 1);
    },
  };
}
