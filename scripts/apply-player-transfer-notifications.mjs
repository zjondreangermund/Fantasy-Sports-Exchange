import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function patchFile(relativePath, patcher) {
  const file = path.join(root, relativePath);
  const before = fs.readFileSync(file, "utf8");
  const after = patcher(before);
  if (after !== before) fs.writeFileSync(file, after);
  return after !== before;
}

function replaceRequired(source, from, to, label, marker = to) {
  if (source.includes(marker)) return source;
  if (!source.includes(from)) throw new Error(`Player-transfer notification patch anchor not found: ${label}`);
  return source.replace(from, to);
}

let changed = 0;

if (patchFile("client/src/components/app-sidebar.tsx", (input) => {
  let source = input;
  source = replaceRequired(
    source,
    'import UnreadNotificationDot from "./UnreadNotificationDot";',
    'import UnreadNotificationDot from "./UnreadNotificationDot";\nimport { markNotificationsSeen } from "../lib/notifications";',
    "desktop notification helper import",
    'import { markNotificationsSeen } from "../lib/notifications";',
  );
  source = replaceRequired(
    source,
    '                            onClick={closeMobileDrawer}',
    '                            onClick={() => { closeMobileDrawer(); if (item.showUnread) void markNotificationsSeen(); }}',
    "desktop unread navigation click",
    'if (item.showUnread) void markNotificationsSeen();',
  );
  return source;
})) changed += 1;

if (patchFile("client/src/components/MobileNavDock.tsx", (input) => {
  let source = input;
  source = replaceRequired(
    source,
    'import UnreadNotificationDot from "./UnreadNotificationDot";',
    'import UnreadNotificationDot from "./UnreadNotificationDot";\nimport { markNotificationsSeen } from "../lib/notifications";',
    "mobile notification helper import",
    'import { markNotificationsSeen } from "../lib/notifications";',
  );
  source = replaceRequired(
    source,
    '                href={item.href}\n                className={[',
    '                href={item.href}\n                onClick={() => { if (item.showUnread) void markNotificationsSeen(); }}\n                className={[',
    "mobile unread navigation click",
    'onClick={() => { if (item.showUnread) void markNotificationsSeen(); }}',
  );
  return source;
})) changed += 1;

if (patchFile("client/src/pages/account.tsx", (input) => {
  let source = input;
  source = source.replace("CheckCircle2, ", "");
  source = replaceRequired(
    source,
    'import { queryClient } from "../lib/queryClient";',
    'import { queryClient } from "../lib/queryClient";\nimport { markNotificationsSeen, openCommunityMention } from "../lib/notifications";',
    "account notification helper import",
    'import { markNotificationsSeen, openCommunityMention } from "../lib/notifications";',
  );

  if (!source.includes("replacementClaimId?: number | null;")) {
    source = replaceRequired(
      source,
      '  createdAt: string | null;\n};',
      '  createdAt: string | null;\n  communityMessageId?: number | null;\n  notificationKind?: string | null;\n  replacementClaimId?: number | null;\n  replacementRarity?: string | null;\n  replacementSourceCardId?: number | null;\n  replacementSourcePlayerName?: string | null;\n  replacementCardId?: number | null;\n  replacementClaimedAt?: string | null;\n};',
      "replacement notification fields",
      "replacementClaimId?: number | null;",
    );
  }

  if (!source.includes("const replacementMutation = useMutation")) {
    const mutationStart = source.indexOf("  const markOneMutation = useMutation({");
    const copyStart = source.indexOf("  const copyReferralLink = async () => {");
    if (mutationStart < 0 || copyStart < 0 || copyStart <= mutationStart) {
      throw new Error("Player-transfer notification patch anchor not found: account notification mutations");
    }
    const replacementMutation = `  const replacementMutation = useMutation({\n    mutationFn: async (claimId: number) => {\n      const res = await fetch(\`/api/player-replacements/\${claimId}/claim\`, { method: "POST", credentials: "include" });\n      const body = await res.json().catch(() => ({}));\n      if (!res.ok) throw new Error(body?.message || "Failed to mint replacement card");\n      return body;\n    },\n    onSuccess: (body: any) => {\n      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });\n      queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] });\n      const rarity = String(body?.card?.rarity || "replacement");\n      const playerName = String(body?.card?.playerName || "Premier League player");\n      toast({ title: "Replacement minted", description: \`Your \${rarity} replacement is \${playerName}.\` });\n    },\n    onError: (error: any) => toast({ title: "Replacement unavailable", description: error?.message || "Could not mint the replacement card.", variant: "destructive" }),\n  });\n\n`;
    source = source.slice(0, mutationStart) + replacementMutation + source.slice(copyStart);
  }

  source = replaceRequired(
    source,
    '<Tabs defaultValue="profile" className="w-full">',
    '<Tabs defaultValue="profile" className="w-full" onValueChange={(value) => { if (value === "inbox") void markNotificationsSeen(); }}>',
    "account inbox auto-read",
    'onValueChange={(value) => { if (value === "inbox") void markNotificationsSeen(); }}',
  );

  source = replaceRequired(
    source,
    '<div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">Notifications</h2><Button variant="outline" size="sm" onClick={() => markAllMutation.mutate()} disabled={markAllMutation.isPending}>Mark all read</Button></div>',
    '<div className="mb-4"><h2 className="text-lg font-semibold">Notifications</h2><p className="mt-1 text-xs text-white/45">Opening this tab clears the notification badge automatically.</p></div>',
    "remove manual mark-all control",
    "Opening this tab clears the notification badge automatically.",
  );

  const oldList = '<div className="space-y-3">{inbox.notifications.map((note) => <div key={note.id} className={`rounded-xl border border-white/10 p-3 ${note.read ? "bg-black/20 opacity-80" : "bg-primary/10"}`}><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-sm">{note.title}</p><p className="text-sm text-white/55 mt-1">{note.message}</p><p className="text-xs text-white/40 mt-2">{note.createdAt ? new Date(note.createdAt).toLocaleString() : ""}</p></div>{!note.read && <Button size="sm" variant="ghost" onClick={() => markOneMutation.mutate(note.id)}><CheckCircle2 className="w-4 h-4 mr-1" />Read</Button>}</div></div>)}</div>';
  const newList = `<div className="space-y-3">{inbox.notifications.map((note) => (\n                <div key={note.id} className={\`rounded-xl border border-white/10 p-3 \${note.read ? "bg-black/20 opacity-80" : "bg-primary/10"}\`}>\n                  <div className="min-w-0">\n                    <p className="font-medium text-sm">{note.title}</p>\n                    <p className="text-sm text-white/55 mt-1">{note.message}</p>\n                    {note.communityMessageId ? (\n                      <div className="mt-3">\n                        <Button size="sm" onClick={() => { void openCommunityMention(note); }}>\n                          Open mentioned message\n                        </Button>\n                      </div>\n                    ) : null}\n                    {note.replacementClaimId ? (\n                      <div className="mt-3 flex flex-wrap items-center gap-2">\n                        {note.replacementCardId ? (\n                          <Badge className="bg-emerald-500/15 text-emerald-200">Replacement minted</Badge>\n                        ) : (\n                          <Button\n                            size="sm"\n                            onClick={() => replacementMutation.mutate(Number(note.replacementClaimId))}\n                            disabled={replacementMutation.isPending}\n                          >\n                            <Sparkles className="mr-1 h-4 w-4" />\n                            Mint {String(note.replacementRarity || "same-rarity")} replacement\n                          </Button>\n                        )}\n                        <span className="text-xs text-white/40">Same rarity • current Premier League player</span>\n                      </div>\n                    ) : null}\n                    <p className="text-xs text-white/40 mt-2">{note.createdAt ? new Date(note.createdAt).toLocaleString() : ""}</p>\n                  </div>\n                </div>\n              ))}</div>`;
  source = replaceRequired(source, oldList, newList, "notification list replacement action", "Same rarity • current Premier League player");
  return source;
})) changed += 1;

console.log(`[player-transfer-notifications] ${changed ? `Patched ${changed} client source file(s)` : "Verified"}: opening unread tabs clears the dot and departure notices expose same-rarity replacement minting.`);
