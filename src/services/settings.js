/* What the person decided: protection on or off, sites they trust for good, and sites they chose
   to open anyway after a block (forgotten when the browser closes). */

const DEFAULTS = { enabled: true, allowlist: [] };

export async function getSettings() {
  return { ...DEFAULTS, ...(await chrome.storage.local.get("settings")).settings };
}

export async function setSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ settings: next });
  return next;
}

export async function trust(domain, yes) {
  const { allowlist } = await getSettings();
  const next = yes ? [...new Set([...allowlist, domain])] : allowlist.filter((d) => d !== domain);
  return setSettings({ allowlist: next });
}

export async function getBypass() {
  return (await chrome.storage.session.get("bypass")).bypass || [];
}

export async function addBypass(domain) {
  const bypass = await getBypass();
  if (!bypass.includes(domain)) await chrome.storage.session.set({ bypass: [...bypass, domain] });
}
