import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '../../lib/queryClient';

const money = (amount: number) => `${amount < 0 ? '-' : ''}N$${Math.abs(amount || 0).toFixed(2)}`;

export default function PlatformFinancePanel() {
  const { data, isLoading, isError } = useQuery<any>({ queryKey: ['/api/admin/platform-finance'], refetchInterval: 30000 });
  const { data: entries = [] } = useQuery<any[]>({ queryKey: ['/api/admin/free-cup-prize-entries'] });
  const { data: qaStatus } = useQuery<{ enabled: boolean }>({ queryKey: ['/api/admin/onboarding-audit/status'] });
  const [entryId, setEntryId] = useState('');
  const [amount, setAmount] = useState('');
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [message, setMessage] = useState('');
  const award = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/free-cup-cash-prize', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify({ entryId: Number(entryId), amount: Number(amount) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Award failed');
      return result;
    },
    onSuccess: () => {
      setMessage('Cash prize credited to the player and recorded as a platform prize cost.'); setAmount(''); setKey(crypto.randomUUID());
      queryClient.invalidateQueries({ queryKey: ['/api/admin/platform-finance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wallet'] });
    },
    onError: (error: Error) => setMessage(error.message),
  });
  return <section className="space-y-4 rounded-2xl border border-cyan-300/20 bg-[#07101d] p-5 text-white">
    <h3 className="text-xl font-black">Live platform finances</h3>
    <p className="text-xs text-slate-400">Testing balances and testing income are excluded. Won cards are valued at the rarity base price, even when the wallet balance is zero.</p>
    {isLoading ? <p>Loading finances…</p> : isError ? <p>Unable to load finances. Please refresh.</p> : data ? <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{[
        ['Platform income', data.revenue], ['Awarded card costs', -data.cardPrizeCosts], ['Cash prize costs', -data.cashPrizeCosts],
        ['Net result', data.netResult], ['Player wallet balances', data.walletAvailable], ['Player locked balances', data.walletLocked],
      ].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-white/5 p-3"><p className="text-xs text-slate-400">{label}</p><p className={`mt-1 text-lg font-black ${Number(value) < 0 ? 'text-rose-300' : 'text-cyan-100'}`}>{money(Number(value))}</p></div>)}</div>
      <p className="text-xs text-slate-400">{data.awards.map((a: any) => `${a.count} ${a.rarity} card${a.count === 1 ? '' : 's'} × ${money(a.basePrice)}`).join(' · ') || 'No awarded cards yet'}</p>
      <p className="text-xs text-slate-500">Card base values are tracked reward costs, not bank payments. Deposits belong to players and are not platform income.</p>
    </> : null}
    {qaStatus?.enabled ? <form method="post" action="/api/admin/onboarding-audit/start" className="border-t border-white/10 pt-4"><button className="rounded-xl border border-cyan-300/30 px-4 py-3 text-sm font-bold">Start temporary onboarding test</button><p className="mt-2 text-xs text-slate-400">Creates a zero-balance test club. Finish the test to remove its account and cards and return to Admin.</p></form> : null}
    <form className="space-y-3 border-t border-white/10 pt-4" onSubmit={event => { event.preventDefault(); if (!award.isPending) award.mutate(); }}>
      <h4 className="font-bold">Award a surprise cash prize</h4>
      <label className="block text-xs text-slate-300">Free cup entrant<select required value={entryId} disabled={award.isPending} onChange={event => { setEntryId(event.target.value); setKey(crypto.randomUUID()); setMessage(''); }} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-900 p-3 text-white"><option value="">Choose a completed free cup entrant</option>{entries.map(entry => <option key={entry.id} value={entry.id}>{entry.club} · {entry.competition} · #{entry.rank || '—'}</option>)}</select></label>
      <label className="block text-xs text-slate-300">Cash prize (N$)<input required type="number" min="0.01" max="100000" step="0.01" value={amount} disabled={award.isPending} onChange={event => { setAmount(event.target.value); setKey(crypto.randomUUID()); setMessage(''); }} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-900 p-3 text-white" /></label>
      <p className="text-xs text-slate-400">Crediting a prize increases the player’s wallet and immediately records the same amount as a platform cost.</p>
      <button disabled={award.isPending || !entryId || Number(amount) <= 0} className="rounded-xl bg-cyan-300 px-5 py-3 font-bold text-slate-950 disabled:opacity-40">{award.isPending ? 'Crediting…' : 'Credit cash prize'}</button>
      {message ? <p role="status" className="text-sm text-cyan-100">{message}</p> : null}
    </form>
  </section>;
}
