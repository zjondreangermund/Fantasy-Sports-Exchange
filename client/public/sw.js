const CACHE_NAME = "fantasy-site-v19-install-brand";
const APP_SHELL = [
  "/",
  "/manifest.json?v=fa-install-2026-09",
  "/brand/fantasy-arena-icon.svg?v=fa-install-2026-09",
  "/brand/fantasy-arena-logo.jpg?v=fa-install-2026-09",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const reqUrl = new URL(event.request.url);
  const isSameOrigin = reqUrl.origin === self.location.origin;

  if (reqUrl.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/") || caches.match(event.request))
    );
    return;
  }

  if (
    isSameOrigin &&
    (reqUrl.pathname.startsWith("/assets/") ||
      reqUrl.pathname.startsWith("/prizes/") ||
      reqUrl.pathname.startsWith("/brand/"))
  ) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((response) => {
          if (!response || response.status !== 200 || response.type === "opaque") {
            return response;
          }
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        }).catch(() => cached)
      );
    })
  );
});

function safeNotificationPath(value) {
  try {
    const target = new URL(String(value || "/dashboard"), self.location.origin);
    if (target.origin !== self.location.origin) return "/dashboard";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/dashboard";
  }
}

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "You have a new Fantasy Arena notification." };
  }

  const title = String(payload.title || "Fantasy Arena");
  const body = String(payload.body || "You have a new Fantasy Arena notification.");
  const url = safeNotificationPath(payload.url);
  const tag = String(payload.tag || `fantasy-arena-${Date.now()}`);
  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag,
    renotify: true,
    icon: "/brand/fantasy-arena-logo.jpg?v=fa-install-2026-09",
    badge: "/brand/fantasy-arena-logo.jpg?v=fa-install-2026-09",
    data: { url, notificationId: Number(payload.notificationId || 0) },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = safeNotificationPath(event.notification?.data?.url);
  const targetUrl = new URL(path, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      const existing = windows.find((client) => {
        try {
          return new URL(client.url).origin === self.location.origin;
        } catch {
          return false;
        }
      });
      if (existing) {
        if ("navigate" in existing) await existing.navigate(targetUrl);
        return existing.focus();
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
