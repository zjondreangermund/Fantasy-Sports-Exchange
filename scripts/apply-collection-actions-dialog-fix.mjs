#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);

function replaceOnce(file, before, after) {
  const source = read(file);
  if (!source.includes(before)) throw new Error(`${file}: expected source block was not found`);
  write(file, source.replace(before, after));
}

const collectionFile = "client/src/pages/collection-clean.tsx";

replaceOnce(
  collectionFile,
  'import { Input } from "../components/ui/input";\n',
  'import { Input } from "../components/ui/input";\nimport { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";\n',
);

replaceOnce(
  collectionFile,
  'import { Archive, ChevronLeft, ChevronRight, Crown, DollarSign, Gem, Handshake, Search, ShieldCheck, Sparkles, Trophy, X } from "lucide-react";',
  'import { Archive, ChevronLeft, ChevronRight, Crown, DollarSign, Gem, Handshake, Search, ShieldCheck, Sparkles, Trophy } from "lucide-react";',
);

replaceOnce(
  collectionFile,
  'className="group flex w-full max-w-[190px] touch-pan-y flex-col items-center gap-2"',
  'className="collection-card-item group flex touch-pan-y flex-col items-center gap-2" style={{ width: isMobile ? 146 : 170, maxWidth: isMobile ? 146 : 170 }}',
);

let collectionSource = read(collectionFile);
const modalPattern = /\{listingCard \? <div className="fixed inset-0 z-\[120\][\s\S]*?<\/div><\/div> : null\}/;
if (!modalPattern.test(collectionSource)) {
  throw new Error(`${collectionFile}: legacy full-page sell overlay was not found`);
}

const dialogMarkup = `{listingCard ? (
        <Dialog
          open={Boolean(listingCard)}
          onOpenChange={(open) => {
            if (!open) {
              setListingCard(null);
              setListingPrice("");
            }
          }}
        >
          <DialogContent
            data-collection-sell-dialog
            className="border-white/15 text-white shadow-[0_30px_100px_rgba(0,0,0,.75)]"
            style={{ maxWidth: "28rem", backgroundColor: "#090d1f" }}
          >
            <DialogHeader>
              <p className="text-[10px] font-black uppercase tracking-[.22em] text-emerald-200">List Card</p>
              <DialogTitle className="text-2xl font-black text-white">Set Sale Price</DialogTitle>
              <DialogDescription className="text-white/55">
                Minimum for <span className="capitalize">{listingRarity}</span>: {money(minimumPrice)}
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="font-bold text-white">{listingCard.player?.name}</p>
              <p className="text-sm capitalize text-white/50">{listingRarity} • {listingCard.player?.position}</p>
              <label className="mt-4 block text-xs font-black uppercase tracking-[.16em] text-white/40">Price (N$)</label>
              <Input
                type="number"
                min={minimumPrice}
                step="1"
                value={listingPrice}
                onChange={(event) => setListingPrice(event.target.value)}
                className="mt-2 h-12 border-white/10 bg-black/35 text-lg font-black text-white"
                autoFocus
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {[10, 50, 100].map((add) => (
                  <button
                    key={add}
                    type="button"
                    onClick={() => setListingPrice(String(Math.max(minimumPrice, Number(listingPrice || minimumPrice) + add)))}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white/75"
                  >
                    +N${add}
                  </button>
                ))}
              </div>
              {!listingIsValid ? (
                <p className="mt-3 text-sm text-red-300">Enter at least {money(minimumPrice)}.</p>
              ) : (
                <p className="mt-3 text-sm text-emerald-300">Ready to list for {money(numericListingPrice)}.</p>
              )}
            </div>

            <DialogFooter className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:space-x-0">
              <Button
                variant="outline"
                onClick={() => {
                  setListingCard(null);
                  setListingPrice("");
                }}
                className="rounded-xl border-white/15 bg-white/5 text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmListing}
                disabled={!listingIsValid || listMutation.isPending}
                className="rounded-xl bg-emerald-400 font-black text-black hover:bg-emerald-300"
              >
                {listMutation.isPending ? "Listing..." : "Confirm Listing"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}`;

collectionSource = collectionSource.replace(modalPattern, dialogMarkup);
write(collectionFile, collectionSource);

for (const file of ["client/src/main.tsx", "client/public/sw.js", "scripts/verify-unified-scroll-architecture.mjs"]) {
  write(file, read(file).replaceAll("fantasy-site-v11", "fantasy-site-v12"));
}

console.log("Collection action widths and compact sell dialog repaired.");
