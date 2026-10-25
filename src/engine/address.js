/* Reads an address the way a careful person would: who really owns it, which service it borrows
   a name from, and which tricks it uses (fake .gouv, misspellings, throwaway extensions…). */

import { tokens, isLookalike, quoteList, joinFr } from "./text.js";
import {
  AFFIX_WORDS, SCAM_WORDS_STRONG, SCAM_WORDS_WEAK, RISKY_TLDS_STRONG, RISKY_TLDS_WEAK, FREE_HOSTING,
} from "./words.js";

const isAffix = (rest) => {
  if (!rest || AFFIX_WORDS.has(rest) || /^\d+$/.test(rest)) return true;
  for (let i = 1; i < rest.length; i++) {
    if (AFFIX_WORDS.has(rest.slice(0, i)) && (AFFIX_WORDS.has(rest.slice(i)) || /^\d+$/.test(rest.slice(i)))) return true;
  }
  return false;
};

// "antai", "antaipaiement", "paiementantai", "antai24" all carry the brand word "antai".
export function keyInToken(t, key) {
  if (t === key.k) return true;
  if (key.weak) return false;
  if (key.k.length >= 7 && t.includes(key.k)) return true;
  if (t.length > key.k.length && t.startsWith(key.k) && isAffix(t.slice(key.k.length))) return true;
  if (t.length > key.k.length && t.endsWith(key.k) && isAffix(t.slice(0, -key.k.length))) return true;
  return false;
}

// A misspelt brand, alone ("chronopst") or glued to filler ("chronopstsuivi").
function lookalikeIn(t, k) {
  if (isLookalike(t, k)) return true;
  for (const len of [k.length - 1, k.length, k.length + 1]) {
    if (len < 4 || len >= t.length) continue;
    if (isAffix(t.slice(len)) && isLookalike(t.slice(0, len), k)) return true;
    if (isAffix(t.slice(0, t.length - len)) && isLookalike(t.slice(t.length - len), k)) return true;
  }
  return false;
}

export function freeHostingOf(host) {
  return FREE_HOSTING.find((p) => host.endsWith(`.${p}`)) || null;
}

export function analyzeAddress(url, parsed, brands) {
  const signals = [];
  const hits = [];
  const add = (s) => signals.push(s);
  const host = parsed.host;
  const ownLabels = [...parsed.subLabels, parsed.label];
  const hostTokens = ownLabels.flatMap((l) => tokens(l));
  const joined = hostTokens.join("");
  const owner = parsed.domain || host;

  // 1. A real address hidden inside a fake one: "impots.gouv.fr.remboursement.com". Only the part
  //    left of the suffix is searched, and very short domains (me.com, fb.com) are skipped.
  const dottedOwn = `.${ownLabels.join(".")}.`;
  const dashedOwn = `-${ownLabels.join("-")}-`;
  for (const b of brands) {
    for (const d of b.domains) {
      if (parsed.domain === d || d.indexOf(".") < 3) continue;
      if (dottedOwn.includes(`.${d}.`)) {
        hits.push({ brand: b, kind: "inside", points: 60, word: d });
        add({ id: "brand-inside", group: "brand", points: 60, brand: b.id,
          text: `L'adresse contient « ${d} », mais elle appartient en réalité à « ${owner} » : seule la fin de l'adresse indique le vrai propriétaire.` });
      } else if (dashedOwn.includes(`-${d.replace(/\./g, "-")}-`)) {
        hits.push({ brand: b, kind: "inside", points: 45, word: d });
        add({ id: "brand-dashed", group: "brand", points: 45, brand: b.id,
          text: `L'adresse imite « ${d} » en remplaçant les points par des tirets, mais elle appartient à « ${owner} ».` });
      } else continue;
      break;
    }
  }

  // 2. A brand name, or a misspelling of it, used in an address that is not the brand's.
  for (const b of brands) {
    if (hits.some((h) => h.brand === b)) continue;
    for (const key of b.keyList) {
      let hit = null;
      const t = hostTokens.find((x) => keyInToken(x, key));
      if (t) hit = { kind: "mention", word: t };
      else if (!key.weak && key.k.length >= 7 && joined.includes(key.k)) hit = { kind: "mention", word: key.k };
      else if (!key.weak && key.k.length >= 5) {
        const l = hostTokens.find((x) => lookalikeIn(x, key.k));
        if (l) hit = { kind: "lookalike", word: l };
      }
      if (!hit) continue;
      // "amazon.com.au", "paypal.de": an international brand's own site in another country.
      if (hit.kind === "mention" && b.global && hit.word === parsed.label && !parsed.subLabels.length) hit.kind = "sibling";
      const points = hit.kind === "lookalike" ? 45 : hit.kind === "sibling" ? 5 : key.weak ? 12 : 30;
      hits.push({ brand: b, key: key.k, points, ...hit });
      break;
    }
  }
  hits.sort((x, y) => y.points - x.points);
  hits.forEach((h, i) => {
    if (h.kind === "inside") return;
    const points = i === 0 ? h.points : 5;
    if (h.kind === "sibling") {
      add({ id: "brand-sibling", group: "brand", points, brand: h.brand.id, minor: true,
        text: `Le site porte le nom ${h.brand.de} sans faire partie de ses adresses connues (peut-être un site du groupe dans un autre pays).` });
    } else if (h.kind === "lookalike") {
      add({ id: "brand-lookalike", group: "brand", points, brand: h.brand.id, minor: i > 0,
        text: `« ${h.word} » imite « ${h.key} » en changeant une ou deux lettres, pour passer pour ${h.brand.le}.` });
    } else {
      add({ id: "brand-mention", group: "brand", points, brand: h.brand.id, minor: i > 0,
        text: `L'adresse utilise le nom ${h.brand.de}, mais le site n'appartient pas ${h.brand.a} (son adresse officielle est ${h.brand.home}).` });
    }
  });

  // 3. A brand only in the rest of the link: "site-quelconque.com/ameli/remboursement".
  if (!hits.length) {
    let rest = "";
    try { rest = decodeURIComponent(url.pathname + url.search); } catch { rest = url.pathname + url.search; }
    const restTokens = tokens(rest);
    for (const b of brands) {
      const key = b.keyList.find((k) => !k.weak && k.k.length >= 4 && restTokens.some((t) => keyInToken(t, k)));
      if (!key) continue;
      hits.push({ brand: b, key: key.k, kind: "path", points: 12, word: key.k });
      add({ id: "brand-path", group: "brand", points: 12, brand: b.id,
        text: `Le lien mentionne « ${key.k} » dans sa suite, pour faire croire à une page ${b.de}.` });
      break;
    }
  }

  // 4. "gouv" outside .gouv.fr. Foreign governments (gouv.qc.ca, gouv.nc) are left alone.
  const onGouvFr = parsed.suffix === "gouv.fr" || parsed.suffix.endsWith(".gouv.fr");
  if (!onGouvFr) {
    let fake = false;
    parsed.labels.forEach((l, i) => {
      for (const t of tokens(l)) {
        const gouvish = t === "gouv" || t === "gouvernement"
          || (t.startsWith("gouv") && isAffix(t.slice(4))) || (t.endsWith("gouv") && isAffix(t.slice(0, -4)));
        if (!gouvish) continue;
        const tail = parsed.labels.slice(i + 1).join(".");
        const foreignGov = l === "gouv" && tail && (parsed.suffix === `gouv.${tail}` || parsed.suffix === tail)
          && parsed.labels.slice(i + 1).every((x) => x.length <= 3);
        if (!foreignGov && owner !== "gouvernement.fr") fake = true;
      }
    });
    if (fake) {
      add({ id: "fake-gouv", group: "brand", points: 45, brand: "etat",
        text: "L'adresse contient « gouv » mais ce n'est pas un site de l'État : les sites officiels français se terminent toujours par « .gouv.fr »." });
      if (!hits.length) hits.push({ brand: brands.find((b) => b.id === "etat"), kind: "gouv", points: 45, word: "gouv" });
    }
  }

  // 5. The vocabulary of the scam story, minus words that belong to the brand name itself.
  const brandWords = hits.flatMap((h) => [h.key || "", h.word || ""]);
  const strong = new Set();
  const weak = new Set();
  for (const t of hostTokens) {
    if (brandWords.some((w) => w && w.includes(t))) continue;
    if (SCAM_WORDS_STRONG.has(t)) strong.add(t);
    else if (SCAM_WORDS_WEAK.has(t)) weak.add(t);
  }
  for (const w of [...SCAM_WORDS_STRONG].sort((x, y) => y.length - x.length)) {
    if (w.length < 6 || !joined.includes(w) || [...strong].some((x) => x.includes(w))) continue;
    if (!brandWords.some((x) => x && x.includes(w))) strong.add(w);
  }
  // An everyday brand word ("orange") becomes credible next to the scam story ("facture-impayee").
  const lead = hits[0];
  if (lead && lead.kind === "mention" && lead.points === 12 && strong.size) {
    const s = signals.find((x) => x.id === "brand-mention" && x.brand === lead.brand.id);
    if (s) s.points += 10;
  }

  const words = [...strong, ...weak];
  if (words.length) {
    const points = Math.min(22, strong.size * 8 + weak.size * 4);
    add({ id: "scam-words", group: "address", points, words,
      text: words.length === 1
        ? `L'adresse contient un mot typique des arnaques : « ${words[0]} ».`
        : `L'adresse contient des mots typiques des arnaques : ${quoteList(words)}.` });
  }

  // 6. Throwaway extensions.
  if (RISKY_TLDS_STRONG.has(parsed.tld)) {
    add({ id: "risky-tld", group: "address", points: 15,
      text: `L'extension « .${parsed.tld} » est très utilisée par les sites jetables des escrocs.` });
  } else if (RISKY_TLDS_WEAK.has(parsed.tld)) {
    add({ id: "risky-tld", group: "address", points: 7,
      text: `L'extension « .${parsed.tld} » est souvent utilisée par des sites jetables.` });
  }

  // 7. Free page builders.
  const platform = freeHostingOf(host);
  if (platform) {
    add({ id: "free-hosting", group: "address", points: 10, platform,
      text: `Le site est hébergé sur « ${platform} », une plateforme où n'importe qui crée une page gratuite en quelques minutes.` });
  }

  // 8. Tricks in how the address is written.
  if (parsed.labels.some((l) => l.startsWith("xn--"))) {
    add({ id: "punycode", group: "address", points: 25,
      text: "L'adresse contient des caractères d'autres alphabets, qui peuvent imiter des lettres normales." });
  }
  if (url.username || url.password) {
    const decoy = decodeURIComponent(url.username);
    const decoyBrand = brands.find((b) => b.domains.some((d) => decoy.includes(d)));
    add({ id: "userinfo", group: "address", points: decoyBrand ? 60 : 40,
      text: `L'adresse contient un « @ » : ce qui est écrit avant (« ${decoy} ») est un leurre, le vrai site est « ${owner} ».` });
    if (decoyBrand && !hits.length) hits.push({ brand: decoyBrand, kind: "inside", points: 60, word: decoy });
  }
  const shape = [];
  let shapePoints = 0;
  const hyphens = (parsed.label.match(/-/g) || []).length;
  if (hyphens >= 3) { shape.push("beaucoup de tirets"); shapePoints += 6; }
  if (parsed.label.length >= 25) { shape.push("un nom très long"); shapePoints += 4; }
  if (parsed.subLabels.length >= 3) { shape.push("beaucoup de sous-parties"); shapePoints += 5; }
  if ((parsed.label.match(/\d/g) || []).length >= 5) { shape.push("beaucoup de chiffres"); shapePoints += 4; }
  if (shape.length) {
    add({ id: "shape", group: "address", points: Math.min(12, shapePoints),
      text: `L'adresse est construite de façon inhabituelle : ${joinFr(shape)}.` });
  }
  // *.localhost is only used for testing on one's own machine, where https is rarely set up.
  if (url.protocol === "http:" && parsed.tld !== "localhost") {
    add({ id: "http", group: "address", points: 5, minor: true, text: "La connexion n'est pas chiffrée (adresse en http)." });
  }

  return { signals, hits, platform };
}
