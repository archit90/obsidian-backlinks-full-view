// The suite's fixtures that belong on disk, written before Obsidian opens the vault. e2e/sandbox.sh runs it once
// the sandbox's vault is made:  node e2e/make-vault.mjs <vault>
//
// - .obsidian/app.json: "Automatically update internal links" on (G5: renaming a note rewrites the links to it),
//   "Readable line length" off (the widths the cases measure), new links as absolute paths.
// - .obsidian/core-plugins.json: Page preview (C4, J8), Canvas (J1–J4, Q6) and Search on; core Backlinks off.
// - The hub `n/Maya Iyer.md` (an own "Logs" pane filtered to the folder `0/`) and 3,000 notes in `0/` that link to
//   it, with bodies of about a kilobyte, "standup" in some (B7, N1, N2); plus 20 topic notes they also link to.
//
// Idempotent. In a copy of another vault (OBS_VAULT) it only sets the settings above and writes what's missing at
// these paths: when that vault has its own `n/Maya Iyer.md`, the hub is left as it is.
import fs from "node:fs";
import path from "node:path";

const vault = process.argv[2];
if (!vault || !fs.existsSync(path.join(vault, ".obsidian"))) {
  console.error("usage: node e2e/make-vault.mjs <vault> (a folder with .obsidian/)");
  process.exit(2);
}
const HUB = "n/Maya Iyer.md";
const SOURCES = 3000;
const TOPICS = 20;

/** Merges `patch` into the JSON object in `file` (created if missing). */
function mergeJson(file, patch) {
  const p = path.join(vault, file);
  let cur = {};
  try {
    cur = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    /* missing or unreadable: start over */
  }
  if (Array.isArray(cur)) {
    // the older list form of core-plugins.json: the enabled ids
    const on = new Set(cur);
    for (const [k, v] of Object.entries(patch)) v ? on.add(k) : on.delete(k);
    fs.writeFileSync(p, JSON.stringify([...on], null, 2));
    return;
  }
  fs.writeFileSync(p, JSON.stringify({ ...cur, ...patch }, null, 2));
}

mergeJson(".obsidian/app.json", { alwaysUpdateLinks: true, readableLineLength: false, newLinkFormat: "absolute" });
// a fresh vault gets the whole list (Obsidian's defaults otherwise); a copy only these four
const fresh = !fs.existsSync(path.join(vault, ".obsidian/core-plugins.json"));
mergeJson(".obsidian/core-plugins.json", {
  ...(fresh
    ? {
        "file-explorer": true,
        switcher: true,
        graph: true,
        "outgoing-link": true,
        "tag-pane": true,
        properties: true,
        "daily-notes": false,
        templates: false,
        "note-composer": true,
        "command-palette": true,
        "editor-status": true,
        bookmarks: true,
        outline: true,
        "word-count": true,
        "file-recovery": true,
        bases: true,
      }
    : {}),
  "page-preview": true,
  canvas: true,
  "global-search": true,
  backlink: false,
});

/** Writes a note unless it's there already. */
function note(rel, text) {
  const p = path.join(vault, rel);
  if (fs.existsSync(p)) return false;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
  return true;
}

if (fs.existsSync(path.join(vault, HUB))) {
  console.log(`make-vault: ${HUB} exists, left as it is`);
  process.exit(0);
}

// a small deterministic generator, so every fresh vault has the same notes
let seed = 948;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = a => a[Math.floor(rnd() * a.length)];
const WORDS = (
  "the a team user review test system cache data queue client meeting question fix push pull merge step job " +
  "bug signal week small fast late early good bad noise schema spec goal value cost quarter deploy release plan"
).split(" ");
const sentence = () => {
  const n = 8 + Math.floor(rnd() * 10);
  const w = Array.from({ length: n }, () => pick(WORDS));
  return w[0][0].toUpperCase() + w.join(" ").slice(1) + ".";
};
const pad = (n, k) => String(n).padStart(k, "0");

note(
  HUB,
  `---
type: entity
created: 2026-09-10T09:30:00
aliases: ["Maya"]
kind: person
backlinks:
  - title: Logs
    filter: '{"type":"group","mode":"and","children":[{"type":"rule","prop":"file.folder","op":"is","value":"0"}]}'
    sort: '[{"prop":"file.name","dir":"desc"}]'
---

My manager. Weekly one-on-one on Tuesdays.

Notes from our meetings are in the logs.
`,
);
for (let t = 1; t <= TOPICS; t++) note(`n/Topic ${pad(t, 2)}.md`, `---\ntype: topic\n---\n\nTopic ${t}.\n`);
let written = 0;
for (let i = 0; i < SOURCES; i++) {
  const day = new Date(Date.UTC(2024, 0, 1) + i * 6 * 3600 * 1000);
  const stamp = `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1, 2)}-${pad(day.getUTCDate(), 2)}-${pad(day.getUTCHours(), 2)}0000`;
  const topics = [`[[n/Maya Iyer]]`, `[[n/Topic ${pad(1 + (i % TOPICS), 2)}]]`];
  const paras = Array.from({ length: 3 }, () => Array.from({ length: 4 }, sentence).join(" "));
  if (i % 7 === 0) paras[1] = "Daily standup notes: " + paras[1];
  paras[2] += ` See [[n/Topic ${pad(1 + ((i * 7) % TOPICS), 2)}]].`;
  const text = `---
type: log
created: ${day.toISOString().slice(0, 19)}
status: ${pick(["linked", "open", "done"])}
topics: [${topics.map(t => `"${t}"`).join(", ")}]
---

${paras.join("\n\n")}
`;
  if (note(`0/${stamp} Log ${pad(i + 1, 4)}.md`, text)) written++;
}
console.log(`make-vault: the hub ${HUB} and ${written} notes in 0/ written`);
