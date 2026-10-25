/* When was a domain registered? Asked to the registry itself over RDAP, the public successor of
   WHOIS. Only the domain name is sent (never the full address), and answers are cached. */

import { CONFIG } from "../config.js";

const DAY = 86400000;
const inflight = new Map();
let bootstrap = null;

async function rdapBase(tld) {
  bootstrap ??= (async () => {
    const { rdapBootstrap: cached } = await chrome.storage.local.get("rdapBootstrap");
    if (cached && Date.now() - cached.at < 7 * DAY) return cached.map;
    try {
      const j = await fetch(CONFIG.rdapBootstrap, { credentials: "omit", signal: AbortSignal.timeout(8000) }).then((r) => r.json());
      const map = {};
      for (const [tlds, urls] of j.services) {
        const url = urls.find((u) => u.startsWith("https://")) || urls[0];
        for (const t of tlds) map[t] = url.endsWith("/") ? url : `${url}/`;
      }
      await chrome.storage.local.set({ rdapBootstrap: { at: Date.now(), map } });
      return map;
    } catch {
      bootstrap = null;
      return cached?.map || {};
    }
  })();
  return (await bootstrap)[tld] || null;
}

async function lookup(domain, tld) {
  const at = Date.now();
  const base = await rdapBase(tld);
  if (!base) return { at, created: null, unsupported: true };
  try {
    const r = await fetch(`${base}domain/${encodeURIComponent(domain)}`, {
      headers: { accept: "application/rdap+json, application/json" },
      credentials: "omit",
      signal: AbortSignal.timeout(CONFIG.rdapTimeoutMs),
    });
    if (r.status === 404) return { at, created: null, notFound: true };
    if (!r.ok) return { at, created: null, error: true };
    const ev = ((await r.json()).events || []).find((e) => /^regist/i.test(e.eventAction || ""));
    return { at, created: ev?.eventDate || null, source: new URL(base).hostname };
  } catch {
    return { at, created: null, error: true };
  }
}

const fresh = (hit) => hit && Date.now() - hit.at < (hit.created ? 30 * DAY : hit.error ? DAY / 24 : DAY);

// Cached answer only, no network: used for every verdict so the popup can show the date.
export async function cachedAge(domain) {
  const key = `age:${domain}`;
  const hit = (await chrome.storage.local.get(key))[key];
  return fresh(hit) ? hit : undefined;
}

export async function getAge({ domain, tld }) {
  const hit = await cachedAge(domain);
  if (hit) return hit;
  if (!inflight.has(domain)) {
    inflight.set(domain, lookup(domain, tld).then(async (res) => {
      await chrome.storage.local.set({ [`age:${domain}`]: res });
      inflight.delete(domain);
      return res;
    }));
  }
  return inflight.get(domain);
}

export async function prune() {
  const all = await chrome.storage.local.get(null);
  const old = Object.keys(all).filter((k) => k.startsWith("age:") && !fresh(all[k]));
  if (old.length) await chrome.storage.local.remove(old);
}
