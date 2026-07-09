// Copies the frozen legacy dashboard into public/ so existing deep links
// (…/claude-toolkit/dashboard/) keep working on the Pages site.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "..", "..", "..", "dashboard");
const dest = resolve(here, "..", "public", "dashboard");

if (existsSync(src)) {
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log(`copied dashboard → ${dest}`);
}
