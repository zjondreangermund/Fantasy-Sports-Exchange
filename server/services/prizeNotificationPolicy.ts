import { sql } from "drizzle-orm";
import { PRIZE_NOTIFICATION_START_GAMEWEEK } from "../../shared/prize-notification-policy.js";

/** Only mint/reveal prompts are retired; results, ownership and entitlements remain. */
export function obsoletePrizePromptSql() {
  return sql`exists (
    select 1 from app.competition_entries prize_entry
    join app.competitions prize_comp on prize_comp.id=prize_entry.competition_id
    where prize_entry.user_id=n.user_id
      and n.dedupe_key in (
        concat('competition:',prize_comp.id,':entry:',prize_entry.id,':free-card-claim-ready'),
        concat('competition:',prize_comp.id,':entry:',prize_entry.id,':free-card-claimed'),
        concat('competition:',prize_comp.id,':entry:',prize_entry.id,':common-cap-choice'),
        concat('competition:',prize_comp.id,':entry:',prize_entry.id,':common-cap-replaced')
      )
      and (coalesce(prize_comp.game_week,0) < ${PRIZE_NOTIFICATION_START_GAMEWEEK}
        or (n.dedupe_key like '%:free-card-claim-ready' and
          (prize_entry.prize_card_id is not null
           or prize_entry.tiebreak_meta -> 'settlement' -> 'prizeAward' ->> 'claimed' = 'true')))
  )`;
}

export async function retireQueuedPrizePrompts(executor: any, channel: "web" | "native") {
  const table = channel === "native" ? sql`app.notification_native_push_deliveries` : sql`app.notification_push_deliveries`;
  await executor.execute(sql`update ${table} delivery
    set status='failed',last_error='Obsolete prize prompt retired by GW8 policy',updated_at=now()
    from app.notifications n
    where delivery.notification_id=n.id and delivery.status in ('pending','processing')
      and ${obsoletePrizePromptSql()}`);
}
