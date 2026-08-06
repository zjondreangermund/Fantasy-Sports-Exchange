import {
  apiPathFromInput,
  createReadOnlyResponse,
  methodFromRequest,
  setClientSecurityStatus,
  shouldClientBlockRequest,
} from "./security-mode";

export const API_BASE = String(import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");

export function toApiUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (!API_BASE) return url;
  if (url.startsWith("/api/")) return `${API_BASE}${url}`;
  if (url === "/api") return `${API_BASE}/api`;
  return url;
}

function dispatchNotice(detail: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent("fantasy-arena-action-notice", { detail }));
}

function bodyData(init?: RequestInit) {
  if (typeof init?.body !== "string") return {};
  try {
    return JSON.parse(init.body) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function withAuctionIdempotency(path: string, method: string, init?: RequestInit) {
  if (method !== "POST" || !/^\/api\/auctions\/(?:packs\/)?\d+\/bid$/.test(path)) return init;
  const headers = new Headers(init?.headers || {});
  if (!headers.has("X-Idempotency-Key")) {
    const random = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    headers.set("X-Idempotency-Key", random);
  }
  return { ...(init || {}), headers };
}

async function inspectResponse(path: string, method: string, init: RequestInit | undefined, response: Response) {
  let payload: any = null;
  try {
    payload = await response.clone().json();
  } catch {
    payload = null;
  }

  if (path === "/api/security/status" && response.ok && payload) {
    setClientSecurityStatus(payload);
  }

  if (!response.ok) {
    const code = String(payload?.code || "");
    if (["read_only", "auctions_paused", "marketplace_paused", "deposits_paused", "withdrawals_paused"].includes(code) || response.status === 503) {
      const auctionAction = /^\/api\/auctions\//.test(path);
      dispatchNotice({
        kind: "blocked",
        code,
        title: auctionAction ? "Auction bidding is paused" : "Action temporarily paused",
        message: payload?.message || (auctionAction
          ? "Auction bids are unavailable while Read-only or Auctions paused is active in the production controls."
          : "This action is unavailable while Fantasy Arena is in production-preview mode."),
      });
    }
    return;
  }

  const requestBody = bodyData(init);
  if (method === "POST" && path === "/api/marketplace/list") {
    dispatchNotice({
      kind: "card-listed",
      price: Number(requestBody.price || 0),
      message: `Your card is now visible to Marketplace buyers at N$${Number(requestBody.price || 0).toFixed(2)}.`,
    });
  }
  if (method === "POST" && /^\/api\/auctions\/(?:packs\/)?\d+\/bid$/.test(path)) {
    dispatchNotice({
      kind: "auction-bid",
      amount: Number(requestBody.amount || 0),
    });
  }
}

export function patchFetchForApiBase() {
  if (typeof window === "undefined") return;
  const marker = "__fantasyfcApiBasePatched";
  if ((window as any)[marker]) return;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = apiPathFromInput(input);
    const method = methodFromRequest(input, init);

    if (shouldClientBlockRequest(input, init)) {
      const response = createReadOnlyResponse();
      void inspectResponse(path, method, init, response);
      return response;
    }

    const nextInit = withAuctionIdempotency(path, method, init);
    let response: Response;

    if (typeof input === "string") {
      response = await originalFetch(toApiUrl(input), nextInit);
    } else if (input instanceof URL) {
      response = await originalFetch(input, nextInit);
    } else if (input instanceof Request) {
      const nextUrl = toApiUrl(input.url);
      const nextReq = nextUrl !== input.url ? new Request(nextUrl, input) : input;
      response = await originalFetch(nextReq, nextInit);
    } else {
      response = await originalFetch(input, nextInit);
    }

    void inspectResponse(path, method, nextInit, response);
    return response;
  };

  (window as any)[marker] = true;
}
