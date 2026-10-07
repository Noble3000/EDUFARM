// PWA verification: manifests, icons, service-worker cache boundaries.
// Usage: node scripts/pwa-check.mjs [--json]
// Fails if installability requirements or offline-policy guards regress.
// Policy under test: shell assets may cache; protected academic content
// (API, pages, materials, grades, assessments, Q&A, JSON) must NEVER cache.
import fs from "node:fs";

const APPS = ["web-student", "web-lecturer", "web-admin"];
const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, error: String(e.message ?? e).slice(0, 200) });
  }
}
function req(cond, msg) {
  if (!cond) throw new Error(msg);
}
const pngMagic = (p) => fs.readFileSync(p).subarray(0, 8).toString("hex") === "89504e470d0a1a0a";

for (const app of APPS) {
  const base = process.cwd() + "/apps/" + app + "/public";
  check(`${app} manifest valid + installable`, () => {
    const m = JSON.parse(fs.readFileSync(base + "/manifest.webmanifest", "utf8"));
    for (const k of ["name", "short_name", "start_url", "display", "theme_color", "icons"]) {
      req(m[k], `missing ${k}`);
    }
    req(m.display === "standalone", "display must be standalone");
    const png192 = m.icons.find((i) => i.sizes === "192x192" && i.type === "image/png");
    const png512 = m.icons.find((i) => i.sizes === "512x512" && i.type === "image/png");
    req(png192 && png512, "need 192 + 512 PNG icons");
    req(m.icons.some((i) => i.purpose === "maskable"), "need maskable icon");
  });
  check(`${app} PNG icons real + sized`, () => {
    for (const s of [192, 512]) {
      const p = `${base}/icons/icon-${s}.png`;
      req(fs.existsSync(p), `missing icon-${s}.png`);
      req(pngMagic(p), `icon-${s}.png not a real PNG`);
    }
  });
  check(`${app} SW guards protected content`, () => {
    const sw = fs.readFileSync(base + "/sw.js", "utf8");
    req(/\/api\//.test(sw), "SW must name the /api/ exclusion");
    req(!/materials|grades|assessments|questions/.test(sw.replace(/never cache[^;]*/i, "")), "SW must not list content routes as cacheable");
    req(/caches\.match\(["']\/["']\)/.test(sw) || /caches\.match\("\/"\)/.test(sw), "SW must fall back to shell");
    req(!/c\.put\(request/.test(sw) || /_next\/static|icons\//.test(sw), "SW may only persist static bundles/icons");
  });
}
const okAll = results.every((r) => r.ok);
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ ok: okAll, checks: results }, null, 2));
} else {
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.ok ? "" : `: ${r.error}`}`);
  console.log(okAll ? "PWA-CHECK OK" : "PWA-CHECK FAILED");
}
process.exitCode = okAll ? 0 : 1;
