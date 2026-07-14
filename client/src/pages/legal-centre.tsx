import { Link, useLocation } from "wouter";
import { AlertTriangle, CheckCircle2, FileText, Mail, Scale, ShieldCheck } from "lucide-react";

const updated = "14 July 2026";

type Section = { title: string; paragraphs?: string[]; bullets?: string[] };
type Document = { title: string; intro: string; sections: Section[] };

const documents: Record<string, Document> = {
  "/legal/terms": {
    title: "Terms of Service",
    intro: "These terms govern access to Fantasy Arena, including accounts, digital player cards, competitions, the marketplace, wallets and Prize Vault rewards.",
    sections: [
      { title: "Eligibility and accounts", bullets: ["Users must be at least 18 years old unless a different minimum age is approved for a specific market.", "One account per person. Account information must be accurate and kept secure.", "Fantasy Arena may restrict, suspend or close accounts linked to fraud, abuse, prohibited automation or unlawful activity."] },
      { title: "Skill-based competitions", bullets: ["Competition results are determined by the published Fantasy Arena scoring rules and official match data.", "Statistics may be corrected after a match. Rankings may be recalculated before settlement.", "Fantasy Arena may postpone, cancel or amend a competition where fixtures, data feeds, technical failures or integrity concerns make fair settlement impossible."] },
      { title: "Digital player cards", bullets: ["Cards are licensed digital platform items used inside Fantasy Arena. They are not shares, securities, cryptocurrency or legal ownership of a football player.", "Card availability, rarity, floor prices and utility may change as the platform evolves.", "Users may buy, sell or loan cards only through supported Fantasy Arena features."] },
      { title: "Wallets, payments and withdrawals", bullets: ["Deposits and withdrawals may be processed by third-party payment providers.", "Fantasy Arena may request verification before withdrawals, refunds, high-risk transactions or where required by a provider or law.", "Chargebacks, payment reversals, duplicate credits and fraud may result in wallet adjustments or account restrictions."] },
      { title: "Prizes", bullets: ["Winners may be required to verify identity, age and delivery details before a prize is released.", "Where a physical prize is unavailable, Fantasy Arena may offer a comparable replacement or approved cash equivalent.", "Delivery times, taxes, duties and regional availability may vary."] },
      { title: "Liability and service availability", bullets: ["Fantasy Arena does not guarantee uninterrupted access or error-free third-party data.", "To the maximum extent permitted, liability is limited to direct losses caused by Fantasy Arena and excludes indirect or speculative loss.", "Nothing in these terms removes rights that cannot lawfully be excluded."] },
    ],
  },
  "/legal/privacy": {
    title: "Privacy Policy",
    intro: "This policy explains how Fantasy Arena collects, uses, stores and shares personal information.",
    sections: [
      { title: "Information collected", bullets: ["Account details such as name, email, phone number, date of birth and profile information.", "Payment, wallet and transaction records. Card details are handled by payment providers where possible.", "Device, browser, IP address, login, gameplay, marketplace, competition and support activity.", "Identity documents only when verification is required."] },
      { title: "How information is used", bullets: ["Operate accounts, competitions, rankings, wallets, payments and prize delivery.", "Prevent fraud, abuse, multi-accounting, money laundering and security incidents.", "Provide support, service messages and optional marketing communications.", "Improve products, analytics, performance and platform safety."] },
      { title: "Sharing", bullets: ["Payment, identity, cloud hosting, analytics, customer support and sports-data providers may receive information needed to perform their services.", "Information may be shared with authorities or professional advisers where legally required or necessary to protect users and Fantasy Arena.", "Fantasy Arena does not sell personal information as a standalone product."] },
      { title: "Retention and rights", bullets: ["Information is retained only for operational, legal, security and dispute-resolution needs.", "Users may request access, correction or deletion, subject to records Fantasy Arena must retain.", "Requests can be sent to privacy@fantasyarena.com."] },
    ],
  },
  "/legal/aml-kyc": {
    title: "AML & Tiered Verification Policy",
    intro: "Fantasy Arena uses proportionate, risk-based verification. Most users can explore and play without uploading identity documents immediately.",
    sections: [
      { title: "Low-friction onboarding", bullets: ["Users may register, browse, collect cards and use permitted platform features with basic account information.", "Identity documents are not requested automatically from every new user.", "Phone or email verification may still be required for account security."] },
      { title: "When verification may be required", bullets: ["Before certain withdrawals, prize claims, refunds or payment reversals.", "When transaction values, frequency or behaviour create elevated risk.", "Where a bank, wallet, payment gateway, card network, regulator or law requires verification.", "Where suspected fraud, duplicate accounts, stolen payments, sanctions exposure or marketplace manipulation must be investigated."] },
      { title: "Possible checks", bullets: ["Full legal name, date of birth, address and contact details.", "Government-issued ID or passport, selfie/liveness check and proof of address.", "Source of funds or additional documents for higher-risk activity."] },
      { title: "Monitoring and restrictions", bullets: ["Fantasy Arena may delay, reject or reverse suspicious transactions and temporarily restrict affected accounts.", "Users must not structure transactions to avoid controls or use another person's payment method without permission.", "Suspicious activity may be reported where required."] },
    ],
  },
  "/legal/cookies": {
    title: "Cookie Policy",
    intro: "Fantasy Arena uses cookies and similar storage technologies to keep the platform secure and functional.",
    sections: [
      { title: "Cookie types", bullets: ["Essential cookies for login, security, fraud prevention and core navigation.", "Preference cookies for themes, language and saved settings.", "Analytics cookies for performance and product improvement, where enabled.", "Marketing cookies only where consent or applicable rules allow them."] },
      { title: "Controls", paragraphs: ["Browser settings can block or delete cookies, but disabling essential cookies may prevent login or other platform functions."] },
    ],
  },
  "/legal/refunds": {
    title: "Refunds & Withdrawals",
    intro: "This policy explains how failed payments, cancelled competitions, withdrawals and chargebacks are handled.",
    sections: [
      { title: "Deposits", bullets: ["Successful wallet deposits are generally final once credited, except for duplicate charges, technical errors or legal rights that apply.", "Failed or pending transactions remain subject to the payment provider's processing time."] },
      { title: "Marketplace purchases", bullets: ["Completed card purchases are normally final because ownership transfers immediately.", "Fantasy Arena may reverse transactions caused by platform errors, fraud, duplicate processing or unauthorised access."] },
      { title: "Competition refunds", bullets: ["Entry amounts may be returned when Fantasy Arena cancels a competition before settlement.", "No refund is normally due where a user selected an invalid lineup, missed a deadline or lost based on valid scoring."] },
      { title: "Withdrawals", bullets: ["Withdrawals are subject to available balance, payment-provider support, fraud screening and any required verification.", "Processing times vary by payment method.", "Fantasy Arena may pause a withdrawal while investigating chargebacks, suspicious activity or account ownership."] },
    ],
  },
  "/legal/responsible-play": {
    title: "Responsible Play",
    intro: "Fantasy Arena is designed as entertainment and a game of football knowledge and strategy. Users should play within affordable limits.",
    sections: [
      { title: "Play safely", bullets: ["Never use money needed for food, rent, transport, education or debt repayments.", "Set personal deposit and spending limits.", "Take breaks and avoid chasing losses or impulsive marketplace purchases.", "Contact support to request a cooling-off period, deposit restriction or self-exclusion."] },
      { title: "Underage access", paragraphs: ["Fantasy Arena is not intended for minors where paid competitions or monetary features are offered."] },
    ],
  },
  "/legal/fair-play": {
    title: "Fair Play & Anti-Cheat Policy",
    intro: "Every user must compete on equal terms and protect the integrity of Fantasy Arena.",
    sections: [
      { title: "Prohibited conduct", bullets: ["Multiple accounts, account sharing or identity misuse.", "Bots, scripts, scraping, automated purchasing or automated competition entry without written permission.", "Exploiting bugs, manipulating prices, collusion, wash trading or coordinating fraudulent transactions.", "Abusing referrals, promotions, refunds, chargebacks or payment methods."] },
      { title: "Enforcement", bullets: ["Fantasy Arena may remove entries, reverse rewards, freeze assets, suspend accounts or permanently ban users.", "Serious cases may be referred to payment providers or authorities."] },
    ],
  },
  "/legal/marketplace": {
    title: "Marketplace Rules",
    intro: "These rules apply to card sales, purchases, loans and future auction features.",
    sections: [
      { title: "Listings and ownership", bullets: ["Only cards owned and eligible for transfer may be listed.", "The seller is responsible for reviewing price, rarity and card details before confirming.", "Ownership transfers after successful payment and final platform confirmation."] },
      { title: "Pricing and fees", bullets: ["Rarity floor prices may be enforced by the platform.", "Any platform or payment fees must be shown before confirmation.", "Manipulative pricing, wash trading and coordinated artificial volume are prohibited."] },
      { title: "Loans and auctions", bullets: ["Loan duration, lineup eligibility and return timing are governed by the terms shown at confirmation.", "Auction bids may be binding once accepted by the system."] },
    ],
  },
  "/legal/prize-vault": {
    title: "Prize Vault Rules",
    intro: "Prize Vault rewards are linked to rarity-specific entry counts and funding targets.",
    sections: [
      { title: "Unlocking", bullets: ["Each rarity has a separate ladder, entry value and gameweek count.", "Only the highest fully unlocked prize for that rarity and gameweek is awarded unless a promotion states otherwise.", "Progress may reset each gameweek while the season prize catalogue remains visible."] },
      { title: "Claim and substitution", bullets: ["The winner must complete any required identity, age, contact and delivery checks.", "A physical prize may be replaced with a comparable item or approved cash equivalent where supply, location or delivery makes the original impractical.", "Unclaimed prizes may expire after the claim period stated in the winner notification."] },
    ],
  },
  "/legal/scoring": {
    title: "Scoring Rules",
    intro: "Fantasy Arena scores five-card lineups using real match statistics and the scoring model published in the platform.",
    sections: [
      { title: "Scoring process", bullets: ["Player events and statistics are received from third-party football-data providers.", "Each card receives an official score based on minutes, decisive actions, all-around actions and applicable bonuses or penalties.", "Captain multipliers and competition-specific rules are shown before entry."] },
      { title: "Corrections", bullets: ["Live scores are provisional.", "Official data corrections may change player scores and rankings before settlement.", "The scoring breakdown displayed in Fantasy Arena is the controlling calculation for platform competitions."] },
    ],
  },
};

const generalPages: Record<string, Document> = {
  "/about": {
    title: "About Fantasy Arena",
    intro: "Fantasy Arena combines fantasy football, collectible player cards, a live marketplace, rarity tournaments and real-world Prize Vault rewards.",
    sections: [
      { title: "Our mission", paragraphs: ["We are building a premium football experience where knowledge, collection strategy and matchday performance matter."] },
      { title: "How it works", bullets: ["Collect and trade digital player cards.", "Build five-card lineups.", "Compete using real match statistics.", "Climb rankings and unlock rewards."] },
    ],
  },
  "/contact": {
    title: "Contact Us",
    intro: "Choose the address that best matches your request. Replace any mailbox below before launch if your final company email setup differs.",
    sections: [
      { title: "Support", bullets: ["General help: support@fantasyarena.com", "Payments and withdrawals: payments@fantasyarena.com", "Privacy requests: privacy@fantasyarena.com", "Legal enquiries: legal@fantasyarena.com", "Partnerships: partners@fantasyarena.com", "Media: media@fantasyarena.com"] },
      { title: "What to include", bullets: ["Your account email or username.", "Relevant transaction, competition or card reference.", "Screenshots where useful, without exposing passwords or payment credentials."] },
    ],
  },
  "/help": {
    title: "Help Centre",
    intro: "Find guidance for accounts, cards, competitions, payments, the marketplace and Prize Vault.",
    sections: [
      { title: "Accounts", bullets: ["Signing in and account recovery.", "Profile and security settings.", "Verification requests and account restrictions."] },
      { title: "Cards and marketplace", bullets: ["Buying, selling, loaning and card ownership.", "Rarity floor prices and failed transactions."] },
      { title: "Competitions and prizes", bullets: ["Lineup requirements, captain selection and deadlines.", "Live scoring, ranking corrections, settlement and prize claims."] },
      { title: "Payments", bullets: ["Deposits, pending payments, withdrawals, refunds and chargebacks."] },
    ],
  },
  "/faq": {
    title: "Frequently Asked Questions",
    intro: "Quick answers to common Fantasy Arena questions.",
    sections: [
      { title: "Do I need to verify immediately?", paragraphs: ["Not normally. Fantasy Arena uses tiered, risk-based verification and may request documents for withdrawals, prize claims, higher-risk activity or provider requirements."] },
      { title: "How many cards are used?", paragraphs: ["A standard Fantasy Arena lineup uses five eligible cards, including the required football positions shown by the tournament."] },
      { title: "How are points calculated?", paragraphs: ["Points come from real match statistics. Live points are provisional and can change after official data corrections."] },
      { title: "Can I sell my cards?", paragraphs: ["Eligible cards can be listed through the marketplace, subject to rarity floors, status and platform rules."] },
      { title: "How do Prize Vault rewards unlock?", paragraphs: ["Each rarity ladder uses its own entry count and funding target. The highest fully unlocked reward becomes the active prize for that gameweek."] },
    ],
  },
};

const navigation = [
  ["Terms", "/legal/terms"], ["Privacy", "/legal/privacy"], ["AML & Verification", "/legal/aml-kyc"], ["Responsible Play", "/legal/responsible-play"],
  ["Fair Play", "/legal/fair-play"], ["Marketplace", "/legal/marketplace"], ["Prize Vault", "/legal/prize-vault"], ["Scoring", "/legal/scoring"],
  ["Refunds", "/legal/refunds"], ["Cookies", "/legal/cookies"],
];

export default function LegalCentrePage() {
  const [location] = useLocation();
  const doc = documents[location] || generalPages[location] || generalPages["/help"];
  const isLegal = location.startsWith("/legal/");

  return (
    <main className="min-h-screen bg-[#02040c] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-2 font-black text-white"><ShieldCheck className="h-5 w-5 text-cyan-300" />Fantasy Arena</Link>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/about" className="rounded-full border border-white/10 px-3 py-1.5 text-white/60 hover:text-white">About</Link>
            <Link href="/help" className="rounded-full border border-white/10 px-3 py-1.5 text-white/60 hover:text-white">Help</Link>
            <Link href="/contact" className="rounded-full border border-white/10 px-3 py-1.5 text-white/60 hover:text-white">Contact</Link>
          </div>
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_85%_0%,rgba(34,211,238,.16),transparent_35%),linear-gradient(145deg,#0b1020,#050711)] p-5 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-3 text-cyan-200">{isLegal ? <Scale className="h-6 w-6" /> : <FileText className="h-6 w-6" />}</div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-200/70">Fantasy Arena Trust Centre</div>
              <h1 className="mt-2 text-3xl font-black sm:text-5xl">{doc.title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">{doc.intro}</p>
              <div className="mt-3 text-xs text-white/35">Last updated: {updated}</div>
            </div>
          </div>
        </section>

        {isLegal && <nav className="mt-5 flex gap-2 overflow-x-auto pb-2">{navigation.map(([label, href]) => <Link key={href} href={href} className={`whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-bold ${location === href ? "border-cyan-300/50 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/[.03] text-white/45 hover:text-white"}`}>{label}</Link>)}</nav>}

        <div className="mt-5 grid gap-4">
          {doc.sections.map((section) => (
            <section key={section.title} className="rounded-2xl border border-white/10 bg-white/[.035] p-5 sm:p-6">
              <h2 className="text-lg font-black">{section.title}</h2>
              {section.paragraphs?.map((paragraph) => <p key={paragraph} className="mt-3 text-sm leading-6 text-white/55">{paragraph}</p>)}
              {section.bullets && <ul className="mt-3 space-y-3">{section.bullets.map((bullet) => <li key={bullet} className="flex gap-3 text-sm leading-6 text-white/55"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-cyan-300" /><span>{bullet}</span></li>)}</ul>}
            </section>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/[.07] p-5 text-sm text-amber-100/75">
          <div className="flex gap-3"><AlertTriangle className="h-5 w-5 shrink-0" /><p>These pages provide a strong operational draft for users and payment-provider review. They must be reviewed by a qualified Namibian legal and compliance professional before paid public launch.</p></div>
        </div>

        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="font-black">Need help with this policy?</div><div className="mt-1 text-sm text-white/45">Contact the Fantasy Arena support team.</div></div>
          <a href="mailto:support@fantasyarena.com" className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-black text-black"><Mail className="h-4 w-4" />Email support</a>
        </div>
      </div>
    </main>
  );
}
