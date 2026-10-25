/* Lists of addresses already reported as phishing. Downloaded in the background, cleaned (no
   official site, no link shortener), stored locally, and checked without any network request. */

import { CONFIG } from "../config.js";
import { NEVER_BLOCK } from "../engine/words.js";

const KEY = "blocklists";
let state = null;

function parse(text, format) {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l && !/^[#!]/.test(l));
  if (format !== "urls") return lines.map((l) => l.toLowerCase());
  return lines.map((l) => { try { return new URL(l).hostname; } catch { return ""; } });
}

function clean(hosts, engine) {
  const out = new Set();
  for (const raw of hosts) {
    const h = raw.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
    if (!h.includes(".") || h.length > 253 || NEVER_BLOCK.has(h)) continue;
    const info = engine.inspect(`https://${h}/`);
    if (info.kind !== "web" || info.official || NEVER_BLOCK.has(info.parsed.domain)) continue;
    out.add(h);
  }
  return out;
}

function hydrate(saved) {
  const sources = (saved?.sources || []).map((s) => ({ ...s, set: new Set(s.domains ? s.domains.split("\n") : []) }));
  const all = new Set();
  for (const s of sources) for (const d of s.set) all.add(d);
  return { updatedAt: saved?.updatedAt || 0, sources, count: all.size };
}

export async function load() {
  if (!state) state = hydrate((await chrome.storage.local.get(KEY))[KEY]);
  return state;
}

export async function refresh(engine, { force = false } = {}) {
  const current = await load();
  if (!force && current.updatedAt && Date.now() - current.updatedAt < CONFIG.refreshHours * 3600e3) return current;
  let fresh = 0;
  const sources = await Promise.all(CONFIG.blocklists.map(async (src) => {
    try {
      const r = await fetch(src.url, { cache: "no-store", credentials: "omit", signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const set = clean(parse(await r.text(), src.format), engine);
      fresh++;
      return { id: src.id, name: src.name, domains: [...set].join("\n") };
    } catch (e) {
      console.warn(`Virio : liste ${src.id} non mise à jour`, e);
      const prev = current.sources.find((s) => s.id === src.id);
      return prev ? { id: prev.id, name: prev.name, domains: [...prev.set].join("\n") } : null;
    }
  }));
  if (!fresh) return current;
  const saved = { updatedAt: Date.now(), sources: sources.filter(Boolean) };
  await chrome.storage.local.set({ [KEY]: saved });
  state = hydrate(saved);
  return state;
}

// Looks for the host and each of its parents, down to the registrable domain.
export function matcher(lists) {
  return {
    match(parsed) {
      const names = [];
      for (const s of lists.sources) {
        let h = parsed.host.replace(/^www\./, "");
        for (;;) {
          if (s.set.has(h)) { names.push(s.name.split(" (")[0]); break; }
          if (h === parsed.domain || !h.includes(".")) break;
          h = h.slice(h.indexOf(".") + 1);
        }
      }
      return names;
    },
  };
}
