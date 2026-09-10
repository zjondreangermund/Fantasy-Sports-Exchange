import fs from "node:fs";

const path = "client/src/components/native/NativeHomePage.tsx";
let source = fs.readFileSync(path, "utf8");

if (!source.includes("FEATURED_CUP_ENTRY_DETAILS_V1")) {
  const start = source.indexOf('      {featured ? <section className="mt-3 rounded-[1.45rem] border p-3.5">');
  const next = source.indexOf('\n\n      <section className="mt-3 grid grid-cols-2 gap-2">', start);
  if (start < 0 || next < 0) throw new Error("[featured-cup-entry-details] Featured cup block not found");

  const replacement = `      {/* FEATURED_CUP_ENTRY_DETAILS_V1 */}\n      {featured ? <section className="mt-3 rounded-[1.45rem] border p-3.5">\n        <div className="flex items-start justify-between gap-2">\n          <div className="min-w-0">\n            <p className="text-[8px] font-black uppercase tracking-[.17em] text-emerald-200/60">Featured cup</p>\n            <h3 className="mt-1 truncate text-[15px] font-black">{featured.name || "Fantasy Arena tournament"}</h3>\n            <p className="mt-1 text-[9px] font-bold uppercase tracking-[.1em] text-cyan-100/55">GW{Number(featured.gameWeek || (featured as any).game_week || 0)} · {String((featured as any).tier || "common").toUpperCase()}</p>\n          </div>\n          <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[8px] font-black">OPEN</span>\n        </div>\n\n        <div className="mt-3 grid grid-cols-3 gap-2">\n          <div className="rounded-xl border border-emerald-300/10 bg-emerald-300/[.045] p-2.5">\n            <p className="text-[8px] font-black uppercase tracking-[.1em] text-slate-600">Entry fee</p>\n            <p className="mt-0.5 text-[12px] font-black text-emerald-200">{Number(featured.entryFee || 0) <= 0 ? "FREE" : money(featured.entryFee)}</p>\n          </div>\n          <div className="rounded-xl border border-cyan-300/10 bg-cyan-300/[.04] p-2.5">\n            <p className="text-[8px] font-black uppercase tracking-[.1em] text-slate-600">Entries</p>\n            <p className="mt-0.5 text-[12px] font-black text-cyan-100">{Number((featured as any).entryCount ?? (featured as any).entry_count ?? 0)}</p>\n          </div>\n          <div className="rounded-xl border border-white/[.07] bg-white/[.025] p-2.5">\n            <p className="text-[8px] font-black uppercase tracking-[.1em] text-slate-600">Closes</p>\n            <p className="mt-0.5 text-[10px] font-black">{deadline(featured.submissionClosesAt || (featured as any).submission_closes_at)}</p>\n          </div>\n        </div>\n\n        <Link href="/competitions">\n          <button className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-gradient-to-r from-fuchsia-400/15 via-violet-500/12 to-cyan-300/15 text-[10px] font-black text-cyan-50 shadow-[0_0_18px_rgba(34,211,238,.08)]">\n            Enter this tournament <ChevronRight className="h-4 w-4" />\n          </button>\n        </Link>\n      </section> : null}`;

  source = source.slice(0, start) + replacement + source.slice(next);
  fs.writeFileSync(path, source);
}

const verify = fs.readFileSync(path, "utf8");
if (!verify.includes("FEATURED_CUP_ENTRY_DETAILS_V1") || !verify.includes("Entry fee") || !verify.includes("entryCount ??") || !verify.includes("Enter this tournament")) {
  throw new Error("[featured-cup-entry-details] Featured cup details verification failed");
}

console.log("[featured-cup-entry-details] Featured cup now shows entry fee, live entry count, close time and a clear enter CTA.");
