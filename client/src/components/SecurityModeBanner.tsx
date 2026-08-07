import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Eye, Gavel, LockKeyhole } from "lucide-react";
import { apiRequest } from "../lib/queryClient";
import { useAuth } from "../hooks/use-auth";
import {
  setClientSecurityStatus,
  type PublicSecurityStatus,
} from "../lib/security-mode";

export default function SecurityModeBanner() {
  const [location] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const [status, setStatus] = useState<PublicSecurityStatus | null>(null);
  const { data: onboarding, isLoading: onboardingLoading } = useQuery<{ completed: boolean }>({
    queryKey: ["/api/onboarding/status"],
    enabled: Boolean(user),
    staleTime: 15_000,
  });

  const onboardingRoute =
    location.startsWith("/onboarding") ||
    location.startsWith("/card-reveal");
  const mainAppReady = Boolean(
    !authLoading &&
      !onboardingLoading &&
      user &&
      onboarding?.completed &&
      !onboardingRoute,
  );

  useEffect(() => {
    if (!mainAppReady) {
      setStatus(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const response = await apiRequest("GET", "/api/security/status");
        const next = (await response.json()) as PublicSecurityStatus;
        if (cancelled) return;
        setStatus(next);
        setClientSecurityStatus(next);
        window.dispatchEvent(
          new CustomEvent("fantasy-arena-security-status", { detail: next }),
        );
      } catch {
        // Server-side security controls remain authoritative if this status request fails.
      }
    };

    void load();
    const timer = window.setInterval(load, 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [mainAppReady]);

  if (!mainAppReady || !status?.readOnly) return null;

  return (
    <aside
      className="pointer-events-none fixed inset-x-2 top-2 z-[160] mx-auto max-w-5xl rounded-2xl border border-amber-200/55 bg-slate-950/88 px-3 py-2 text-amber-50 shadow-[0_14px_50px_rgba(0,0,0,.55),0_0_30px_rgba(245,158,11,.18)] backdrop-blur-2xl sm:px-4"
      aria-live="polite"
      data-help="Fantasy Arena is in production-preview mode. Signed-in managers can explore the full arena, while money, tournament, marketplace and auction actions remain paused until the administrator turns off Read-only mode."
    >
      <div className="flex items-start justify-center gap-2 text-center">
        <Eye className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.16em] sm:text-xs">
            Production preview · Read-only mode
          </p>
          <p className="mt-0.5 text-[10px] leading-4 text-amber-100/72 sm:text-[11px]">
            Explore the arena and your starter rewards. Trading, wallet actions,
            tournament entries and auction bids are paused until launch controls are opened.
          </p>
        </div>
        <div className="hidden shrink-0 items-center gap-1 text-amber-200/70 sm:flex">
          <LockKeyhole className="h-3.5 w-3.5" />
          <Gavel className="h-3.5 w-3.5" />
        </div>
      </div>
    </aside>
  );
}
