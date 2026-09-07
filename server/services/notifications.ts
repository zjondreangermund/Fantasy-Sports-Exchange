import { sql } from "drizzle-orm";
import { db } from "../db.js";

export type ArenaNotificationType = "win" | "runner_up" | "system";

let notificationsSchemaPromise: Promise<void> | null = null;

export async function ensureNotificationsSchema(): Promise<void> {
  if (!notificationsSchemaPromise) {
    notificationsSchemaPromise = (async () => {
      await db.execute(sql`
        create table if not exists app.notifications (
          id serial primary key,
          user_id varchar(255) not null references app.users(id),
          type text not null default 'system',
          title text not null,
          message text not null,
          read boolean not null default false,
          dedupe_key text,
          created_at timestamp default now()
        )
      `);
      await db.execute(sql`alter table if exists app.notifications add column if not exists dedupe_key text`);
      await db.execute(sql`create unique index if not exists notifications_user_dedupe_idx on app.notifications (user_id, dedupe_key)`);
      await db.execute(sql`create index if not exists notifications_user_unread_idx on app.notifications (user_id, read, created_at desc)`);
      await db.execute(sql`
        create table if not exists app.web_push_config (
          id smallint primary key,
          public_key text not null,
          private_key text not null,
          subject text not null,
          created_at timestamp not null default now(),
          updated_at timestamp not null default now(),
          constraint web_push_single_config check (id = 1)
        )
      `);
      await db.execute(sql`
        create table if not exists app.web_push_subscriptions (
          id bigserial primary key,
          user_id varchar(255) not null references app.users(id) on delete cascade,
          endpoint text not null unique,
          p256dh text not null,
          auth text not null,
          expiration_time bigint,
          user_agent text,
          failure_count integer not null default 0,
          disabled_at timestamp,
          last_success_at timestamp,
          created_at timestamp not null default now(),
          updated_at timestamp not null default now()
        )
      `);
      await db.execute(sql`create index if not exists web_push_subscriptions_user_idx on app.web_push_subscriptions (user_id, disabled_at)`);
      await db.execute(sql`
        create table if not exists app.native_push_subscriptions (
          id bigserial primary key,
          user_id varchar(255) not null references app.users(id) on delete cascade,
          token text not null unique,
          platform text not null,
          failure_count integer not null default 0,
          disabled_at timestamp,
          last_success_at timestamp,
          created_at timestamp not null default now(),
          updated_at timestamp not null default now()
        )
      `);
      await db.execute(sql`create index if not exists native_push_subscriptions_user_idx on app.native_push_subscriptions (user_id, disabled_at)`);
      await db.execute(sql`
        create table if not exists app.notification_push_deliveries (
          id bigserial primary key,
          notification_id integer not null references app.notifications(id) on delete cascade,
          subscription_id bigint not null references app.web_push_subscriptions(id) on delete cascade,
          status text not null default 'pending',
          attempts integer not null default 0,
          next_attempt_at timestamp not null default now(),
          last_error text,
          sent_at timestamp,
          created_at timestamp not null default now(),
          updated_at timestamp not null default now(),
          unique (notification_id, subscription_id)
        )
      `);
      await db.execute(sql`create index if not exists notification_push_due_idx on app.notification_push_deliveries (status, next_attempt_at, id)`);
      await db.execute(sql`
        create table if not exists app.notification_native_push_deliveries (
          id bigserial primary key,
          notification_id integer not null references app.notifications(id) on delete cascade,
          subscription_id bigint not null references app.native_push_subscriptions(id) on delete cascade,
          status text not null default 'pending',
          attempts integer not null default 0,
          next_attempt_at timestamp not null default now(),
          last_error text,
          sent_at timestamp,
          created_at timestamp not null default now(),
          updated_at timestamp not null default now(),
          unique (notification_id, subscription_id)
        )
      `);
      await db.execute(sql`create index if not exists notification_native_push_due_idx on app.notification_native_push_deliveries (status, next_attempt_at, id)`);
    })().catch((error) => {
      notificationsSchemaPromise = null;
      throw error;
    });
  }
  await notificationsSchemaPromise;
}

export async function createNotificationOnce(tx: any, input: {
  userId: string;
  type?: ArenaNotificationType;
  title: string;
  message: string;
  dedupeKey: string;
}) {
  const userId = String(input.userId || "").trim();
  const title = String(input.title || "").trim().slice(0, 240);
  const message = String(input.message || "").trim().slice(0, 4000);
  const dedupeKey = String(input.dedupeKey || "").trim().slice(0, 240);
  const type: ArenaNotificationType = input.type === "win" || input.type === "runner_up" ? input.type : "system";
  if (!userId || !title || !message || !dedupeKey) return null;

  const result = await tx.execute(sql`
    insert into app.notifications (user_id, type, title, message, read, dedupe_key, created_at)
    values (${userId}, ${type}, ${title}, ${message}, false, ${dedupeKey}, now())
    on conflict (user_id, dedupe_key) do nothing
    returning id, user_id as "userId", type::text as type, title, message, read, created_at as "createdAt"
  `);
  const notification = Array.isArray(result?.rows) ? result.rows[0] || null : null;
  if (notification?.id) {
    await tx.execute(sql`
      insert into app.notification_push_deliveries (notification_id, subscription_id, status, next_attempt_at, created_at, updated_at)
      select ${Number(notification.id)}, subscription.id, 'pending', now(), now(), now()
      from app.web_push_subscriptions subscription
      where subscription.user_id = ${userId} and subscription.disabled_at is null
      on conflict (notification_id, subscription_id) do nothing
    `);
    await tx.execute(sql`
      insert into app.notification_native_push_deliveries (notification_id, subscription_id, status, next_attempt_at, created_at, updated_at)
      select ${Number(notification.id)}, subscription.id, 'pending', now(), now(), now()
      from app.native_push_subscriptions subscription
      where subscription.user_id = ${userId} and subscription.disabled_at is null
      on conflict (notification_id, subscription_id) do nothing
    `);
  }
  return notification;
}
