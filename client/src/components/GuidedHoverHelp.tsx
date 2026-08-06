import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleHelp, X } from "lucide-react";

type HelpState = {
  text: string;
  left: number;
  top: number;
  placement: "above" | "below";
};

const HELP_DELAY_MS = 3_000;
const HELP_LAYER = 2_147_483_000;
const TARGET_SELECTOR = [
  "[data-help]",
  "[aria-description]",
  "[aria-label]",
  "[title]",
  "button",
  "a",
  "input",
  "select",
  "textarea",
  "label",
  "[role='button']",
  "[role='tab']",
  "[role='menuitem']",
  "[data-testid]",
  "th",
  "td",
  "dt",
  "dd",
].join(",");

const explanations: Array<[RegExp, string]> = [
  [/\b(?:1\.5|1\.6|1\.7|1\.8|2\.0|2)\s*x\s*funding\b|funding multiplier/i, "The funding multiplier shows how much entry revenue must be collected before a prize unlocks. For example, a N$1,000 prize at 2.0× funding needs N$2,000 in entry revenue."],
  [/funding progress/i, "Funding progress compares the current entry revenue with the amount required to unlock this prize."],
  [/\bfloor\b|minimum price/i, "A floor is the minimum permitted entry fee or selling price for this rarity. It protects the value of the tournament or card market."],
  [/current prize/i, "This is the highest reward already unlocked by the current number of tournament entries."],
  [/\btier\b/i, "A tier is one step on the Prize Vault ladder. Higher tiers need more entries and unlock larger rewards."],
  [/\bentries\b/i, "Entries are confirmed tournament teams counted toward participation and Prize Vault funding."],
  [/\bremaining\b/i, "This is how many more entries are needed to reach the displayed target."],
  [/entry fee/i, "The entry fee is the amount charged for submitting one team to this tournament."],
  [/locked balance/i, "Locked balance is money temporarily reserved for a bid, withdrawal or other unresolved action. It cannot be spent elsewhere until released or settled."],
  [/wallet balance|available balance/i, "Available wallet balance is the amount currently free to spend, enter or withdraw."],
  [/current bid/i, "The current bid is the highest valid offer. A new bid must meet the displayed minimum increment."],
  [/minimum increment|min increment/i, "The minimum increment is the smallest amount by which a new auction bid must exceed the current bid."],
  [/buy now/i, "Buy Now immediately purchases the card or pack at the displayed fixed price, without waiting for the auction to finish."],
  [/total bids/i, "Total bids shows how many accepted offers have been placed on this auction."],
  [/ending soon/i, "This auction is close to its closing time. Bids submitted after the deadline are rejected by the server."],
  [/captain/i, "Your captain adds a 10% bonus to the lineup total. The player's own card score is not altered."],
  [/utility/i, "The Utility slot may use any eligible position after selecting a Goalkeeper, Defender, Midfielder and Forward."],
  [/lineup/i, "A lineup is the five-card team submitted to a tournament. Submitted tournament lineups are final and the cards stay locked until settlement or cancellation."],
  [/rarity/i, "Rarity controls tournament eligibility, supply and marketplace floor rules. It does not multiply football points."],
  [/prize vault/i, "The Prize Vault links tournament entry totals to a rarity-specific reward ladder. Only the highest fully unlocked prize is active."],
  [/marketplace/i, "The Marketplace is where eligible premium cards can be listed and purchased. Common cards remain tournament-only."],
  [/auction/i, "Auctions let users bid against one another. The highest valid bid is held securely until the auction is settled or the bidder is outbid."],
  [/collection/i, "Your Collection contains the player cards owned by your account, including their rarity, status and market availability."],
  [/live entries/i, "Live Entries counts your tournament teams that are still open or active."],
  [/lineup score/i, "Lineup Score is the current combined score of the five cards in your active lineup."],
  [/unlocked/i, "Unlocked means the required entry funding has been reached for this reward tier."],
  [/listed/i, "Listed means the card is currently visible for sale on the Marketplace."],
  [/edit lineup/i, "Edit Lineup lets you choose the five cards used as your default active squad. Tournament entries may use their own submitted teams."],
  [/show \/ hide menu|menu/i, "Open or collapse the main navigation sidebar."],
  [/community live|community/i, "Community Live is the public manager chat. Replies, mentions, edits and deletions are supported, and disrespectful language is blocked."],
];

function cleanLabel(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 120);
}

function visibleLabel(element: HTMLElement) {
  const explicit =
    element.dataset.help ||
    element.getAttribute("aria-description") ||
    element.getAttribute("aria-label") ||
    element.getAttribute("title");
  if (explicit) return cleanLabel(explicit);

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return cleanLabel(element.placeholder || element.name || "Input field");
  }
  if (element instanceof HTMLSelectElement) {
    return cleanLabel(element.selectedOptions[0]?.textContent || element.name || "Selection");
  }
  return cleanLabel(element.innerText || element.textContent || "");
}

function explain(element: HTMLElement) {
  const explicit = element.dataset.help || element.getAttribute("aria-description");
  if (explicit) return cleanLabel(explicit);

  const label = visibleLabel(element);
  if (!label || label.length < 2) return "";
  for (const [pattern, explanation] of explanations) {
    if (pattern.test(label)) return explanation;
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return `Enter ${label.toLowerCase()} here.`;
  }
  if (element instanceof HTMLSelectElement) {
    return `Choose the required ${label.toLowerCase()} option here.`;
  }
  if (element.matches("a")) return `Open ${label}.`;
  if (element.matches("button,[role='button'],[role='tab'],[role='menuitem']")) {
    return `Use this control to ${label.replace(/[.!?]+$/, "").toLowerCase()}.`;
  }
  return `This shows ${label}.`;
}

function findTarget(raw: EventTarget | null): HTMLElement | null {
  if (!(raw instanceof Element)) return null;
  const target = raw.closest<HTMLElement>(TARGET_SELECTOR);
  if (!target || target.closest("[data-guided-help-popup]")) return null;
  if (target.hasAttribute("data-help-disabled") || target.getAttribute("aria-hidden") === "true") return null;
  const rect = target.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4 || rect.width > window.innerWidth * 0.96) return null;
  return target;
}

export default function GuidedHoverHelp() {
  const [help, setHelp] = useState<HelpState | null>(null);
  const [introVisible, setIntroVisible] = useState(false);
  const timerRef = useRef<number | null>(null);
  const activeRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const seenKey = "fantasy_arena_guided_help_intro_seen";
    if (!window.sessionStorage.getItem(seenKey)) {
      window.sessionStorage.setItem(seenKey, "1");
      setIntroVisible(true);
      const introTimer = window.setTimeout(() => setIntroVisible(false), 7_000);
      return () => window.clearTimeout(introTimer);
    }
  }, []);

  useEffect(() => {
    const clear = () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      activeRef.current = null;
      setHelp(null);
    };

    const schedule = (element: HTMLElement) => {
      if (activeRef.current === element) return;
      clear();
      activeRef.current = element;
      timerRef.current = window.setTimeout(() => {
        if (activeRef.current !== element || !element.isConnected) return;
        const text = explain(element);
        if (!text) return;
        const rect = element.getBoundingClientRect();
        const width = Math.min(340, window.innerWidth - 24);
        const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2));
        const placement: "above" | "below" = rect.top > 150 ? "above" : "below";
        const top = placement === "above"
          ? Math.max(12, rect.top - 12)
          : Math.min(window.innerHeight - 12, rect.bottom + 12);
        setHelp({ text, left, top, placement });
      }, HELP_DELAY_MS);
    };

    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      const target = findTarget(event.target);
      if (target) schedule(target);
    };
    const onPointerOut = (event: PointerEvent) => {
      if (!activeRef.current) return;
      const related = event.relatedTarget;
      if (related instanceof Node && activeRef.current.contains(related)) return;
      clear();
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = findTarget(event.target);
      if (target) schedule(target);
    };

    document.addEventListener("pointerover", onPointerOver, true);
    document.addEventListener("pointerout", onPointerOut, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", clear, true);
    document.addEventListener("click", clear, true);
    window.addEventListener("scroll", clear, true);
    window.addEventListener("resize", clear);
    return () => {
      clear();
      document.removeEventListener("pointerover", onPointerOver, true);
      document.removeEventListener("pointerout", onPointerOut, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", clear, true);
      document.removeEventListener("click", clear, true);
      window.removeEventListener("scroll", clear, true);
      window.removeEventListener("resize", clear);
    };
  }, []);

  const content = (
    <>
      {help ? (
        <div
          data-guided-help-popup
          className="pointer-events-none fixed w-[min(340px,calc(100vw-24px))] rounded-2xl border border-cyan-200/25 bg-slate-950/88 p-3 text-sm leading-5 text-white shadow-[0_18px_55px_rgba(0,0,0,.62),0_0_24px_rgba(34,211,238,.12)] backdrop-blur-2xl"
          style={{
            left: help.left,
            top: help.top,
            zIndex: HELP_LAYER,
            transform: help.placement === "above" ? "translateY(-100%)" : undefined,
          }}
          role="tooltip"
        >
          <div className="flex gap-2">
            <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
            <p>{help.text}</p>
          </div>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-[.14em] text-white/30">
            Guided help · appeared after 3 seconds
          </p>
        </div>
      ) : null}

      {introVisible ? (
        <div
          data-guided-help-popup
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] right-3 w-[min(360px,calc(100vw-24px))] rounded-2xl border border-cyan-200/25 bg-slate-950/88 p-4 text-white shadow-[0_20px_65px_rgba(0,0,0,.62)] backdrop-blur-2xl sm:bottom-4 sm:right-4"
          style={{ zIndex: HELP_LAYER - 1 }}
        >
          <button
            type="button"
            onClick={() => setIntroVisible(false)}
            className="absolute right-2 top-2 rounded-lg p-1 text-white/45 hover:bg-white/10 hover:text-white"
            aria-label="Close guided help introduction"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex gap-3 pr-5">
            <div className="rounded-xl bg-cyan-300/12 p-2 text-cyan-300">
              <CircleHelp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black">Guided help is active</p>
              <p className="mt-1 text-xs leading-5 text-white/58">
                Keep your pointer still over a tab, label, number or button for 3 seconds to see what it means.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );

  return typeof document === "undefined" ? content : createPortal(content, document.body);
}
