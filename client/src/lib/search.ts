function searchableValues(value: unknown): string[] {
  if (value === null || value === undefined || value === false) return [];
  if (Array.isArray(value)) return value.flatMap(searchableValues);
  if (typeof value === "object") return [];
  return [String(value)];
}

export function normalizeSearchText(value: unknown): string {
  return searchableValues(value)
    .join(" ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function matchesSearch(query: string, ...values: unknown[]): boolean {
  const terms = normalizeSearchText(query).split(" ").filter(Boolean);
  if (!terms.length) return true;
  const haystack = normalizeSearchText(values.flatMap(searchableValues));
  return terms.every((term) => haystack.includes(term));
}

export function cardMatchesSearch(query: string, card: any, ...additionalValues: unknown[]): boolean {
  const player = card?.player || {};
  return matchesSearch(
    query,
    player.name,
    player.webName,
    player.web_name,
    player.firstName,
    player.first_name,
    player.lastName,
    player.last_name,
    player.team,
    player.club,
    player.position,
    player.league,
    card?.rarity,
    card?.serialId,
    card?.serial_id,
    card?.serial,
    card?.id,
    player.id,
    additionalValues,
  );
}
