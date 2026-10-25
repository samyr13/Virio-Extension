# Virio, l'extension Chrome

Virio regarde chaque site au moment où il s'ouvre. Si c'est un faux (amende, colis, banque, impôts…), la page est remplacée par un écran qui explique ce qui cloche et propose le vrai site.

Version 0.1, à tester en local. Pas encore publiée sur le Chrome Web Store.

## L'installer sur ton ordinateur

1. Ouvre Chrome et tape `chrome://extensions` dans la barre d'adresse.
2. Active le **Mode développeur** (interrupteur en haut à droite).
3. Clique sur **Charger l'extension non empaquetée**.
4. Choisis le dossier `virio-extension` (celui qui contient `manifest.json`).
5. Épingle le bouclier Virio dans la barre d'outils (icône puzzle, puis punaise).

Après chaque modification du code, clique sur la flèche ↻ de la carte Virio dans `chrome://extensions`.

Dans **Firefox** (version 140 ou plus récente) : tape `about:debugging#/runtime/this-firefox`, clique sur **Charger un module complémentaire temporaire** et choisis le fichier `manifest.json`. Le module reste chargé jusqu'à la fermeture de Firefox.

## Fabriquer les fichiers à envoyer aux stores

```bash
npm run package
```

La commande crée deux fichiers dans `dist/`, avec `manifest.json` à la racine comme l'exigent les stores :

| Fichier | À envoyer sur |
|:--|:--|
| `virio-chrome-<version>.zip` | Chrome Web Store, Microsoft Edge Add-ons |
| `virio-firefox-<version>.zip` | addons.mozilla.org |

Chaque zip reçoit un manifeste adapté à son navigateur : `service_worker` pour Chrome, `scripts` et l'identifiant `virio@virio.fr` pour Firefox. L'identifiant Firefox ne peut plus changer après la première publication. Pense à augmenter `version` dans `manifest.json` avant chaque nouvel envoi.

Le zip Firefox passe l'outil de vérification de Mozilla sans erreur ni avertissement :

```bash
npx addons-linter dist/virio-firefox-0.1.0.zip
```

## Le tester

Lance les pages de test (elles imitent des faux sites mais n'envoient rien) :

```bash
npm run test-pages
```

Puis ouvre http://localhost:8765 dans Chrome et suis la liste. Les adresses en `.localhost` pointent toutes vers ton ordinateur, ce qui permet de simuler `antai-paiement-gouv.localhost` sans toucher à un vrai site.

Tu peux aussi taper directement `chronopst-livraison.top` ou `ameli-remboursement.com` dans la barre d'adresse : Virio bloque avant même que le site réponde.

Pour voir le verdict d'une adresse dans le terminal, avec l'âge réel du domaine :

```bash
npm run check -- antai-paiement-gouv.com www.amendes.gouv.fr
```

Les tests automatiques du moteur :

```bash
npm test
```

## Comment Virio décide

Le système complet, avec chaque règle et des exemples chiffrés, est décrit dans [ANALYSE.md](ANALYSE.md).

Chaque signal ajoute des points. À 40, un bandeau « Site suspect » s'affiche. À 70, la page est bloquée. Les sites officiels connus (`domains` dans `src/engine/brands.js`, et tout `.gouv.fr`) ne sont jamais bloqués.

| Ce que Virio regarde | Exemple | Points |
|:--|:--|--:|
| Listes de sites déjà signalés | OpenPhish, PhishTank, IPThreat | 100 |
| Vraie adresse cachée au début d'une fausse | `impots.gouv.fr.remboursement.com` | 60 |
| Nom d'un service mal orthographié | `chronopst`, `arneli` | 45 |
| « gouv » hors de `.gouv.fr` | `antai-paiement-gouv.com` | 45 |
| Nom d'un service dans une adresse qui n'est pas la sienne | `la-poste-suivi-colis.com` | 30 |
| Mots du scénario d'arnaque | paiement, amende, colis, remboursement | jusqu'à 22 |
| Extension jetable | `.top`, `.xyz`, `.icu` | 7 à 15 |
| Page gratuite (Vercel, Weebly, Firebase…) | `paypal-login.vercel.app` | 10, +20 avec un nom de service |
| Caractères d'autres alphabets, « @ » trompeur, adresse IP | `xn--…`, `impots.gouv.fr@site.com` | 25 à 60 |
| Âge du domaine (registre officiel, RDAP) | créé il y a 3 jours | +40 à −20 |
| La page se présente comme un service connu | titre « ANTAI – Paiement » | 6 à 40 |
| Ce que la page demande | carte, code SMS, mot de passe, IBAN, identité | jusqu'à 35 |
| Pression | « dernier délai », « sous 24 h », compte à rebours | 10 à 15 |
| Petite somme à payer | « frais de réexpédition 1,99 € » | 10 |
| Données envoyées vers Telegram | `api.telegram.org/bot…` dans la page | 40 |

Les combinaisons comptent plus que les signaux isolés. Un nom de service accolé à des mots d'arnaque est très suspect. Une boutique qui demande une carte bancaire ne l'est pas. Un site ancien n'excuse jamais une imitation.

## Ce qui sort de l'ordinateur

- **Les listes de faux sites** sont téléchargées toutes les 6 heures depuis leurs sources publiques, puis vérifiées sur l'ordinateur, sans envoyer l'adresse visitée.
- **L'âge du domaine** n'est demandé que pour un site qui montre déjà un signal. Seul le nom de domaine (`exemple.com`, jamais l'adresse complète) est envoyé au registre officiel de son extension (AFNIC pour `.fr`, Verisign pour `.com`…). La réponse est gardée 30 jours.
- **Le contenu des pages** (titre, champs de formulaire) est analysé dans le navigateur et n'est envoyé nulle part.

## Organisation du code

| Dossier | Rôle |
|:--|:--|
| `src/engine/` | Le moteur de détection. Aucun appel au navigateur : il tourne aussi dans les tests, et pourra tourner sur le serveur et dans les apps mobiles. |
| `src/engine/brands.js` | Les 59 services surveillés, leurs vraies adresses et leurs noms. **C'est le fichier à enrichir.** |
| `src/engine/words.js` | Mots d'arnaque, extensions jetables, plateformes gratuites. |
| `src/services/` | Listes noires, âge des domaines, réglages. |
| `src/background.js` | Surveille les navigations et décide du blocage. |
| `src/content/content.js` | Lit la page (titre, logos, champs) et affiche le bandeau. |
| `src/pages/` | Écran de blocage et fenêtre de l'extension. |
| `data/public_suffix_list.dat` | Liste officielle des suffixes (`npm run update-psl` pour la mettre à jour). |
| `tests/` | Tests du moteur et pages de test. |

## Pas encore fait

- **Serveur Virio** (`apiBase` dans `src/config.js`) : regrouper plus de listes, l'âge des domaines en `.de`, `.io`, `.eu` (sans RDAP, il faut WHOIS), les signalements des utilisateurs.
- **Bouton « Signaler une erreur »** sur l'écran de blocage, qui a besoin du serveur.
- **Licences des listes** : vérifier les conditions d'OpenPhish, de PhishTank et des autres avant la publication.
- **Publication** : la politique de confidentialité est dans [POLITIQUE-DE-CONFIDENTIALITE.md](POLITIQUE-DE-CONFIDENTIALITE.md) ; il reste à la mettre en ligne sur virio.fr (le Chrome Web Store demande une adresse web), à y ajouter une adresse de contact, et à remplir la fiche du Chrome Web Store (les visuels sont déjà dans `virio-site/brand/chrome-web-store`).
