/* Text helpers shared by the URL and page analysers: folding, tokens, look-alike distance. */

// "Crédit Agricole" -> "credit agricole"
export function fold(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Letters and digits only, single spaces: "Caisse d'Épargne" -> "caisse d epargne".
export function plain(s) {
  return fold(s).replace(/[^a-z0-9]+/g, " ").trim();
}

export function tokens(s) {
  return fold(s).split(/[^a-z0-9]+/).filter(Boolean);
}

// Swaps scammers use to fool the eye ("arneli" for "ameli", "g00gle"). Applied to both sides.
const SKELETON = [
  [/rn/g, "m"], [/vv/g, "w"], [/cl/g, "d"],
  [/[1il]/g, "l"], [/0/g, "o"], [/3/g, "e"], [/4/g, "a"], [/5/g, "s"], [/7/g, "t"], [/8/g, "b"],
];
export function skeleton(s) {
  return SKELETON.reduce((acc, [re, to]) => acc.replace(re, to), s);
}

// Optimal string alignment distance: insertions, deletions, substitutions, adjacent swaps.
export function editDistance(a, b) {
  const n = a.length, m = b.length;
  let prev2 = null;
  let prev = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const cur = [i];
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
    }
    prev2 = prev;
    prev = cur;
  }
  return prev[m];
}

// Is `word` a deliberate misspelling of `key`? Short keys only allow same-length swaps, so that
// "amelie" (a first name) is not read as a fake "ameli".
export function isLookalike(word, key) {
  if (word === key) return false;
  if (word.length > 3 && skeleton(word) === skeleton(key)) return true;
  if (key.length < 7) return word.length === key.length && editDistance(word, key) === 1;
  const max = key.length >= 10 ? 2 : 1;
  return Math.abs(word.length - key.length) <= max && editDistance(word, key) <= max;
}

// ["a", "b", "c"] -> "a, b et c"
export function joinFr(list) {
  return list.length <= 1 ? list.join("") : `${list.slice(0, -1).join(", ")} et ${list[list.length - 1]}`;
}

export function quoteList(words) {
  return joinFr(words.map((w) => `« ${w} »`));
}
