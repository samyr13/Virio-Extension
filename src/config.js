/* Settings that will change as Virio grows. When the Virio server exists, `apiBase` takes over the
   blocklists and the domain-age lookups (WHOIS for extensions without RDAP, shared cache). */

export const CONFIG = {
  apiBase: null,

  // Public phishing feeds, refreshed every `refreshHours`. Check each licence before publishing.
  blocklists: [
    {
      id: "phishing-filter",
      name: "Phishing Filter (OpenPhish, PhishTank, IPThreat)",
      url: "https://malware-filter.gitlab.io/malware-filter/phishing-filter-domains.txt",
      format: "domains",
    },
    {
      id: "openphish",
      name: "OpenPhish",
      url: "https://raw.githubusercontent.com/openphish/public_feed/refs/heads/main/feed.txt",
      format: "urls",
    },
  ],
  refreshHours: 6,

  // Domain creation dates come from the registries' RDAP servers, found through IANA's directory.
  rdapBootstrap: "https://data.iana.org/rdap/dns.json",
  rdapTimeoutMs: 5000,
};
