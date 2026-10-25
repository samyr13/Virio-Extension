/* Word lists used by the address analyser. All lower case, without accents. */

// Words of the scam story itself: the fine, the parcel, the refund, the "security check".
export const SCAM_WORDS_STRONG = new Set([
  "paiement", "payer", "amende", "amendes", "contravention", "infraction", "majoration", "majoree",
  "remboursement", "rembourser", "rembourse", "refund", "verification", "verifier", "verif", "verify",
  "securite", "securise", "confirmation", "confirmer", "identification", "authentification",
  "miseajour", "colis", "livraison", "reexpedition", "reprogrammer", "douane", "frais", "facture",
  "impaye", "impayee", "impayes", "regularisation", "regulariser", "regul", "peage", "debloquer",
  "deblocage", "suspendu", "suspension", "recouvrement", "cartevitale", "vitale", "renouvellement",
  "cartebancaire", "tracking", "parcel", "delivery", "unlock", "suspended",
]);

// Everyday words that scam addresses lean on, but so do plenty of honest sites.
export const SCAM_WORDS_WEAK = new Set([
  "suivi", "suivre", "compte", "account", "espace", "client", "connexion", "login", "signin", "logon",
  "auth", "update", "maj", "secure", "security", "confirm", "dossier", "alerte", "alert", "urgent",
  "support", "assistance", "aide", "help", "validation", "valider", "activation", "activer", "avis",
  "notification", "bonus", "cadeau", "gain", "gagnant", "prime", "remise", "solde", "virement", "track",
  "package", "ticket", "info", "service", "pay",
]);

// Glue scammers put around a brand name ("ameli-espace", "antaipaiement", "laposte24").
export const AFFIX_WORDS = new Set([
  ...SCAM_WORDS_STRONG, ...SCAM_WORDS_WEAK,
  "fr", "france", "francais", "gouv", "gov", "en", "ligne", "online", "web", "net", "app", "mon", "ma",
  "mes", "my", "votre", "vos", "infos", "services", "clients", "pro", "perso", "particulier",
  "particuliers", "officiel", "official", "securise", "connect", "portail", "portal", "site", "page",
  "www", "center", "centre", "direct", "plus", "group", "groupe", "contact", "mobile", "express", "id",
  "check", "team", "assist", "s",
]);

// Extensions most used by throwaway scam domains (Spamhaus, Interisle phishing reports).
export const RISKY_TLDS_STRONG = new Set([
  "top", "xyz", "icu", "cfd", "sbs", "cyou", "bond", "rest", "buzz", "click", "tk", "ml", "ga", "cf",
  "gq", "lat", "quest", "monster", "mom", "zip", "mov", "gdn", "cam", "pw", "su",
]);
export const RISKY_TLDS_WEAK = new Set([
  "shop", "online", "site", "live", "vip", "info", "life", "store", "fun", "club", "cc", "ws", "link",
  "today", "win", "bid", "best", "support", "help", "digital", "website", "space", "work", "loan",
]);

// Platforms where anyone gets a free sub-address in minutes. Age checks are meaningless there.
export const FREE_HOSTING = [
  "vercel.app", "netlify.app", "pages.dev", "workers.dev", "r2.dev", "web.app", "firebaseapp.com",
  "github.io", "gitlab.io", "glitch.me", "herokuapp.com", "onrender.com", "railway.app", "fly.dev",
  "replit.app", "repl.co", "webflow.io", "framer.website", "framer.app", "wixsite.com", "wixstudio.io",
  "weebly.com", "weeblysite.com", "square.site", "godaddysites.com", "mystrikingly.com", "carrd.co",
  "blogspot.com", "wordpress.com", "000webhostapp.com", "ngrok-free.app", "ngrok.io", "ngrok.app",
  "trycloudflare.com", "translate.goog", "azurewebsites.net", "azurestaticapps.net", "appspot.com",
  "surge.sh", "notion.site", "gitbook.io", "jimdosite.com", "webnode.page", "tilda.ws", "ipfs.io",
  "dweb.link", "cloudflare-ipfs.com", "firebasestorage.app", "pythonanywhere.com", "codeanyapp.com",
  // Seen most often in the public phishing feeds (October 2026).
  "wixstudio.com", "webcindario.com", "start.page", "webwave.dev", "myportfolio.com", "w3spaces.com",
  "bolt.host", "boxmode.io", "typedream.app", "lovable.app", "ghost.io", "m-pages.com", "edgeone.dev",
  "zapier.app", "framer.media", "web.core.windows.net", "replit.dev", "iceiy.com", "teemill.com", "eu.cc",
];

// Hosts never added from a blocklist, even if a feed lists one of their pages: blocking them
// would break link shorteners or file-sharing sites for everyone.
export const NEVER_BLOCK = new Set([
  "bit.ly", "bitly.com", "tinyurl.com", "t.co", "ow.ly", "is.gd", "cutt.ly", "rb.gy", "shorturl.at",
  "t.ly", "tiny.cc", "s.id", "u.gy", "lnkd.in", "buff.ly", "rebrand.ly", "bl.ink", "short.io",
  "qrco.de", "linktr.ee", "github.com", "gitlab.com", "dropbox.com", "wetransfer.com", "notion.so",
  "canva.com", "adobe.com", "docusign.net", "docusign.com", "wikipedia.org", "archive.org",
]);
