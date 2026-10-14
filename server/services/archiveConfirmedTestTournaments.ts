import { sql } from 'drizzle-orm';
import { db } from '../db.js';

// Owner identified the old tournaments as tests on 14 October 2026.
// Keep a reversible snapshot; preserve all real weekly free-cup results.
export async function archiveConfirmedTestTournaments() {
  await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(746202612)`);
    await tx.execute(sql`create table if not exists app.confirmed_test_tournament_archive (
      competition_id integer primary key, original_record jsonb not null, archived_at timestamptz not null default now()
    )`);
    const result: any = await tx.execute(sql`insert into app.confirmed_test_tournament_archive (competition_id, original_record)
      select c.id, to_jsonb(c) from app.competitions c
      where c.created_at < '2026-10-14T06:24:12Z'::timestamptz and c.name not like '[TEST]%'
      and (
        c.start_date < '2026-07-01'::timestamp
        or c.name in ('Common tournament - Game Week 38','COMMON - GAME WEEK - 31','Rare Championship - GW2','GW29 Common Prize Ladder')
        or c.name ~ '^GW[0-9]+ (Common|Rare|Unique|Epic|Legendary) Vault$'
        or (c.status::text in ('completed','cancelled') and not
          (c.status::text = 'completed' and c.name ~ '^GW[1-6] FREE Common Card Cup$'))
      ) on conflict do nothing returning competition_id`);
    // LEGACY_FUTURE_GW_QUARANTINE_V1: Only archive unused automated GW27–GW30
    // cups. Never change entered competitions, owner-created cups, manual
    // overrides, or current/future official calendar-synced free cup records.
    // The complete original row is saved in this reversible archive.
    const legacy: any = await tx.execute(sql`insert into app.confirmed_test_tournament_archive (competition_id, original_record)
      select c.id, to_jsonb(c) from app.competitions c
      where c.name ~ '^FREE Rare Card Cup - GW(27|28|29|30)
    await tx.execute(sql`update app.competitions c set name = '[TEST] ' || c.name,
      visibility = 'private', status = 'cancelled', admin_status_override = 'cancelled',
      cancellation_reason = 'Owner-confirmed old testing tournament; archived from live operation'
      where c.id in (select competition_id from app.confirmed_test_tournament_archive) and c.name not like '[TEST]%'`);
    console.log('[confirmed-test-tournaments-archived]', { count: result.rows?.length || 0, unusedLegacyFutureCups: legacy.rows?.length || 0, entriesAndManualOverridesPreserved: true });
  });
}

        and c.created_by_user_id is null
        and coalesce(c.entry_fee, 0) = 0
        and c.prize_card_rarity::text = 'rare'
        and c.admin_status_override is null
        and not exists (select 1 from app.competition_entries e where e.competition_id = c.id)
      on conflict do nothing returning competition_id`);
    await tx.execute(sql`update app.competitions c set name = '[TEST] ' || c.name,
      visibility = 'private', status = 'cancelled', admin_status_override = 'cancelled',
      cancellation_reason = 'Owner-confirmed old testing tournament; archived from live operation'
      where c.id in (select competition_id from app.confirmed_test_tournament_archive) and c.name not like '[TEST]%'`);
    console.log('[confirmed-test-tournaments-archived]', { count: result.rows?.length || 0 });
  });
}
