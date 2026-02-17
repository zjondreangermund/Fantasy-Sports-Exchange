// Fixed: Since RewardPopup is in /components/, use ./ui/ to find the dialog
import { Dialog, DialogContent } from "./ui/dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
// Fixed: PlayerCard is a neighbor in the same /components/ folder
import PlayerCard from "./PlayerCard";
import { Trophy, Gift, DollarSign, Star } from "lucide-react";

interface RewardPopupProps {
  rewards: any[];
  onClose: () => void;
}

export default function RewardPopup({ rewards, onClose }: RewardPopupProps) {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-yellow-500" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Congratulations!</h2>
          <p className="text-muted-foreground mb-6">You've won prizes in recent competitions</p>

          <div className="space-y-4 max-h-96 overflow-auto">
            {rewards.map((reward, index) => (
              <div key={index} className="p-4 bg-muted/50 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span className="font-semibold text-foreground">
                    {reward.competition?.name || "Competition"}
                  </span>
                  {reward.rank && (
                    <Badge variant="outline" className={
                      reward.rank === 1 ? "text-yellow-500 border-yellow-500" :
                      reward.rank === 2 ? "text-zinc-400 border-zinc-400" :
                      "text-amber-700 border-amber-700"
                    }>
                      {reward.rank === 1 ? "1st Place" : reward.rank === 2 ? "2nd Place" : `${reward.rank}${reward.rank === 3 ? "rd" : "th"} Place`}
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4">
                  {reward.prizeAmount > 0 && (
                    <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded-md">
                      <DollarSign className="w-5 h-5 text-green-500" />
                      <span className="font-bold text-green-500">N${reward.prizeAmount.toFixed(2)}</span>
                    </div>
                  )}

                  {reward.prizeCard && (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Gift className="w-4 h-4" /> Card Prize
                      </div>
                      <PlayerCard card={reward.prizeCard} size="sm" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Button onClick={onClose} className="mt-6 w-full">
            Claim & Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
