import { createSign } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { ensureNotificationsSchema } from "./notifications.js";

type FirebaseCredentials = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

type AccessToken = {
  value: string;
  expiresAt: number;
};

class FcmDeliveryError extends Error {
  statusCode: number;
  responseBody: string;
  invalidToken: boolean;

  constructor(message: string, statusCode: number, responseBody: string, invalidToken: boolean) {
    super(message);
    this.name = "FcmDeliveryError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
    this.invalidToken = invalidToken;
  }
}

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function decodeServiceAccountJson(): any | null {
  const plain = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  const encoded = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 || "").trim();
  if (!plain && !encoded) return null;
  const source = plain || Buffer.from(encoded, "base64").toString("utf8");
  try {
    return JSON.parse(source);
  } catch {
    throw new Error("Firebase service-account credentials are not valid JSON");
  }
}

function firebaseCredentials(): FirebaseCredentials | null {
  const serviceAccount = decodeServiceAccountJson();
  const projectId = String(serviceAccount?.project_id || process.env.FIREBASE_PROJECT_ID || "").trim();
  const clientEmail = String(serviceAccount?.client_email || process.env.FIREBASE_CLIENT_EMAIL || "").trim();
  const privateKey = String(serviceAccount?.private_key || process.env.FIREBASE_PRIVATE_KEY || "")
    .replace(/\\n/g, "\n")
    .trim();
  if (!projectId && !clientEmail && !privateKey) return null;
  if (!projectId || !clientEmail || !privateKey.includes("BEGIN PRIVATE KEY")) {
    throw new Error("Firebase service-account credentials are incomplete");
  }
  return { projectId, clientEmail, privateKey };
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

let cachedAccessToken: AccessToken | null = null;
let accessTokenPromise: Promise<string> | null = null;

async function getFirebaseAccessToken(credentials: FirebaseCredentials): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) return cachedAccessToken.value;
  if (!accessTokenPromise) {
    accessTokenPromise = (async () => {
      const now = Math.floor(Date.now() / 1000);
      const unsigned = `${base64UrlJson({ alg: "RS256", typ: "JWT" })}.${base64UrlJson({
        iss: credentials.clientEmail,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      })}`;
      const signer = createSign("RSA-SHA256");
      signer.update(unsigned);
      signer.end();
      const assertion = `${unsigned}.${signer.sign(credentials.privateKey).toString("base64url")}`;
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion,
        }),
      });
      const body = await response.text();
      if (!response.ok) throw new Error(`Firebase authorization failed (${response.status})`);
      let parsed: any;
      try {
        parsed = JSON.parse(body);
      } catch {
        throw new Error("Firebase authorization returned an invalid response");
      }
      const value = String(parsed?.access_token || "");
      const expiresIn = Number(parsed?.expires_in || 3600);
      if (!value) throw new Error("Firebase authorization did not return an access token");
      cachedAccessToken = {
        value,
        expiresAt: Date.now() + Math.max(300, Math.min(3600, expiresIn)) * 1000,
      };
      return value;
    })().finally(() => {
      accessTokenPromise = null;
    });
  }
  return accessTokenPromise;
}

function normalizeToken(value: unknown): string {
  const token = String(value || "").trim();
  if (token.length < 20 || token.length > 4096 || /\s/.test(token)) {
    throw new Error("A valid native push token is required");
  }
  return token;
}

export async function getNativePushStatus(userId: string) {
  await ensureNotificationsSchema();
  const credentials = firebaseCredentials();
  const row = rowsOf(await db.execute(sql`
    select count(*)::int as count
    from app.native_push_subscriptions
    where user_id = ${userId} and disabled_at is null
  `))[0];
  return {
    configured: Boolean(credentials),
    activeSubscriptions: Number(row?.count || 0),
  };
}

export async function upsertNativePushSubscription(userId: string, tokenValue: unknown, platformValue: unknown) {
  await ensureNotificationsSchema();
  const token = normalizeToken(tokenValue);
  const platform = String(platformValue || "").trim().toLowerCase();
  if (platform !== "android") throw new Error("Native push is currently available for the Android app");
  const row = rowsOf(await db.execute(sql`
    insert into app.native_push_subscriptions (
      user_id, token, platform, failure_count, disabled_at, created_at, updated_at
    ) values (
      ${userId}, ${token}, ${platform}, 0, null, now(), now()
    )
    on conflict (token) do update set
      user_id = excluded.user_id,
      platform = excluded.platform,
      failure_count = 0,
      disabled_at = null,
      updated_at = now()
    returning id, platform, created_at as "createdAt", updated_at as "updatedAt"
  `))[0];
  if (!row?.id) throw new Error("Native push subscription could not be saved");
  return row;
}

export async function disableNativePushSubscription(userId: string, tokenValue: unknown) {
  await ensureNotificationsSchema();
  const token = normalizeToken(tokenValue);
  const rows = rowsOf(await db.execute(sql`
    update app.native_push_subscriptions
    set disabled_at = now(), updated_at = now()
    where user_id = ${userId} and token = ${token}
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
      from app.notification_native_push_deliveries delivery
      join app.native_push_subscriptions subscription on subscription.id = delivery.subscription_id
      where subscription.disabled_at is null
        and (
          (delivery.status = 'pending' and delivery.next_attempt_at <= now())
          or (delivery.status = 'processing' and delivery.updated_at < now() - interval '5 minutes')
        )
      order by delivery.next_attempt_at asc, delivery.id asc
      for update of delivery skip locked
      limit ${Math.max(1, Math.min(100, limit))}
    ), claimed as (
      update app.notification_native_push_deliveries delivery
      set status = 'processing', attempts = delivery.attempts + 1, updated_at = now()
      from due
      where delivery.id = due.id
      returning delivery.id, delivery.notification_id, delivery.subscription_id, delivery.attempts
    )
    select claimed.id, claimed.attempts,
      notification.id as "notificationId", notification.title, notification.message, notification.dedupe_key as "dedupeKey",
      subscription.id as "subscriptionId", subscription.token
    from claimed
    join app.notifications notification on notification.id = claimed.notification_id
    join app.native_push_subscriptions subscription on subscription.id = claimed.subscription_id
  `);
  return rowsOf(result);
}

async function sendFcmNotification(credentials: FirebaseCredentials, delivery: any) {
  const accessToken = await getFirebaseAccessToken(credentials);
  const notificationId = Number(delivery.notificationId);
  const url = notificationUrl(delivery.dedupeKey);
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(credentials.projectId)}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: String(delivery.token),
          notification: {
            title: String(delivery.title || "Fantasy Arena"),
            body: String(delivery.message || "You have a new Fantasy Arena notification."),
          },
          data: {
            url,
            notificationId: String(notificationId),
          },
          android: {
            priority: "high",
            notification: {
              channel_id: "fantasy_arena_updates",
              tag: `fantasy-arena-${notificationId}`,
              sound: "default",
            },
          },
        },
      }),
    },
  );
  const body = await response.text();
  if (response.ok) return;
  if (response.status === 401) cachedAccessToken = null;
  const invalidToken = /UNREGISTERED|registration-token-not-registered/i.test(body);
  throw new FcmDeliveryError(`Firebase delivery failed (${response.status})`, response.status, body, invalidToken);
}

async function markDeliverySent(delivery: any) {
  await db.transaction(async (tx: any) => {
    await tx.execute(sql`
      update app.notification_native_push_deliveries
      set status = 'sent', sent_at = now(), last_error = null, updated_at = now()
      where id = ${Number(delivery.id)}
    `);
    await tx.execute(sql`
      update app.native_push_subscriptions
      set failure_count = 0, last_success_at = now(), updated_at = now()
      where id = ${Number(delivery.subscriptionId)}
    `);
  });
}

async function markDeliveryFailed(delivery: any, error: any) {
  const invalidSubscription = error instanceof FcmDeliveryError && error.invalidToken;
  const attempts = Number(delivery.attempts || 1);
  const permanentlyFailed = invalidSubscription || attempts >= 5;
  const message = String(error?.responseBody || error?.message || "Native push delivery failed").slice(0, 1000);
  const retrySeconds = Math.min(3600, Math.max(30, (2 ** attempts) * 15));

  await db.transaction(async (tx: any) => {
    await tx.execute(sql`
      update app.notification_native_push_deliveries
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
      update app.native_push_subscriptions
      set failure_count = failure_count + 1,
          disabled_at = case when ${invalidSubscription} then now() else disabled_at end,
          updated_at = now()
      where id = ${Number(delivery.subscriptionId)}
    `);
    if (invalidSubscription) {
      await tx.execute(sql`
        update app.notification_native_push_deliveries
        set status = 'failed', last_error = 'Native push token expired', updated_at = now()
        where subscription_id = ${Number(delivery.subscriptionId)} and status in ('pending', 'processing')
      `);
    }
  });
}

let processingDeliveries = false;

export async function processPendingNativePushDeliveries(limit = 25) {
  if (processingDeliveries) return { configured: Boolean(firebaseCredentials()), claimed: 0, sent: 0, failed: 0 };
  const credentials = firebaseCredentials();
  if (!credentials) return { configured: false, claimed: 0, sent: 0, failed: 0 };
  processingDeliveries = true;
  try {
    await ensureNotificationsSchema();
    const deliveries = await claimDueDeliveries(limit);
    let sent = 0;
    let failed = 0;
    for (const delivery of deliveries) {
      try {
        await sendFcmNotification(credentials, delivery);
        await markDeliverySent(delivery);
        sent += 1;
      } catch (error) {
        await markDeliveryFailed(delivery, error);
        failed += 1;
      }
    }
    return { configured: true, claimed: deliveries.length, sent, failed };
  } finally {
    processingDeliveries = false;
  }
}

let workerTimer: NodeJS.Timeout | null = null;

export function startNativePushDeliveryWorker() {
  if (workerTimer) return;
  const run = () => {
    void processPendingNativePushDeliveries().catch((error) => {
      console.error("Native push delivery worker failed:", error);
    });
  };
  const initialTimer = setTimeout(run, 2_500);
  initialTimer.unref?.();
  workerTimer = setInterval(run, 15_000);
  workerTimer.unref?.();
}
