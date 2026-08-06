import { useEffect } from "react";
import { useToast } from "../hooks/use-toast";

type ActionNotice = {
  kind?: "card-listed" | "auction-bid" | "blocked" | "success";
  title?: string;
  message?: string;
  price?: number;
  amount?: number;
  code?: string;
};

function money(value: unknown) {
  const amount = Number(value || 0);
  return `N$${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
}

export default function GlobalActionToasts() {
  const { toast } = useToast();

  useEffect(() => {
    const onNotice = (event: Event) => {
      const detail = (event as CustomEvent<ActionNotice>).detail || {};
      if (detail.kind === "card-listed") {
        toast({
          title: detail.title || "Card listed on Marketplace",
          description: detail.message || `Your card is now visible to buyers at ${money(detail.price)}.`,
          duration: 4_500,
        });
        return;
      }
      if (detail.kind === "auction-bid") {
        toast({
          title: detail.title || "Auction bid accepted",
          description: detail.message || `Your ${money(detail.amount)} bid is secured in locked balance until you are outbid or the auction settles.`,
          duration: 4_500,
        });
        return;
      }
      if (detail.kind === "blocked") {
        toast({
          title: detail.title || "Action temporarily paused",
          description: detail.message || "This action is unavailable while Fantasy Arena is in production-preview mode.",
          variant: "destructive",
          duration: 5_500,
        });
        return;
      }
      toast({
        title: detail.title || "Action completed",
        description: detail.message,
        duration: 4_000,
      });
    };

    window.addEventListener("fantasy-arena-action-notice", onNotice as EventListener);
    return () => window.removeEventListener("fantasy-arena-action-notice", onNotice as EventListener);
  }, [toast]);

  return null;
}
