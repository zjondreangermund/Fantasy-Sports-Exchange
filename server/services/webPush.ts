import webpush from "web-push";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { ensureNotificationsSchema } from "./notifications.js";

type VapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

type BrowserPushSubscription = {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function normalizeSubject(value: unknown): string {
  const subject = String(value || "").trim();
  if (/^(mailto:|https:\/\/)/i.test(subject)) return subject;
  if (subject.includes("@")) return `mailto:${subject}`;
  return "https://fantasy-sports-exchange-production-d05c.up.railway.app";
}

let vapidConfigPromise: Promise<VapidConfig> | null = null;

async function loadVapidConfig(): Promise<VapidConfig> {
  if (!vapidConfigPromise) {
    vapidConfigPromise = (async () => {
      await ensureNotificationsSchema();

      const envPublicKey = String(process.env.WEB_PUSH_VAPID_PUBLIC_KEY || "").trim();
      const envPrivateKey = String(process.env.WEB_PUSH_VAPID_PRIVATE_KEY || "").trim();
      const envSubject = normalizeSubject(process.env.WEB_PUSH_VAPID_SUBJECT || process.env.APP_URL);
      if (envPublicKey && envPrivateKey) {
        webpush.setVapidDetails(envSubject, envPublicKey, envPrivateKey);
        return { publicKey: envPublicKey, privateKey: envPrivateKey, subject: envSubject };
      }

      const config = await db.transaction(async (tx: any) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext('fantasy-arena-web-push-v1'))`);
        const existing = rowsOf(await tx.execute(sql`
          select public_key as "publicKey", private_key as "privateKey", subject
          from app.web_push_config
          where id = 1
          for update
        `))[0];
        if (existing?.publicKey && existing?.privateKey) {
          return {
            publicKey: String(existing.publicKey),
            privateKey: String(existing.privateKey),
            subject: normalizeSubject(existing.subject),
          };
        }

        const generated = webpush.generateVAPIDKeys();
        const subject = envSubject;
        await tx.execute(sql`
          insert into app.web_push_config (id, public_key, private_key, subject, created_at, updated_at)
          values (1, ${generated.publicKey}, ${generated.privateKey}, ${subject}, now(), now())
          on conflict (id) do update set
            public_key = excluded.public_key,
            private_key = excluded.private_key,
            subject = excluded.subject,
            updated_at = now()
        `);
        return { ...generated, subject };
      });

      webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
      return config;
    })().catch((error) => {
      vapidConfigPromise = null;
      throw error;
    });
  }
  return vapidConfigPromise;
}

function normalizeSubscription(input: any): BrowserPushSubscription {
  const endpoint = String(input?.endpoint || "").trim();
  const p256dh = String(input?.keys?.p256dh || "").trim();
  const auth = String(input?.keys?.auth || "").trim();
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error("A valid push subscription endpoint is required");
  }
  if (parsed.protocol !== "https:" || endpoint.length > 4096) throw new Error("A secure push subscription endpoint is required");
  if (p256dh.length < 16 || p256dh.length > 1024 || auth.length < 8 || auth.length > 512) {
    throw new Error("Valid push subscription encryption keys are required");
  }
  const rawExpiration = Number(input?.expirationTime);
  return {
    endpoint,
    expirationTime: Number.isFinite(rawExpiration) && rawExpiration > 0 ? Math.round(rawExpiration) : null,
    keys: { p256dh, auth },
  };
}

export async function getWebPushStatus(userId: string) {
  const config = await loadVapidConfig();
  const row = rowsOf(await db.execute(sql`
    select count(*)::int as count
    from app.web_push_subscriptions
    where user_id = ${userId} and disabled_at is null
  `))[0];
  return {
    configured: true,
    publicKey: config.publicKey,
    activeSubscriptions: Number(row?.count || 0),
  };
}

export async function upsertWebPushSubscription(userId: string, rawSubscription: any, userAgent?: unknown) {
  await loadVapidConfig();
  const subscription = normalizeSubscription(rawSubscription);
  const safeUserAgent = String(userAgent || "").trim().slice(0, 500) || null;
  const row = rowsOf(await db.execute(sql`
    insert into app.web_push_subscriptions (
      user_id, endpoint, p256dh, auth, expiration_time, user_agent,
      failure_count, disabled_at, created_at, updated_at
    ) values (
      ${userId}, ${subscription.endpoint}, ${subscription.keys.p256dh}, ${subscription.keys.auth},
      ${subscription.expirationTime}, ${safeUserAgent}, 0, null, now(), now()
    )
    on conflict (endpoint) do update set
      user_id = excluded.user_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      expiration_time = excluded.expiration_time,
      user_agent = excluded.user_agent,
      failure_count = 0,
      disabled_at = null,
      updated_at = now()
    returning id, endpoint, created_at as "createdAt", updated_at as "updatedAt"
  `))[0];
  if (!row?.id) throw new Error("Push subscription could not be saved");
  return row;
}

export async function disableWebPushSubscription(userId: string, endpointValue: unknown) {
  const endpoint = String(endpointValue || "").trim();
  if (!endpoint) throw new Error("Push subscription endpoint is required");
  await ensureNotificationsSchema();
  const rows = rowsOf(await db.execute(sql`
    update app.web_push_subscriptions
    set disabled_at = now(), updated_at = now()
    where user_id = ${userId} and endpoint = ${endpoint}
    returning id
  `));
  return rows.length > 0;
}

function notificationUrl(dedupeKey: unknown): string {
  const key = String(dedupeKey || "");
  if (key.startsWith("replacement-claim:")) return "/collection";
  if (key.startsWith("community-mention:")) return "/community";
  if (key.startsWith("competition:") || key.startsWith("gameweek:")) return "/my-entries";
  return "/dashboard";
}

async function claimDueDeliveries(limit: number): Promise<any[]> {
  const result = await db.execute(sql`
    with due as (
      select delivery.id
      from app.notification_push_deliveries delivery
      join app.web_push_subscriptions subscription on subscription.id = delivery.subscription_id
      where subscription.disabled_at is null
        and (
          (delivery.status = 'pending' and delivery.next_attempt_at <= now())
          or (delivery.status = 'processing' and delivery.updated_at < now() - interval '5 minutes')
        )
      order by delivery.next_attempt_at asc, delivery.id asc
      for update of delivery skip locked
      limit ${Math.max(1, Math.min(100, limit))}
    ), claimed as (
      update app.notification_push_deliveries delivery
      set status = 'processing', attempts = delivery.attempts + 1, updated_at = now()
      from due
      where delivery.id = due.id
      returning delivery.id, delivery.notification_id, delivery.subscription_id, delivery.attempts
    )
    select claimed.id, claimed.attempts,
      notification.id as "notificationId", notification.title, notification.message, notification.dedupe_key as "dedupeKey",
      subscription.id as "subscriptionId", subscription.endpoint, subscription.p256dh, subscription.auth
    from claimed
    join app.notifications notification on notification.id = claimed.notification_id
    join app.web_push_subscriptions subscription on subscription.id = claimed.subscription_id
  `);
  return rowsOf(result);
}

async function markDeliverySent(delivery: any) {
  await db.transaction(async (tx: any) => {
    await tx.execute(sql`
      update app.notification_push_deliveries
      set status = 'sent', sent_at = now(), last_error = null, updated_at = now()
      where id = ${Number(delivery.id)}
    `);
    await tx.execute(sql`
      update app.web_push_subscriptions
      set failure_count = 0, last_success_at = now(), updated_at = now()
      where id = ${Number(delivery.subscriptionId)}
    `);
  });
}

async function markDeliveryFailed(delivery: any, error: any) {
  const statusCode = Number(error?.statusCode || error?.status || 0);
  const invalidSubscription = statusCode === 404 || statusCode === 410;
  const attempts = Number(delivery.attempts || 1);
  const permanentlyFailed = invalidSubscription || attempts >= 5;
  const message = String(error?.body || error?.message || "Push delivery failed").slice(0, 1000);
  const retrySeconds = Math.min(3600, Math.max(30, (2 ** attempts) * 15));

  await db.transaction(async (tx: any) => {
    await tx.execute(sql`
      update app.notification_push_deliveries
      set status = ${permanentlyFailed ? "failed" : "pending"},
          next_attempt_at = case
            when ${permanentlyFailed} then now()
            else now() + (${retrySeconds} * interval '1 second')
          end,
          last_error = ${message},
          updated_at = now()
      where id = ${Number(delivery.id)}
    `);
    await tx.execute(sql`
      update app.web_push_subscriptions
      set failure_count = failure_count + 1,
          disabled_at = case when ${invalidSubscription} then now() else disabled_at end,
          updated_at = now()
      where id = ${Number(delivery.subscriptionId)}
    `);
    if (invalidSubscription) {
      await tx.execute(sql`
        update app.notification_push_deliveries
        set status = 'failed', last_error = 'Push subscription expired', updated_at = now()
        where subscription_id = ${Number(delivery.subscriptionId)} and status in ('pending', 'processing')
      `);
    }
  });
}

let processingDeliveries = false;

export async function processPendingWebPushDeliveries(limit = 25) {
  if (processingDeliveries) return { claimed: 0, sent: 0, failed: 0 };
  processingDeliveries = true;
  try {
    const config = await loadVapidConfig();
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    const deliveries = await claimDueDeliveries(limit);
    let sent = 0;
    let failed = 0;
    for (const delivery of deliveries) {
      try {
        await webpush.sendNotification({
          endpoint: String(delivery.endpoint),
          keys: { p256dh: String(delivery.p256dh), auth: String(delivery.auth) },
        }, JSON.stringify({
          title: String(delivery.title || "Fantasy Arena"),
          body: String(delivery.message || "You have a new Fantasy Arena notification."),
          url: notificationUrl(delivery.dedupeKey),
          tag: `fantasy-arena-${Number(delivery.notificationId)}`,
          notificationId: Number(delivery.notificationId),
        }), { TTL: 24 * 60 * 60, urgency: "high" });
        await markDeliverySent(delivery);
        sent += 1;
      } catch (error) {
        await markDeliveryFailed(delivery, error);
        failed += 1;
      }
    }
    return { claimed: deliveries.length, sent, failed };
  } finally {
    processingDeliveries = false;
  }
}

let workerTimer: NodeJS.Timeout | null = null;

export function startWebPushDeliveryWorker() {
  if (workerTimer) return;
  const run = () => {
    void processPendingWebPushDeliveries().catch((error) => {
      console.error("Web Push delivery worker failed:", error);
    });
  };
  const initialTimer = setTimeout(run, 2_000);
  initialTimer.unref?.();
  workerTimer = setInterval(run, 15_000);
  workerTimer.unref?.();
}
