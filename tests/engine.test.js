import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createEngine } from "../src/engine/index.js";

const engine = createEngine({ pslText: readFileSync(new URL("../data/public_suffix_list.dat", import.meta.url), "utf8") });
const NOW = Date.parse("2026-10-25T12:00:00Z");
const daysAgo = (d) => ({ created: new Date(NOW - d * 86400000).toISOString() });
const judge = (href, extra = {}) => engine.evaluate({ href, now: NOW, ...extra });

test("les vrais sites sont reconnus comme officiels", () => {
  for (const href of [
    "https://www.amendes.gouv.fr/tai", "https://www.impots.gouv.fr", "https://www.ameli.fr/assure",
    "https://www.laposte.fr/outils/suivre-vos-envois", "https://www.service-public.gouv.fr",
    "https://mabanque.bnpparibas/", "https://particuliers.sg.fr", "https://www.credit-agricole.fr/ca-paris",
    "https://accounts.google.com", "https://www.amazon.fr", "https://login.microsoftonline.com",
  ]) {
    assert.equal(judge(href).level, "official", href);
  }
});

test("le faux site du film est bloqué sur la seule adresse", () => {
  const v = judge("https://antai-paiement-gouv.com/amende");
  assert.equal(v.level, "danger");
  assert.equal(v.brand.id, "amendes");
  assert.ok(v.reasons.some((r) => r.id === "fake-gouv"));
});

test("une vraie adresse cachée au début d'une fausse est bloquée", () => {
  const v = judge("https://impots.gouv.fr.remboursement-dossier.com/");
  assert.equal(v.level, "danger");
  assert.equal(v.brand.id, "impots");
  assert.ok(v.reasons[0].text.includes("remboursement-dossier.com"));
});

test("les fautes d'orthographe volontaires sont repérées", () => {
  const v = judge("https://chronopst-livraison.top/suivi");
  assert.equal(v.level, "danger");
  assert.equal(v.brand.id, "chronopost");
  assert.ok(v.reasons.some((r) => r.id === "brand-lookalike"));
  assert.ok(judge("https://arneli-remboursement.com").reasons.some((r) => r.id === "brand-lookalike"));
});

test("un nom de marque sur une plateforme gratuite est bloqué", () => {
  assert.equal(judge("https://paypal-secure-login.vercel.app").level, "danger");
});

test("les adresses à moitié suspectes attendent l'âge du domaine", () => {
  const v = judge("https://la-poste-suivi-colis.com");
  assert.equal(v.level, "suspect");
  assert.equal(v.needsAge, true);
  assert.equal(judge("https://la-poste-suivi-colis.com", { age: daysAgo(4) }).level, "danger");
  assert.equal(judge("https://ameli-remboursement.com", { age: daysAgo(12) }).level, "danger");
  assert.equal(judge("https://orange-facture-impayee.com", { age: daysAgo(20) }).level, "danger");
});

test("pas de fausse alerte sur des sites honnêtes", () => {
  for (const href of [
    "https://www.amelie-couture.fr", "https://www.orange-bleue.fr", "https://www.leparisien.fr/faits-divers/arnaque-ameli",
    "https://www.wikipedia.org", "https://monsite.github.io", "https://www.cafe-de-flore.fr",
    "https://www.amazonie-voyages.fr", "https://www.contact-me.com", "https://www.cicada-design.com",
    "https://www.impot-conseil.fr", "https://www.amazon.com.au", "https://www.paypal.de",
  ]) {
    const v = judge(href, { age: daysAgo(4000) });
    assert.equal(v.level, "ok", `${href} -> ${v.level} ${v.score} ${v.reasons.map((r) => r.id)}`);
  }
});

test("les gouvernements étrangers ne sont pas pris pour de faux .gouv", () => {
  assert.equal(judge("https://www.quebec.gouv.qc.ca", { age: daysAgo(5000) }).level, "ok");
  assert.ok(!judge("https://www.gouv.nc").reasons.some((r) => r.id === "fake-gouv"));
  assert.ok(judge("https://gouv-fr-amende.com").reasons.some((r) => r.id === "fake-gouv"));
});

test("le réseau local et localhost ne sont jamais jugés", () => {
  for (const href of ["http://localhost:3000", "http://192.168.1.1", "http://nas", "http://imprimante.local"]) {
    assert.equal(judge(href).level, "local", href);
  }
  assert.equal(judge("http://antai-paiement-gouv.localhost:8765/").level, "danger");
});

test("une liste noire suffit à bloquer", () => {
  const blocklist = { match: (p) => (p.domain === "exemple-signale.com" ? ["OpenPhish"] : []) };
  const v = judge("https://exemple-signale.com", { blocklist });
  assert.equal(v.level, "danger");
  assert.equal(v.title, "Arnaque détectée");
});

test("le contenu de la page fait basculer un site neutre", () => {
  const fakeFine = {
    title: "ANTAI - Paiement de votre avis de contravention",
    h1: ["Paiement de votre amende"],
    text: "Avis de contravention. Réglez 35,00 € sous 48h pour éviter la majoration.",
    fields: [{ type: "text", autocomplete: "cc-number", hint: "Numéro de carte" }, { type: "text", hint: "Cryptogramme" }],
    protocol: "https:",
  };
  const v = judge("https://paiement-dossier-2026.fr/", { page: fakeFine });
  assert.equal(v.level, "danger");
  assert.equal(v.brand.id, "amendes");

  const news = { title: "Arnaque à l'ANTAI : comment la repérer", h1: ["Arnaque à l'ANTAI"], text: "Des SMS frauduleux...", fields: [] };
  assert.equal(judge("https://www.lemonde.fr/article", { page: news, age: daysAgo(9000) }).level, "ok");

  const shop = {
    title: "Ma Boutique – Paiement", h1: ["Finaliser ma commande"], logos: ["logo-colissimo.png", "paypal"],
    text: "Livraison Colissimo offerte", fields: [{ type: "text", autocomplete: "cc-number", hint: "Numéro de carte" }],
  };
  assert.equal(judge("https://www.ma-boutique.fr/checkout", { page: shop, age: daysAgo(2000) }).level, "ok");
});

test("les pages de test donnent le résultat annoncé", () => {
  const colis = {
    title: "Colissimo - Suivi de votre colis", h1: ["Votre colis est en attente"],
    text: "Votre colis n'a pas pu être livré. Des frais de réexpédition de 1,99 € sont à régler.", fields: [],
  };
  assert.equal(judge("http://suivi-envoi.localhost:8765/faux-colis.html", { page: colis }).level, "ok");
  const colisStep2 = { ...colis, fields: [{ type: "text", autocomplete: "cc-number", hint: "cc Numéro de carte" }, { type: "text", hint: "cvv CVV" }] };
  assert.equal(judge("http://suivi-envoi.localhost:8765/faux-colis.html", { page: colisStep2 }).level, "danger");

  const douteuse = {
    protocol: "http:", title: "Bon Plan Express - Commande", h1: ["iPhone à 1 € : dernière chance"],
    text: "Offre urgente : temps restant 04:59. Votre réservation sera annulée sans paiement.",
    fields: [{ type: "text", autocomplete: "cc-number", hint: "cc" }, { type: "text", hint: "cvv Cryptogramme" }, { type: "text", autocomplete: "one-time-code", hint: "otp Code reçu par SMS" }],
  };
  assert.equal(judge("http://bon-plan-express.localhost:8765/boutique-douteuse.html", { page: douteuse }).level, "suspect");

  const boutique = { title: "Ma Boutique - Paiement", h1: ["Finaliser ma commande"], text: "Livraison Colissimo offerte", fields: [{ type: "text", autocomplete: "cc-number", hint: "cc" }] };
  assert.equal(judge("http://ma-boutique.localhost:8765/boutique.html", { page: boutique }).level, "ok");
});

test("le verdict détaille chaque contrôle", () => {
  const v = judge("https://www.lemonde.fr", { age: daysAgo(9000), listsCount: 26962, page: { title: "Le Monde", fields: [] } });
  assert.deepEqual(v.checks.map((c) => c.id), ["list", "brand", "address", "age", "page"]);
  assert.ok(v.checks.every((c) => c.state === "good"), JSON.stringify(v.checks));
});
