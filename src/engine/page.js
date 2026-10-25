/* Reads what the page says and asks: who it claims to be, what it wants you to type, and how
   hard it pushes. Fed by the content script; nothing here touches the DOM. */

import { fold, plain, tokens, joinFr, quoteList } from "./text.js";
import { keyInToken } from "./address.js";

const SENSITIVE = [
  {
    id: "card", points: 20, label: "votre carte bancaire",
    test: (f) => /^cc-(number|csc|exp|exp-month|exp-year|name|type)$/.test(f.autocomplete)
      || /(card|carte(?!.?vitale)|ccnum|cc.?num|\bcb\b|numero.?cb|credit|cvv|cvc|cvn|cryptogramme|\bcrypto\b|code.?de.?securite|security.?code|expir|mm.?\/.?(aa|yy))/.test(f.hint),
  },
  {
    id: "otp", points: 15, label: "le code reçu par SMS",
    test: (f) => f.autocomplete === "one-time-code"
      || /(code.{0,20}(sms|recu|confirmation|verification|validation)|\botp\b|3d.?secure|securipass|sms.?code)/.test(f.hint),
  },
  { id: "password", points: 8, label: "un mot de passe", test: (f) => f.type === "password" },
  { id: "iban", points: 10, label: "votre IBAN", test: (f) => /(iban|\bbic\b|swift|\brib\b)/.test(f.hint) },
  {
    id: "identity", points: 12, label: "des informations d'identité",
    test: (f) => /(\bsecu\b|securite.?sociale|\bnir\b|naissance|birth|numero.?fiscal|passeport|passport|piece.?d.?identite|carte.?vitale)/.test(f.hint),
  },
];

const PRESSURE = [
  [/dernier (delai|rappel|avis)|derniere (relance|chance)/, "dernier délai"],
  [/sous (24|48) ?h|dans les (24|48) ?(h|heures)|avant (ce soir|minuit|demain)/, "délai de quelques heures"],
  [/majoration|majoree|penalite/, "majoration"],
  [/(sera|sont|est|a ete|ont ete) (suspendu|bloque|desactive|supprime|retourne|detruit|annule)|(compte|carte|acces|ligne|colis) (suspendu|bloque|desactive|en attente)/, "menace de blocage"],
  [/temps restant|expire (aujourd|dans)|expiration imminente/, "compte à rebours"],
  [/poursuites|huissier|recouvrement force/, "menace de poursuites"],
  [/action (immediate )?requise|immediatement|sans delai|\burgent/, "action immédiate"],
];

const FEE = /(frais|droits?|taxes?) (de |d )?(livraison|reexpedition|douane|douaniers|traitement|port|reprogrammation|dedouanement)/;
const SMALL_AMOUNT = /\b[0-4][,.]\d{2} ?(€|eur)/;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Short acronyms ("CAF", "UPS") and everyday words ("Orange") must match their exact spelling.
function nameMatcher(name, strict) {
  const p = plain(name);
  if (strict || p.replace(/ /g, "").length <= 4 || /[^\p{L}\p{N}' .-]/u.test(name)) {
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(name.normalize("NFD").replace(/[̀-ͯ]/g, ""))}($|[^\\p{L}\\p{N}])`, "u");
    return (text) => re.test(text.normalize("NFD").replace(/[̀-ͯ]/g, ""));
  }
  return (text) => ` ${plain(text)} `.includes(` ${p} `);
}

export function prepareNames(brand) {
  const strict = brand.keyList.some((k) => k.weak);
  return brand.names.map((n) => nameMatcher(n, strict));
}

// Which brand does the page dress up as? Title, site name and main heading decide; a logo only
// confirms, because honest shops show PayPal or Colissimo logos at checkout. The top banner
// only counts for the State ("République française").
function findClaim(features, brands) {
  const spots = [
    ["title", features.title],
    ["siteName", features.siteName],
    ["h1", (features.h1 || []).join(" · ")],
  ];
  const logoText = (features.logos || []).join(" ");
  const logoTokens = tokens(logoText);
  let best = null;
  for (const b of brands) {
    const where = spots.filter(([, text]) => text && b.matchers.some((m) => m(text))).map(([k]) => k);
    if (b.id === "etat" && features.header && b.matchers.some((m) => m(features.header))) where.push("header");
    if (!where.length) continue;
    const inLogo = b.matchers.some((m) => m(logoText))
      || b.keyList.some((k) => !k.weak && k.k.length >= 4 && logoTokens.some((t) => keyInToken(t, k)));
    if (inLogo) where.push("logo");
    const strong = where.includes("title") || where.includes("siteName") || where.length >= 2;
    const score = where.length + (strong ? 10 : 0);
    if (!best || score > best.score) best = { brand: b, where, strong, score };
  }
  return best;
}

export function analyzePage(features, { parsed, brands, preferBrand }) {
  const signals = [];
  const add = (s) => signals.push(s);

  const fields = (features.fields || []).map((f) => ({
    type: String(f.type || "").toLowerCase(),
    autocomplete: String(f.autocomplete || "").toLowerCase().trim(),
    hint: fold(f.hint || ""),
  }));
  const asked = SENSITIVE.filter((s) => fields.some((f) => s.test(f)));
  const sensitive = asked.length > 0;
  if (sensitive) {
    add({ id: "asks", group: "page", points: Math.min(35, asked.reduce((n, s) => n + s.points, 0)),
      asks: asked.map((s) => s.id), text: `La page demande ${joinFr(asked.map((s) => s.label))}.` });
  }

  let claim = findClaim(features, brands);
  if (claim && preferBrand && claim.brand !== preferBrand) {
    const alt = findClaim(features, [preferBrand]);
    if (alt) claim = alt;
  }
  if (claim) {
    const points = claim.strong ? (sensitive ? 40 : 12) : (sensitive ? 25 : 6);
    const b = claim.brand;
    add({ id: "page-claim", group: "brand", points, brand: b.id, minor: !sensitive && !claim.strong,
      text: b.id === "etat"
        ? "La page affiche les symboles de l'État (« République française »), alors que ce n'est pas un site en « .gouv.fr »."
        : `La page se présente comme ${b.le}, mais son adresse n'appartient pas ${b.a}.` });
    if (sensitive && asked.some((s) => s.id === "card" || s.id === "otp")) {
      add({ id: "claim-and-card", group: "page", points: 15, minor: true,
        text: `Elle se fait passer pour ${b.le} et demande de quoi payer : c'est exactement le schéma d'une arnaque.` });
    }
  }

  const text = fold(features.text || "");
  const pressure = PRESSURE.filter(([re]) => re.test(text)).map(([, label]) => label);
  if (pressure.length) {
    add({ id: "pressure", group: "page", points: pressure.length >= 2 ? 15 : 10,
      text: `La page met la pression (${quoteList(pressure)}) : l'urgence sert à vous empêcher de vérifier.` });
  }
  if (FEE.test(text) && SMALL_AMOUNT.test(text)) {
    add({ id: "small-fee", group: "page", points: 10,
      text: "La page réclame une petite somme (frais de livraison ou de douane) : c'est l'appât pour récupérer votre carte." });
  }
  if (features.telegram) {
    add({ id: "telegram", group: "page", points: 40,
      text: "La page envoie ce que vous tapez vers une messagerie (Telegram), comme le font les kits d'arnaque." });
  }
  if (sensitive) {
    const elsewhere = (features.formHosts || []).find((h) => h && h !== parsed.host && !h.endsWith(`.${parsed.domain}`) && h !== parsed.domain);
    if (elsewhere) {
      add({ id: "form-elsewhere", group: "page", points: 8, minor: true,
        text: `Le formulaire envoie vos informations vers un autre site (« ${elsewhere} »).` });
    }
    if (features.protocol === "http:" && parsed.tld !== "localhost") {
      add({ id: "http-sensitive", group: "page", points: 15,
        text: "La page demande des informations sensibles sur une connexion non chiffrée (http)." });
    }
  }

  return { signals, claim, asked: asked.map((s) => ({ id: s.id, label: s.label })), sensitive };
}
