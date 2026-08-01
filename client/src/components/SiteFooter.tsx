import { Link } from "wouter";
import { Mail, ShieldCheck } from "lucide-react";

const BRAND_LOGO = "/brand/fantasy-arena-logo.jpg?v=lion-jpg-2026-08";

const groups = [
  {
    title: "Fantasy Arena",
    links: [
      ["About", "/about"],
      ["Contact Us", "/contact-us"],
      ["Help Centre", "/help"],
      ["FAQ", "/faq"],
    ],
  },
  {
    title: "Game Rules",
    links: [
      ["Official Game Rules", "/game-rules"],
      ["Scoring Rules", "/legal/scoring"],
      ["Prize Vault Rules", "/legal/prize-vault"],
      ["Marketplace Rules", "/legal/marketplace"],
      ["Fair Play & Anti-Cheat", "/legal/fair-play"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Terms & Conditions", "/terms-and-conditions"],
      ["Privacy Policy", "/privacy-policy"],
      ["AML & Verification", "/legal/aml-kyc"],
      ["Cookie Policy", "/legal/cookies"],
      ["Refunds & Withdrawals", "/legal/refunds"],
      ["Responsible Play", "/legal/responsible-play"],
    ],
  },
  {
    title: "Trust Centre",
    links: [
      ["System Status", "/trust/status"],
      ["Security", "/trust/security"],
      ["Payment Readiness", "/trust/payments"],
      ["Release Notes", "/trust/releases"],
      ["Roadmap", "/trust/roadmap"],
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-white/10 bg-[#03050d]/95 px-4 py-10 text-white sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.1fr_2.4fr]">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-fuchsia-300/25 bg-black shadow-[0_0_28px_rgba(168,85,247,.25)]">
              <img
                src={BRAND_LOGO}
                alt="Fantasy Arena crowned lion"
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <div className="font-black">Fantasy Arena</div>
              <div className="text-xs uppercase tracking-[.2em] text-white/45">Play • Compete • Win</div>
            </div>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/50">
            A fantasy football platform for collecting Premier League player cards, building lineups, entering skill-based competitions and unlocking real-world rewards.
          </p>
          <Link href="/contact-us" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-cyan-200 hover:text-cyan-100">
            <Mail className="h-4 w-4" /> Contact Fantasy Arena Support
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-7 sm:grid-cols-4">
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
        <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Policies require final Namibian legal review before commercial launch.</span>
      </div>
    </footer>
  );
}
