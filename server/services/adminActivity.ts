import { sql } from 'drizzle-orm';
import { auditProblem, transactionProblem, cleanActivityMeta } from './activityPolicy.js';
const rows=(r:any)=>r.rows||[];
export async function getAdminActivity(executor:any, query:any) {
  const integer=(v:any,fallback:number,max:number)=>Number.isFinite(Number(v))?Math.max(1,Math.min(max,Math.floor(Number(v)))):fallback;
  const hours=integer(query.hours||24,24,2160),page=integer(query.page||1,1,100000),limit=integer(query.limit||40,40,100);
  const end=new Date(),start=new Date(end.getTime()-hours*3600000);
  const userId=String(query.userId||'').slice(0,255),session=String(query.session||'').slice(0,100),q=String(query.q||'').trim().slice(0,160),user=String(query.user||'').trim().slice(0,160);
  const like=(s:string)=>'%'+s.replace(/[\\%_]/g,'\\$&')+'%';
  const category=String(query.category||'all'),outcome=String(query.outcome||'all');
  const source=String(query.source||'all');
  const result=rows(await executor.execute(sql`
    with combined as (
      select concat('log-',a.id) as id,'audit'::text as source,a.user_id as "userId",
        coalesce(nullif(u.manager_team_name,''),nullif(u.name,''),u.email,a.user_id,'System') as "userName",u.email,
        a.action as type,a.action as label,a.meta,a.created_at as "createdAt",null::float as amount,
        case when a.action='client.route_view' then 'page' when a.action='client.interaction' then 'interaction'
          when a.action like 'request.%' then 'request' when a.action like 'risk.%' or a.action like 'security.%' then 'security' else 'account' end as category,
        case when ${auditProblem} then 'error' else 'recorded' end as outcome,
        coalesce(a.meta->>'path',a.meta->>'route') as path,a.meta->>'sessionId' as session
      from app.audit_logs a left join app.users u on u.id=a.user_id
      where a.created_at >= ${start} and a.created_at <= ${end}
        and (a.action<>'client.route_view' or not exists(select 1 from app.page_activity p where p.user_id=a.user_id and p.path=a.meta->>'path' and p.event='page_view' and p.created_at between a.created_at-interval '3 seconds' and a.created_at+interval '3 seconds'))
      union all
      select concat('page-',p.id),'page',p.user_id,coalesce(nullif(u.manager_team_name,''),nullif(u.name,''),u.email,p.user_id,'Visitor'),u.email,
        'page_view','Visited page',jsonb_build_object('sessionId',p.session_id),p.created_at,null::float,'page','recorded',p.path,p.session_id::text
      from app.page_activity p left join app.users u on u.id=p.user_id
      where p.event='page_view' and p.created_at >= ${start} and p.created_at <= ${end}
      union all
      select concat('tx-',t.id),'transaction',t.user_id,coalesce(nullif(u.manager_team_name,''),nullif(u.name,''),u.email,t.user_id,'System'),u.email,
        t.type::text,coalesce(t.description,t.type::text),jsonb_build_object('status',t.status,'grossAmount',t.gross_amount,'feeAmount',t.fee_amount,'netAmount',t.net_amount,'sourceType',t.source_type),t.created_at,t.amount::float,'transaction',
        case when ${transactionProblem} then 'error' when lower(coalesce(t.status::text,'')) in ('pending','processing') then 'pending' else 'recorded' end,null::text,null::text
      from app.transactions t left join app.users u on u.id=t.user_id where t.created_at >= ${start} and t.created_at <= ${end}
    ), scoped as (
      select * from combined where (${userId}='' or "userId"=${userId}) and (${session}='' or session=${session})
        and (${user}='' or "userName" ilike ${like(user)} or email ilike ${like(user)} or "userId" ilike ${like(user)})
        and (${q}='' or label ilike ${like(q)} or path ilike ${like(q)} or meta::text ilike ${like(q)} or id=${q})
    ), filtered as (select * from scoped where (${category}='all' or category=${category}) and (${outcome}='all' or outcome=${outcome}) and (${source}='all' or source=${source}))
    select (select coalesce(jsonb_agg(e),'[]'::jsonb) from (select * from filtered order by "createdAt" desc,id desc limit ${limit} offset ${(page-1)*limit}) e) as activity,
      (select count(*)::int from filtered) as total,count(*)::int as events,count(*) filter(where outcome='error')::int as errors,
      count(*) filter(where category='page')::int as visits,count(distinct "userId")::int as users
    from scoped
  `))[0]||{};
  const recentUsers=rows(await executor.execute(sql`
    select p.user_id as "userId",coalesce(nullif(u.manager_team_name,''),nullif(u.name,''),u.email,p.user_id) as "userName",
      max(p.created_at) as "lastSeen",(array_agg(p.path order by p.created_at desc,p.id desc))[1] as path
    from app.page_activity p join app.users u on u.id=p.user_id
    where p.created_at>now()-interval '10 minutes'
    group by p.user_id,u.manager_team_name,u.name,u.email order by "lastSeen" desc limit 30
  `));
  return {activity:(result.activity||[]).map((item:any)=>({...item,meta:cleanActivityMeta(item.meta)})),total:Number(result.total||0),page,limit,pages:Math.max(1,Math.ceil(Number(result.total||0)/limit)),recentUsers,summary:{events:result.events||0,errors:result.errors||0,visits:result.visits||0,users:result.users||0},from:start.toISOString(),to:end.toISOString()};
}
