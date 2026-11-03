import { useQuery } from "@tanstack/react-query";

type Entry = { id: number; email?: string; userId: string; name: string; gameWeek: number; status: string; rank?: number | null; totalScore?: number | null };
type CardLock = { cardId: number; email?: string; userId: string; name?: string; refId: string; gameWeek?: number; status?: string; endDate?: string };

export default function AdminEntryMonitor() {
  const { data, isLoading, isError } = useQuery<{ entries: Entry[]; locks: CardLock[] }>({
    queryKey: ["/api/admin/entry-monitor"], refetchInterval: 30_000,
  });
  return (
    <section className="my-4 min-w-0 rounded-xl border border-white/15 p-3 sm:p-4">
      <h3 className="font-bold">Tournament results & card locks</h3>
      <p className="mt-1 text-sm text-white/60">Latest 100 real tournament entries and locks. Historical simulator data is excluded; accepted and rejected attempts remain in Activity.</p>
      {isLoading ? <p>Loading…</p> : isError ? <p role="alert">Unable to load entry monitor.</p> : (
        <>
          <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
            {data?.entries.map(entry => (
              <article key={entry.id} className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 break-all font-semibold text-cyan-100">{entry.email || entry.userId}</span>
                  <span className="rounded-full border border-white/15 px-2 py-0.5 text-xs capitalize">{entry.status}</span>
                </div>
                <p className="mt-2 break-words font-medium text-white">{entry.name} · GW{entry.gameWeek}</p>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/65">
                  <span>Place: {entry.rank ?? "—"}</span>
                  <span>Points: {entry.totalScore ?? "—"}</span>
                </div>
              </article>
            ))}
            {!data?.entries.length ? <p className="p-3 text-sm text-white/60">No real tournament entries recorded.</p> : null}
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm">Competition card locks ({data?.locks.length || 0})</summary>
            <ul className="space-y-2 pt-3 text-xs">
              {data?.locks.map((lock, i) => (
                <li key={i} className="min-w-0 rounded-lg border border-white/10 p-2">
                  <div className="break-all text-cyan-100">{lock.email || lock.userId}</div>
                  <div className="break-words text-white/70">Card #{lock.cardId} · {lock.name || `Tournament ${lock.refId}`} · GW{lock.gameWeek || "?"} · {lock.status || "missing tournament"}</div>
                  <div className="text-white/50">Settlement: {lock.endDate ? new Date(lock.endDate).toLocaleString() : "unknown"}</div>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}
