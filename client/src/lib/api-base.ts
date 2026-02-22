export const API_BASE = String(import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");

export function toApiUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (!API_BASE) return url;
  if (url.startsWith("/api/")) return `${API_BASE}${url}`;
  if (url === "/api") return `${API_BASE}/api`;
  return url;
}

export function patchFetchForApiBase() {
  if (typeof window === "undefined") return;
  const marker = "__fantasyfcApiBasePatched";
  if ((window as any)[marker]) return;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string") {
      return originalFetch(toApiUrl(input), init);
    }

    if (input instanceof URL) {
      return originalFetch(input, init);
    }

    if (input instanceof Request) {
      const nextUrl = toApiUrl(input.url);
      if (nextUrl !== input.url) {
        const nextReq = new Request(nextUrl, input);
        return originalFetch(nextReq, init);
      }
    }

    return originalFetch(input, init);
  };

  (window as any)[marker] = true;
}
