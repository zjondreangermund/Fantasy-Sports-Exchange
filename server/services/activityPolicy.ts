import { sql } from 'drizzle-orm';
export const auditProblem = sql`(a.action ilike '%error%' or a.action in ('request.rejected','request.error','client.error') or coalesce(a.meta->>'status','') ~ '^[45][0-9][0-9]$')`;
export const transactionProblem = sql`lower(coalesce(t.status::text,'')) in ('failed','error','rejected')`;
export function cleanActivityText(value: unknown, max = 300): string {
  return String(value || '').replace(/https?:\/\/[^\s]+/gi, '[link]').replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/g, '[email]').replace(/\b[A-Za-z0-9_-]{40,}\b/g, '[redacted]').replace(/[\x00-\x1f]/g, ' ').slice(0,max);
}
export function cleanActivityMeta(value: any, depth = 0): any {
  if(depth > 3)return '[details omitted]';
  if(typeof value === 'string')return cleanActivityText(value,500);
  if(Array.isArray(value))return value.slice(0,20).map(v=>cleanActivityMeta(v,depth+1));
  if(value && typeof value === 'object')return Object.fromEntries(Object.entries(value).slice(0,40).map(([k,v])=>[k,/password|secret|token|cookie|authorization|body|stack|sql|headers/i.test(k)?'[redacted]':cleanActivityMeta(v,depth+1)]));
  return value;
}
