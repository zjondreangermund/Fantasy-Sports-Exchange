import { sql } from 'drizzle-orm';
import { db } from '../db.js';

let lastReport = 0;
export async function reportNotificationHealth(force = false) {
  if (!force && Date.now() - lastReport < 60 * 60_000) return;
  const result = await db.execute(sql`
    select
      (select count(*)::int from app.notifications where created_at >= now()-interval '24 hours') as "created24h",
      (select count(*)::int from app.web_push_subscriptions where disabled_at is null) as "activeWebSubscriptions",
      (select count(*)::int from app.native_push_subscriptions where disabled_at is null) as "activeNativeSubscriptions",
      (select count(*)::int from app.notification_push_deliveries where sent_at >= now()-interval '24 hours') as "webSent24h",
      (select count(*)::int from app.notification_native_push_deliveries where sent_at >= now()-interval '24 hours') as "nativeSent24h",
      (select count(*)::int from app.notification_push_deliveries where status='pending') as "webPending",
      (select count(*)::int from app.notification_native_push_deliveries where status='pending') as "nativePending",
      (select count(*)::int from app.notification_push_deliveries where status='failed' and updated_at >= now()-interval '24 hours') as "webFailed24h",
      (select count(*)::int from app.notification_native_push_deliveries where status='failed' and updated_at >= now()-interval '24 hours') as "nativeFailed24h",
      (select count(*)::int from app.notification_native_push_deliveries where last_error like '%(403)%' and updated_at >= now()-interval '24 hours') as "nativePermissionErrors24h",
      (select count(*)::int from app.notification_native_push_deliveries where last_error like '%(401)%' and updated_at >= now()-interval '24 hours') as "nativeAuthorizationErrors24h",
      (select count(*)::int from app.native_push_subscriptions where disabled_at >= now()-interval '24 hours') as "nativeExpiredTokens24h"
  `);
  const row = (result as any)?.rows?.[0] || {};
  console.info('[notification-health]', JSON.stringify(row));
  lastReport = Date.now();
}
