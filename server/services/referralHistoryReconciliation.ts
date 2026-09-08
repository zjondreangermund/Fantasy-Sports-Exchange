import { sql } from "drizzle-orm";
import { db } from "../db.js";

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

// These three requests are the confirmed 7 Sep production referral failures.
// In each case the old endpoint minted Michael's Common reward first and then
// failed while inserting app.referrals because the legacy table did not yet
// have referral_code. The first two rewards remained in live tournament use;
// the third was later quarantined by the duplicate-leak repair and is restored
// only when that exact repair audit record proves provenance.
const HISTORICAL_REFERRAL_RECONCILIATION_V1 = true;
const TARGET_EMAIL = "michaelmentile2475@gmail.com";
const EVENTS = [
  { at: new Date("2026-09-07T09:58:31.046Z"), cardId: 367185 },
  { at: new Date("2026-09-07T11:20:28.421Z"), cardId: 367187 },
  { at: new Date("2026-09-07T13:23:01.799Z"), cardId: 367188 },
] as const;

let reconcilePromise: Promise<ReferralReconciliationSummary> | null = null;

type ReferralReconciliationSummary = {
  linked: number[];
  restoredCards: number[];
  alreadyLinked: number[];
  ambiguousEvents: number[];
  conflicts: Array<{ cardId: number; reason: string }>;
};

async function reconcileOnce(): Promise<ReferralReconciliationSummary> {
  const summary: ReferralReconciliationSummary = {
    linked: [],
    restoredCards: [],
    alreadyLinked: [],
    ambiguousEvents: [],
    conflicts: [],
  };

  return db.transaction(async (tx: any) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('fantasy-arena:referral-history-reconciliation-v1'))`);

    // Converge every existing referral row first. This repairs rows where one
    // side of the durable attribution survived an older schema/version without
    // inventing a referrer: a code must resolve through app.referral_codes.
    await tx.execute(sql`
      update app.referrals r
      set referrer_user_id = rc.user_id
      from app.referral_codes rc
      where r.referrer_user_id is null
        and nullif(btrim(r.referral_code), '') is not null
        and upper(btrim(r.referral_code)) = upper(btrim(rc.code))
    `);
    await tx.execute(sql`
      update app.referrals r
      set referral_code = rc.code
      from app.referral_codes rc
      where r.referrer_user_id = rc.user_id
        and nullif(btrim(r.referral_code), '') is null
    `);

    const target = rowsOf(await tx.execute(sql`
      select id::text as id, email
      from app.users
      where lower(coalesce(email, '')) = ${TARGET_EMAIL}
      limit 1
    `))[0];
    if (!target?.id) {
      console.log(`REFERRAL_HISTORY_RECONCILE target=${TARGET_EMAIL} status=target-missing`);
      return summary;
    }
    const referrerUserId = String(target.id);

    const codeRow = rowsOf(await tx.execute(sql`
      select code from app.referral_codes where user_id=${referrerUserId} limit 1
    `))[0];
    const referralCode = String(codeRow?.code || "").trim();
    if (!referralCode) {
      console.log(`REFERRAL_HISTORY_RECONCILE target=${TARGET_EMAIL} status=code-missing`);
      return summary;
    }

    for (const event of EVENTS) {
      const eventStart = new Date(event.at.getTime() - 2_000);
      const eventEnd = new Date(event.at.getTime() + 2_000);

      const existingByCard = rowsOf(await tx.execute(sql`
        select id, referrer_user_id as "referrerUserId", referred_user_id as "referredUserId"
        from app.referrals
        where reward_card_id=${event.cardId}
        limit 1
      `))[0];
      if (existingByCard?.id) {
        if (String(existingByCard.referrerUserId || "") === referrerUserId) {
          summary.alreadyLinked.push(event.cardId);
        } else {
          summary.conflicts.push({ cardId: event.cardId, reason: "reward-card-linked-to-another-referrer" });
        }
        continue;
      }

      // The failed claim request itself was not persisted, but the same
      // authenticated browser posted client.route_view immediately before it.
      // Only a single user in this two-second evidence window is accepted.
      const candidates = rowsOf(await tx.execute(sql`
        select al.user_id::text as "userId",
          min(abs(extract(epoch from (al.created_at - ${event.at}))))::float as "distanceSeconds"
        from app.audit_logs al
        where al.action='client.route_view'
          and al.user_id is not null
          and al.user_id <> ${referrerUserId}
          and al.created_at between ${eventStart} and ${eventEnd}
        group by al.user_id
        order by "distanceSeconds" asc
      `));

      const uniqueCandidates = candidates.filter((row: any) => String(row.userId || "").trim());
      if (uniqueCandidates.length !== 1) {
        summary.ambiguousEvents.push(event.cardId);
        console.warn(`REFERRAL_HISTORY_RECONCILE_AMBIGUOUS card=${event.cardId} candidates=${uniqueCandidates.length}`);
        continue;
      }
      const referredUserId = String(uniqueCandidates[0].userId);

      const existingForUser = rowsOf(await tx.execute(sql`
        select id, referrer_user_id as "referrerUserId", reward_card_id as "rewardCardId"
        from app.referrals
        where referred_user_id=${referredUserId}
        limit 1
      `))[0];
      if (existingForUser?.id) {
        if (String(existingForUser.referrerUserId || "") !== referrerUserId) {
          summary.conflicts.push({ cardId: event.cardId, reason: "referred-user-linked-to-another-referrer" });
          continue;
        }
        await tx.execute(sql`
          update app.referrals
          set referral_code=coalesce(nullif(referral_code, ''), ${referralCode}),
              reward_card_id=coalesce(reward_card_id, ${event.cardId}),
              status=case when reward_card_id is null then 'rewarded_reconciled' else status end
          where id=${Number(existingForUser.id)}
        `);
        summary.alreadyLinked.push(event.cardId);
        continue;
      }

      const card = rowsOf(await tx.execute(sql`
        select id, owner_id as "ownerId", acquired_at as "acquiredAt"
        from app.player_cards
        where id=${event.cardId}
        limit 1
        for update
      `))[0];
      if (!card?.id) {
        summary.conflicts.push({ cardId: event.cardId, reason: "historical-reward-card-missing" });
        continue;
      }
      const acquiredMs = new Date(card.acquiredAt).getTime();
      if (!Number.isFinite(acquiredMs) || Math.abs(acquiredMs - event.at.getTime()) > 15_000) {
        summary.conflicts.push({ cardId: event.cardId, reason: "historical-reward-timestamp-mismatch" });
        continue;
      }

      const currentOwnerId = String(card.ownerId || "");
      if (!currentOwnerId) {
        const repairAudit = rowsOf(await tx.execute(sql`
          select id from app.audit_logs
          where user_id=${referrerUserId}
            and action='admin.failed_referral_card_leak_repaired'
            and meta->>'cardId'=${String(event.cardId)}
          order by id desc
          limit 1
        `))[0];
        if (!repairAudit?.id) {
          summary.conflicts.push({ cardId: event.cardId, reason: "unowned-card-without-repair-proof" });
          continue;
        }
        await tx.execute(sql`
          update app.player_cards
          set owner_id=${referrerUserId}, for_sale=false, price=0
          where id=${event.cardId} and owner_id is null
        `);
        summary.restoredCards.push(event.cardId);
      } else if (currentOwnerId !== referrerUserId) {
        summary.conflicts.push({ cardId: event.cardId, reason: "historical-reward-owned-by-another-user" });
        continue;
      }

      await tx.execute(sql`
        insert into app.referrals
          (referrer_user_id, referred_user_id, referral_code, reward_card_id, status, created_at)
        values
          (${referrerUserId}, ${referredUserId}, ${referralCode}, ${event.cardId}, 'rewarded_reconciled', ${event.at})
      `);
      await tx.execute(sql`
        insert into app.audit_logs (user_id, action, meta)
        values (${referrerUserId}, 'admin.referral_history_reconciled', ${JSON.stringify({
          referredUserId,
          referralCode,
          rewardCardId: event.cardId,
          failedClaimAt: event.at.toISOString(),
          evidence: "failed-claim timestamp + target reward card + unique authenticated route-view session",
        })}::jsonb)
      `);
      summary.linked.push(event.cardId);
    }

    const total = rowsOf(await tx.execute(sql`
      select count(*)::int as count
      from app.referrals
      where referrer_user_id=${referrerUserId}
    `))[0];
    console.log(
      `REFERRAL_HISTORY_RECONCILE target=${TARGET_EMAIL}`
      + ` linked=${summary.linked.join(',') || 'none'}`
      + ` restored=${summary.restoredCards.join(',') || 'none'}`
      + ` already=${summary.alreadyLinked.join(',') || 'none'}`
      + ` ambiguous=${summary.ambiguousEvents.join(',') || 'none'}`
      + ` conflicts=${summary.conflicts.length}`
      + ` totalReferrals=${Number(total?.count || 0)}`,
    );

    return summary;
  });
}

export async function reconcileReferralHistory(): Promise<ReferralReconciliationSummary> {
  if (!HISTORICAL_REFERRAL_RECONCILIATION_V1) {
    return { linked: [], restoredCards: [], alreadyLinked: [], ambiguousEvents: [], conflicts: [] };
  }
  if (!reconcilePromise) {
    reconcilePromise = reconcileOnce().catch((error) => {
      reconcilePromise = null;
      throw error;
    });
  }
  return reconcilePromise;
}
