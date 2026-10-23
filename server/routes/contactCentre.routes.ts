import type { Express } from "express";
import { db } from "../db.js";
import { sql } from "drizzle-orm";
import { createHash } from "node:crypto";

/** CONTACT_CENTRE_V1: tickets always reach the private Fantasy Arena database,
 * even before a custom-domain email provider has been configured.
 * NEVER advertise an unverified email mailbox as live. */
const SUPPORT_DOMAIN = "playfantasyarena.com";
const categories = new Set(["general","account","cards","tournament","prizes","payments","marketplace","partnerships","privacy"]);
const statuses = new Set(["new","in_progress","waiting","resolved"]);
let createPromise: Promise<void> | null = null;
function rowsOf(result:any):any[]{return Array.isArray(result?.rows)?result.rows:[];}
async function ensureSupportTable(){
  if(!createPromise)createPromise=(async()=>{
    await db.execute(sql`CREATE TABLE IF NOT EXISTS app.support_requests (
      id bigserial primary key,
      name varchar(120) not null,
      email varchar(254) not null,
      category varchar(32) not null,
      subject varchar(180) not null,
      message text not null,
      account_id varchar(255),
      ip_hash varchar(64) not null,
      status varchar(24) not null default 'new',
      admin_note text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      resolved_at timestamptz
    )`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS support_requests_created_idx ON app.support_requests(created_at DESC)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS support_requests_status_idx ON app.support_requests(status,created_at DESC)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS support_requests_ratelimit_idx ON app.support_requests(ip_hash,created_at DESC)`);
  })().catch(e=>{createPromise=null;throw e});
  await createPromise;
}
function value(raw:unknown,max:number){return typeof raw==="string"?raw.trim().slice(0,max):"";}
function number(raw:unknown,fallback:number,min:number,max:number){const n=Number(raw);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.trunc(n))):fallback;}
function publicEmail(){
  // The boolean is set ONLY after inbound delivery to this domain is tested.
  return process.env.FANTASY_SUPPORT_EMAIL_VERIFIED==="true"
    ? (value(process.env.FANTASY_SUPPORT_EMAIL,254)||`support@${SUPPORT_DOMAIN}`) : null;
}
export function registerContactCentreRoutes(app:Express,deps:{requireAuth:any,isAdmin:any}){
  const {requireAuth,isAdmin}=deps;
  app.get("/api/public/contact-info",(_req,res)=>{
    res.setHeader("Cache-Control","public, max-age=60");
    return res.json({brand:"Fantasy Arena",website:`https://${SUPPORT_DOMAIN}`,region:"Namibia",email:publicEmail(),
      onlineSupport:true,phone:null,socials:[],
      note:publicEmail()?"Use the verified support mailbox or send the contact form.":"Use the secure contact form until our domain mailbox is activated."});
  });
  app.post("/api/public/contact",async(req:any,res)=>{
    try{
      const data=req.body||{};
      // Hidden field: most form bots fill this, real visitors never see it.
      if(value(data.website,256)||value(data.fax,256))return res.json({success:true,reference:"Submitted"});
      const name=value(data.name,120), email=value(data.email,254).toLowerCase();
      const subject=value(data.subject,180), message=value(data.message,5000);
      const category=value(data.category,32).toLowerCase();
      if(name.length<2||name.length>120||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||subject.length<4||
         message.length<12||!categories.has(category)||String(data.message||"").length>5000)
        return res.status(400).json({message:"Please provide a valid name, email, topic, subject and message (12–5000 characters)."});
      // Lower risk from unauthenticated forms: cap raw hyperlinks.
      if((message.match(/https?:\/\//gi)||[]).length>2)return res.status(400).json({message:"For security, please remove extra links from your message."});
      const ip=String(req.headers["cf-connecting-ip"]||req.ip||"unknown").slice(0,130);
      const secret=String(process.env.SESSION_SECRET||SUPPORT_DOMAIN);
      const ipHash=createHash("sha256").update(`${secret}:support:${ip}`).digest("hex");
      await ensureSupportTable();
      const id=await db.transaction(async(tx:any)=>{
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${ipHash}))`);
        const counts=rowsOf(await tx.execute(sql`SELECT
          count(*) FILTER (WHERE created_at>now()-interval '1 hour')::int AS hourly,
          count(*) FILTER (WHERE created_at>now()-interval '1 day')::int AS daily
          FROM app.support_requests WHERE ip_hash=${ipHash}`))[0];
        if(Number(counts?.hourly||0)>=4||Number(counts?.daily||0)>=12)return null;
        const found=rowsOf(await tx.execute(sql`
          INSERT INTO app.support_requests(name,email,category,subject,message,ip_hash)
          VALUES (${name},${email},${category},${subject},${message},${ipHash}) RETURNING id
        `))[0];
        return Number(found?.id||0);
      });
      if(!id)return res.status(429).json({message:"Too many requests. Please use your existing support reference or try again later."});
      return res.status(201).json({success:true,reference:`FA-${String(id).padStart(6,"0")}`,message:"Your request is saved in Fantasy Arena Support."});
    }catch(err){console.error("[contact-centre] Could not save support request:",err);return res.status(500).json({message:"The request could not be saved. Please try again."});}
  });
  app.get("/api/admin/contact-requests",requireAuth,isAdmin,async(req:any,res)=>{
    try{
      await ensureSupportTable();
      const page=number(req.query.page,1,1,100000),limit=number(req.query.limit,30,1,100);
      const status=value(req.query.status,25)||"all",search=value(req.query.q,120);
      if(status!=="all"&&!statuses.has(status))return res.status(400).json({message:"Invalid status filter"});
      const like=`%${search}%`;
      const data=rowsOf(await db.execute(sql`
        SELECT id,name,email,category,subject,message,status,
               admin_note AS "adminNote",created_at AS "createdAt",updated_at AS "updatedAt",
               resolved_at AS "resolvedAt",count(*) OVER()::int AS total
        FROM app.support_requests
        WHERE (${status}='all' OR status=${status})
          AND (${search}='' OR name ILIKE ${like} OR email ILIKE ${like}
             OR subject ILIKE ${like} OR message ILIKE ${like}
             OR cast(id as text)=${search})
        ORDER BY CASE WHEN status='new' THEN 0 WHEN status='in_progress' THEN 1 ELSE 2 END,
                 created_at DESC
        LIMIT ${limit} OFFSET ${(page-1)*limit}
      `));
      const total=Number(data[0]?.total||0);
      return res.json({requests:data.map(({total,...row})=>row),total,page,pages:Math.max(1,Math.ceil(total/limit))});
    }catch(err){console.error("[contact-centre] Admin listing failed:",err);return res.status(500).json({message:"Could not load support inbox."});}
  });
  app.patch("/api/admin/contact-requests/:id",requireAuth,isAdmin,async(req:any,res)=>{
    try{
      await ensureSupportTable();
      const id=number(req.params.id,0,0,2147483647),status=value(req.body?.status,24);
      const note=value(req.body?.adminNote,3000);
      if(!id||!statuses.has(status))return res.status(400).json({message:"A valid ticket and status are required."});
      const changed=rowsOf(await db.execute(sql`
        UPDATE app.support_requests SET status=${status},admin_note=${note},
          resolved_at=CASE WHEN ${status}='resolved' THEN COALESCE(resolved_at,now()) ELSE null END,
          updated_at=now()
        WHERE id=${id} RETURNING id,status,updated_at AS "updatedAt"
      `))[0];
      if(!changed)return res.status(404).json({message:"Ticket not found."});
      return res.json({success:true,ticket:changed});
    }catch(err){console.error("[contact-centre] Update failed:",err);return res.status(500).json({message:"Could not update ticket."});}
  });
}
