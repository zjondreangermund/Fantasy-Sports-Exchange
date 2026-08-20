import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function patchFile(relativePath, patcher) {
  const file = path.join(root, relativePath);
  const before = fs.readFileSync(file, "utf8");
  const after = patcher(before);
  if (after !== before) fs.writeFileSync(file, after);
  return after !== before;
}

function replaceRequired(source, from, to, label, marker = to) {
  if (source.includes(marker)) return source;
  if (!source.includes(from)) throw new Error(`Admin cancel/refund patch anchor not found: ${label}`);
  return source.replace(from, to);
}

let changed = 0;

if (patchFile("server/services/competitionCancellation.ts", (input) => {
  let source = input;
  source = replaceRequired(
    source,
    'import { db } from "../db.js";',
    'import { db } from "../db.js";\nimport { createNotificationOnce, ensureNotificationsSchema } from "./notifications.js";',
    "refund notification service import",
    'import { createNotificationOnce, ensureNotificationsSchema } from "./notifications.js";',
  );
  source = replaceRequired(
    source,
    '  await ensureCompetitionCancellationSchema();\n\n  const competitionId = Number(input.competitionId);',
    '  await ensureCompetitionCancellationSchema();\n  await ensureNotificationsSchema();\n\n  const competitionId = Number(input.competitionId);',
    "refund notification schema preparation",
    '  await ensureNotificationsSchema();',
  );

  const oldRefundCompletion = [
    '      newlyRefundedEntries += 1;',
    '      newlyRefundedTotal = toMoney(newlyRefundedTotal + refundAmount);',
  ].join("\n");
  const newRefundCompletion = [
    '      newlyRefundedEntries += 1;',
    '      newlyRefundedTotal = toMoney(newlyRefundedTotal + refundAmount);',
    '',
    '      await createNotificationOnce(tx, {',
    '        userId,',
    '        title: refundAmount > 0 ? "Tournament refund completed" : "Tournament entry cancelled",',
    '        message: refundAmount > 0',
    '          ? `${String(competition.name || "Tournament")} was cancelled. N$${refundAmount.toFixed(2)} has been returned to your Fantasy Arena wallet.`',
    '          : `${String(competition.name || "Tournament")} was cancelled. Your entry has been cancelled; there was no paid entry fee to refund.`',
    '        dedupeKey: `competition-cancellation-refund:${competitionId}:entry:${entryId}`,',
    '      });',
  ].join("\n");
  source = replaceRequired(
    source,
    oldRefundCompletion,
    newRefundCompletion,
    "entrant refund notification",
    'dedupeKey: `competition-cancellation-refund:${competitionId}:entry:${entryId}`',
  );
  return source;
})) changed += 1;

if (patchFile("client/src/components/admin/AdminTournamentManager.tsx", (input) => {
  let source = input;
  source = replaceRequired(
    source,
    'import { CheckCircle2, Gift, Plus, Save, Trash2, Trophy } from "lucide-react";',
    'import { CheckCircle2, Gift, Plus, RotateCcw, Save, Trash2, Trophy } from "lucide-react";',
    "cancel/refund icon import",
    'RotateCcw, Save, Trash2',
  );

  const cancelMutation = [
    '  const cancelMutation = useMutation({',
    '    mutationFn: async ({ competitionId, reason }: { competitionId: number; reason: string }) =>',
    '      (await apiRequest("POST", `/api/admin/competitions/${competitionId}/cancel`, { reason })).json(),',
    '    onSuccess: (result: any) => {',
    '      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });',
    '      queryClient.invalidateQueries({ queryKey: ["/api/competitions/my-entries"] });',
    '      queryClient.invalidateQueries({ queryKey: ["/api/prize-vault"] });',
    '      queryClient.invalidateQueries({ queryKey: ["/api/admin/backoffice?range=30d"] });',
    '      const refundedEntries = Number(result?.refundedEntryCount || 0);',
    '      const refundTotal = Number(result?.refundTotal || 0);',
    '      toast({',
    '        title: "Tournament cancelled & refunded",',
    '        description: `${refundedEntries} ${refundedEntries === 1 ? "entry" : "entries"} processed • ${money(refundTotal)} returned. Entrants receive a notification.`,',
    '      });',
    '      if (String(form.id || "") === String(result?.competition?.id || "")) setForm(buildEmptyForm());',
    '    },',
    '    onError: (error: any) => toast({ title: "Cancellation/refund failed", description: error.message, variant: "destructive" }),',
    '  });',
    '',
  ].join("\n");
  if (!source.includes("const cancelMutation = useMutation")) {
    const anchor = '  const deleteMutation = useMutation({';
    const index = source.indexOf(anchor);
    if (index < 0) throw new Error("Admin cancel/refund patch anchor not found: delete mutation");
    source = source.slice(0, index) + cancelMutation + source.slice(index);
  }

  const requestCancel = [
    '  const requestCancelRefund = (comp: any) => {',
    '    const entryCount = Number(comp.entryCount ?? comp.entry_count ?? 0);',
    '    const defaultReason = "Tournament cancelled by Fantasy Arena admin";',
    '    const reason = window.prompt(`Reason for cancelling "${comp.name || "this tournament"}"? Entrants will see this cancellation in their account history.`, defaultReason);',
    '    if (reason === null) return;',
    '    if (!window.confirm(`Cancel "${comp.name || "this tournament"}" and refund ${entryCount} ${entryCount === 1 ? "entry" : "entries"}? Paid entry fees will be returned to player wallets and card locks will be released.`)) return;',
    '    cancelMutation.mutate({ competitionId: Number(comp.id), reason: reason.trim() || defaultReason });',
    '  };',
    '',
  ].join("\n");
  if (!source.includes("const requestCancelRefund =")) {
    const anchor = '  const requestDelete = (comp: any) => {';
    const index = source.indexOf(anchor);
    if (index < 0) throw new Error("Admin cancel/refund patch anchor not found: delete request");
    source = source.slice(0, index) + requestCancel + source.slice(index);
  }

  source = source.replace(
    '    if (!window.confirm(`Delete "${comp.name || "this tournament"}" and all related entries? This cannot be undone.`)) return;',
    '    if (!window.confirm(`Delete empty tournament "${comp.name || "this tournament"}"? Tournaments with entries must use Cancel & Refund instead.`)) return;',
  );

  source = replaceRequired(
    source,
    '<p className="mt-1 text-sm text-white/45">Prize Ladder and player-card prizes are official admin rewards. User-created tournaments are kept separate and cash-only.</p>',
    '<p className="mt-1 text-sm text-white/45">Prize Ladder and player-card prizes are official admin rewards. User-created tournaments are kept separate and cash-only. Tournaments with entries must be cancelled with refunds; only empty tournaments can be deleted.</p>',
    "admin cancellation guidance",
    'Tournaments with entries must be cancelled with refunds',
  );

  source = replaceRequired(
    source,
    '<TournamentList title="Current & Upcoming" competitions={activeCompetitions} selectedId={form.id} onLoad={loadCompetition} onDelete={requestDelete} onSettle={requestSettlement} deleting={deleteMutation.isPending} settling={settleMutation.isPending} />',
    '<TournamentList title="Current & Upcoming" competitions={activeCompetitions} selectedId={form.id} onLoad={loadCompetition} onDelete={requestDelete} onCancelRefund={requestCancelRefund} onSettle={requestSettlement} deleting={deleteMutation.isPending} cancelling={cancelMutation.isPending} settling={settleMutation.isPending} />',
    "current tournament cancel/refund control",
    'title="Current & Upcoming" competitions={activeCompetitions} selectedId={form.id} onLoad={loadCompetition} onDelete={requestDelete} onCancelRefund={requestCancelRefund}',
  );
  source = replaceRequired(
    source,
    '<TournamentList title="Closed & Completed" competitions={completedCompetitions} selectedId={form.id} onLoad={loadCompetition} onDelete={requestDelete} onSettle={requestSettlement} deleting={deleteMutation.isPending} settling={settleMutation.isPending} />',
    '<TournamentList title="Closed & Completed" competitions={completedCompetitions} selectedId={form.id} onLoad={loadCompetition} onDelete={requestDelete} onCancelRefund={requestCancelRefund} onSettle={requestSettlement} deleting={deleteMutation.isPending} cancelling={cancelMutation.isPending} settling={settleMutation.isPending} />',
    "closed tournament cancel/refund control",
    'title="Closed & Completed" competitions={completedCompetitions} selectedId={form.id} onLoad={loadCompetition} onDelete={requestDelete} onCancelRefund={requestCancelRefund}',
  );

  if (!source.includes("Cancel & Refund")) {
    const functionStart = source.indexOf("function TournamentList(");
    if (functionStart < 0) throw new Error("Admin cancel/refund patch anchor not found: TournamentList");
    const tournamentList = [
      'function TournamentList({ title, competitions, selectedId, onLoad, onDelete, onCancelRefund, onSettle, deleting, cancelling, settling }: any) {',
      '  return (',
      '    <section>',
      '      <div className="mb-2 flex items-center justify-between"><h4 className="text-sm font-black uppercase tracking-[.14em] text-white/60">{title}</h4><Badge variant="outline">{competitions.length}</Badge></div>',
      '      <div className="space-y-2">',
      '        {competitions.length ? competitions.map((comp: any) => {',
      '          const status = String(comp.status || "").toLowerCase();',
      '          const settlement = comp.endDate || comp.end_date;',
      '          const settlementMs = new Date(String(settlement || "")).getTime();',
      '          const entryCount = Number(comp.entryCount ?? comp.entry_count ?? 0);',
      '          const refundedEntryCount = Number(comp.refundedEntryCount ?? comp.refunded_entry_count ?? 0);',
      '          const refundTotal = Number(comp.refundTotal ?? comp.refund_total ?? 0);',
      '          const isCancelled = status === "cancelled";',
      '          const isCompleted = status === "completed";',
      '          const readyToSettle = !isCancelled && !isCompleted && ["active", "closed"].includes(status) && Number.isFinite(settlementMs) && Date.now() >= settlementMs;',
      '          const canCancelRefund = !isCancelled && !isCompleted && entryCount > 0;',
      '          const canDelete = !isCancelled && !isCompleted && entryCount === 0;',
      '          const key = String(comp.prizeKey || comp.prize_key || "");',
      '          const isCard = key.startsWith("free-");',
      '          const prizeRarity = String(comp.prizeCardRarity || comp.prize_card_rarity || "");',
      '          return (',
      '            <div key={comp.id} className={`rounded-xl border p-3 text-sm transition ${String(selectedId) === String(comp.id) ? "border-cyan-300 bg-cyan-300/10" : "border-white/10 bg-black/25"}`}>',
      '              <button onClick={() => onLoad(comp)} className="w-full text-left">',
      '                <div className="flex items-center justify-between gap-3"><span className="font-bold">{comp.name}</span><Badge className="capitalize">{comp.status}</Badge></div>',
      '                <div className="mt-1 text-white/50">GW {comp.gameWeek ?? comp.game_week} • {comp.tier} cards • {isCard ? `FREE → ${prizeRarity || "card"} prize` : `Prize Ladder • Entry ${money(comp.entryFee ?? comp.entry_fee)}`}</div>',
      '                <div className="mt-1 text-xs text-cyan-100/60">Settlement: {settlementLabel(settlement)} • Entries: {entryCount}</div>',
      '              </button>',
      '              {isCancelled ? <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/10 p-2 text-xs text-amber-100">Cancelled • {refundedEntryCount || entryCount} {(refundedEntryCount || entryCount) === 1 ? "entry" : "entries"} processed • {money(refundTotal)} refunded</div> : null}',
      '              {readyToSettle ? <Button size="sm" disabled={settling} onClick={() => onSettle(comp)} className="mt-3 w-full bg-emerald-300 font-black text-slate-950 hover:bg-emerald-200"><CheckCircle2 className="mr-2 h-4 w-4" />{settling ? "Settling..." : "Settle Results"}</Button> : null}',
      '              {canCancelRefund ? <Button size="sm" disabled={cancelling} onClick={() => onCancelRefund(comp)} className="mt-2 w-full bg-amber-300 font-black text-slate-950 hover:bg-amber-200"><RotateCcw className="mr-2 h-4 w-4" />{cancelling ? "Refunding..." : `Cancel & Refund ${entryCount} ${entryCount === 1 ? "Entry" : "Entries"}`}</Button> : null}',
      '              {canDelete ? <Button variant="destructive" size="sm" disabled={deleting} onClick={() => onDelete(comp)} className="mt-2 w-full"><Trash2 className="mr-2 h-4 w-4" />Delete Empty Tournament</Button> : null}',
      '              {isCompleted ? <div className="mt-2 text-xs text-white/40">Completed tournaments are final and cannot be cancelled or refunded.</div> : null}',
      '            </div>',
      '          );',
      '        }) : <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-white/40">No tournaments in this section.</div>}',
      '      </div>',
      '    </section>',
      '  );',
      '}',
      '',
    ].join("\n");
    source = source.slice(0, functionStart) + tournamentList;
  }
  return source;
})) changed += 1;

console.log(`[admin-cancel-refund] ${changed ? `Patched ${changed} source file(s)` : "Verified"}: admins can cancel entered tournaments, refund entrant wallets, release locks, and send refund notifications.`);
