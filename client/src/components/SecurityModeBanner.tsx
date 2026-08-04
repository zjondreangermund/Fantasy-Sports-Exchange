import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export type PublicSecurityStatus = {
  readOnlyMode: boolean;
  blockedMessage: string;
};

export default function SecurityModeBanner() {
  const [status, setStatus] = useState<PublicSecurityStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await apiRequest("GET", "/api/security/status");
        const next = await response.json();
        if (!cancelled) setStatus(next);
      } catch {
        // The server remains the final protection if the status endpoint is temporarily unavailable.
      }
    };

    load();
    const timer = window.setInterval(load, 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("fantasy-arena-security-status", { detail: status }));
  }, [status]);

  if (!status?.readOnlyMode) return null;

  return (
    <div className="sticky top-0 z-[70] border-b border-amber-300/50 bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-300 px-3 py-2 text-center text-black shadow-[0_8px_26px_rgba(245,158,11,.22)]">
      <div className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wide sm:text-sm">
        <Eye className="h-4 w-4" />
        FANTASY ARENA IS IN PRODUCTION — explore the arena while launch systems are being completed.
      </div>
      <div className="mt-0.5 text-[10px] font-semibold leading-snug sm:text-xs">
        New users may sign up, complete starter onboarding and collect the daily Common-card reward. Trading, loans, wallet actions, auctions and tournament entries remain safely paused until launch readiness is complete.
      </div>
    </div>
  );
}
