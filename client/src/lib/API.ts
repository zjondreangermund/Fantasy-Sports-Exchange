import { toApiUrl } from "./api-base";

export async function fetchEplPlayers(params: URLSearchParams) {
  const res = await fetch(toApiUrl(`/api/epl/players?${params.toString()}`));
  if (!res.ok) throw new Error("Failed to load players");

  const data = await res.json();

  return Array.isArray(data)
    ? data
    : Array.isArray(data?.response)
      ? data.response
      : [];
}
