// Prints Virio's verdict for addresses typed on the command line, with the real domain age.
//   npm run check -- antai-paiement-gouv.com https://www.amendes.gouv.fr
import { readFileSync } from "node:fs";
import { createEngine } from "../src/engine/index.js";

const engine = createEngine({ pslText: readFileSync(new URL("../data/public_suffix_list.dat", import.meta.url), "utf8") });
let bootstrap = null;

async function rdapCreated({ domain, tld }) {
  bootstrap ??= await fetch("https://data.iana.org/rdap/dns.json").then((r) => r.json());
  const base = bootstrap.services.find(([tlds]) => tlds.includes(tld))?.[1][0];
  if (!base) return { created: null, unsupported: true };
  try {
    const r = await fetch(`${base}domain/${domain}`, { headers: { accept: "application/rdap+json" }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return { created: null, notFound: r.status === 404 };
    const ev = (await r.json()).events?.find((e) => /^regist/i.test(e.eventAction));
    return { created: ev?.eventDate || null, source: new URL(base).hostname };
  } catch {
    return { created: null };
  }
}

const args = process.argv.slice(2);
if (!args.length) console.log("Usage : npm run check -- <adresse> [<adresse>…]");
for (const arg of args) {
  const href = /^https?:\/\//.test(arg) ? arg : `https://${arg}`;
  let v = engine.evaluate({ href });
  if (v.needsAge) v = engine.evaluate({ href, age: await rdapCreated(v.ageTarget) });
  console.log(`\n${href}\n  ${v.title.toUpperCase()}  (score ${v.score}/100)${v.brand ? `  · service : ${v.brand.name} → ${v.brand.url}` : ""}`);
  for (const r of v.reasons) console.log(`  ${r.minor ? "·" : "✗"} [+${r.points}] ${r.text}`);
  for (const c of v.checks) console.log(`    ${{ good: "✓", bad: "✗", neutral: "–", pending: "…" }[c.state]} ${c.label} : ${c.detail}`);
}
