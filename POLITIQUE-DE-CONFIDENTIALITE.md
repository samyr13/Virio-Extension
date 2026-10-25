# Politique de confidentialité de Virio

Dernière mise à jour : 25 octobre 2026

Cette politique concerne l'extension de navigateur Virio. Virio est gratuite. Elle repère les faux sites (amendes, colis, banque, impôts…) et les bloque avant que vous ne donniez vos informations.

Virio est conçue pour fonctionner sur votre appareil : elle n'a pas de compte utilisateur, pas de serveur qui reçoit vos données, pas de publicité et pas d'outil de mesure d'audience.

## Ce que Virio analyse sur votre appareil

Pour reconnaître un faux site, Virio examine dans votre navigateur :

- l'adresse des pages que vous ouvrez ;
- le contenu de ces pages : titre, titres principaux, logos, texte, et la nature des champs de formulaire (par exemple « numéro de carte » ou « mot de passe ») ;
- le code écrit dans la page, pour y repérer un envoi de données vers la messagerie Telegram, une technique courante des escrocs.

Virio ne lit jamais ce que vous tapez dans les formulaires. Ces informations sont analysées sur place et ne sont envoyées à personne, ni à Virio ni à un tiers.

## Ce qui sort de votre appareil

**La date de création des sites suspects.** Quand un site présente déjà au moins un signe d'arnaque, Virio demande sa date de création au registre officiel de son extension, par le protocole public RDAP : par exemple l'AFNIC pour les adresses en .fr, Verisign pour les adresses en .com. Seul le nom de domaine est envoyé (par exemple « exemple.com »), jamais l'adresse complète de la page ni son contenu. Comme pour toute connexion à internet, le registre voit l'adresse IP de votre connexion. Les registres sont des organismes indépendants de Virio, avec leur propre politique de confidentialité. Pour savoir quel registre interroger, Virio consulte l'annuaire public de l'IANA (data.iana.org).

**Les listes de sites signalés.** Toutes les 6 heures, Virio télécharge des listes publiques de sites d'hameçonnage : Phishing Filter (hébergée sur GitLab) et OpenPhish (hébergée sur GitHub). C'est un simple téléchargement de fichier : aucune information sur votre navigation n'est envoyée. Comme pour tout téléchargement, l'hébergeur voit l'adresse IP de votre connexion.

Virio ne vend, ne loue et ne partage aucune donnée. Virio ne collecte aucune donnée de localisation.

## Ce que Virio garde sur votre appareil

- les listes de sites signalés ;
- la date de création des domaines déjà vérifiés, pendant 30 jours au plus ;
- vos réglages : protection active ou en pause, et les sites auxquels vous avez choisi de faire confiance ;
- le résultat de l'analyse de vos onglets ouverts et les sites que vous avez choisi d'ouvrir malgré une alerte, effacés à la fermeture du navigateur.

Ces données restent dans l'espace de stockage de l'extension, sur votre appareil. Elles sont supprimées quand vous désinstallez Virio.

## Pourquoi Virio demande ces autorisations

- **Accès à tous les sites** : pour analyser chaque page au moment où elle s'ouvre, la remplacer par l'écran de blocage si c'est un faux site, ou afficher un bandeau d'alerte.
- **webNavigation** : pour repérer l'ouverture d'une page avant son chargement, et bloquer un faux site avant qu'il ne s'affiche.
- **storage** : pour garder sur votre appareil les listes, les dates de création et vos réglages.
- **alarms** : pour mettre à jour les listes de sites signalés toutes les 6 heures.

## Vos droits

Virio ne détient aucune donnée vous concernant : il n'y a rien à consulter, corriger ou supprimer de notre côté. Vous pouvez effacer toutes les données locales de Virio en désinstallant l'extension. Pour les demandes envoyées à un registre, vous pouvez exercer vos droits auprès de ce registre.

## Modifications

Si Virio évolue, par exemple avec un service en ligne pour vérifier plus de sites, cette politique sera mise à jour avant le changement et sa date sera modifiée.

## Contact

Pour toute question : [adresse e-mail de contact]

Site : https://virio.fr
