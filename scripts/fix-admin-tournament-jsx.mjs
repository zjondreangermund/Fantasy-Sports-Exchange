import fs from 'node:fs';

const file = 'client/src/components/admin/AdminTournamentManager.tsx';
let text = fs.readFileSync(file, 'utf8');
const broken = `          </div><div className="mt-1 text-white/50">GW {comp.gameWeek} • {comp.tier} ladder • Entry {money(comp.entryFee)} • {comp.prizeDescription || "Prize Vault ladder"}</div><div className="mt-1 text-xs text-cyan-100/60">Unlock: {comp.requiredEntrants || 0} entries • Current: {comp.entryCount || 0} • {comp.prizeUnlocked ? "Prize unlocked" : "Prize locked"}</div><div className="mt-1 text-xs text-cyan-100/60">Cutoff: {comp.submissionClosesAt ? new Date(comp.submissionClosesAt).toLocaleString() : "first fixture fallback"}</div></button>)}{sortedCompetitions.length === 0 && <div className="rounded-xl border border-white/10 bg-black/25 p-4 text-sm text-white/45">No tournaments found.</div>}</div>`;
if (!text.includes(broken)) throw new Error('Broken Admin tournament JSX fragment not found');
text = text.replace(broken, '          </div>');
fs.writeFileSync(file, text);
