import { useQuery } from "@tanstack/react-query";

// Approved, versioned files are generated independently of the card database.
// Keep an emergency *build-time* switch, not a user-facing preview control.
const CUTOUTS_ENABLED = import.meta.env.VITE_DISABLE_CARD_CUTOUTS !== "true";
type CutoutManifest = { version: number; players: Record<string, unknown> };

/**
 * The entire app shares ONE cached manifest request, regardless of how many
 * cards are visible. Missing or rejected cutouts are never requested: callers
 * continue through their existing official-photo fallback candidates.
 */
export function useApprovedCutoutPortrait(apiFootballId: number | null | undefined): string | null {
  const id = Number(apiFootballId || 0);
  const valid = Number.isSafeInteger(id) && id > 0;
  const { data } = useQuery<CutoutManifest>({
    queryKey: ["/portraits/cutouts/manifest.json"],
    queryFn: async () => {
      const response = await fetch("/portraits/cutouts/manifest.json", { cache: "no-cache" });
      if (!response.ok) throw new Error("Approved cutout manifest unavailable");
      const manifest = await response.json() as CutoutManifest;
      if (!manifest || typeof manifest.players !== "object" || !manifest.players) {
        throw new Error("Invalid approved cutout manifest");
      }
      return manifest;
    },
    enabled: CUTOUTS_ENABLED && valid,
    staleTime: 10 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  return CUTOUTS_ENABLED && valid && Object.prototype.hasOwnProperty.call(data?.players || {}, String(id))
    ? `/portraits/cutouts/${id}.webp`
    : null;
}
