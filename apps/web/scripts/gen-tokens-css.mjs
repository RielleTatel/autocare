import { toCssVars } from "@autocare/design-tokens";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const header =
  "/* GENERATED from @autocare/design-tokens toCssVars(). Do not edit by hand.\n" +
  "   Regenerate: node scripts/gen-tokens-css.mjs */\n";
writeFileSync(resolve(dir, "../app/tokens.css"), header + toCssVars());
console.log("wrote app/tokens.css");
