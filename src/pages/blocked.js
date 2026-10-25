/* The block page: what Virio stopped, why, and the way to the real site. Opened outside the
   extension (local preview), it judges a demo address with the real engine instead. */

const $ = (id) => document.getElementById(id);
const inExtension = typeof chrome !== "undefined" && !!chrome.runtime?.id;
const ask = (msg) => chrome.runtime.sendMessage(msg);
const ICON = { good: "✓", bad: "✕", neutral: "–", pending: "…" };

async function demo() {
  const { createEngine } = await import("../engine/index.js");
  const pslText = await fetch("../../data/public_suffix_list.dat").then((r) => r.text());
  const href = new URLSearchParams(location.search).get("url") || "https://antai-paiement-gouv.com/paiement-amende";
  const verdict = createEngine({ pslText }).evaluate({ href, listsCount: 26962, age: { created: new Date(Date.now() - 3 * 86400000).toISOString() } });
  return { href, verdict };
}

async function load() {
  if (!inExtension) return demo();
  const info = await ask({ type: "blockedInfo" });
  if (info) return info;
  // The browser restarted on this page: the verdict is gone, so judge the address again.
  const href = decodeURIComponent(location.hash.slice(1));
  return { href, verdict: null };
}

function span(cls, text) {
  const el = document.createElement("span");
  el.className = cls;
  el.textContent = text;
  return el;
}

function checkItem(state, label, detail) {
  const el = document.createElement("li");
  el.className = state;
  const ico = span("ico", ICON[state] || "–");
  ico.setAttribute("aria-hidden", "true");
  el.append(ico, span("lbl", label), span("det", detail));
  return el;
}

function li(text, cls) {
  const el = document.createElement("li");
  el.textContent = text;
  if (cls) el.className = cls;
  return el;
}

function render({ href, verdict: v }) {
  let host = href;
  try { host = new URL(href).hostname; } catch {}
  $("fake-addr").textContent = host;

  if (!v) {
    $("headline").textContent = "Cette page avait été bloquée.";
    $("lead").textContent = "Virio avait arrêté ce site lors de votre visite précédente.";
    $("continue").textContent = "Analyser ce site à nouveau";
    $("continue").addEventListener("click", () => { location.href = href; });
    document.querySelectorAll(".risk, .why, .all-checks").forEach((el) => (el.hidden = true));
    return;
  }

  const certain = v.listHits?.length || v.score >= 85;
  $("pill").textContent = v.title;
  $("headline").textContent = certain ? "Ce site est un faux." : "Ce site ressemble fort à une arnaque.";
  $("lead").textContent = `Virio a bloqué la page avant que vous ne donniez vos informations.${v.brand ? ` Elle se fait passer pour ${v.brand.le}.` : ""}`;
  document.title = `Virio · ${host} bloqué`;

  if (v.brand) {
    $("real").hidden = false;
    $("real-addr").textContent = v.brand.home;
    const go = $("go");
    go.hidden = false;
    go.href = v.brand.url;
    go.textContent = `Aller sur ${v.brand.home}`;
    go.addEventListener("click", (e) => {
      if (!inExtension) return;
      e.preventDefault();
      ask({ type: "goOfficial", url: v.brand.url });
    });
  }

  $("risk-label").textContent = v.score >= 85 ? "Très élevé" : "Élevé";
  $("meter").setAttribute("aria-valuenow", String(v.score));
  requestAnimationFrame(() => requestAnimationFrame(() => { $("bar").style.width = `${Math.max(8, v.score)}%`; }));

  const major = v.reasons.filter((r) => !r.minor);
  const shown = (major.length ? major : v.reasons).slice(0, 4);
  const rest = v.reasons.filter((r) => !shown.includes(r));
  shown.forEach((r) => $("reasons").append(li(r.text)));
  if (rest.length) {
    const more = $("more");
    more.hidden = false;
    more.textContent = `Voir ${rest.length === 1 ? "l'autre signal" : `les ${rest.length} autres signaux`}`;
    more.addEventListener("click", () => {
      rest.forEach((r) => $("reasons").append(li(r.text, r.minor ? "minor" : "")));
      more.remove();
    }, { once: true });
  }

  for (const c of v.checks || []) {
    const notOpened = c.id === "page" && c.state === "pending";
    const state = notOpened ? "neutral" : c.state;
    const detail = notOpened ? "Page bloquée avant de s'ouvrir" : c.detail;
    $("checks").append(checkItem(state, c.label, detail));
  }

  $("continue").addEventListener("click", () => {
    $("confirm").hidden = false;
    $("continue").hidden = true;
    $("continue-yes").focus();
  });
  $("continue-yes").addEventListener("click", () => {
    if (inExtension) ask({ type: "continueAnyway" });
  });
}

// The green flash only plays once the tab is actually on screen, then gets out of the way.
const flash = document.querySelector(".flash");
const playFlash = () => {
  if (document.visibilityState !== "visible") return;
  flash.addEventListener("animationend", () => flash.remove(), { once: true });
  flash.classList.add("on");
  document.removeEventListener("visibilitychange", playFlash);
};
if (matchMedia("(prefers-reduced-motion: reduce)").matches) flash.remove();
else { document.addEventListener("visibilitychange", playFlash); playFlash(); }

$("leave").addEventListener("click", () => {
  if (inExtension) ask({ type: "leave" });
  else history.back();
});

load().then(render).catch((e) => {
  console.error(e);
  render({ href: decodeURIComponent(location.hash.slice(1)), verdict: null });
});
