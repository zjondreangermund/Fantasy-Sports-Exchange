import { useQuery } from "@tanstack/react-query";

interface SorarePlayerData {
  slug: string;
  displayName: string;
  imageUrl: string | null;
  position: string;
  age: number | null;
  club: string | null;
  clubLogo: string | null;
  recentScores: number[];
}

export function useSorarePlayer(firstName: string | undefined, lastName: string | undefined) {
  const enabled = !!firstName && !!lastName && firstName.length > 1 && lastName.length > 1;

  return useQuery<SorarePlayerData>({
    queryKey: ["/api/sorare/player", firstName, lastName],
    queryFn: async () => {
      if (!firstName || !lastName) throw new Error("Missing name");
      const params = new URLSearchParams({ firstName, lastName });
      const res = await fetch(`/api/sorare/player?${params}`);
      if (!res.ok) throw new Error("Player not found");
      return res.json();
    },
    enabled,
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
}
