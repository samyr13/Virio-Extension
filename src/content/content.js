/* Virio — runs in every web page. Collects what the page shows and asks (title, logos, form
   fields), hands it to the background for judgement, and shows the warning banner. Nothing
   collected here leaves the browser. Plain script on purpose: content scripts can't be modules. */
(() => {
  "use strict";
  if (window.__virio) return;
  window.__virio = true;

  const send = (msg) => new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (res) => { void chrome.runtime.lastError; resolve(res || null); });
    } catch {
      resolve(null); // the extension was reloaded: this copy of the script is orphaned
    }
  });

  const clip = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
  const shown = (el) => el.type !== "hidden" && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const visibleFields = () => [...document.querySelectorAll("input, select, textarea")].filter(shown);

  function labelFor(el) {
    if (el.labels && el.labels.length) return el.labels[0].textContent;
    const by = el.getAttribute("aria-labelledby");
    if (by) return document.getElementById(by)?.textContent || "";
    const prev = el.previousElementSibling;
    return prev && /^(LABEL|SPAN|P|DIV|STRONG)$/.test(prev.tagName) ? prev.textContent : "";
  }

  function collect() {
    const fields = visibleFields().slice(0, 60).map((el) => ({
      type: el.type || el.tagName.toLowerCase(),
      autocomplete: el.getAttribute("autocomplete") || "",
      hint: clip([el.name, el.id, el.placeholder, el.getAttribute("aria-label"), labelFor(el)].filter(Boolean).join(" "), 240),
    }));
    const logos = [...document.images].slice(0, 80)
      .filter((img) => /logo|brand|marque/i.test(`${img.src} ${img.alt} ${img.className} ${img.id}`) || img.closest("header, nav, [class*=header i], [id*=header i]"))
      .slice(0, 12)
      .map((img) => clip(`${img.alt} ${(img.currentSrc || img.src).split(/[?#]/)[0].split("/").pop()}`, 160));
    const header = document.querySelector("header, [role=banner], [class*=header i], [id*=header i]");
    const inline = [...document.scripts].filter((s) => !s.src).map((s) => s.textContent).join("\n").slice(0, 300000);
    const formHosts = [...document.forms]
      .map((f) => { try { return new URL(f.getAttribute("action") || "", location.href).hostname; } catch { return ""; } })
      .filter(Boolean).slice(0, 10);
    return {
      protocol: location.protocol,
      title: clip(document.title, 200),
      siteName: clip(document.querySelector('meta[property="og:site_name"], meta[name="application-name"]')?.content, 100),
      h1: [...document.querySelectorAll("h1")].slice(0, 3).map((h) => clip(h.innerText, 160)),
      header: clip(header?.innerText, 300),
      logos,
      text: clip(document.body?.innerText, 8000),
      fields,
      formHosts,
      telegram: /api\.telegram\.org\/bot|\bbot\d{8,10}:[A-Za-z0-9_-]{30,}/.test(inline),
    };
  }

  /* ---------------------------------------------------------------- banner */

  // Built node by node (no innerHTML): page text never becomes markup.
  function el(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else n.setAttribute(k, v);
    }
    n.append(...kids);
    return n;
  }

  function shield() {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "4 2 192 234");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(NS, "path");
    for (const [k, v] of Object.entries({
      d: "M100 10 L182 40 C186 41.5 188 45 188 49 V112 C188 166 152 204 100 228 C48 204 12 166 12 112 V49 C12 45 14 41.5 18 40 Z",
      fill: "#2bc97a", "fill-opacity": "0.14", stroke: "#2bc97a", "stroke-width": "16", "stroke-linejoin": "round",
    })) path.setAttribute(k, v);
    const rect = document.createElementNS(NS, "rect");
    for (const [k, v] of Object.entries({ x: "82", y: "66", width: "36", height: "104", rx: "18", fill: "#2bc97a" })) rect.setAttribute(k, v);
    svg.append(path, rect);
    return svg;
  }

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .v { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 2147483647;
      width: min(760px, calc(100vw - 24px)); background: #121722; color: #f2f4f8; border: 1px solid #252d3b;
      border-radius: 18px; box-shadow: 0 30px 60px -30px rgba(0,0,0,.8); padding: 12px 12px 12px 16px;
      font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; animation: in .35s cubic-bezier(.16,1,.3,1); }
    @keyframes in { from { opacity: 0; transform: translate(-50%, -8px); } }
    @media (prefers-reduced-motion: reduce) { .v, .t { animation: none; } }
    .row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    svg { width: 18px; height: 22px; flex: none; }
    .brand { font-weight: 800; letter-spacing: -.02em; }
    .pill { background: #3a1418; color: #ff7a7d; font-weight: 700; font-size: 11px; letter-spacing: .1em; padding: 4px 9px; border-radius: 999px; }
    .msg { flex: 1 1 260px; margin: 0; color: #b9c0cc; }
    .msg b { color: #f2f4f8; font-weight: 600; }
    button { font: inherit; cursor: pointer; border-radius: 999px; }
    .more { background: #19202d; color: #f2f4f8; border: 1px solid #252d3b; padding: 6px 12px; font-weight: 600; }
    .close { background: none; border: 0; color: #8c96a8; width: 32px; height: 32px; font-size: 20px; line-height: 1; }
    button:hover { color: #f2f4f8; }
    button:focus-visible { outline: 2px solid #2bc97a; outline-offset: 3px; }
    ul { list-style: none; margin: 12px 0 2px; padding: 12px 0 0; border-top: 1px solid #252d3b; display: grid; gap: 8px; }
    li { display: grid; grid-template-columns: 16px 1fr; gap: 8px; color: #f2f4f8; }
    li::before { content: "✕"; color: #e5484d; font-weight: 700; }
    .warn { margin: 10px 0 0; padding: 10px 12px; border-radius: 12px; background: #3a1418; color: #ffd9da; font-weight: 600; }
    .t { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; display: flex; align-items: center; gap: 10px;
      background: #121722; color: #f2f4f8; border: 1px solid rgba(43,201,122,.45); border-radius: 999px; padding: 10px 16px 10px 12px;
      font: 600 14px/1.3 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; box-shadow: 0 30px 60px -30px rgba(0,0,0,.8);
      animation: up .4s cubic-bezier(.16,1,.3,1); }
    @keyframes up { from { opacity: 0; transform: translateY(8px); } }
    .t .d { color: #b9c0cc; font: 500 13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  `;

  let host = null;
  let root = null;
  let dismissed = false;
  let warned = false;
  let current = null;

  function mount() {
    if (host) return;
    host = document.createElement("virio-alerte");
    root = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = CSS;
    root.append(style);
    document.documentElement.append(host);
  }

  function showBanner(v, { warnTyping = false } = {}) {
    mount();
    root.querySelector(".v")?.remove();
    const reasons = v.reasons.filter((r) => !r.minor).slice(0, 5);
    const more = el("button", { class: "more", type: "button", "aria-expanded": String(warnTyping), text: "Pourquoi ?" });
    const close = el("button", { class: "close", type: "button", "aria-label": "Fermer l'alerte Virio", text: "×" });
    const details = el("div", { class: "details" });
    details.hidden = !warnTyping;
    if (warnTyping) details.append(el("p", { class: "warn", text: "Attendez avant de taper : Virio a des doutes sur ce site." }));
    details.append(el("ul", {}, ...reasons.map((r) => el("li", { text: r.text }))));
    const box = el("div", { class: "v", role: "alert" },
      el("div", { class: "row" },
        shield(),
        el("span", { class: "brand", text: "Virio" }),
        el("span", { class: "pill", text: "SITE SUSPECT" }),
        el("p", { class: "msg" }, el("b", { text: "Ce site présente des signes d'arnaque." }), " Ne donnez ni carte bancaire ni code reçu par SMS."),
        more,
        close),
      details);
    more.addEventListener("click", () => {
      details.hidden = !details.hidden;
      more.setAttribute("aria-expanded", String(!details.hidden));
    });
    close.addEventListener("click", () => { dismissed = true; box.remove(); });
    root.append(box);
  }

  function hideBanner() {
    root?.querySelector(".v")?.remove();
  }

  function toast(v) {
    mount();
    const t = el("div", { class: "t", role: "status" },
      shield(), el("span", { text: "Site officiel vérifié" }), el("span", { class: "d", text: v.domain }));
    root.append(t);
    setTimeout(() => t.remove(), 6000);
  }

  function apply(v) {
    if (!v || new URL(v.href).host !== location.host) return;
    current = v;
    if (v.level === "suspect" && !dismissed) showBanner(v);
    else if (v.level !== "suspect") hideBanner();
  }

  // On a suspect page, reaching for a card, password or SMS code field brings the warning back.
  const SENSITIVE_FIELD = /card|carte|cvv|cvc|crypto|expir|iban|otp|sms|secu|password|mot.?de.?passe/i;
  document.addEventListener("focusin", (e) => {
    const el = e.target;
    if (current?.level !== "suspect" || !(el instanceof HTMLInputElement)) return;
    const hint = `${el.type} ${el.name} ${el.id} ${el.placeholder} ${el.autocomplete}`;
    if (warned && root?.querySelector(".v")) return;
    if (el.type === "password" || /^cc-|one-time-code/.test(el.autocomplete) || SENSITIVE_FIELD.test(hint)) {
      dismissed = false;
      warned = true;
      showBanner(current, { warnTyping: true });
    }
  }, true);

  /* ---------------------------------------------------------------- flow */

  let sends = 0;
  let lastCount = -1;
  let timer = null;

  async function analyse() {
    const features = collect();
    lastCount = features.fields.length;
    sends++;
    const res = await send({ type: "features", href: location.href, features });
    if (res?.verdict) apply(res.verdict);
  }

  // Scam kits often reveal the card form a few seconds later, or after a first "Payer" click.
  function watch() {
    const obs = new MutationObserver(() => {
      if (timer || sends >= 6) return;
      timer = setTimeout(() => {
        timer = null;
        if (visibleFields().length !== lastCount) analyse();
      }, 1500);
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => obs.disconnect(), 120000);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "verdict") apply(msg.verdict);
  });

  async function start() {
    const res = await send({ type: "hello", href: location.href });
    if (!res) return;
    if (res.toast) toast(res.verdict);
    if (!res.analyze) return;
    apply(res.verdict);
    await analyse();
    watch();
  }

  if (document.prerendering) document.addEventListener("prerenderingchange", start, { once: true });
  else start();
})();
