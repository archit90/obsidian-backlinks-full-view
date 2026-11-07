// Fixture notes for the end-to-end suite: everything lives in `_bfv/` of the test vault and is rewritten
// (through Obsidian's vault API, so the metadata cache follows) before each group that needs a clean slate.

const fm = (props, body) => `---\n${props}\n---\n${body}\n`;
const REFS = "Refs: [[_bfv/Open list]] [[_bfv/Yaml filter]] [[_bfv/Mismatch]] [[_bfv/Single obj]]";

export const FIXTURES = {
  "_bfv/Target.md": fm(
    `type: zettel
aliases: [TA]
backlinks:
  - title: Mine
    sort: '[{"prop":"note.rank","dir":"asc"}]'`,
    "# Target\n\n## Section\nSome text. ^blk\n\nSelf link: [[_bfv/Target]]",
  ),
  // the sources of Target, one per kind of link
  "_bfv/src/Plain.md": fm(
    "rank: 3\nstatus: active\ntags: [alpha, beta/gamma]\ncreated: 2026-10-01",
    'Links to [[_bfv/Target]]. Also see [[_bfv/src/Heading]] and [[_bfv/Lonely|lonely alias]].\nbilling v2 acme\n\n```dataview\nLIST FROM "_bfv/src" SORT file.name LIMIT 2\n```\n' +
      REFS,
  ),
  "_bfv/src/Heading.md": fm(
    "rank: 1\nstatus: done\ntags: [alpha]\ncreated: 2026-09-01",
    'Heading link [[_bfv/Target#Section]] here. phrase "daily log" words.\n' + REFS,
  ),
  "_bfv/src/Block.md": fm(
    "rank: 2\nstatus: active\ncreated: 2026-11-01\nflag: true",
    "Block link [[_bfv/Target#^blk]].\n" + REFS,
  ),
  "_bfv/src/Embed.md": fm("rank: 10\nstatus: idea\nflag: false", "Embed: ![[_bfv/Target]]\n" + REFS),
  "_bfv/src/Alias.md": fm(
    'rank: 5\npeople: ["[[_bfv/Target]]", "[[n/Maya Iyer]]"]',
    "Alias [[_bfv/Target|display text]] and alias-name link [[TA]].",
  ),
  "_bfv/src/Mdlink.md": fm("rank: 6", "Markdown link [x](</_bfv/Target.md>) and [y](_bfv/Target.md)."),
  "_bfv/src/FmOnly.md": fm('rank: 7\nrelated: "[[_bfv/Target]]"', "Only a frontmatter link."),
  "_bfv/src/Unresolved.md": fm("rank: 8", "Points to [[_bfv/Nope]] and [[_bfv/Target]]."),
  "_bfv/Lonely.md": fm("type: zettel", "Only Plain links here, with an alias."),
  "_bfv/Orphan.md": "No links to here, no frontmatter.\n",
  "_bfv/Short.md": "One line.\n",
  // `backlinks` property variants
  "_bfv/Bad list.md": fm("backlinks: just a string", "[[_bfv/Target]]"),
  "_bfv/Bad json.md": fm("backlinks:\n  - title: Broken\n    filter: '{bad json'\n  - title: Fine", "[[_bfv/Target]]"),
  "_bfv/Bad entry.md": fm("backlinks:\n  - 42", "body"),
  "_bfv/Single obj.md": fm("backlinks:\n  title: Solo\n  note: keep me", "body"),
  "_bfv/Yaml filter.md": fm(
    `backlinks:
  - title: Yaml
    filter:
      type: group
      mode: and
      children:
        - {type: rule, prop: note.status, op: is, value: active}
    sort:
      - {prop: note.rank, dir: desc}
    extra: unknown-key`,
    "body",
  ),
  "_bfv/Empty list.md": fm("backlinks: []", "body"),
  "_bfv/Null entry.md": fm("backlinks:\n  -", "body"),
  "_bfv/Titles.md": fm(
    "backlinks:\n  - sort: '[]'\n  - query: 'LIST FROM \"_bfv/src\"'\n  - title: 7",
    "Default titles.",
  ),
  "_bfv/Mismatch.md": fm(
    `backlinks:
  - title: Mismatch
    filter: '{"type":"group","mode":"and","children":[{"type":"rule","prop":"note.status","op":"before","value":"2026"}]}'`,
    "body",
  ),
  "_bfv/Open list.md": fm('backlinks:\n  - title: Opened\n    open: ["_bfv/src/Plain.md", "_bfv/Gone.md"]', "body"),
  "_bfv/Queries.md": fm(
    `backlinks:
  - title: Src
    query: 'LIST FROM "_bfv/src" SORT file.name'
  - title: Nothing
    query: 'LIST FROM "_bfv/src" WHERE rank > 1000'
  - title: Broken
    query: 'LIST FROM WHERE ((('
  - title: NoLinks
    query: 'TABLE WITHOUT ID rank FROM "_bfv/src"'
    open: ["_bfv/src/Plain.md"]`,
    "Query panes.",
  ),
  "_bfv/DVJS.md": fm(
    "type: zettel",
    "Open embeds:\n```dataviewjs\nbfv.embed(dv, dv.pages('\"_bfv/src\"').sort(p => p.file.name))\n```\n" +
      "Collapsed, limit 2:\n```dataviewjs\nbfv.embed(dv, dv.pages('\"_bfv/src\"'), { collapsed: true, limit: 2 })\n```\n" +
      "Self:\n```dataviewjs\nbfv.embed(dv, [dv.current()])\n```",
  ),
  "_bfv/Canvas.canvas": JSON.stringify({
    nodes: [
      { id: "c1", type: "file", file: "_bfv/Target.md", x: 0, y: 0, width: 560, height: 700 },
      { id: "c2", type: "file", file: "_bfv/Lonely.md", x: 620, y: 0, width: 460, height: 500 },
    ],
    edges: [],
  }),
};

/** Page-side: (re)write every fixture, removing other files in `_bfv/` first. */
export const writeFixturesExpr = `(async () => {
  const want = ${JSON.stringify(FIXTURES)};
  const all = app.vault.getFiles().filter(f => f.path.startsWith("_bfv/"));
  for (const f of all) if (!(f.path in want)) await app.vault.delete(f, true);
  for (const [p, text] of Object.entries(want)) {
    const dir = p.split("/").slice(0, -1).join("/");
    if (!app.vault.getAbstractFileByPath(dir)) await app.vault.createFolder(dir).catch(() => {});
    const f = app.vault.getAbstractFileByPath(p);
    if (!f) await app.vault.create(p, text);
    else if ((await app.vault.read(f)) !== text) await app.vault.modify(f, text);
  }
  // wait until the metadata cache has every fixture's links
  for (let i = 0; i < 50; i++) {
    const r = app.metadataCache.resolvedLinks;
    if (r["_bfv/src/Unresolved.md"]?.["_bfv/Target.md"] && r["_bfv/src/Plain.md"]?.["_bfv/Open list.md"]) break;
    await new Promise(r => setTimeout(r, 100));
  }
  await new Promise(r => setTimeout(r, 400));
  return true;
})()`;
