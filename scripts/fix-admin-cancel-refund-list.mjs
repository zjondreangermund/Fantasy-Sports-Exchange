import fs from "node:fs";

const file = "client/src/components/admin/AdminTournamentManager.tsx";
let source = fs.readFileSync(file, "utf8");
let changed = false;

if (!source.includes("Delete Empty Tournament")) {
  const oldSignature = "function TournamentList({ title, competitions, selectedId, onLoad, onDelete, onSettle, deleting, settling }: any)";
  const newSignature = "function TournamentList({ title, competitions, selectedId, onLoad, onDelete, onCancelRefund, onSettle, deleting, cancelling, settling }: any)";
  if (!source.includes(oldSignature)) throw new Error("Admin cancel/refund list fix: TournamentList signature not found");
  source = source.replace(oldSignature, newSignature);

  const oldStatus = 'const status = String(comp.status || "").toLowerCase(); const settlement = comp.endDate || comp.end_date;';
  const newStatus = 'const status = String(comp.status || "").toLowerCase(); const entryCount = Number(comp.entryCount ?? comp.entry_count ?? 0); const refundedEntryCount = Number(comp.refundedEntryCount ?? comp.refunded_entry_count ?? 0); const refundTotal = Number(comp.refundTotal ?? comp.refund_total ?? 0); const isCancelled = status === "cancelled"; const isCompleted = status === "completed"; const settlement = comp.endDate || comp.end_date;';
  if (!source.includes(oldStatus)) throw new Error("Admin cancel/refund list fix: status block not found");
  source = source.replace(oldStatus, newStatus);

  source = source.replace(
    'const readyToSettle = ["active", "closed"].includes(status) && Number.isFinite(settlementMs) && Date.now() >= settlementMs;',
    'const readyToSettle = !isCancelled && !isCompleted && ["active", "closed"].includes(status) && Number.isFinite(settlementMs) && Date.now() >= settlementMs;',
  );

  const oldDelete = '<Button variant="destructive" size="sm" disabled={deleting} onClick={() => onDelete(comp)} className="mt-2 w-full"><Trash2 className="mr-2 h-4 w-4" />Delete Tournament</Button>';
  const newControls = '{isCancelled ? <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/10 p-2 text-xs text-amber-100">Cancelled • {refundedEntryCount || entryCount} {(refundedEntryCount || entryCount) === 1 ? "entry" : "entries"} processed • {money(refundTotal)} refunded</div> : null}{!isCancelled && !isCompleted && entryCount > 0 ? <Button size="sm" disabled={cancelling} onClick={() => onCancelRefund(comp)} className="mt-2 w-full bg-amber-300 font-black text-slate-950 hover:bg-amber-200"><RotateCcw className="mr-2 h-4 w-4" />{cancelling ? "Refunding..." : `Cancel & Refund ${entryCount} ${entryCount === 1 ? "Entry" : "Entries"}`}</Button> : null}{!isCancelled && !isCompleted && entryCount === 0 ? <Button variant="destructive" size="sm" disabled={deleting} onClick={() => onDelete(comp)} className="mt-2 w-full"><Trash2 className="mr-2 h-4 w-4" />Delete Empty Tournament</Button> : null}{isCompleted ? <div className="mt-2 text-xs text-white/40">Completed tournaments are final and cannot be cancelled or refunded.</div> : null}';
  if (!source.includes(oldDelete)) throw new Error("Admin cancel/refund list fix: old delete control not found");
  source = source.replace(oldDelete, newControls);
  changed = true;
}

if (!source.includes("Cancel & Refund ${entryCount}") || !source.includes("Delete Empty Tournament")) {
  throw new Error("Admin cancel/refund list fix did not produce the required controls");
}

if (changed) fs.writeFileSync(file, source);
console.log(`[admin-cancel-refund-list] ${changed ? "Applied" : "Verified"} entered-tournament cancel/refund and empty-only delete controls.`);
