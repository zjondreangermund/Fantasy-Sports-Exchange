import fs from "node:fs";

const ADMIN_ROUTE = "server/routes/admin.routes.ts";
const ADMIN_PAGE = "client/src/pages/admin.tsx";
const REFERRALS = "server/routes/referrals.routes.ts";
const RECONCILIATION = "server/services/referralHistoryReconciliation.ts";

function patchFile(file, transform) {
  const source = fs.readFileSync(file, "utf8");
  const next = transform(source);
  if (next !== source) {
    fs.writeFileSync(file, next);
    console.log(`[admin-referrals] patched ${file}`);
  } else {
    console.log(`[admin-referrals] ${file} already patched`);
  }
}

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Admin referral monitoring anchor not found: ${label}`);
  return source.replace(from, to);
}

patchFile(ADMIN_ROUTE, (original) => {
  let source = original;
  const referralImport = 'import { registerAdminReferralRoutes } from "./adminReferrals.routes.js";';
  if (!source.includes(referralImport)) {
    const importAnchor = 'import { registerAdminIntegrityRoutes } from "./adminIntegrity.routes.js";\n';
    if (!source.includes(importAnchor)) throw new Error("Admin referral monitoring anchor not found: admin referral route import");
    source = source.replace(importAnchor, `${importAnchor}${referralImport}\n`);
  }
  const referralRegistration = '  registerAdminReferralRoutes(app, { requireAuth, isAdmin });';
  if (!source.includes(referralRegistration)) {
    const registrationAnchor = '  registerAdminIntegrityRoutes(app, { requireAuth, isAdmin });\n';
    if (!source.includes(registrationAnchor)) throw new Error("Admin referral monitoring anchor not found: admin referral route registration");
    source = source.replace(registrationAnchor, `${registrationAnchor}${referralRegistration}\n`);
  }
  return source;
});

patchFile(ADMIN_PAGE, (original) => {
  let source = original;
  const panelImport = 'import AdminReferralPanel from "../components/admin/AdminReferralPanel";';
  if (!source.includes(panelImport)) {
    const importAnchor = 'import AdminTournamentDirectory from "../components/admin/AdminTournamentDirectory";\n';
    if (!source.includes(importAnchor)) throw new Error("Admin referral monitoring anchor not found: referral panel import");
    source = source.replace(importAnchor, `${importAnchor}${panelImport}\n`);
  }
  source = replaceRequired(
    source,
    '  const [workspacePanel, setWorkspacePanel] = useState<"transactions" | "withdrawals" | "backoffice" | "integrity" | "tournaments" | null>(null);',
    '  const [workspacePanel, setWorkspacePanel] = useState<"transactions" | "withdrawals" | "backoffice" | "integrity" | "tournaments" | "referrals" | null>(null);',
    "workspace union",
  );
  source = replaceRequired(
    source,
    '            <WorkspaceLauncher icon={Trophy} title="Tournament directory" subtitle={`${allCompetitions.length} tournament(s), grouped by gameweek with entrants, prize and profit detail.`} onOpen={() => setWorkspacePanel("tournaments")} />\n',
    '            <WorkspaceLauncher icon={Trophy} title="Tournament directory" subtitle={`${allCompetitions.length} tournament(s), grouped by gameweek with entrants, prize and profit detail.`} onOpen={() => setWorkspacePanel("tournaments")} />\n            <WorkspaceLauncher icon={Gift} title="Referral monitoring" subtitle="See every referral, referred manager, reward card, referral code and live link-health status." onOpen={() => setWorkspacePanel("referrals")} />\n',
    "referral launcher",
  );
  source = replaceRequired(
    source,
    '{{ transactions: "Transaction explorer", withdrawals: "Withdrawal requests", backoffice: "Backoffice management", integrity: "Integrity and security", tournaments: "Tournament directory" }[workspacePanel || "transactions"]}',
    '{{ transactions: "Transaction explorer", withdrawals: "Withdrawal requests", backoffice: "Backoffice management", integrity: "Integrity and security", tournaments: "Tournament directory", referrals: "Referral monitoring" }[workspacePanel || "transactions"]}',
    "workspace title",
  );
  source = replaceRequired(
    source,
    '              {workspacePanel === "tournaments" ? <AdminTournamentDirectory\n',
    '              {workspacePanel === "referrals" ? <AdminReferralPanel\n                onOpenUser={(userId) => { setWorkspacePanel(null); selectUser(userId); }}\n                onOpenCard={(cardId) => { setWorkspacePanel(null); openCardLookup(cardId); }}\n              /> : null}\n              {workspacePanel === "tournaments" ? <AdminTournamentDirectory\n',
    "referral workspace body",
  );
  return source;
});

patchFile(REFERRALS, (original) => {
  let source = original;
  const auditHelperAnchor = `function isCurrentPremierLeaguePlayer(player: any) {\n  const league = String(player?.league || "").toLowerCase().replace(/[^a-z0-9]+/g, "");\n  const fplId = Number(player?.fplId ?? player?.fpl_id ?? 0);\n  const status = String(player?.status || "a").toLowerCase();\n  return ["premierleague", "englishpremierleague", "epl"].includes(league)\n    && fplId > 0\n    && !["departed", "superseded", "unlinked"].includes(status);\n}\n`;
  const auditHelper = `${auditHelperAnchor}\nasync function recordReferralClaimAudit(userId: string, action: string, meta: Record<string, unknown>) {\n  try {\n    await db.execute(sql\`\n      insert into app.audit_logs (user_id, action, meta)\n      values (\${userId || null}, \${action}, \${JSON.stringify(meta)}::jsonb)\n    \`);\n  } catch (error) {\n    console.warn("Referral claim audit failed:", error);\n  }\n}\n`;
  source = replaceRequired(source, auditHelperAnchor, auditHelper, "claim audit helper");

  const safeCodeIndexAnchor = `  await db.execute(sql\`\n    create unique index if not exists referrals_referred_user_id_unique_idx\n    on app.referrals (referred_user_id)\n    where referred_user_id is not null\n  \`);\n}`;
  const safeCodeIndex = `  await db.execute(sql\`\n    create unique index if not exists referrals_referred_user_id_unique_idx\n    on app.referrals (referred_user_id)\n    where referred_user_id is not null\n  \`);\n\n  // Older referral-code rows existed before Drizzle managed this table. Never\n  // let a schema tool truncate invite history to add a constraint. Check the\n  // normalized values first and only create the runtime unique index when the\n  // current data proves that doing so is safe.\n  const codeHealth = rowsOf(await db.execute(sql\`\n    select count(*)::int as total,\n      count(distinct upper(btrim(code)))::int as distinct_codes,\n      count(*) filter (where nullif(btrim(code), '') is null)::int as blank_codes\n    from app.referral_codes\n  \`))[0] || {};\n  const duplicateCodeRows = Math.max(0, Number(codeHealth.total || 0) - Number(codeHealth.distinct_codes || 0));\n  if (duplicateCodeRows === 0 && Number(codeHealth.blank_codes || 0) === 0) {\n    await db.execute(sql\`\n      create unique index if not exists referral_codes_code_normalized_unique_idx\n      on app.referral_codes (upper(btrim(code)))\n    \`);\n  } else {\n    console.error(\`REFERRAL_CODE_UNIQUENESS_BLOCKED duplicateRows=\${duplicateCodeRows} blankCodes=\${Number(codeHealth.blank_codes || 0)}\`);\n  }\n}`;
  source = replaceRequired(source, safeCodeIndexAnchor, safeCodeIndex, "safe referral code uniqueness");

  source = replaceRequired(
    source,
    '      if ((result as any)?.error) return res.status(Number((result as any).error)).json({ message: (result as any).message });\n      return res.json(result);\n    } catch (error: any) {\n      console.error("Referral claim failed:", error);\n      return res.status(500).json({ message: error?.message || "Failed to claim referral" });\n    }',
    '      if ((result as any)?.error) {\n        await recordReferralClaimAudit(referredUserId, "referral.claim.rejected", { code, status: Number((result as any).error), reason: String((result as any).message || "Rejected") });\n        return res.status(Number((result as any).error)).json({ message: (result as any).message });\n      }\n      await recordReferralClaimAudit(referredUserId, (result as any)?.alreadyClaimed ? "referral.claim.duplicate" : "referral.claim.success", { code, rewardCardId: (result as any)?.rewardCardId || null, alreadyClaimed: Boolean((result as any)?.alreadyClaimed) });\n      return res.json(result);\n    } catch (error: any) {\n      console.error("Referral claim failed:", error);\n      const referredUserId = String(req.authUserId || "");\n      const code = cleanCode(req.body?.code);\n      await recordReferralClaimAudit(referredUserId, "referral.claim.failed", { code, error: String(error?.message || error || "Unknown error") });\n      return res.status(500).json({ message: error?.message || "Failed to claim referral" });\n    }',
    "claim audit outcomes",
  );
  return source;
});

patchFile(RECONCILIATION, (original) => {
  let source = original;
  source = replaceRequired(
    source,
    '    console.log(\n      `REFERRAL_HISTORY_RECONCILE target=${TARGET_EMAIL}`\n      + ` linked=${summary.linked.join(\',\') || \'none\'}`\n      + ` restored=${summary.restoredCards.join(\',\') || \'none\'}`\n      + ` already=${summary.alreadyLinked.join(\',\') || \'none\'}`\n      + ` ambiguous=${summary.ambiguousEvents.join(\',\') || \'none\'}`\n      + ` conflicts=${summary.conflicts.length}`\n      + ` totalReferrals=${Number(total?.count || 0)}`,\n    );\n\n    return summary;',
    '    console.log(\n      `REFERRAL_HISTORY_RECONCILE target=${TARGET_EMAIL}`\n      + ` linked=${summary.linked.join(\',\') || \'none\'}`\n      + ` restored=${summary.restoredCards.join(\',\') || \'none\'}`\n      + ` already=${summary.alreadyLinked.join(\',\') || \'none\'}`\n      + ` ambiguous=${summary.ambiguousEvents.join(\',\') || \'none\'}`\n      + ` conflicts=${summary.conflicts.length}`\n      + ` totalReferrals=${Number(total?.count || 0)}`,\n    );\n\n    const global = rowsOf(await tx.execute(sql`\n      select count(*)::int as total,\n        count(distinct referrer_user_id)::int as "uniqueReferrers",\n        count(*) filter (where reward_card_id is not null)::int as rewarded,\n        count(*) filter (where reward_card_id is null)::int as "withoutReward"\n      from app.referrals\n    `))[0] || {};\n    console.log(`REFERRAL_GLOBAL_HEALTH total=${Number(global.total || 0)} uniqueReferrers=${Number(global.uniqueReferrers || 0)} rewarded=${Number(global.rewarded || 0)} withoutReward=${Number(global.withoutReward || 0)}`);\n\n    const codes = rowsOf(await tx.execute(sql`\n      select count(*)::int as total,\n        count(distinct user_id)::int as owners,\n        count(distinct upper(btrim(code)))::int as distinct,\n        count(*) filter (where exists (\n          select 1 from app.referrals r\n          where upper(btrim(coalesce(r.referral_code, \'\'))) = upper(btrim(referral_codes.code))\n        ))::int as used\n      from app.referral_codes\n    `))[0] || {};\n    const duplicateCodeRows = Math.max(0, Number(codes.total || 0) - Number(codes.distinct || 0));\n    console.log(`REFERRAL_CODE_HEALTH total=${Number(codes.total || 0)} owners=${Number(codes.owners || 0)} used=${Number(codes.used || 0)} unused=${Math.max(0, Number(codes.total || 0) - Number(codes.used || 0))} duplicateRows=${duplicateCodeRows}`);\n\n    return summary;',
    "global referral health log",
  );
  return source;
});

console.log("Admin referral monitoring, claim audit logging and referral health telemetry are ready.");
