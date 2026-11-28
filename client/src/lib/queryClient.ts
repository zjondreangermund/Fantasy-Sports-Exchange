import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { toApiUrl } from "./api-base";

export function activitySessionHeaders(): Record<string,string> {
  try { const id=sessionStorage.getItem('arena_activity_session');return id ? {'X-Arena-Session':id}:{}; } catch { return {}; }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function resolveApiUrl(url: string) {
  if (url === "/api/admin/test-console/cleanup") return "/api/admin/simulator/cleanup";
  if (url === "/api/admin/simulator/run") return "/api/admin/simulator/run-v2";
  if (/^\/api\/admin\/simulator\/tournament\/\d+\/rankings(?:\?|$)/.test(url)) {
    return url.replace("/rankings", "/rankings-v2");
  }
  return url;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(toApiUrl(resolveApiUrl(url)), {
    method,
    headers: {...activitySessionHeaders(),...(data ? { "Content-Type": "application/json" } : {})},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

// Bounded read-only requests: do not let a slow upstream leave Home loading indefinitely.
export async function readHomeJson<T=any>(url:string,signal?:AbortSignal):Promise<T>{
  const controller=new AbortController();
  const abort=()=>controller.abort();
  if(signal?.aborted)abort();
  else signal?.addEventListener("abort",abort,{once:true});
  const timer=setTimeout(abort,8000);
  try{
    const res=await fetch(toApiUrl(resolveApiUrl(url)),{credentials:"include",headers:activitySessionHeaders(),signal:controller.signal});
    await throwIfResNotOk(res);
    return await res.json();
  }finally{clearTimeout(timer);signal?.removeEventListener("abort",abort);}
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey, signal }) => {
    const rawUrl = queryKey.join("/") as string;
    const res = await fetch(toApiUrl(resolveApiUrl(rawUrl)), {
      credentials: "include",
      signal,
      headers: activitySessionHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
