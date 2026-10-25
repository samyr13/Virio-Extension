// Builds the zips to upload to the stores, with manifest.json at the root of each:
//   dist/virio-chrome-<version>.zip   (Chrome Web Store, Edge Add-ons)
//   dist/virio-firefox-<version>.zip  (addons.mozilla.org)
// Each store gets a manifest stripped of the keys meant for the other.
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { deflateRawSync, crc32 } from "node:zlib";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SHIPPED = ["src", "assets", "data/public_suffix_list.dat"];

function files(path) {
  const full = join(root, path);
  if (!statSync(full).isDirectory()) return [path];
  return readdirSync(full).flatMap((name) => files(join(path, name)));
}

function manifestFor(target) {
  const m = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
  if (target === "chrome") {
    delete m.background.scripts;
    delete m.browser_specific_settings;
  } else {
    delete m.background.service_worker;
    delete m.minimum_chrome_version;
  }
  return JSON.stringify(m, null, 2);
}

// Minimal zip writer (deflate, UTF-8 names, forward slashes), so no extra tool is needed.
function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const packed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, packed);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + packed.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

const { version } = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const shipped = SHIPPED.flatMap(files).map((p) => relative(root, join(root, p)).split(sep).join("/")).sort();
mkdirSync(join(root, "dist"), { recursive: true });

for (const target of ["chrome", "firefox"]) {
  const entries = [
    { name: "manifest.json", data: Buffer.from(manifestFor(target), "utf8") },
    ...shipped.map((name) => ({ name, data: readFileSync(join(root, name)) })),
  ];
  const out = join(root, "dist", `virio-${target}-${version}.zip`);
  const buf = zip(entries);
  writeFileSync(out, buf);
  console.log(`${relative(root, out)} : ${entries.length} fichiers, ${Math.round(buf.length / 1024)} Ko`);
}
