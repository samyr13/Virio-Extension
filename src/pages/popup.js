/* The toolbar popup: Virio's verdict on the current tab, every check it ran, and the switches.
   Opened outside the extension (local preview), it judges ?url=… with the real engine. */

const $ = (id) => document.getElementById(id);
const inExtension = typeof chrome !== "undefined" && !!chrome.runtime?.id;
const ask = (msg) => chrome.runtime.sendMessage(msg);
const nf = new Intl.NumberFormat("fr-FR");
const ICON = { good: "✓", bad: "✕", neutral: "–", pending: "…" };

const PILL = {
  official: ["safe", "Site officiel vérifié"],
  ok: ["neutral", "Aucun signal d'arnaque"],
  suspect: ["threat", "Site suspect"],
  danger: ["threat", "Bloqué par Virio"],
  bypassed: ["threat", "Ouvert malgré l'alerte"],
  trusted: ["neutral", "Autorisé par vous"],
  local: ["neutral", "Réseau local"],
  unsupported: ["neutral", "Page non analysée"],
  off: ["neutral", "Protection en pause"],
};
const TEXT = {
  official: (v) => ["Vous êtes sur le vrai site", v.brand ? `Ce site appartient bien ${v.brand.a}.` : v.summary],
  ok: (v) => ["Rien d'inquiétant", v.summary],
  suspect: (v) => ["Prudence sur ce site", v.summary],
  bypassed: (v) => ["Site risqué", v.summary],
  trusted: (v) => ["Site de confiance", v.summary],
  local: () => ["Adresse locale", "Les adresses de votre ordinateur ou de votre réseau ne sont pas analysées."],
  unsupported: () => ["Rien à analyser ici", "Virio analyse les sites web (adresses en http et https)."],
  off: () => ["Protection en pause", "Virio n'analyse plus les sites. Réactivez la protection en haut à droite."],
};

let tab = null;
let state = null;

function since(ts) {
  if (!ts) return "jamais";
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 2) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `il y a ${h} h` : `il y a ${Math.round(h / 24)} jours`;
}

function span(cls, text) {
  const el = document.createElement("span");
  el.className = cls;
  el.textContent = text;
  return el;
}

function button(label, cls, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `btn ${cls}`;
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function render() {
  const { verdict: v, settings, lists } = state;
  const enabled = settings?.enabled !== false;
  $("toggle").setAttribute("aria-checked", String(enabled));
  $("toggle-label").textContent = enabled ? "Protection active" : "Protection en pause";
  $("lists").textContent = lists?.count
    ? `${nf.format(lists.count)} sites signalés · mis à jour ${since(lists.updatedAt)}`
    : "Listes de sites signalés : en cours de téléchargement";

  const level = enabled ? v?.level || "unsupported" : "off";
  const [tone, pill] = PILL[level] || PILL.unsupported;
  $("pill").className = `pill ${tone}`;
  $("pill").textContent = pill;
  $("site").textContent = v?.host || "";
  const [title, summary] = TEXT[level]?.(v) || [v?.title || "", v?.summary || ""];
  $("title").textContent = title;
  $("summary").textContent = summary || "";

  const risky = ["suspect", "danger", "bypassed"].includes(level);
  $("risk").hidden = !risky;
  if (risky) {
    $("risk-value").textContent = `${v.score} / 100`;
    $("risk-bar").style.width = `${Math.max(6, v.score)}%`;
  }

  $("reasons").replaceChildren(...(risky ? v.reasons.filter((r) => !r.minor).slice(0, 4) : []).map((r) => {
    const li = document.createElement("li");
    li.textContent = r.text;
    return li;
  }));

  const checks = enabled && v?.checks?.length ? v.checks : [];
  $("checks-block").hidden = !checks.length;
  $("checks").replaceChildren(...checks.map((c) => {
    const pending = c.id === "page" && c.state === "pending" && state.blocked;
    const st = pending ? "neutral" : c.state;
    const li = document.createElement("li");
    li.className = st;
    const ico = span("ico", ICON[st] || "–");
    ico.setAttribute("aria-hidden", "true");
    li.append(ico, span("lbl", c.label), span("det", pending ? "Page bloquée avant de s'ouvrir" : c.detail));
    return li;
  }));

  const acts = [];
  if (enabled && (level === "suspect" || level === "bypassed")) {
    acts.push(button("Je fais confiance à ce site", "ghost", () => setTrust(true)));
  } else if (enabled && level === "trusted") {
    acts.push(button("Ne plus faire confiance", "ghost", () => setTrust(false)));
  }
  $("acts").replaceChildren(...acts);
}

async function load() {
  if (!inExtension) {
    const { createEngine } = await import("../engine/index.js");
    const pslText = await fetch("../../data/public_suffix_list.dat").then((r) => r.text());
    const href = new URLSearchParams(location.search).get("url") || "https://www.amendes.gouv.fr";
    const age = new URLSearchParams(location.search).get("age");
    const verdict = createEngine({ pslText }).evaluate({
      href, listsCount: 26962, page: { title: "", fields: [] },
      age: age ? { created: new Date(Date.now() - Number(age) * 86400000).toISOString() } : undefined,
    });
    state = { verdict, settings: { enabled: true }, lists: { count: 26962, updatedAt: Date.now() - 2 * 3600e3 } };
    return render();
  }
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state = await ask({ type: "popup", tabId: tab?.id, url: tab?.url || "" });
  if (state) render();
}

async function setTrust(yes) {
  if (!inExtension || !state.verdict?.domain) return;
  await ask({ type: "trust", domain: state.verdict.domain, yes, tabId: tab.id });
  await load();
}

$("toggle").addEventListener("click", async () => {
  if (!inExtension) return;
  const enabled = state.settings?.enabled === false;
  state.settings = await ask({ type: "setEnabled", enabled });
  if (enabled) chrome.tabs.reload(tab.id);
  await load();
});

$("refresh").addEventListener("click", async () => {
  if (!inExtension) return;
  $("lists").textContent = "Mise à jour des listes…";
  state.lists = await ask({ type: "refreshLists" });
  render();
});

load().catch(console.error);
