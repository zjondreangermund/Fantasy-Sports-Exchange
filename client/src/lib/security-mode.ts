export type PublicSecurityStatus = {
  readOnly: boolean;
  adminBypass: boolean;
  authPaused: boolean;
  depositsPaused: boolean;
  withdrawalsPaused: boolean;
  marketplacePaused: boolean;
  auctionsPaused: boolean;
  message: string;
  updatedAt?: string | null;
};

const DEFAULT_STATUS: PublicSecurityStatus = {
  readOnly: false,
  adminBypass: false,
  authPaused: false,
  depositsPaused: false,
  withdrawalsPaused: false,
  marketplacePaused: false,
  auctionsPaused: false,
  message: "Fantasy Arena is temporarily restricted while the security team completes checks.",
  updatedAt: null,
};

let currentStatus: PublicSecurityStatus = DEFAULT_STATUS;
const listeners = new Set<() => void>();

export function getClientSecurityStatus(): PublicSecurityStatus {
  return currentStatus;
}

export function setClientSecurityStatus(value: Partial<PublicSecurityStatus> | null | undefined) {
  currentStatus = { ...DEFAULT_STATUS, ...(value || {}) };
  for (const listener of listeners) listener();
}

export function subscribeClientSecurityStatus(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function apiPathFromInput(input: RequestInfo | URL | string): string {
  try {
    const raw = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    const url = new URL(raw, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    return url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
  } catch {
    return String(input || "").split("?")[0];
  }
}

export function methodFromRequest(input: RequestInfo | URL | string, init?: RequestInit): string {
  if (init?.method) return String(init.method).toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) return String(input.method || "GET").toUpperCase();
  return "GET";
}

export function isReadOnlyRecoveryRequest(method: string, path: string): boolean {
  const upper = String(method || "GET").toUpperCase();
  return (upper === "PATCH" && path === "/api/admin/security")
    || path === "/api/logout"
    || path === "/api/auth/logout";
}

export function isReadOnlyPreviewRequest(method: string, path: string): boolean {
  const upper = String(method || "GET").toUpperCase();
  if (path === "/api/login" || path === "/api/auth/google" || path === "/api/auth/google/callback") return true;
  if (upper === "PATCH" && path === "/api/user/profile") return true;
  if (upper !== "POST") return false;
  return [
    "/api/onboarding/create-offer",
    "/api/onboarding/choose",
    "/api/rewards/daily-login/claim",
    "/api/referrals/claim",
  ].includes(path);
}

export function isClientStateChangingRequest(method: string, path: string): boolean {
  const upper = String(method || "GET").toUpperCase();
  if (isReadOnlyRecoveryRequest(upper, path) || isReadOnlyPreviewRequest(upper, path)) return false;
  if (!["GET", "HEAD", "OPTIONS"].includes(upper)) return true;
  return path === "/api/login" || path === "/api/auth/google" || path === "/api/auth/google/callback";
}

export function shouldClientBlockRequest(input: RequestInfo | URL | string, init?: RequestInit): boolean {
  if (!currentStatus.readOnly || currentStatus.adminBypass) return false;
  const path = apiPathFromInput(input);
  if (!path.startsWith("/api/")) return false;
  const method = methodFromRequest(input, init);
  return isClientStateChangingRequest(method, path);
}

export function createReadOnlyResponse(): Response {
  return new Response(JSON.stringify({
    code: "read_only",
    readOnly: true,
    message: currentStatus.message || "Fantasy Arena is currently in view-only mode.",
  }), {
    status: 503,
    statusText: "View Only",
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
