import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
export default function CaptainRequiredDialog({open,onOpenChange,cards,onSelect}:{open:boolean;onOpenChange:(open:boolean)=>void;cards:any[];onSelect:(id:number)=>void}) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent data-captain-required layer={12000}><DialogHeader><DialogTitle>Select your captain</DialogTitle><DialogDescription>Your team has not been submitted. Choose a captain, then press Submit team again. Complete all five positions before submitting.</DialogDescription></DialogHeader>{cards.map(card=><Button key={card.id} variant="outline" onClick={()=>onSelect(Number(card.id))}>Make {card.player?.name || "player"} captain</Button>)}</DialogContent></Dialog>;
}
