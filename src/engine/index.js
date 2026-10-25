/* The Virio engine: turns an address (plus, when known, blocklists, the domain's age and what the
   page asks for) into a verdict with plain-French reasons. Pure functions, no browser APIs, so the
   same code runs in the extension, in the tests and later on the server or in the mobile apps. */

import { createPsl } from "./psl.js";
import { BRANDS, GLOBAL_BRANDS } from "./brands.js";
import { analyzeAddress, freeHostingOf } from "./address.js";
import { analyzePage, prepareNames } from "./page.js";
import { joinFr } from "./text.js";

export const THRESHOLDS = { block: 70, warn: 40, age: 10 };

const DAY = 86400000;
const nf = new Intl.NumberFormat("fr-FR");
const df = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const deForm = (name) => (/^[aeiouyéèêh]/i.test(name) ? `d'${name}` : `de ${name}`);

export function ago(days) {
  if (days < 1) return "il y a moins d'un jour";
  if (days < 60) return `il y a ${days} jour${days > 1 ? "s" : ""}`;
  if (days < 730) return `il y a ${Math.round(days / 30.4)} mois`;
  return `il y a ${Math.floor(days / 365.25)} ans`;
}

function prepareBrand(b) {
  const brand = {
    ...b,
    le: b.le || b.name,
    de: b.de || deForm(b.name),
    a: b.a || `à ${b.name}`,
    suffixes: b.suffixes || [],
    keyList: b.keys.map((k) => (typeof k === "string" ? { k, weak: false } : k)),
    domainSet: new Set(b.domains),
    global: GLOBAL_BRANDS.has(b.id),
    home: new URL(b.url).hostname.replace(/^www\./, ""),
  };
  brand.matchers = prepareNames(brand);
  return brand;
}

const publicBrand = (b) => b && { id: b.id, name: b.name, le: b.le, de: b.de, a: b.a, url: b.url, home: b.home };

// Home networks, intranets and the machine itself are never judged.
function isLocalHost(host) {
  if (host === "localhost" || !host.includes(".")) return true;
  if (/\.(local|lan|home|internal|intranet|home\.arpa)$/.test(host)) return true;
  if (host.startsWith("[")) return /^\[(::1|f[cd][0-9a-f]{2}:|fe80:)/i.test(host);
  const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || a === 127 || a === 0 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31)
    || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
}
const isIp = (host) => /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith("[");

const ADDRESS_LABELS = {
  "scam-words": "mots d'arnaque", "risky-tld": "extension jetable", "free-hosting": "page gratuite",
  punycode: "caractères trompeurs", userinfo: "« @ » trompeur", shape: "forme inhabituelle",
  http: "connexion non chiffrée", ip: "adresse IP",
};

export function createEngine({ pslText, brands = BRANDS, thresholds = THRESHOLDS }) {
  const psl = createPsl(pslText);
  const list = brands.map(prepareBrand);

  function officialFor(parsed) {
    if (!parsed.domain) return null;
    return list.find((b) => b.domainSet.has(parsed.domain))
      || list.find((b) => b.suffixes.some((s) => parsed.suffix === s || parsed.suffix.endsWith(`.${s}`)))
      || null;
  }

  // Everything the background needs to know about an address before judging it.
  function inspect(href) {
    let url;
    try { url = new URL(href); } catch { return { kind: "unsupported", href }; }
    if (url.protocol !== "http:" && url.protocol !== "https:") return { kind: "unsupported", href };
    const host = url.hostname.toLowerCase();
    if (isLocalHost(host)) return { kind: "local", href, url, host };
    if (isIp(host)) return { kind: "ip", href, url, host, parsed: { host, labels: [host], suffix: "", tld: "", subLabels: [], label: host, domain: host } };
    const parsed = psl.parse(host);
    const platform = freeHostingOf(host);
    const ageTarget = parsed.domain && !parsed.isPrivate && !platform && parsed.knownTld ? { domain: parsed.domain, tld: parsed.tld } : null;
    return { kind: "web", href, url, host, parsed, platform, official: officialFor(parsed), ageTarget };
  }

  function evaluate({ href, blocklist = null, age, page = null, trusted = false, bypassed = false, listsCount = 0, now = Date.now() }) {
    const info = inspect(href);
    const base = { href, host: info.host || "", domain: info.parsed?.domain || info.host || "" };
    if (info.kind === "unsupported") return { ...base, level: "unsupported", title: "Page non analysée", score: 0, reasons: [], checks: [] };
    if (info.kind === "local") return { ...base, level: "local", title: "Adresse locale", score: 0, reasons: [], checks: [] };
    if (info.official) {
      const b = info.official;
      return { ...base, level: "official", title: "Site officiel vérifié", score: 0, brand: publicBrand(b), reasons: [],
        summary: `Vous êtes bien sur le site ${b.de}.`,
        checks: [{ id: "owner", label: "Propriétaire du site", state: "good", detail: `${cap(b.le)} (${b.home})` }] };
    }
    if (trusted) return { ...base, level: "trusted", title: "Site autorisé par vous", score: 0, reasons: [], checks: [],
      summary: "Vous avez indiqué faire confiance à ce site : Virio ne l'analyse plus." };

    const { parsed, url } = info;
    const signals = [];
    let hits = [];
    let platform = info.platform || null;

    const listHits = blocklist ? blocklist.match(parsed) : [];
    if (listHits.length) {
      signals.push({ id: "blocklist", group: "list", points: 100,
        text: `Ce site figure sur des listes de sites d'arnaque signalés (${joinFr(listHits)}).` });
    }

    if (info.kind === "ip") {
      signals.push({ id: "ip", group: "address", points: 25,
        text: "L'adresse est une suite de chiffres (une adresse IP) au lieu d'un nom : aucun service officiel ne fait ça." });
      if (url.protocol === "http:") signals.push({ id: "http", group: "address", points: 5, minor: true, text: "La connexion n'est pas chiffrée (adresse en http)." });
    } else {
      const a = analyzeAddress(url, parsed, list);
      signals.push(...a.signals);
      hits = a.hits;
      platform = a.platform;
    }

    // Combinations that are far more telling than their parts.
    const lead = hits.find((h) => h.kind !== "sibling" && h.kind !== "path");
    const has = (id) => signals.some((s) => s.id === id);
    if (lead && has("scam-words")) signals.push({ id: "combo-words", group: "brand", points: 10, minor: true,
      text: "Le nom d'un service connu accolé à des mots d'arnaque : c'est la recette typique des faux sites." });
    if (lead && platform) signals.push({ id: "combo-platform", group: "brand", points: 20, minor: true,
      text: "Un service connu n'héberge jamais ses pages sur une plateforme gratuite." });
    if (lead && has("risky-tld")) signals.push({ id: "combo-tld", group: "brand", points: 5, minor: true,
      text: "Un service connu n'utilise pas ce genre d'extension pour son site." });

    let pageResult = null;
    if (page) {
      pageResult = analyzePage(page, { parsed, brands: list, preferBrand: lead?.brand || null });
      signals.push(...pageResult.signals);
    }

    const before = signals.reduce((n, s) => n + s.points, 0);
    let ageInfo = null;
    if (age && age.created) {
      const days = Math.max(0, Math.floor((now - Date.parse(age.created)) / DAY));
      ageInfo = { created: age.created, days, text: ago(days), date: df.format(new Date(age.created)), source: age.source };
      const impersonation = hits.some((h) => ["inside", "mention", "lookalike", "gouv"].includes(h.kind));
      if (days < 7) signals.push({ id: "age", group: "age", points: 40, text: `Le site a été créé ${ago(days)} seulement.` });
      else if (days < 30) signals.push({ id: "age", group: "age", points: 30, text: `Le site a été créé ${ago(days)} : les faux sites ne vivent souvent que quelques semaines.` });
      else if (days < 183) signals.push({ id: "age", group: "age", points: 18, text: `Le site a été créé ${ago(days)}, c'est très récent.` });
      else if (days < 365) signals.push({ id: "age", group: "age", points: 6, minor: true, text: "Le site existe depuis moins d'un an." });
      else if (!impersonation) signals.push({ id: "age", group: "age", points: days >= 3 * 365 ? -20 : -8, minor: true,
        text: `Le site existe depuis ${df.format(new Date(age.created))} : un site ancien est rarement un faux, sans que ce soit une garantie.` });
    }

    const score = Math.max(0, Math.min(100, signals.reduce((n, s) => n + s.points, 0)));
    let level = score >= thresholds.block ? "danger" : score >= thresholds.warn ? "suspect" : "ok";
    if (level !== "ok" && bypassed) level = "bypassed";
    const needsAge = !!info.ageTarget && age === undefined && before >= thresholds.age;

    const claim = pageResult?.claim;
    const brand = lead?.brand || (claim && (claim.strong || pageResult.sensitive) ? claim.brand : null) || hits[0]?.brand || null;
    const reasons = signals.filter((s) => s.points > 0).sort((x, y) => (!!x.minor === !!y.minor ? y.points - x.points : x.minor ? 1 : -1))
      .map(({ id, group, points, text, minor }) => ({ id, group, points, text, minor: !!minor }));

    const titles = {
      danger: listHits.length || score >= 85 ? "Arnaque détectée" : "Arnaque probable",
      suspect: "Site suspect",
      ok: "Aucun signal d'arnaque",
      bypassed: "Site risqué ouvert à votre demande",
    };
    const summaries = {
      danger: brand ? `Ce site se fait passer pour ${brand.le}.` : "Ce site présente plusieurs signes d'arnaque.",
      suspect: "Ce site présente des signes d'arnaque. Ne donnez ni carte bancaire ni code reçu par SMS.",
      ok: "Virio n'a rien trouvé d'inquiétant. Restez attentif à ce que la page vous demande.",
      bypassed: "Vous avez choisi d'ouvrir ce site malgré l'alerte de Virio.",
    };

    return {
      ...base, level, score, title: titles[level], summary: summaries[level],
      brand: publicBrand(brand), reasons, listHits, platform,
      age: ageInfo, ageTarget: info.ageTarget || null, needsAge,
      asked: pageResult?.asked || null,
      checks: buildChecks({ signals, listHits, listsCount, brand, info, platform, age, ageInfo, needsAge, pageResult, level, count: list.length }),
    };
  }

  return { psl, brands: list, thresholds, inspect, evaluate, officialFor };
}

function buildChecks({ signals, listHits, listsCount, brand, info, platform, age, ageInfo, needsAge, pageResult, level, count }) {
  const checks = [];
  checks.push(listHits.length
    ? { id: "list", label: "Listes de sites signalés", state: "bad", detail: `Signalé par ${joinFr(listHits)}` }
    : listsCount
      ? { id: "list", label: "Listes de sites signalés", state: "good", detail: `Absent des ${nf.format(listsCount)} sites signalés` }
      : { id: "list", label: "Listes de sites signalés", state: "neutral", detail: "Listes en cours de téléchargement" });

  const brandSignals = signals.filter((s) => s.group === "brand" && s.points > 0);
  const major = brandSignals.filter((s) => !s.minor);
  checks.push(major.length
    ? { id: "brand", label: "Imitation d'un service connu", state: "bad",
        detail: major.some((s) => s.id === "fake-gouv") && (!brand || brand.id === "etat") ? "Faux site de l'État" : `Imite ${brand ? brand.le : "un service connu"}` }
    : brandSignals.length && brand
      ? { id: "brand", label: "Imitation d'un service connu", state: "neutral", detail: `Mentionne ${brand.le}` }
      : { id: "brand", label: "Imitation d'un service connu", state: "good", detail: `N'imite aucun des ${count} services surveillés` });

  const addr = signals.filter((s) => s.group === "address" && s.points > 0);
  const addrPoints = addr.reduce((n, s) => n + s.points, 0);
  checks.push(addr.length
    ? { id: "address", label: "Forme de l'adresse", state: addrPoints >= 10 ? "bad" : "neutral",
        detail: cap(joinFr([...new Set(addr.map((s) => ADDRESS_LABELS[s.id]).filter(Boolean))])) }
    : { id: "address", label: "Forme de l'adresse", state: "good", detail: "Rien d'anormal" });

  let ageCheck;
  if (!info.ageTarget) {
    ageCheck = { state: "neutral", detail: platform ? `Page hébergée sur ${platform}` : "Non vérifiable pour cette adresse" };
  } else if (ageInfo) {
    // An old domain is only reassuring when nothing else is wrong (hacked sites host fakes too).
    ageCheck = ageInfo.days < 183
      ? { state: "bad", detail: `Créé ${ageInfo.text}` }
      : ageInfo.days >= 365
        ? { state: level === "ok" ? "good" : "neutral", detail: `Créé le ${ageInfo.date} (${ageInfo.text})` }
        : { state: "neutral", detail: `Créé ${ageInfo.text}` };
  } else if (age === undefined) {
    ageCheck = needsAge ? { state: "pending", detail: "Vérification…" } : { state: "neutral", detail: "Non vérifié (aucun autre signal)" };
  } else if (age && age.unsupported) {
    ageCheck = { state: "neutral", detail: `Pas encore disponible pour l'extension .${info.ageTarget.tld}` };
  } else if (age && age.notFound) {
    ageCheck = { state: "neutral", detail: "Nom de domaine absent du registre (pas ou plus enregistré)" };
  } else {
    ageCheck = { state: "neutral", detail: "Date de création introuvable" };
  }
  checks.push({ id: "age", label: "Âge du site", ...ageCheck });

  if (!pageResult) checks.push({ id: "page", label: "Ce que demande la page", state: "pending", detail: "Analyse de la page…" });
  else if (pageResult.asked.length) {
    checks.push({ id: "page", label: "Ce que demande la page", state: level === "ok" ? "neutral" : "bad",
      detail: cap(joinFr(pageResult.asked.map((a) => a.label))) });
  } else checks.push({ id: "page", label: "Ce que demande la page", state: "good", detail: "Rien de sensible" });

  return checks;
}
