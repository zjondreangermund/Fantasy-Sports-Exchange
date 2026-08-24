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

// Older builds cleared every unread notification when a manager merely opened
// the sidebar or mobile dock. Preserve unread alerts until their actual action.
if (patchFile("client/src/components/app-sidebar.tsx", (input) => input
  .replace('\nimport { markNotificationsSeen } from "../lib/notifications";', "")
  .replace(
    'onClick={() => { closeMobileDrawer(); if (item.showUnread) void markNotificationsSeen(); }}',
    'onClick={closeMobileDrawer}',
  ))) changed += 1;

if (patchFile("client/src/components/MobileNavDock.tsx", (input) => input
  .replace('\nimport { markNotificationsSeen } from "../lib/notifications";', "")
  .replace(
    '                onClick={() => { if (item.showUnread) void markNotificationsSeen(); }}\n',
    "",
  ))) changed += 1;

if (patchFile("client/src/pages/account.tsx", (input) => {
  let source = input;
  if (!source.includes("CheckCircle2")) source = source.replace("Mail, Gift,", "Mail, CheckCircle2, Gift,");
  source = source.replace(
    'import { markNotificationsSeen, openCommunityMention } from "../lib/notifications";',
    'import { openCommunityMention } from "../lib/notifications";',
  );
  source = replaceRequired(
    source,
    'import { queryClient } from "../lib/queryClient";',
    'import { queryClient } from "../lib/queryClient";\nimport { openCommunityMention } from "../lib/notifications";',
    "account notification helper import",
    'import { openCommunityMention } from "../lib/notifications";',
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

  if (!source.includes("const markOneMutation = useMutation")) {
    const originalReadMutations = `  const markOneMutation = useMutation({\n    mutationFn: async (id: number) => {\n      const res = await fetch(\`/api/notifications/\${id}/read\`, { method: "POST", credentials: "include" });\n      if (!res.ok) throw new Error("Failed to update notification");\n      return res.json();\n    },\n    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),\n  });\n\n  const markAllMutation = useMutation({\n    mutationFn: async () => {\n      const res = await fetch("/api/notifications/read-all", { method: "POST", credentials: "include" });\n      if (!res.ok) throw new Error("Failed to update notifications");\n      return res.json();\n    },\n    onSuccess: () => {\n      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });\n      toast({ title: "Inbox updated", description: "All notifications marked as read." });\n    },\n    onError: () => toast({ title: "Error", description: "Could not mark notifications as read.", variant: "destructive" }),\n  });\n\n`;
    const mutationAnchor = source.includes("  const replacementMutation = useMutation({")
      ? "  const replacementMutation = useMutation({"
      : "  const copyReferralLink = async () => {";
    if (!source.includes(mutationAnchor)) throw new Error("Player-transfer notification patch anchor not found: restore read mutations");
    source = source.replace(mutationAnchor, originalReadMutations + mutationAnchor);
  }

  if (!source.includes("const replacementMutation = useMutation")) {
    const copyStart = source.indexOf("  const copyReferralLink = async () => {");
    if (copyStart < 0) {
      throw new Error("Player-transfer notification patch anchor not found: account notification mutations");
    }
    const replacementMutation = `  const replacementMutation = useMutation({\n    mutationFn: async (claimId: number) => {\n      const res = await fetch(\`/api/player-replacements/\${claimId}/claim\`, { method: "POST", credentials: "include" });\n      const body = await res.json().catch(() => ({}));\n      if (!res.ok) throw new Error(body?.message || "Failed to mint replacement card");\n      return body;\n    },\n    onSuccess: (body: any) => {\n      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });\n      queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] });\n      const rarity = String(body?.card?.rarity || "replacement");\n      const playerName = String(body?.card?.playerName || "Premier League player");\n      toast({ title: "Replacement minted", description: \`Your \${rarity} replacement is \${playerName}.\` });\n    },\n    onError: (error: any) => toast({ title: "Replacement unavailable", description: error?.message || "Could not mint the replacement card.", variant: "destructive" }),\n  });\n\n`;
    source = source.slice(0, copyStart) + replacementMutation + source.slice(copyStart);
  }

  source = source.replace(
    '<Tabs defaultValue="profile" className="w-full" onValueChange={(value) => { if (value === "inbox") void markNotificationsSeen(); }}>',
    '<Tabs defaultValue="profile" className="w-full">',
  );
  source = replaceRequired(
    source,
    '<Tabs defaultValue="profile" className="w-full">',
    '<Tabs defaultValue={new URLSearchParams(window.location.search).get("tab") === "inbox" ? "inbox" : "profile"} className="w-full">',
    "account inbox deep link",
    'new URLSearchParams(window.location.search).get("tab") === "inbox"',
  );

  const inboxHeader = '<div className="flex flex-wrap items-center justify-between gap-3 mb-4"><div><h2 className="text-lg font-semibold">Notifications</h2><p className="mt-1 text-xs text-white/55">Open an alert or mark it read when you have seen it.</p></div><Button variant="outline" size="sm" onClick={() => markAllMutation.mutate()} disabled={markAllMutation.isPending || !inbox?.unreadCount}>Mark all read</Button></div>';
  source = source.replace(
    '<div className="mb-4"><h2 className="text-lg font-semibold">Notifications</h2><p className="mt-1 text-xs text-white/45">Opening this tab clears the notification badge automatically.</p></div>',
    inboxHeader,
  );
  source = replaceRequired(
    source,
    '<div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">Notifications</h2><Button variant="outline" size="sm" onClick={() => markAllMutation.mutate()} disabled={markAllMutation.isPending}>Mark all read</Button></div>',
    inboxHeader,
    "preserve manual mark-all control",
    'Open an alert or mark it read when you have seen it.',
  );

  const oldList = '<div className="space-y-3">{inbox.notifications.map((note) => <div key={note.id} className={`rounded-xl border border-white/10 p-3 ${note.read ? "bg-black/20 opacity-80" : "bg-primary/10"}`}><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-sm">{note.title}</p><p className="text-sm text-white/55 mt-1">{note.message}</p><p className="text-xs text-white/40 mt-2">{note.createdAt ? new Date(note.createdAt).toLocaleString() : ""}</p></div>{!note.read && <Button size="sm" variant="ghost" onClick={() => markOneMutation.mutate(note.id)}><CheckCircle2 className="w-4 h-4 mr-1" />Read</Button>}</div></div>)}</div>';
  const newList = `<div className="space-y-3">{inbox.notifications.map((note) => (\n                <div key={note.id} className={\`rounded-xl border border-white/10 p-3 \${note.read ? "bg-black/20" : "bg-primary/10"}\`}>\n                  <div className="flex items-start justify-between gap-3">\n                    <div className="min-w-0 flex-1">\n                      <p className="font-medium text-sm">{note.title}</p>\n                      <p className="text-sm text-white/65 mt-1">{note.message}</p>\n                      {note.communityMessageId ? (\n                        <div className="mt-3">\n                          <Button size="sm" onClick={() => { void openCommunityMention(note); }}>\n                            Open mentioned message\n                          </Button>\n                        </div>\n                      ) : null}\n                      {note.replacementClaimId ? (\n                        <div className="mt-3 flex flex-wrap items-center gap-2">\n                          {note.replacementCardId ? (\n                            <Badge className="bg-emerald-500/15 text-emerald-200">Replacement minted</Badge>\n                          ) : (\n                            <Button\n                              size="sm"\n                              onClick={() => replacementMutation.mutate(Number(note.replacementClaimId))}\n                              disabled={replacementMutation.isPending}\n                            >\n                              <Sparkles className="mr-1 h-4 w-4" />\n                              Mint {String(note.replacementRarity || "same-rarity")} replacement\n                            </Button>\n                          )}\n                          <span className="text-xs text-white/40">Same rarity • current Premier League player</span>\n                        </div>\n                      ) : null}\n                      <p className="text-xs text-white/45 mt-2">{note.createdAt ? new Date(note.createdAt).toLocaleString() : ""}</p>\n                    </div>\n                    {!note.read ? <Button size="sm" variant="outline" onClick={() => markOneMutation.mutate(note.id)} disabled={markOneMutation.isPending} className="shrink-0"><CheckCircle2 className="w-4 h-4 mr-1" />Read</Button> : <Badge variant="outline" className="shrink-0 border-white/15 text-white/60">Read</Badge>}\n                  </div>\n                </div>\n              ))}</div>`;
  if (!source.includes('disabled={markOneMutation.isPending} className="shrink-0"')) {
    if (source.includes(oldList)) {
      source = source.replace(oldList, newList);
    } else {
      const previousListStart = source.indexOf('<div className="space-y-3">{inbox.notifications.map((note) => (');
      const previousListEnd = previousListStart < 0 ? -1 : source.indexOf('              ))}</div>', previousListStart);
      if (previousListStart < 0 || previousListEnd < 0) throw new Error("Player-transfer notification patch anchor not found: preserve individual read actions");
      source = source.slice(0, previousListStart) + newList + source.slice(previousListEnd + '              ))}</div>'.length);
    }
  }
  return source;
})) changed += 1;

console.log(`[player-transfer-notifications] ${changed ? `Patched ${changed} client source file(s)` : "Verified"}: unread alerts remain actionable, mention deep links work and departure notices expose same-rarity replacement minting.`);
