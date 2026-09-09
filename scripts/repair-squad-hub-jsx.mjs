import fs from "node:fs";

const file = "client/src/components/native/NativeSquadPage.tsx";
let source = fs.readFileSync(file, "utf8");
const broken = '      </> : null}\n    </div>';
const fixed = '      </>}\n    </div>';

if (source.includes(broken)) {
  source = source.replace(broken, fixed);
  fs.writeFileSync(file, source);
  console.log("[squad-hub-jsx] fixed Entered Teams / Collection ternary closing.");
} else if (source.includes(fixed) && source.includes("data-squad-hub-tabs")) {
  console.log("[squad-hub-jsx] Squad hub ternary already valid.");
} else {
  throw new Error("[squad-hub-jsx] generated Squad hub closing anchor not found");
}
