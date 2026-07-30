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
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}
