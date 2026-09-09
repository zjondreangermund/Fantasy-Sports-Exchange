import fs from "node:fs";

function patchFile(path, transform) {
  const original = fs.readFileSync(path, "utf8");
  const next = transform(original);
  if (next !== original) {
    fs.writeFileSync(path, next);
    console.log(`[push-self-test] patched ${path}`);
  }
}

function insertOnce(source, anchor, addition, marker, label) {
  if (source.includes(marker)) return source;
  if (!source.includes(anchor)) throw new Error(`[push-self-test] ${label} anchor not found`);
  return source.replace(anchor, `${anchor}${addition}`);
}

function replaceOnce(source, from, to, marker, label) {
  if (source.includes(marker)) return source;
  if (!source.includes(from)) throw new Error(`[push-self-test] ${label} anchor not found`);
  return source.replace(from, to);
}

patchFile("server/routes/notifications.routes.ts", (input) => {
  let source = input;
  const helperAnchor = [
    'function minutesUntil(value: unknown): number | null {',
    '  const time = new Date(String(value || "")).getTime();',
    '  if (!Number.isFinite(time)) return null;',
    '  return Math.round((time - Date.now()) / 60000);',
    '}',
    '',
  ].join("\n");
  const helpers = [
    '// Fixed, self-only notification previews. These deliberately cannot target another user',
    '// or accept arbitrary notification text, so the production test control cannot become',
    '// a broadcast/spam endpoint.',
    'const PUSH_SELF_TEST_TEMPLATES = {',
    '  entries_open: {',
    '    title: "TEST • Gameweek entries are open",',
    '    message: "Gameweek tournaments are open. Review the rarity requirements and submit your five-card lineup before the deadline.",',
    '  },',
    '  starts_soon: {',
    '    title: "TEST • Gameweek starts soon",',
    '    message: "Your gameweek starts within 24 hours. Check submitted teams, captains and eligible cards before kickoff.",',
    '  },',
    '  lineup_lock: {',
    '    title: "TEST • Lineup lock approaching",',
    '    message: "Tournament entries lock within two hours. Complete any remaining entries before the deadline.",',
    '  },',
    '  gameweek_live: {',
    '    title: "TEST • Your gameweek is live",',
    '    message: "Your entered tournament teams are live. Follow scores and rankings in My Teams & Prizes.",',
    '  },',
    '  prize_won: {',
    '    title: "TEST • Tournament prize won",',
    '    message: "A tournament has settled and a reward is ready. Open My Teams & Prizes to review the result.",',
    '  },',
    '  replacement_required: {',
    '    title: "TEST • Player replacement required",',
    '    message: "One of your cards needs a same-rarity, same-position Premier League replacement. Open Collection to review the claim.",',
    '  },',
    '  community_mention: {',
    '    title: "TEST • You were mentioned",',
    '    message: "A manager mentioned you in Community Live. Tap this notification to open the conversation.",',
    '  },',
    '  cancellation_refund: {',
    '    title: "TEST • Tournament cancelled / refunded",',
    '    message: "A tournament entry was cancelled. Any applicable paid entry refund has been returned to your Fantasy Arena wallet.",',
    '  },',
    '} as const;',
    '',
    'type PushSelfTestPreset = keyof typeof PUSH_SELF_TEST_TEMPLATES;',
    'const pushSelfTestLastScheduledAt = new Map<string, number>();',
    '',
    'function pushSelfTestDedupeKey(preset: PushSelfTestPreset): string {',
    '  const stamp = Date.now();',
    '  if (preset === "replacement_required") return `replacement-claim:self-test-${stamp}`;',
    '  if (preset === "community_mention") return `community-mention:${stamp}:self-test`;',
    '  if (preset === "prize_won") return `competition:self-test:prize:${stamp}`;',
    '  if (preset === "cancellation_refund") return `competition:self-test:refund:${stamp}`;',
    '  return `gameweek:self-test:${preset}:${stamp}`;',
    '}',
    '',
  ].join("\n");
  source = insertOnce(source, helperAnchor, helpers, "PUSH_SELF_TEST_TEMPLATES", "server self-test helpers");

  const routeAnchor = '  app.post("/api/push/subscription", requireAuth, async (req: any, res) => {';
  const route = [
    '  app.post("/api/push/test", requireAuth, async (req: any, res) => {',
    '    try {',
    '      const userId = String(req.authUserId || "");',
    '      const preset = String(req.body?.preset || "entries_open") as PushSelfTestPreset;',
    '      if (!Object.prototype.hasOwnProperty.call(PUSH_SELF_TEST_TEMPLATES, preset)) {',
    '        return res.status(400).json({ message: "Unknown notification test preset" });',
    '      }',
    '',
    '      const requestedDelay = Number(req.body?.delaySeconds || 12);',
    '      const delaySeconds = Math.max(5, Math.min(30, Number.isFinite(requestedDelay) ? Math.round(requestedDelay) : 12));',
    '      const now = Date.now();',
    '      const lastScheduled = pushSelfTestLastScheduledAt.get(userId) || 0;',
    '      if (now - lastScheduled < 4_000) {',
    '        return res.status(429).json({ message: "Wait a few seconds before scheduling another notification test" });',
    '      }',
    '',
    '      const [web, native] = await Promise.all([getWebPushStatus(userId), getNativePushStatus(userId)]);',
    '      const activeWeb = Number(web.activeSubscriptions || 0);',
    '      const activeNative = Number(native.activeSubscriptions || 0);',
    '      if (!activeWeb && !activeNative) {',
    '        return res.status(409).json({ message: "Enable notifications on this device before sending a test" });',
    '      }',
    '',
    '      const template = PUSH_SELF_TEST_TEMPLATES[preset];',
    '      pushSelfTestLastScheduledAt.set(userId, now);',
    '      const timer = setTimeout(() => {',
    '        void (async () => {',
    '          await createNotificationOnce(db, {',
    '            userId,',
    '            title: template.title,',
    '            message: template.message,',
    '            dedupeKey: pushSelfTestDedupeKey(preset),',
    '          });',
    '          await Promise.all([',
    '            processPendingWebPushDeliveries(),',
    '            processPendingNativePushDeliveries(),',
    '          ]);',
    '        })().catch((error) => console.error("Delayed notification self-test failed:", error));',
    '      }, delaySeconds * 1000);',
    '      timer.unref?.();',
    '',
    '      return res.json({',
    '        success: true,',
    '        preset,',
    '        delaySeconds,',
    '        title: template.title,',
    '        delivery: { web: activeWeb, native: activeNative },',
    '      });',
    '    } catch (error: any) {',
    '      console.error("Failed to schedule notification self-test:", error);',
    '      return res.status(500).json({ message: error?.message || "Failed to schedule notification test" });',
    '    }',
    '  });',
    '',
    '',
  ].join("\n");
  if (!source.includes('app.post("/api/push/test"')) {
    if (!source.includes(routeAnchor)) throw new Error("[push-self-test] server route anchor not found");
    source = source.replace(routeAnchor, `${route}${routeAnchor}`);
  }
  return source;
});

patchFile("client/src/components/PushNotificationControl.tsx", (input) => {
  let source = input;
  const typeAnchor = [
    'type EnabledDevice =',
    '  | { kind: "web"; subscription: PushSubscription }',
    '  | { kind: "native"; token: string };',
    '',
  ].join("\n");
  const testTypes = [
    'type PushTestPreset =',
    '  | "entries_open"',
    '  | "starts_soon"',
    '  | "lineup_lock"',
    '  | "gameweek_live"',
    '  | "prize_won"',
    '  | "replacement_required"',
    '  | "community_mention"',
    '  | "cancellation_refund";',
    '',
    'const PUSH_TEST_PRESETS: Array<{ id: PushTestPreset; label: string; hint: string }> = [',
    '  { id: "entries_open", label: "Entries open", hint: "New gameweek tournaments are available" },',
    '  { id: "starts_soon", label: "Starts soon", hint: "24-hour gameweek reminder" },',
    '  { id: "lineup_lock", label: "Lineup lock", hint: "Two-hour deadline warning" },',
    '  { id: "gameweek_live", label: "Gameweek live", hint: "Your entered teams are live" },',
    '  { id: "prize_won", label: "Prize won", hint: "Tournament settlement / reward" },',
    '  { id: "replacement_required", label: "Replacement", hint: "Premier League player replacement claim" },',
    '  { id: "community_mention", label: "Community mention", hint: "Another manager mentioned you" },',
    '  { id: "cancellation_refund", label: "Cancellation / refund", hint: "Tournament cancelled and entry refunded" },',
    '];',
    '',
  ].join("\n");
  source = insertOnce(source, typeAnchor, testTypes, "PUSH_TEST_PRESETS", "client self-test presets");

  source = replaceOnce(
    source,
    '  const [promptOpen, setPromptOpen] = React.useState(false);',
    [
      '  const [promptOpen, setPromptOpen] = React.useState(false);',
      '  const [testOpen, setTestOpen] = React.useState(false);',
      '  const [testPreset, setTestPreset] = React.useState<PushTestPreset>("entries_open");',
    ].join("\n"),
    "const [testOpen, setTestOpen]",
    "client test dialog state",
  );

  const mutationAnchor = '  const disableMutation = useMutation({';
  const testMutation = [
    '  const testMutation = useMutation({',
    '    mutationFn: async (preset: PushTestPreset) => {',
    '      const response = await apiRequest("POST", "/api/push/test", { preset, delaySeconds: 12 });',
    '      return response.json();',
    '    },',
    '    onSuccess: (body: any) => {',
    '      setTestOpen(false);',
    '      toast({',
    '        title: "Test notification scheduled",',
    '        description: `${String(body?.title || "Fantasy Arena test")} will be sent in ${Number(body?.delaySeconds || 12)} seconds. Close or minimize the app now.`,',
    '      });',
    '    },',
    '    onError: (error: any) => toast({',
    '      title: "Could not schedule test notification",',
    '      description: String(error?.message || "Make sure notifications are enabled and try again."),',
    '      variant: "destructive",',
    '    }),',
    '  });',
    '',
    '',
  ].join("\n");
  if (!source.includes("const testMutation = useMutation")) {
    if (!source.includes(mutationAnchor)) throw new Error("[push-self-test] client mutation anchor not found");
    source = source.replace(mutationAnchor, `${testMutation}${mutationAnchor}`);
  }

  const oldToggle = [
    '    if (enabled) {',
    '      if (window.confirm("Turn off Fantasy Arena mobile notifications on this device?")) disableMutation.mutate();',
    '      return;',
    '    }',
  ].join("\n");
  const newToggle = [
    '    if (enabled) {',
    '      setTestOpen(true);',
    '      return;',
    '    }',
  ].join("\n");
  source = replaceOnce(source, oldToggle, newToggle, "setTestOpen(true)", "alerts-on control behavior");

  const closeAnchor = [
    '      </Dialog>',
    '    </>',
    '  );',
  ].join("\n");
  const testDialog = [
    '      </Dialog>',
    '',
    '      <Dialog open={testOpen} onOpenChange={setTestOpen}>',
    '        <DialogContent className="z-[125] max-w-lg border-cyan-300/25 bg-[#080c18] text-white" data-push-self-test-dialog>',
    '          <DialogHeader>',
    '            <DialogTitle className="flex items-center gap-2 text-xl font-black"><Bell className="h-5 w-5 text-cyan-200" />Test app notifications</DialogTitle>',
    '            <DialogDescription className="leading-6 text-white/60">',
    '              Choose a real Fantasy Arena alert style. It will be sent to your own enabled devices after 12 seconds so you can close the app and test background delivery.',
    '            </DialogDescription>',
    '          </DialogHeader>',
    '          <div className="grid max-h-[46vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">',
    '            {PUSH_TEST_PRESETS.map((preset) => (',
    '              <button',
    '                key={preset.id}',
    '                type="button"',
    '                onClick={() => setTestPreset(preset.id)}',
    '                className={`rounded-2xl border p-3 text-left transition ${testPreset === preset.id ? "border-cyan-300/45 bg-cyan-300/10" : "border-white/10 bg-white/[.04] hover:bg-white/[.07]"}`}',
    '              >',
    '                <div className="text-sm font-black text-white">{preset.label}</div>',
    '                <div className="mt-1 text-xs leading-5 text-white/50">{preset.hint}</div>',
    '              </button>',
    '            ))}',
    '          </div>',
    '          <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[.08] p-3 text-xs leading-5 text-amber-100/80">',
    '            Tap “Send in 12 sec”, then close or minimize Fantasy Arena. Do not Force stop the app in Android settings; a force-stopped app may not receive background push until it is opened again.',
    '          </div>',
    '          <div className="grid gap-2 sm:grid-cols-2">',
    '            <Button type="button" variant="outline" onClick={() => { setTestOpen(false); if (window.confirm("Turn off Fantasy Arena mobile notifications on this device?")) disableMutation.mutate(); }} className="border-white/15 bg-white/5 text-white hover:bg-white/10">Turn off alerts</Button>',
    '            <Button type="button" onClick={() => testMutation.mutate(testPreset)} disabled={testMutation.isPending} className="bg-cyan-300 font-black text-slate-950 hover:bg-cyan-200">',
    '              {testMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}Send in 12 sec',
    '            </Button>',
    '          </div>',
    '        </DialogContent>',
    '      </Dialog>',
    '    </>',
    '  );',
  ].join("\n");
  source = replaceOnce(source, closeAnchor, testDialog, "data-push-self-test-dialog", "client self-test dialog");
  return source;
});

console.log("Notification self-test controls ready.");
