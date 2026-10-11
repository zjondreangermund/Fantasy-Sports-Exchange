import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { loadApiFootballPlayerDirectory, resolveApiFootballPlayer } from "./apiFootballPlayerDirectory.js";
import { createNotificationOnce, ensureNotificationsSchema } from "./notifications.js";

let schemaPromise: Promise<void> | null = null;
const rowsOf = (result: any): any[] => Array.isArray(result?.rows) ? result.rows : [];

async function ensureBookingAlertsSchema() {
  if (!schemaPromise) schemaPromise = (async () => {
    await ensureNotificationsSchema();
    await db.execute(sql`
      create table if not exists app.player_booking_alerts (
        user_id varchar(255) not null references app.users(id),
        api_fixture_id integer not null,
        api_player_id integer not null,
        card_kind text not null check (card_kind in ('yellow','red')),
        occurrence integer not null check (occurrence > 0),
        created_at timestamptz not null default now(),
        primary key (user_id, api_fixture_id, api_player_id, card_kind, occurrence)
      )
    `);
  })().catch(error => { schemaPromise = null; throw error; });
  await schemaPromise;
}

// Counts come exclusively from freshly synchronized API-Football match stats.
// Completed-stat backfills outside the live window never generate old alerts.
export async function notifyFixtureBookings(fixtureId: number): Promise<number> {
  if (!Number.isInteger(fixtureId) || fixtureId <= 0) return 0;
  const fixture = rowsOf(await db.execute(sql`
    select api_fixture_id, round, kickoff_at, raw
    from app.api_football_fixtures
    where api_fixture_id=${fixtureId} and league_id=39
      and kickoff_at between now()-interval '3 hours' and now()
      and status_short in ('1H','HT','2H','ET','BT','P','INT','LIVE','FT','AET','PEN')
  `))[0];
  const gameWeek = Number(String(fixture?.round || "").match(/(\d+)\s*$/)?.[1] || 0);
  if (!fixture || gameWeek < 1 || gameWeek > 38) return 0;

  const stats = rowsOf(await db.execute(sql`
    select api_player_id, player_name, statistics
    from app.api_football_player_match_stats
    where api_fixture_id=${fixtureId} and synced_at > now()-interval '5 minutes'
  `));
  const booked = stats.filter(row => Number(row?.statistics?.cards?.yellow || 0) > 0 || Number(row?.statistics?.cards?.red || 0) > 0);
  if (!booked.length) return 0;
  const [directory, recipients] = await Promise.all([
    loadApiFootballPlayerDirectory(),
    db.execute(sql`
      select distinct ce.user_id as "userId", p.id, p.name, p.team, p.position
      from app.competition_entries ce
      join app.competitions c on c.id=ce.competition_id
      cross join lateral jsonb_array_elements_text(ce.lineup_card_ids) chosen(card_id)
      join app.player_cards pc on pc.id=chosen.card_id::integer
      join app.players p on p.id=pc.player_id
      join app.users u on u.id=ce.user_id
      where c.game_week=${gameWeek} and c.status::text in ('open','closed','active')
        and c.start_date <= ${fixture.kickoff_at} and c.end_date >= ${fixture.kickoff_at}
        and ce.joined_at <= now() and coalesce(u.is_banned,false)=false
    `),
  ]);
  const byApiId = new Map(booked.map(row => [Number(row.api_player_id), row]));
  await ensureBookingAlertsSchema();
  const match = fixture.raw?.teams;
  const matchLabel = match?.home?.name && match?.away?.name ? `${match.home.name} vs ${match.away.name}` : `GW${gameWeek} match`;
  let sent = 0;
  for (const recipient of rowsOf(recipients)) {
    const linked = resolveApiFootballPlayer(recipient, directory);
    const row = linked ? byApiId.get(linked.apiPlayerId) : null;
    if (!row) continue;
    for (const kind of ["yellow", "red"] as const) {
      const count = Number(row.statistics?.cards?.[kind] || 0);
      if (!Number.isInteger(count) || count < 1 || count > 2) continue;
      const playerName = String(row.player_name || linked!.name || recipient.name);
      const title = kind === "red" ? "🟥 Your player received a red card" : "🟨 Your player was booked";
      const incident = kind === "red" ? "received a red card" : count === 2 ? "received a second yellow card" : "received a yellow card";
      const message = `${playerName} ${incident} in ${matchLabel}. This player is in your submitted GW${gameWeek} lineup. Open Live Lineup to see the updated scoring breakdown.`;
      const created = await db.transaction(async tx => {
        const claim = rowsOf(await tx.execute(sql`
          insert into app.player_booking_alerts (user_id,api_fixture_id,api_player_id,card_kind,occurrence)
          values (${recipient.userId},${fixtureId},${linked!.apiPlayerId},${kind},${count})
          on conflict do nothing returning user_id
        `));
        if (!claim.length) return false;
        return Boolean(await createNotificationOnce(tx, {
          userId: String(recipient.userId), title, message,
          dedupeKey: `booking:${fixtureId}:${linked!.apiPlayerId}:${kind}:${count}`,
        }));
      });
      if (created) sent += 1;
    }
  }
  if (sent) console.info(`[booking-alerts] fixture=${fixtureId} sent=${sent}`);
  return sent;
}
