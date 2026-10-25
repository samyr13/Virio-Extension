// Downloads the latest Public Suffix List into data/ (run it before each release).
import { writeFileSync } from "node:fs";

const r = await fetch("https://publicsuffix.org/list/public_suffix_list.dat");
if (!r.ok) throw new Error(`Téléchargement impossible : HTTP ${r.status}`);
const text = await r.text();
if (!text.includes("===BEGIN PRIVATE DOMAINS===")) throw new Error("Fichier inattendu, rien n'a été écrit.");
writeFileSync(new URL("../data/public_suffix_list.dat", import.meta.url), text);
console.log(`Liste des suffixes mise à jour (${text.split("\n").length} lignes).`);
