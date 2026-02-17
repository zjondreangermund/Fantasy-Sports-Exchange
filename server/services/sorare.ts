const SORARE_API_URL = "https://api.sorare.com/federation/graphql";

const playerCache = new Map<string, { data: SorarePlayer | null; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;
const NEGATIVE_CACHE_TTL = 6 * 60 * 60 * 1000;

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000;
let rateLimitedUntil = 0;

export interface SorarePlayer {
  slug: string;
  displayName: string;
  pictureUrl: string | null;
  avatarImageUrl: string | null;
  position: string;
  age: number | null;
  activeClub: {
    name: string;
    pictureUrl: string | null;
  } | null;
  so5Scores: Array<{ score: number }>;
}

function nameToSlug(firstName: string, lastName: string): string {
  const full = `${firstName} ${lastName}`;
  return full
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

async function throttle(): Promise<void> {
  if (Date.now() < rateLimitedUntil) {
    return;
  }
  const elapsed = Date.now() - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL) {
    await new Promise(r => setTimeout(r, MIN_REQUEST_INTERVAL - elapsed));
  }
  lastRequestTime = Date.now();
}

async function graphqlQuery(query: string, variables: Record<string, any> = {}): Promise<any> {
  if (Date.now() < rateLimitedUntil) {
    return null;
  }

  await throttle();

  try {
    const res = await fetch(SORARE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });

    if (res.status === 429) {
      rateLimitedUntil = Date.now() + 60000;
      console.warn("Sorare API rate limited, pausing for 60s");
      return null;
    }

    if (!res.ok) {
      return null;
    }

    const json = await res.json();
    if (json.errors) {
      return null;
    }

    return json.data;
  } catch (err) {
    return null;
  }
}

export async function fetchSorarePlayer(firstName: string, lastName: string): Promise<SorarePlayer | null> {
  const slug = nameToSlug(firstName, lastName);

  const cached = playerCache.get(slug);
  if (cached) {
    const ttl = cached.data ? CACHE_TTL : NEGATIVE_CACHE_TTL;
    if (Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }
  }

  if (Date.now() < rateLimitedUntil) {
    return null;
  }

  const query = `
    query GetPlayer($slug: String!) {
      football {
        player(slug: $slug) {
          slug
          displayName
          pictureUrl
          avatarImageUrl
          position
          age
          activeClub {
            name
            pictureUrl
          }
          so5Scores(last: 5) {
            score
          }
        }
      }
    }
  `;

  const data = await graphqlQuery(query, { slug });
  const player = data?.football?.player || null;

  playerCache.set(slug, { data: player, timestamp: Date.now() });
  return player;
}

export async function fetchSorarePlayersBatch(players: Array<{ firstName: string; lastName: string }>): Promise<Map<string, SorarePlayer>> {
  const results = new Map<string, SorarePlayer>();

  for (const { firstName, lastName } of players) {
    const key = `${firstName} ${lastName}`;
    const player = await fetchSorarePlayer(firstName, lastName);
    if (player) {
      results.set(key, player);
    }
  }

  return results;
}

export function getSorareImageUrl(player: SorarePlayer): string | null {
  return player.pictureUrl || player.avatarImageUrl || null;
}
