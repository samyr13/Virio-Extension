/* Services that scammers imitate, with their real addresses.
   - domains: registrable domains that belong to the service (exact match, subdomains included).
   - suffixes: whole suffixes only the service can use (".gouv.fr", the ".bnpparibas" brand TLD).
   - keys: words looked for in a suspicious address. `weak` marks everyday words ("orange", "apple")
     that only count for little and are never checked for misspellings.
   - names: how the service names itself on its pages (title, logo, main heading).
   - le / de / a: the name inside a French sentence ("la CAF", "de la CAF", "à la CAF").
   Every domain here is trusted outright, so only add one after checking who owns it. */

export const BRANDS = [
  // État et services publics
  {
    id: "etat", name: "État français", le: "l'État", de: "de l'État", a: "à l'État",
    url: "https://www.service-public.gouv.fr",
    domains: ["gouvernement.fr", "service-public.fr", "elysee.fr"], suffixes: ["gouv.fr"],
    keys: [], names: ["République française", "Liberté Égalité Fraternité", "gouvernement.fr"],
  },
  {
    id: "amendes", name: "ANTAI", le: "l'ANTAI", de: "de l'ANTAI", a: "à l'ANTAI",
    url: "https://www.amendes.gouv.fr",
    domains: ["antai.gouv.fr", "amendes.gouv.fr"],
    keys: ["antai"], names: ["ANTAI", "Agence nationale de traitement automatisé des infractions", "amendes.gouv"],
  },
  {
    id: "impots", name: "Impôts", le: "le site des impôts", de: "des impôts", a: "à l'administration fiscale",
    url: "https://www.impots.gouv.fr",
    domains: ["impots.gouv.fr"],
    keys: ["impots", "impot", "dgfip"], names: ["impots.gouv", "DGFiP", "Direction générale des Finances publiques", "Finances publiques"],
  },
  {
    id: "ameli", name: "Assurance Maladie", le: "l'Assurance Maladie", de: "de l'Assurance Maladie", a: "à l'Assurance Maladie",
    url: "https://www.ameli.fr",
    domains: ["ameli.fr"],
    keys: ["ameli", "cpam", "assurancemaladie"], names: ["ameli", "Assurance Maladie", "CPAM", "carte Vitale"],
  },
  {
    id: "caf", name: "CAF", le: "la CAF", de: "de la CAF", a: "à la CAF",
    url: "https://www.caf.fr",
    domains: ["caf.fr"],
    keys: ["caf"], names: ["CAF", "Caisse d'allocations familiales", "caf.fr"],
  },
  {
    id: "cpf", name: "Mon Compte Formation", le: "Mon Compte Formation (CPF)",
    url: "https://www.moncompteformation.gouv.fr",
    domains: ["moncompteformation.gouv.fr"],
    keys: ["moncompteformation", "cpf"], names: ["Mon Compte Formation", "moncompteformation", "CPF", "compte personnel de formation"],
  },
  {
    id: "francetravail", name: "France Travail",
    url: "https://www.francetravail.fr",
    domains: ["francetravail.fr", "pole-emploi.fr"],
    keys: ["francetravail", "poleemploi"], names: ["France Travail", "Pôle emploi"],
  },
  {
    id: "ants", name: "ANTS", le: "l'ANTS", de: "de l'ANTS", a: "à l'ANTS",
    url: "https://ants.gouv.fr",
    domains: ["ants.gouv.fr"],
    keys: [{ k: "ants", weak: true }], names: ["ANTS", "Agence nationale des titres sécurisés"],
  },
  {
    id: "critair", name: "Crit'Air",
    url: "https://www.certificat-air.gouv.fr",
    domains: ["certificat-air.gouv.fr"],
    keys: ["critair", "certificatair"], names: ["Crit'Air", "certificat qualité de l'air"],
  },
  {
    id: "douane", name: "Douane", le: "la Douane", de: "de la Douane", a: "à la Douane",
    url: "https://www.douane.gouv.fr",
    domains: ["douane.gouv.fr"],
    keys: [{ k: "douane", weak: true }, { k: "douanes", weak: true }], names: ["douane.gouv", "Direction générale des douanes"],
  },
  {
    id: "franceconnect", name: "FranceConnect",
    url: "https://franceconnect.gouv.fr",
    domains: ["franceconnect.gouv.fr"],
    keys: ["franceconnect"], names: ["FranceConnect"],
  },
  {
    id: "vinci", name: "VINCI Autoroutes",
    url: "https://www.vinci-autoroutes.com",
    domains: ["vinci-autoroutes.com"],
    keys: ["vinciautoroutes", "ulys"], names: ["VINCI Autoroutes", "Ulys"],
  },
  {
    id: "sanef", name: "Sanef", url: "https://www.sanef.com",
    domains: ["sanef.com"], keys: ["sanef"], names: ["Sanef"],
  },

  // Colis
  {
    id: "laposte", name: "La Poste", url: "https://www.laposte.fr",
    domains: ["laposte.fr", "laposte.net", "lapostemobile.fr"],
    keys: ["laposte"], names: ["La Poste"],
  },
  {
    id: "colissimo", name: "Colissimo", url: "https://www.laposte.fr/outils/suivre-vos-envois",
    domains: ["colissimo.fr"], keys: ["colissimo"], names: ["Colissimo"],
  },
  {
    id: "chronopost", name: "Chronopost", url: "https://www.chronopost.fr",
    domains: ["chronopost.fr"], keys: ["chronopost"], names: ["Chronopost"],
  },
  {
    id: "dhl", name: "DHL", url: "https://www.dhl.com",
    domains: ["dhl.com", "dhl.fr", "dhl.de"], keys: ["dhl"], names: ["DHL"],
  },
  {
    id: "ups", name: "UPS", url: "https://www.ups.com",
    domains: ["ups.com"], keys: [{ k: "ups", weak: true }], names: ["UPS"],
  },
  {
    id: "fedex", name: "FedEx", url: "https://www.fedex.com",
    domains: ["fedex.com"], keys: ["fedex"], names: ["FedEx"],
  },
  {
    id: "dpd", name: "DPD", url: "https://www.dpd.fr",
    domains: ["dpd.fr", "dpd.com"], keys: ["dpd"], names: ["DPD"],
  },
  {
    id: "mondialrelay", name: "Mondial Relay", url: "https://www.mondialrelay.fr",
    domains: ["mondialrelay.fr", "mondialrelay.com"], keys: ["mondialrelay"], names: ["Mondial Relay"],
  },
  {
    id: "relaiscolis", name: "Relais Colis", url: "https://www.relaiscolis.com",
    domains: ["relaiscolis.com"], keys: ["relaiscolis"], names: ["Relais Colis"],
  },

  // Banques et paiement
  {
    id: "creditagricole", name: "Crédit Agricole", le: "le Crédit Agricole", de: "du Crédit Agricole", a: "au Crédit Agricole",
    url: "https://www.credit-agricole.fr",
    domains: ["credit-agricole.fr", "credit-agricole.com"], keys: ["creditagricole"], names: ["Crédit Agricole"],
  },
  {
    id: "bnp", name: "BNP Paribas", url: "https://mabanque.bnpparibas",
    domains: ["bnpparibas.com"], suffixes: ["bnpparibas"],
    keys: ["bnpparibas", "bnp"], names: ["BNP Paribas"],
  },
  {
    id: "sg", name: "Société Générale", le: "la Société Générale", de: "de la Société Générale", a: "à la Société Générale",
    url: "https://particuliers.sg.fr",
    domains: ["sg.fr", "societegenerale.fr", "societegenerale.com"], keys: ["societegenerale"], names: ["Société Générale"],
  },
  {
    id: "lcl", name: "LCL", url: "https://www.lcl.fr",
    domains: ["lcl.fr"], keys: ["lcl"], names: ["LCL"],
  },
  {
    id: "caisseepargne", name: "Caisse d'Épargne", le: "la Caisse d'Épargne", de: "de la Caisse d'Épargne", a: "à la Caisse d'Épargne",
    url: "https://www.caisse-epargne.fr",
    domains: ["caisse-epargne.fr"], keys: ["caisseepargne", "caissedepargne"], names: ["Caisse d'Épargne"],
  },
  {
    id: "banquepopulaire", name: "Banque Populaire", le: "la Banque Populaire", de: "de la Banque Populaire", a: "à la Banque Populaire",
    url: "https://www.banquepopulaire.fr",
    domains: ["banquepopulaire.fr"], keys: ["banquepopulaire"], names: ["Banque Populaire"],
  },
  {
    id: "creditmutuel", name: "Crédit Mutuel", le: "le Crédit Mutuel", de: "du Crédit Mutuel", a: "au Crédit Mutuel",
    url: "https://www.creditmutuel.fr",
    domains: ["creditmutuel.fr"], keys: ["creditmutuel"], names: ["Crédit Mutuel"],
  },
  {
    id: "cic", name: "CIC", le: "le CIC", de: "du CIC", a: "au CIC", url: "https://www.cic.fr",
    domains: ["cic.fr"], keys: ["cic"], names: ["CIC"],
  },
  {
    id: "labanquepostale", name: "La Banque Postale", url: "https://www.labanquepostale.fr",
    domains: ["labanquepostale.fr"], keys: ["labanquepostale", "banquepostale"], names: ["La Banque Postale"],
  },
  {
    id: "boursobank", name: "BoursoBank", url: "https://www.boursobank.com",
    domains: ["boursobank.com", "boursorama.com", "boursorama-banque.com"], keys: ["boursobank", "boursorama"], names: ["BoursoBank", "Boursorama"],
  },
  {
    id: "fortuneo", name: "Fortuneo", url: "https://www.fortuneo.fr",
    domains: ["fortuneo.fr"], keys: ["fortuneo"], names: ["Fortuneo"],
  },
  {
    id: "hellobank", name: "Hello bank!", url: "https://www.hellobank.fr",
    domains: ["hellobank.fr"], keys: ["hellobank"], names: ["Hello bank"],
  },
  {
    id: "revolut", name: "Revolut", url: "https://www.revolut.com",
    domains: ["revolut.com"], keys: ["revolut"], names: ["Revolut"],
  },
  {
    id: "n26", name: "N26", url: "https://n26.com",
    domains: ["n26.com"], keys: ["n26"], names: ["N26"],
  },
  {
    id: "paypal", name: "PayPal", url: "https://www.paypal.com",
    domains: ["paypal.com", "paypal.fr", "paypal.me", "paypalobjects.com"], keys: ["paypal"], names: ["PayPal"],
  },

  // Télécoms et énergie
  {
    id: "orange", name: "Orange", url: "https://www.orange.fr",
    domains: ["orange.fr", "orange.com", "sosh.fr"], keys: [{ k: "orange", weak: true }], names: ["Orange"],
  },
  {
    id: "sfr", name: "SFR", url: "https://www.sfr.fr",
    domains: ["sfr.fr"], keys: ["sfr"], names: ["SFR"],
  },
  {
    id: "bouygues", name: "Bouygues Telecom", url: "https://www.bouyguestelecom.fr",
    domains: ["bouyguestelecom.fr"], keys: ["bouyguestelecom", "bouygues"], names: ["Bouygues Telecom"],
  },
  {
    id: "free", name: "Free", url: "https://www.free.fr",
    domains: ["free.fr"], keys: ["freemobile", "freebox"], names: ["Free Mobile", "Freebox"],
  },
  {
    id: "edf", name: "EDF", url: "https://www.edf.fr",
    domains: ["edf.fr", "edf.com"], keys: ["edf"], names: ["EDF"],
  },
  {
    id: "engie", name: "ENGIE", url: "https://www.engie.fr",
    domains: ["engie.fr", "engie.com"], keys: ["engie"], names: ["ENGIE"],
  },
  {
    id: "totalenergies", name: "TotalEnergies", url: "https://www.totalenergies.fr",
    domains: ["totalenergies.fr", "totalenergies.com"], keys: ["totalenergies"], names: ["TotalEnergies"],
  },

  // Commerce, comptes en ligne, transport
  {
    id: "amazon", name: "Amazon", url: "https://www.amazon.fr",
    domains: ["amazon.fr", "amazon.com", "amazon.de", "amazon.co.uk", "amazon.es", "amazon.it", "amazon.com.be", "amazonaws.com", "media-amazon.com", "ssl-images-amazon.com"],
    keys: ["amazon"], names: ["Amazon"],
  },
  {
    id: "apple", name: "Apple", url: "https://www.apple.com/fr",
    domains: ["apple.com", "icloud.com", "me.com", "mzstatic.com"],
    keys: ["icloud", "appleid", { k: "apple", weak: true }], names: ["Apple", "iCloud", "identifiant Apple", "Apple ID"],
  },
  {
    id: "microsoft", name: "Microsoft", url: "https://www.microsoft.com/fr-fr",
    domains: ["microsoft.com", "live.com", "outlook.com", "office.com", "microsoftonline.com", "office365.com", "microsoft365.com", "hotmail.com", "msn.com", "sharepoint.com", "onedrive.com", "xbox.com", "windows.com", "bing.com"],
    suffixes: ["microsoft"],
    keys: ["microsoft", "office365", "microsoft365", "hotmail", "onedrive", "sharepoint", { k: "outlook", weak: true }],
    names: ["Microsoft", "Outlook", "Office 365", "Microsoft 365", "OneDrive", "Hotmail"],
  },
  {
    id: "google", name: "Google", url: "https://www.google.com",
    domains: ["google.com", "google.fr", "gmail.com", "youtube.com", "youtu.be", "googleusercontent.com", "gstatic.com", "googleapis.com", "goo.gl", "g.co", "withgoogle.com", "android.com", "blogger.com"],
    suffixes: ["google"],
    keys: ["google", "gmail", "youtube"], names: ["Google", "Gmail", "YouTube"],
  },
  {
    id: "facebook", name: "Facebook", url: "https://www.facebook.com",
    domains: ["facebook.com", "fb.com", "fb.me", "meta.com", "messenger.com", "fbcdn.net"], keys: ["facebook"], names: ["Facebook"],
  },
  {
    id: "instagram", name: "Instagram", url: "https://www.instagram.com",
    domains: ["instagram.com", "cdninstagram.com"], keys: ["instagram"], names: ["Instagram"],
  },
  {
    id: "whatsapp", name: "WhatsApp", url: "https://www.whatsapp.com",
    domains: ["whatsapp.com", "whatsapp.net", "wa.me"], keys: ["whatsapp"], names: ["WhatsApp"],
  },
  {
    id: "netflix", name: "Netflix", url: "https://www.netflix.com",
    domains: ["netflix.com", "netflix.net", "nflxext.com", "nflximg.net"], keys: ["netflix"], names: ["Netflix"],
  },
  {
    id: "canalplus", name: "CANAL+", url: "https://www.canalplus.com",
    domains: ["canalplus.com"], keys: ["canalplus"], names: ["CANAL+"],
  },
  {
    id: "leboncoin", name: "leboncoin", url: "https://www.leboncoin.fr",
    domains: ["leboncoin.fr"], keys: ["leboncoin"], names: ["leboncoin"],
  },
  {
    id: "vinted", name: "Vinted", url: "https://www.vinted.fr",
    domains: ["vinted.fr", "vinted.com"], keys: ["vinted"], names: ["Vinted"],
  },
  {
    id: "cdiscount", name: "Cdiscount", url: "https://www.cdiscount.com",
    domains: ["cdiscount.com"], keys: ["cdiscount"], names: ["Cdiscount"],
  },
  {
    id: "ebay", name: "eBay", url: "https://www.ebay.fr",
    domains: ["ebay.fr", "ebay.com"], keys: ["ebay"], names: ["eBay"],
  },
  {
    id: "doctolib", name: "Doctolib", url: "https://www.doctolib.fr",
    domains: ["doctolib.fr"], keys: ["doctolib"], names: ["Doctolib"],
  },
  {
    id: "sncf", name: "SNCF Connect", url: "https://www.sncf-connect.com",
    domains: ["sncf-connect.com", "sncf.com"], keys: ["sncfconnect", "sncf"], names: ["SNCF Connect", "SNCF"],
  },
];

// International groups that own their name in many countries: "amazon.com.au" or "paypal.de" with
// nothing else around the name is most likely theirs, so it only counts for little.
export const GLOBAL_BRANDS = new Set([
  "dhl", "ups", "fedex", "dpd", "paypal", "amazon", "apple", "microsoft", "google", "facebook",
  "instagram", "whatsapp", "netflix", "ebay", "revolut", "n26",
]);
