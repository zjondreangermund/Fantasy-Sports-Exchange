import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, ShieldAlert } from "lucide-react";
import { setClientSecurityStatus, type PublicSecurityStatus } from "../lib/security-mode";

export default function SecurityModeBanner() {
  const { data } = useQuery<PublicSecurityStatus>({
    queryKey: ["/api/security/status"],
    staleTime: 0,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (data) setClientSecurityStatus(data);
  }, [data]);

  const pausedLabels = useMemo(() => {
    if (!data || data.readOnly) return [];
    return [
      data.authPaused ? "new logins" : "",
      data.depositsPaused ? "deposits" : "",
      data.withdrawalsPaused ? "withdrawals" : "",
      data.marketplacePaused ? "marketplace and loans" : "",
      data.auctionsPaused ? "auctions" : "",
    ].filter(Boolean);
  }, [data]);

  if (!data?.readOnly && pausedLabels.length === 0) return null;

  if (data?.readOnly) {
    return (
      <div className="relative z-[70] shrink-0 border-b border-amber-300/30 bg-amber-300 px-3 py-2 text-slate-950 shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 text-center text-xs font-black sm:text-sm">
          <Eye className="h-4 w-4 shrink-0" />
          <span>VIEW-ONLY MODE — buying, selling, loans, auctions, wallet actions, tournament entries, account changes and admin operations are paused.</span>
        </div>
        {data.message ? <p className="mx-auto mt-1 max-w-5xl text-center text-[11px] font-semibold text-slate-800">{data.message}</p> : null}
      </div>
    );
  }

  return (
    <div className="relative z-[70] shrink-0 border-b border-orange-300/30 bg-orange-950 px-3 py-2 text-orange-100">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 text-center text-xs font-bold sm:text-sm">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span>Temporarily paused: {pausedLabels.join(", ")}.</span>
      </div>
    </div>
  );
}
