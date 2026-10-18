import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { ensureNotificationsSchema } from "../services/notifications.js";

function rowsOf(result: any): any[] { return Array.isArray(result?.rows) ? result.rows : []; }
function bounded(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
}
const allowedStatus = new Set(["all", "sent", "pending", "failed", "inbox-only"]);
const allowedCoverage = new Set(["all", "connected", "no-push", "mint-muted"]);
function pushState(nativeSent:number,webSent:number,pending:number,failed:number) {
  if(nativeSent+webSent>0)return "sent";
  if(pending>0)return "pending";
  if(failed>0)return "failed";
  return "inbox-only";
}

/**
 * ADMIN_NOTIFICATION_DELIVERY_AUDIT_V1
 * Read-only, admin authenticated delivery audit. Push "sent" means accepted by
 * the device's provider. The server cannot certify that an OS displayed it.
 * No FCM tokens, push endpoints, user credentials or raw provider errors leave
 * these routes. Muted users are never automatically re-subscribed.
 */
export function registerAdminNotificationAuditRoutes(app: Express, deps: {requireAuth:any;isAdmin:any}) {
  const {requireAuth,isAdmin}=deps;

  app.get("/api/admin/notification-audit/summary", requireAuth, isAdmin, async (req:any,res) => {
    try {
      await ensureNotificationsSchema();
      const hours = [24,168,720].includes(Number(req.query.hours)) ? Number(req.query.hours) : 24;
      const [notifications,delivery,coverage] = await Promise.all([
        db.execute(sql`
          SELECT count(*)::int AS "inboxCreated",
                 count(*) FILTER (WHERE read=true)::int AS "inboxRead",
                 count(*) FILTER (WHERE read=false)::int AS "inboxUnread"
          FROM app.notifications WHERE created_at >= now()-(${hours}*interval '1 hour')
        `),
        db.execute(sql`
          SELECT count(*) FILTER (WHERE status='sent')::int AS "sentJobs",
                 count(*) FILTER (WHERE status IN ('pending','processing'))::int AS "pendingJobs",
                 count(*) FILTER (WHERE status='failed')::int AS "failedJobs",
                 count(DISTINCT notification_id) FILTER (WHERE status='sent')::int AS "notificationsPushed"
          FROM (
            SELECT notification_id,status FROM app.notification_native_push_deliveries WHERE created_at>=now()-(${hours}*interval '1 hour')
            UNION ALL
            SELECT notification_id,status FROM app.notification_push_deliveries WHERE created_at>=now()-(${hours}*interval '1 hour')
          ) jobs
        `),
        db.execute(sql`
          SELECT (SELECT count(*)::int FROM app.users) AS "accounts",
                 (SELECT count(*)::int FROM (
                   SELECT user_id FROM app.native_push_subscriptions WHERE disabled_at IS NULL
                   UNION SELECT user_id FROM app.web_push_subscriptions WHERE disabled_at IS NULL
                 ) s) AS "usersWithPush",
                 (SELECT count(*)::int FROM app.native_push_subscriptions WHERE disabled_at IS NULL) AS "androidDevices",
                 (SELECT count(*)::int FROM app.web_push_subscriptions WHERE disabled_at IS NULL) AS "webDevices"
        `),
      ]);
      return res.json({hours,...rowsOf(notifications)[0],...rowsOf(delivery)[0],...rowsOf(coverage)[0],note:"Push sent = accepted by push provider, not proof a phone displayed or the user read it."});
    } catch(error:any){
      console.error("[admin-notification-audit] summary failed:",error);
      return res.status(500).json({message:"Could not load notification delivery summary."});
    }
  });

  app.get("/api/admin/notification-audit/events", requireAuth, isAdmin, async (req:any,res)=>{
    try {
      await ensureNotificationsSchema();
      const hours=[24,168,720].includes(Number(req.query.hours))?Number(req.query.hours):168;
      const page=bounded(req.query.page,1,1,1000);
      const limit=bounded(req.query.limit,40,1,100);
      const offset=(page-1)*limit;
      const q=String(req.query.q||"").trim().slice(0,110);
      const pattern=`%${q}%`;
      const status=allowedStatus.has(String(req.query.status||"all"))?String(req.query.status||"all"):"all";
      // Per-notification aggregates use lateral queries; do not multiply rows for
      // multiple registered phones/browsers belonging to one manager.
      const result=await db.execute(sql`
        WITH audited AS (
          SELECT n.id,n.user_id AS "userId",n.title,n.message,n.dedupe_key AS "dedupeKey",
            n.type::text AS type,n.created_at AS "createdAt",n.read AS "inboxRead",
            coalesce(u.manager_team_name,u.name,u.email,n.user_id) AS "manager",
            u.email,
            coalesce(ns.active_native,0)::int AS "androidSubscriptions",
            coalesce(ws.active_web,0)::int AS "webSubscriptions",
            coalesce(nd.sent,0)::int AS "androidSent",
            coalesce(wd.sent,0)::int AS "webSent",
            (coalesce(nd.pending,0)+coalesce(wd.pending,0))::int AS pending,
            (coalesce(nd.failed,0)+coalesce(wd.failed,0))::int AS failed,
            greatest(nd.last_sent,wd.last_sent) AS "lastProviderSentAt"
          FROM app.notifications n
          LEFT JOIN app.users u ON u.id=n.user_id
          LEFT JOIN LATERAL(
            SELECT count(*)::int AS active_native FROM app.native_push_subscriptions s
            WHERE s.user_id=n.user_id AND s.disabled_at IS NULL
          ) ns ON true
          LEFT JOIN LATERAL(
            SELECT count(*)::int AS active_web FROM app.web_push_subscriptions s
            WHERE s.user_id=n.user_id AND s.disabled_at IS NULL
          ) ws ON true
          LEFT JOIN LATERAL(
            SELECT count(*) FILTER(WHERE d.status='sent')::int AS sent,
              count(*) FILTER(WHERE d.status IN ('pending','processing'))::int AS pending,
              count(*) FILTER(WHERE d.status='failed')::int AS failed,
              max(d.sent_at) AS last_sent
            FROM app.notification_native_push_deliveries d WHERE d.notification_id=n.id
          ) nd ON true
          LEFT JOIN LATERAL(
            SELECT count(*) FILTER(WHERE d.status='sent')::int AS sent,
              count(*) FILTER(WHERE d.status IN ('pending','processing'))::int AS pending,
              count(*) FILTER(WHERE d.status='failed')::int AS failed,
              max(d.sent_at) AS last_sent
            FROM app.notification_push_deliveries d WHERE d.notification_id=n.id
          ) wd ON true
          WHERE n.created_at>=now()-(${hours}*interval '1 hour')
            AND (${q}='' OR n.title ILIKE ${pattern} OR n.message ILIKE ${pattern}
              OR n.dedupe_key ILIKE ${pattern} OR n.user_id ILIKE ${pattern}
              OR coalesce(u.manager_team_name,'') ILIKE ${pattern}
              OR coalesce(u.name,'') ILIKE ${pattern} OR coalesce(u.email,'') ILIKE ${pattern})
        )
        SELECT *,CASE WHEN ("androidSent"+"webSent")>0 THEN 'sent'
            WHEN pending>0 THEN 'pending'
            WHEN failed>0 THEN 'failed'
            ELSE 'inbox-only' END AS "deliveryStatus",
            count(*) OVER()::int AS "filteredTotal"
        FROM audited
        WHERE (${status}='all' OR
          CASE WHEN ("androidSent"+"webSent")>0 THEN 'sent'
            WHEN pending>0 THEN 'pending'
            WHEN failed>0 THEN 'failed'
            ELSE 'inbox-only' END=${status})
        ORDER BY "createdAt" DESC NULLS LAST,id DESC LIMIT ${limit} OFFSET ${offset}
      `);
      const notifications=rowsOf(result).map(({filteredTotal,...item}:any)=>item);
      const total=Number(rowsOf(result)[0]?.filteredTotal||0);
      return res.json({events:notifications,total,page,limit,pages:Math.max(1,Math.ceil(total/limit)),hours,status});
    } catch(error:any){
      console.error("[admin-notification-audit] events failed:",error);
      return res.status(500).json({message:"Could not load notification delivery history."});
    }
  });

  app.get("/api/admin/notification-audit/users", requireAuth, isAdmin, async(req:any,res)=>{
    try {
      await ensureNotificationsSchema();
      const q=String(req.query.q||"").trim().slice(0,110);
      const pattern=`%${q}%`;
      const coverage=allowedCoverage.has(String(req.query.coverage||"all"))?String(req.query.coverage||"all"):"all";
      const page=bounded(req.query.page,1,1,1000);
      const limit=bounded(req.query.limit,40,1,100);
      const result=await db.execute(sql`
        WITH coverage AS (
          SELECT u.id AS "userId",coalesce(u.manager_team_name,u.name,u.email,u.id) AS manager,u.email,
            coalesce(a.android_devices,0)::int AS "androidDevices",
            coalesce(w.web_devices,0)::int AS "webDevices",
            coalesce(a.disabled_android,0)::int AS "disabledAndroid",
            coalesce(w.disabled_web,0)::int AS "disabledWeb",
            greatest(a.last_success,w.last_success) AS "lastProviderSentAt",
            p.preferences->>'mint' AS "mintPref",
            coalesce(n.recent_notifications,0)::int AS "inboxLast7Days"
          FROM app.users u
          LEFT JOIN app.arena_alert_preferences p ON p.user_id=u.id
          LEFT JOIN LATERAL (
            SELECT count(*) FILTER(WHERE disabled_at IS NULL)::int AS android_devices,
              count(*) FILTER(WHERE disabled_at IS NOT NULL)::int AS disabled_android,
              max(last_success_at) AS last_success
            FROM app.native_push_subscriptions WHERE user_id=u.id
          ) a ON true
          LEFT JOIN LATERAL (
            SELECT count(*) FILTER(WHERE disabled_at IS NULL)::int AS web_devices,
              count(*) FILTER(WHERE disabled_at IS NOT NULL)::int AS disabled_web,
              max(last_success_at) AS last_success
            FROM app.web_push_subscriptions WHERE user_id=u.id
          ) w ON true
          LEFT JOIN LATERAL (
            SELECT count(*)::int AS recent_notifications
            FROM app.notifications WHERE user_id=u.id AND created_at >= now()-interval '7 days'
          ) n ON true
          WHERE (${q}='' OR u.id ILIKE ${pattern} OR coalesce(u.name,'') ILIKE ${pattern}
             OR coalesce(u.email,'') ILIKE ${pattern} OR coalesce(u.manager_team_name,'') ILIKE ${pattern})
        )
        SELECT *,count(*) OVER()::int AS "filteredTotal"
        FROM coverage
        WHERE (${coverage}='all'
          OR (${coverage}='connected' AND ("androidDevices"+"webDevices")>0)
          OR (${coverage}='no-push' AND ("androidDevices"+"webDevices")=0)
          OR (${coverage}='mint-muted' AND "mintPref"='false'))
        ORDER BY "androidDevices"+"webDevices" ASC, manager ASC
        LIMIT ${limit} OFFSET ${(page-1)*limit}
      `);
      const entries=rowsOf(result);
      return res.json({users:entries.map(({filteredTotal,...row}:any)=>row),
        total:Number(entries[0]?.filteredTotal||0),page,limit,pages:Math.max(1,Math.ceil(Number(entries[0]?.filteredTotal||0)/limit)),
        note:"Connected means a registered push endpoint. OS notification permission and the actual display of a message cannot be confirmed from this server."});
    }catch(error:any){
      console.error("[admin-notification-audit] coverage failed:",error);
      return res.status(500).json({message:"Could not load users' notification connection status."});
    }
  });
}
