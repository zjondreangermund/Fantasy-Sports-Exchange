import fs from "node:fs";
const file = "scripts/apply-guided-help-chat-auction-v2.mjs";
let source = fs.readFileSync(file, "utf8");
source = source.replace('• N${Number(notice.price||0).toFixed(2)}', '• N\\${Number(notice.price||0).toFixed(2)}');
fs.writeFileSync(file, source);
