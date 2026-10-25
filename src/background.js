/* Virio — background service worker.
   Every top-level navigation is judged before the page loads (address, blocklists). The domain's
   age and what the page asks for come in a moment later and can still trigger the block. */

import { createEngine } from "./engine/index.js";
import * as lists from "./services/blocklist.js";
import { cachedAge, getAge, prune } from "./services/domain-age.js";
import { getSettings, setSettings, trust, getBypass, addBypass } from "./services/settings.js";

const BLOCK_PAGE = chrome.runtime.getURL("src/pages/blocked.html");
const QUIET = new Set(["official", "trusted", "local", "off", "unsupported"]);

let enginePromise = null;
const engine = () => (enginePromise ??= fetch(chrome.runtime.getURL("data/public_suffix_list.dat"))
  .then((r) => r.text())
  .then((pslText) => createEngine({ pslText })));

/* ------------------------------------------------------------------ per-tab state */

// tabId -> { href, page, verdict, ageRequested, blocked }. The verdict is mirrored in
// storage.session so the popup and the block page survive the worker going to sleep.
const tabs = new Map();
const toastFor = new Map(); // tabId -> time the person chose "go to the official site"

const hostOf = (href) => { try { return new URL(href).host; } catch { return ""; } };

function freshState(tabId, href) {
  const t = { href, page: null, verdict: null, ageRequested: false, blocked: false };
  tabs.set(tabId, t);
  return t;
}

async function judge(t) {
  const [eng, settings, bypass, state] = await Promise.all([engine(), getSettings(), getBypass(), lists.load()]);
  if (!settings.enabled) return { href: t.href, level: "off", title: "Protection en pause", score: 0, reasons: [], checks: [] };
  const info = eng.inspect(t.href);
  const domain = info.parsed?.domain || info.host || "";
  const age = info.ageTarget ? await cachedAge(info.ageTarget.domain) : undefined;
  return eng.evaluate({
    href: t.href, page: t.page, age,
    blocklist: lists.matcher(state), listsCount: state.count,
    trusted: settings.allowlist.includes(domain), bypassed: bypass.includes(domain),
  });
}

async function refresh(tabId, t) {
  const v = await judge(t);
  if (tabs.get(tabId) !== t) return null;
  t.verdict = v;
  await publish(tabId, t);
  if (v.level === "danger") {
    await block(tabId, t);
    return v;
  }
  if (v.needsAge && !t.ageRequested) {
    t.ageRequested = true;
    getAge(v.ageTarget).then(() => (tabs.get(tabId) === t ? refresh(tabId, t) : null)).catch(console.error);
  }
  chrome.tabs.sendMessage(tabId, { type: "verdict", verdict: v }, { frameId: 0 }).catch(() => {});
  return v;
}

async function publish(tabId, t) {
  await chrome.storage.session.set({ [`tab:${tabId}`]: { href: t.href, verdict: t.verdict } });
  const look = {
    official: ["✓", "#2bc97a", "#06140c"],
    suspect: ["!", "#c8363b", "#ffffff"],
    danger: ["!", "#c8363b", "#ffffff"],
    bypassed: ["!", "#c8363b", "#ffffff"],
    off: ["off", "#252d3b", "#b9c0cc"],
  }[t.verdict.level] || ["", "#121722", "#f2f4f8"];
  chrome.action.setBadgeText({ tabId, text: look[0] }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color: look[1] }).catch(() => {});
  chrome.action.setBadgeTextColor?.({ tabId, color: look[2] })?.catch(() => {});
}

async function block(tabId, t) {
  if (t.blocked) return;
  t.blocked = true;
  await chrome.storage.session.set({ [`blocked:${tabId}`]: { href: t.href, verdict: t.verdict } });
  await chrome.tabs.update(tabId, { url: `${BLOCK_PAGE}#${encodeURIComponent(t.href)}` }).catch(() => {});
}

async function onNavigate(tabId, href) {
  if (href.startsWith(BLOCK_PAGE)) return; // keep the blocked verdict for the popup
  chrome.storage.session.remove(`blocked:${tabId}`).catch(() => {});
  const t = freshState(tabId, href);
  await refresh(tabId, t);
}

/* ------------------------------------------------------------------ navigation hooks */

chrome.webNavigation.onBeforeNavigate.addListener((d) => {
  if (d.frameId !== 0 || d.documentLifecycle === "prerender") return;
  onNavigate(d.tabId, d.url).catch(console.error);
});

// Server redirects (a link shortener, http -> https) only show their final address here.
chrome.webNavigation.onCommitted.addListener((d) => {
  if (d.frameId !== 0 || d.documentLifecycle === "prerender") return;
  const t = tabs.get(d.tabId);
  if (!t || hostOf(t.href) !== hostOf(d.url)) onNavigate(d.tabId, d.url).catch(console.error);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabs.delete(tabId);
  toastFor.delete(tabId);
  chrome.storage.session.remove([`tab:${tabId}`, `blocked:${tabId}`]).catch(() => {});
});

/* ------------------------------------------------------------------ messages */

// The content script speaks for the page it runs in; it may arrive before or after the
// navigation hooks, or after the worker restarted, so it can (re)open the tab's state.
function stateFor(tabId, href) {
  const t = tabs.get(tabId);
  if (t && hostOf(t.href) === hostOf(href)) {
    t.href = href;
    return t;
  }
  return freshState(tabId, href);
}

const handlers = {
  async hello({ href }, sender) {
    const tabId = sender.tab.id;
    const t = stateFor(tabId, href);
    const v = t.verdict && !t.page ? t.verdict : await refresh(tabId, t);
    if (!v) return null;
    const asked = toastFor.get(tabId);
    const toast = v.level === "official" && asked && Date.now() - asked < 120000;
    if (toast) toastFor.delete(tabId);
    return { analyze: !QUIET.has(v.level), verdict: v, toast };
  },

  async features({ href, features }, sender) {
    const tabId = sender.tab.id;
    const t = stateFor(tabId, href);
    t.page = features;
    return { verdict: await refresh(tabId, t) };
  },

  async popup({ tabId, url }) {
    const [settings, state] = await Promise.all([getSettings(), lists.load()]);
    const listsInfo = { count: state.count, updatedAt: state.updatedAt };
    if (!url || url.startsWith(BLOCK_PAGE)) {
      const blocked = (await chrome.storage.session.get(`blocked:${tabId}`))[`blocked:${tabId}`];
      if (blocked) return { verdict: blocked.verdict, blocked: true, settings, lists: listsInfo };
    }
    let t = tabs.get(tabId);
    if (!t || t.href !== url) {
      const saved = (await chrome.storage.session.get(`tab:${tabId}`))[`tab:${tabId}`];
      t = saved && saved.href === url ? { ...saved } : null;
    }
    const verdict = t?.verdict || (url ? await judge({ href: url, page: null }) : null);
    return { verdict, settings, lists: listsInfo };
  },

  async setEnabled({ enabled }) {
    return setSettings({ enabled: !!enabled });
  },

  async trust({ domain, yes, tabId }) {
    const s = await trust(domain, yes);
    const t = tabs.get(tabId);
    if (t) await refresh(tabId, t);
    return s;
  },

  async refreshLists() {
    const state = await lists.refresh(await engine(), { force: true });
    return { count: state.count, updatedAt: state.updatedAt };
  },

  async blockedInfo(_msg, sender) {
    const key = `blocked:${sender.tab.id}`;
    return (await chrome.storage.session.get(key))[key] || null;
  },

  async continueAnyway(_msg, sender) {
    const tabId = sender.tab.id;
    const info = await handlers.blockedInfo(null, sender);
    if (!info) return false;
    await addBypass(info.verdict.domain);
    await chrome.tabs.update(tabId, { url: info.href });
    return true;
  },

  async goOfficial({ url }, sender) {
    toastFor.set(sender.tab.id, Date.now());
    await chrome.tabs.update(sender.tab.id, { url });
    return true;
  },

  async leave(_msg, sender) {
    const id = sender.tab.id;
    await chrome.tabs.update(id, { url: "chrome://newtab/" }).catch(() => chrome.tabs.update(id, { url: "about:blank" }));
    return true;
  },
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handler = msg && handlers[msg.type];
  if (!handler) return false;
  if (["hello", "features"].includes(msg.type) && (!sender.tab || sender.frameId !== 0)) return false;
  handler(msg, sender).then(sendResponse, (e) => {
    console.error(e);
    sendResponse(null);
  });
  return true;
});

/* ------------------------------------------------------------------ lists upkeep */

async function upkeep({ force = false } = {}) {
  await lists.refresh(await engine(), { force });
  await prune();
}

function ensureAlarm() {
  chrome.alarms.get("upkeep", (a) => { if (!a) chrome.alarms.create("upkeep", { periodInMinutes: 60 }); });
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  ensureAlarm();
  upkeep({ force: reason === "install" }).catch(console.error);
});
chrome.runtime.onStartup.addListener(() => {
  ensureAlarm();
  upkeep().catch(console.error);
});
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "upkeep") upkeep().catch(console.error);
});
