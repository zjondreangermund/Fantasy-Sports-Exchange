import fs from "node:fs";

const file = "client/src/pages/onboarding.tsx";
const marker = "STARTER_CONFIRM_SINGLE_TAP_V1";
let source = fs.readFileSync(file, "utf8");

if (!source.includes(marker)) {
  source = source.replace(
    'import { useState, useCallback, useEffect, useMemo } from "react";',
    'import { useState, useCallback, useEffect, useMemo, useRef } from "react";',
  );

  source = source.replace(
    '  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(new Set());',
    '  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(new Set());\n  // STARTER_CONFIRM_SINGLE_TAP_V1: lock the first valid tap immediately so slow mobile/network responses never encourage repeat taps.\n  const [confirmStatus, setConfirmStatus] = useState<"idle" | "submitting" | "error">("idle");\n  const confirmInFlightRef = useRef(false);',
  );

  const oldHandler = `  const handleConfirm = useCallback(() => {\n    const ids = Array.from(selectedPlayerIds);\n    if (ids.length !== 5) return;\n    chooseMutation.mutate(ids, {\n      onSuccess: () => {\n        setStep("done");\n        refetch();\n      },\n    });\n  }, [selectedPlayerIds, chooseMutation, refetch]);`;

  const newHandler = `  const handleConfirm = useCallback(async () => {\n    if (confirmInFlightRef.current || chooseMutation.isPending) return;\n    const ids = Array.from(selectedPlayerIds);\n    if (ids.length !== 5) return;\n\n    confirmInFlightRef.current = true;\n    setConfirmStatus("submitting");\n\n    try {\n      await chooseMutation.mutateAsync(ids);\n      setStep("done");\n      void refetch();\n    } catch (error) {\n      try {\n        const refreshed = await refetch();\n        if (refreshed.data?.completed) {\n          setStep("done");\n          return;\n        }\n      } catch {}\n      console.error("Starter Draft confirmation failed:", error);\n      confirmInFlightRef.current = false;\n      setConfirmStatus("error");\n    }\n  }, [selectedPlayerIds, chooseMutation, refetch]);`;

  if (!source.includes(oldHandler)) throw new Error("[starter-confirm] handleConfirm anchor not found");
  source = source.replace(oldHandler, newHandler);

  const oldFooter = '            <Button onClick={handleConfirm} disabled={selectedCount !== requiredSelections || chooseMutation.isPending} size="lg" className="h-11 min-w-[138px] shrink-0 rounded-xl border border-cyan-200/30 bg-cyan-300 px-4 text-sm font-black text-slate-950 hover:bg-cyan-200 disabled:border-white/10 disabled:bg-white/[0.06] disabled:text-white/35 disabled:opacity-100 sm:min-w-[240px] sm:text-base">{chooseMutation.isPending ? "Minting..." : selectedCount !== requiredSelections ? <>Select {remaining} more</> : <>Confirm & Mint <Check className="ml-1.5 h-4 w-4" /></>}</Button>';
  const newFooter = '            <div className="flex shrink-0 flex-col items-end gap-1">\n              <Button onClick={handleConfirm} disabled={selectedCount !== requiredSelections || chooseMutation.isPending || confirmStatus === "submitting"} aria-busy={confirmStatus === "submitting"} size="lg" className="h-11 min-w-[138px] shrink-0 touch-manipulation rounded-xl border border-cyan-200/30 bg-cyan-300 px-4 text-sm font-black text-slate-950 hover:bg-cyan-200 disabled:border-white/10 disabled:bg-white/[0.06] disabled:text-white/35 disabled:opacity-100 sm:min-w-[240px] sm:text-base">{confirmStatus === "submitting" || chooseMutation.isPending ? <><span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />Minting your 5...</> : selectedCount !== requiredSelections ? <>Select {remaining} more</> : <>Confirm & Mint <Check className="ml-1.5 h-4 w-4" /></>}</Button>\n              {confirmStatus === "submitting" ? <span role="status" aria-live="polite" className="text-[10px] font-semibold text-cyan-100/80">Securing your cards — one tap is enough.</span> : null}\n              {confirmStatus === "error" ? <span role="alert" className="max-w-[240px] text-right text-[10px] font-semibold text-rose-300">Couldn’t finish the mint. Tap Confirm & Mint once to retry.</span> : null}\n            </div>';

  if (!source.includes(oldFooter)) throw new Error("[starter-confirm] final Confirm & Mint button anchor not found");
  source = source.replace(oldFooter, newFooter);

  fs.writeFileSync(file, source);
  console.log("[starter-confirm] first tap now locks immediately, shows mint progress and safely recovers interrupted responses");
} else {
  console.log("[starter-confirm] single-tap confirmation UX already ready");
}

for (const required of [marker, "confirmInFlightRef.current", "Minting your 5...", "one tap is enough", "refreshed.data?.completed"]) {
  if (!source.includes(required)) throw new Error(`[starter-confirm] verification failed: ${required}`);
}
