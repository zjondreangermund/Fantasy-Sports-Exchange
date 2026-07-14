import { Link } from "wouter";
import { Mail, ShieldCheck, Trophy } from "lucide-react";

const groups = [
  {
    title: "Fantasy Arena",
    links: [
      ["About", "/about"],
      ["Contact Us", "/contact"],
      ["Help Centre", "/help"],
      ["FAQ", "/faq"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Terms of Service", "/legal/terms"],
      ["Privacy Policy", "/legal/privacy"],
      ["AML & Verification", "/legal/aml-kyc"],
      ["Cookie Policy", "/legal/cookies"],
      ["Refunds & Withdrawals", "/legal/refunds"],
    ],
  },
  {
    title: "Play Safely",
    links: [
      ["Responsible Play", "/legal/responsible-play"],
      ["Fair Play & Anti-Cheat", "/legal/fair-play"],
      ["Marketplace Rules", "/legal/marketplace"],
      ["Prize Vault Rules", "/legal/prize-vault"],
      ["Scoring Rules", "/legal/scoring"],
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-white/10 bg-[#03050d]/95 px-4 py-10 text-white sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.25fr_2fr]">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-200">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <div className="font-black">Fantasy Arena</div>
              <div className="text-xs uppercase tracking-[.2em] text-white/45">Play • Compete • Win</div>
            </div>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/50">
            A fantasy football platform for collecting player cards, building lineups, entering skill-based competitions and unlocking real-world rewards.
          </p>
          <a href="mailto:support@fantasyarena.com" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-cyan-200 hover:text-cyan-100">
            <Mail className="h-4 w-4" /> support@fantasyarena.com
          </a>
        </div>

        <div className="grid grid-cols-2 gap-7 sm:grid-cols-3">
          {groups.map((group) => (
            <div key={group.title}>
              <div className="mb-3 text-xs font-black uppercase tracking-[.18em] text-white/70">{group.title}</div>
              <div className="space-y-2.5">
                {group.links.map(([label, href]) => (
                  <Link key={href} href={href} className="block text-sm text-white/45 transition hover:text-white">
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-8 flex max-w-7xl flex-col gap-3 border-t border-white/10 pt-5 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between">
        <span>© 2026 Fantasy Arena. All rights reserved.</span>
        <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Policies require final review before commercial launch.</span>
      </div>
    </footer>
  );
}
