import fs from "node:fs";

// Notification delivery is proven by real production events. Keep the notification
// transport and enable/disable control, but remove the old self-test endpoint,
// templates and user-facing test lab from every generated build.

function patchFile(path, transform) {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log(`[notification-production] cleaned ${path}`);
  }
}

patchFile("server/routes/notifications.routes.ts", (input) => {
  let source = input;

  source = source.replace(
    /\n\/\/ Fixed, self-only notification previews\.[\s\S]*?function pushSelfTestDedupeKey\(preset: PushSelfTestPreset\): string \{[\s\S]*?\n\}\n/,
    "\n",
  );

  source = source.replace(
    /\n  app\.post\("\/api\/push\/test", requireAuth, async \(req: any, res\) => \{[\s\S]*?\n  \}\);\n\n/,
    "\n",
  );

  // Old diagnostic rows should never reappear in the real notification inbox.
  const userFilter = '        where n.user_id = ${userId}\n        order by n.created_at desc nulls last, n.id desc';
  const productionFilter = '        where n.user_id = ${userId}\n          and coalesce(n.dedupe_key, \'\') not like \'%self-test%\'\n        order by n.created_at desc nulls last, n.id desc';
  if (!source.includes(productionFilter) && source.includes(userFilter)) {
    source = source.replace(userFilter, productionFilter);
  }

  return source;
});

patchFile("client/src/components/PushNotificationControl.tsx", (input) => {
  let source = input;

  source = source.replace(/\ntype PushTestPreset =[\s\S]*?\n\];\n/, "\n");
  source = source.replace(/\n  const \[testOpen, setTestOpen\] = React\.useState\(false\);/, "");
  source = source.replace(/\n  const \[testPreset, setTestPreset\] = React\.useState<PushTestPreset>\("entries_open"\);/, "");
  source = source.replace(/\n  const testMutation = useMutation\(\{[\s\S]*?\n  \}\);\n\n(?=  const disableMutation)/, "\n");
  source = source.replace(/\n      window\.setTimeout\(\(\) => setTestOpen\(true\), 250\);/, "");
  source = source.replace(/\n      setTestOpen\(false\);/g, "");
  source = source.replace(
    "  const busy = enableMutation.isPending || disableMutation.isPending || testMutation.isPending;",
    "  const busy = enableMutation.isPending || disableMutation.isPending;",
  );
  source = source.replace(
    [
      "    if (enabled) {",
      "      setTestOpen(true);",
      "      return;",
      "    }",
      "    enableMutation.mutate();",
    ].join("\n"),
    [
      "    if (enabled) {",
      "      disableMutation.mutate();",
      "      return;",
      "    }",
      "    enableMutation.mutate();",
    ].join("\n"),
  );
  source = source.replace(
    'aria-label={enabled ? "Open notification tests" : "Enable mobile notifications"}',
    'aria-label={enabled ? "Disable mobile notifications" : "Enable mobile notifications"}',
  );
  source = source.replace(
    'title={enabled ? "Alerts on — tap to test" : permission === "denied" ? "Allow notifications in phone settings" : "Enable mobile notifications"}',
    'title={enabled ? "Notifications on — tap to turn off" : permission === "denied" ? "Allow notifications in phone settings" : "Enable mobile notifications"}',
  );
  source = source.replace(
    /\n\s*<Dialog open=\{testOpen\} onOpenChange=\{setTestOpen\}>[\s\S]*?<\/Dialog>\n/,
    "\n",
  );

  return source;
});

console.log("Notification self-tests removed; production keeps only real Fantasy Arena event notifications.");
