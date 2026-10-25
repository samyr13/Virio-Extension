/* Public Suffix List: tells a site ("impots.gouv.fr") from a suffix nobody owns ("gouv.fr"),
   and someone's page ("paypal-login.vercel.app") from the platform hosting it ("vercel.app").
   Source: data/public_suffix_list.dat (https://publicsuffix.org), refreshed with `npm run update-psl`. */

export function createPsl(text) {
  const rules = new Map(); // rule -> true when it comes from the PRIVATE section (hosting platforms)
  let inPrivate = false;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.includes("===BEGIN PRIVATE DOMAINS===")) inPrivate = true;
    if (!line || line.startsWith("//")) continue;
    let rule = line.split(/\s/)[0].toLowerCase();
    // Hostnames reach us in punycode, so encode the few Unicode rules the same way.
    if (/[^\x00-\x7f]/.test(rule)) {
      try {
        const prefix = rule.match(/^[!*.]*/)[0];
        rule = prefix + new URL(`http://${rule.slice(prefix.length)}`).hostname;
      } catch {
        continue;
      }
    }
    rules.set(rule, inPrivate);
  }

  function lookup(labels) {
    for (let i = 0; i < labels.length; i++) {
      const cand = labels.slice(i).join(".");
      if (rules.has(`!${cand}`)) return { suffix: labels.slice(i + 1).join("."), isPrivate: rules.get(`!${cand}`) };
      if (rules.has(cand)) return { suffix: cand, isPrivate: rules.get(cand) };
      if (i + 1 < labels.length) {
        const wild = `*.${labels.slice(i + 1).join(".")}`;
        if (rules.has(wild)) return { suffix: cand, isPrivate: rules.get(wild) };
      }
    }
    return { suffix: labels[labels.length - 1], isPrivate: false };
  }

  return {
    parse(host) {
      host = host.toLowerCase().replace(/\.$/, "");
      const labels = host.split(".");
      const { suffix, isPrivate } = lookup(labels);
      const tld = labels[labels.length - 1];
      const n = labels.length - (suffix ? suffix.split(".").length : 0);
      const base = { host, labels, suffix, tld, knownTld: rules.has(tld), isPrivate };
      if (n <= 0) return { ...base, domain: null, label: "", subLabels: [] };
      return { ...base, domain: labels.slice(n - 1).join("."), label: labels[n - 1], subLabels: labels.slice(0, n - 1) };
    },
  };
}
