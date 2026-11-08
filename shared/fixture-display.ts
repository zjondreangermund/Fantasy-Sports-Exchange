// Display policy only: never infer a final whistle from elapsed minutes.
export function fixtureMatchesTab(fixture: any, tab: string): boolean {
  const status = String(fixture?.status || "NS").toUpperCase();
  if (tab === "finished" || tab === "completed") return ["FT", "AET", "PEN"].includes(status);
  if (tab === "live") return ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"].includes(status);
  return ["NS", "TBD", "PST"].includes(status);
}
export function fixtureClock(fixture: any): string {
  const status = String(fixture?.status || "NS");
  if (!["1H", "2H", "ET", "LIVE"].includes(status)) return status;
  const minute = Number(fixture?.elapsed || 0);
  const extra = Number(fixture?.extra || 0);
  return minute > 0 ? `${minute}${extra > 0 ? `+${extra}` : ""}′` : status;
}
// Pick one complete snapshot; mixing a score and clock from different feeds is misleading.
export function newerFixture(current: any, saved: any): any {
  if (!saved) return current;
  if (!current) return saved;
  const currentAt = new Date(current.updatedAt || 0).getTime();
  const savedAt = new Date(saved.updatedAt || 0).getTime();
  return savedAt > currentAt ? saved : current;
}
