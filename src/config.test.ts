import { describe, expect, it } from "vitest";
import {
  Entry,
  countRules,
  defaults,
  hasLegacyOpen,
  legacyOpen,
  listJson,
  merge,
  mergeOpen,
  parseEntry,
  parseList,
  parseOpen,
  sanitizeGroup,
  serializeEntry,
} from "./config";
import { MAX_OPEN_SAVED } from "./constants";

const entry = (raw: Record<string, unknown> | null, src: number | null = 0): Entry => ({ ...parseEntry(raw), src });

describe("parseList", () => {
  it("treats a missing property as no panes", () => {
    expect(parseList(undefined)).toEqual({ entries: [], error: "" });
    expect(parseList(null)).toEqual({ entries: [], error: "" });
  });
  it("accepts a single pane written as a map", () => {
    const { entries, error } = parseList({ title: "Logs" });
    expect(error).toBe("");
    expect(entries).toHaveLength(1);
    expect(entries[0].cfg.title).toBe("Logs");
    expect(entries[0].src).toBe(0);
  });
  it("refuses something that isn't a list of panes", () => {
    expect(parseList("nope").error).toMatch(/isn't a list/);
  });
});

describe("parseEntry", () => {
  it("reads every key in the stored (JSON string) form", () => {
    const filter = {
      type: "group",
      mode: "or",
      children: [{ type: "rule", prop: "file.name", op: "contains", value: "x" }],
    };
    const { cfg, errors } = parseEntry({
      title: " Logs ",
      filter: JSON.stringify(filter),
      sort: JSON.stringify([{ prop: "file.mtime", dir: "desc" }]),
      query: " LIST FROM #a ",
    });
    expect(errors).toEqual([]);
    expect(cfg.title).toBe("Logs");
    expect(cfg.filter).toEqual(filter);
    expect(cfg.sorts).toEqual([{ prop: "file.mtime", dir: "desc" }]);
    expect(cfg.query).toBe("LIST FROM #a");
  });
  it("also reads hand-written YAML values", () => {
    const { cfg, errors } = parseEntry({ sort: [{ prop: "file.name" }], filter: { children: [] } });
    expect(errors).toEqual([]);
    expect(cfg.sorts).toEqual([{ prop: "file.name", dir: "asc" }]);
    expect(cfg.filter).toEqual({ type: "group", mode: "and", children: [] });
  });
  it("ignores the older per-pane `open` (it's read by legacyOpen)", () => {
    const { cfg, errors } = parseEntry({ title: "T", open: "nope" });
    expect(errors).toEqual([]);
    expect(cfg).toEqual({ ...defaults(), title: "T" });
  });
  it("reports each unreadable key and keeps defaults for it", () => {
    const { cfg, errors } = parseEntry({ filter: "{bad", sort: "[1]", title: ["x"] });
    expect(errors).toEqual(["`title` isn't text", "`filter` isn't valid JSON", "`sort` isn't a list of sort rules"]);
    expect(cfg).toEqual(defaults());
  });
  it("reports an entry that isn't a map", () => {
    expect(parseEntry("x").errors).toHaveLength(1);
    expect(parseEntry(null).errors).toEqual([]);
  });
});

describe("sanitizeGroup", () => {
  it("rejects a group with anything invalid inside it instead of dropping it", () => {
    expect(sanitizeGroup({ children: [{ prop: "a", op: "is" }, { nonsense: true }] })).toBeNull();
    expect(sanitizeGroup({ mode: "xor", children: [] })).toBeNull();
    expect(sanitizeGroup({ children: [{ children: [{ prop: 1, op: "is" }] }] })).toBeNull();
  });
  it("normalises rules and nested groups", () => {
    expect(sanitizeGroup({ mode: "not", children: [{ prop: "a", op: "is", value: 3 }, { children: [] }] })).toEqual({
      type: "group",
      mode: "not",
      children: [
        { type: "rule", prop: "a", op: "is", value: "3" },
        { type: "group", mode: "and", children: [] },
      ],
    });
  });
});

describe("serializeEntry", () => {
  it("writes only non-default keys for a new pane", () => {
    const e: Entry = { cfg: { ...defaults(), title: "Logs" }, raw: null, errors: [], src: null };
    expect(serializeEntry(e)).toEqual({ title: "Logs" });
  });
  it("writes a new pane with nothing set as an empty entry, never `key: null`", () => {
    const e: Entry = { cfg: defaults(), raw: null, errors: [], src: null };
    expect(serializeEntry(e)).toEqual({});
  });
  it("removes a filter that has no rules left, whatever its groups' modes", () => {
    const e = entry({
      title: "T",
      filter: '{"type":"group","mode":"and","children":[{"type":"rule","prop":"a","op":"is","value":"1"}]}',
    });
    e.cfg.filter = { type: "group", mode: "or", children: [{ type: "group", mode: "not", children: [] }] };
    expect(serializeEntry(e)).toEqual({ title: "T" });
  });
  it("keeps unknown keys and the user's spelling of unchanged keys", () => {
    const raw = { title: "Logs", sort: [{ prop: "file.name" }], color: "red" };
    const e = entry(raw);
    e.cfg.query = "LIST";
    const out = serializeEntry(e);
    expect(out.color).toBe("red");
    expect(out.sort).toEqual([{ prop: "file.name" }]); // same meaning: left as written
    expect(out.query).toBe("LIST");
  });
  it("drops the older per-pane `open` (it moved to `backlinks-open`)", () => {
    expect(serializeEntry(entry({ title: "T", open: ["a.md"], color: "red" }))).toEqual({ title: "T", color: "red" });
  });
  it("round-trips through parseEntry", () => {
    const e = entry({ title: "T" });
    e.cfg.sorts = [{ prop: "file.mtime", dir: "desc" }];
    expect(parseEntry(serializeEntry(e)).cfg).toEqual(e.cfg);
  });
});

describe("merge (three-way, per key)", () => {
  const list = (...titles: string[]) => titles.map((t, i) => entry({ title: t }, i));

  it("takes ours when the file didn't change, keeping the file's unknown keys", () => {
    const base = list("A");
    const ours = list("A2");
    const disk = [entry({ title: "A", extra: 1 }, 0)];
    const out = merge(base, ours, [{ ...base[0], raw: disk[0].raw }]);
    expect(out[0].cfg.title).toBe("A2");
    expect(out[0].raw).toEqual({ title: "A", extra: 1 });
  });
  it("keeps keys changed on disk and keys changed here", () => {
    const base = [entry({ title: "A", query: "" }, 0)];
    const ours = [entry({ title: "A2", query: "" }, 0)];
    const disk = [entry({ title: "A", query: "LIST" }, 0)];
    const out = merge(base, ours, disk);
    expect(out[0].cfg.title).toBe("A2");
    expect(out[0].cfg.query).toBe("LIST");
  });
  it("takes our structure when only we added or removed panes", () => {
    const base = list("A", "B");
    const ours = [base[0]]; // B removed here
    const disk = [entry({ title: "A*" }, 0), entry({ title: "B" }, 1)];
    expect(merge(base, ours, disk).map(e => e.cfg.title)).toEqual(["A"]);
  });
  it("keeps ours, detached from the file, when both sides changed the structure", () => {
    const base = list("A");
    const ours = [...list("A"), entry({ title: "New" }, null)];
    const disk = list("A", "Other");
    const out = merge(base, ours, disk);
    expect(out.map(e => e.cfg.title)).toEqual(["A", "New"]);
    expect(out.every(e => e.src === null)).toBe(true);
  });
  it("listJson ignores raw spelling", () => {
    expect(listJson([entry({ sort: [{ prop: "file.name" }] })])).toBe(listJson([entry({})]));
  });
});

describe("countRules", () => {
  it("counts rules in nested groups, not groups", () => {
    expect(countRules({ type: "group", mode: "and", children: [] })).toBe(0);
    expect(
      countRules({
        type: "group",
        mode: "or",
        children: [
          { type: "rule", prop: "a", op: "is", value: "" },
          { type: "group", mode: "not", children: [{ type: "rule", prop: "b", op: "is", value: "" }] },
          { type: "group", mode: "and", children: [] },
        ],
      }),
    ).toBe(2);
  });
});

describe("sort and filter values that aren't objects", () => {
  it("rejects a sort list holding a non-object", () => {
    expect(parseEntry({ sort: [{ prop: "a" }, "b"] }).errors).toEqual(["`sort` isn't a list of sort rules"]);
  });
  it("rejects a filter group whose child isn't an object, or with an unknown mode", () => {
    expect(sanitizeGroup({ children: [3] })).toBeNull();
    expect(sanitizeGroup({ mode: "xor", children: [] })).toBeNull();
    expect(sanitizeGroup({ children: [] })).toEqual({ type: "group", mode: "and", children: [] });
  });
});

describe("backlinks-open", () => {
  it("reads a list of paths: de-duplicated, blanks dropped, capped", () => {
    expect(parseOpen(["a.md", "b.md", "a.md", "", 3], 50)).toEqual({ paths: ["a.md", "b.md"], error: "" });
    const many = Array.from({ length: MAX_OPEN_SAVED + 10 }, (_, i) => `n${i}.md`);
    expect(parseOpen(many, MAX_OPEN_SAVED).paths).toEqual(many.slice(0, MAX_OPEN_SAVED));
    expect(parseOpen(["a.md", "b.md"], 1).paths).toEqual(["a.md"]);
    expect(parseOpen(["a.md"], 0).paths).toEqual([]);
  });
  it("accepts a missing value or a single path, refuses anything else", () => {
    expect(parseOpen(undefined, 50)).toEqual({ paths: [], error: "" });
    expect(parseOpen(null, 50)).toEqual({ paths: [], error: "" });
    expect(parseOpen("a.md", 50)).toEqual({ paths: ["a.md"], error: "" });
    expect(parseOpen({ a: 1 }, 50).error).toMatch(/isn't a list of paths/);
  });
  it("reads the older per-pane lists as one, first pane first", () => {
    const bl = [{ open: ["a.md", "b.md"] }, { title: "x" }, { open: '["b.md","c.md"]' }, { open: "{bad" }];
    expect(legacyOpen(bl, 50)).toEqual(["a.md", "b.md", "c.md"]);
    expect(legacyOpen({ open: ["a.md"] }, 50)).toEqual(["a.md"]);
    expect(legacyOpen(bl, 2)).toEqual(["a.md", "b.md"]);
    expect(legacyOpen(undefined, 50)).toEqual([]);
    expect(hasLegacyOpen(bl)).toBe(true);
    expect(hasLegacyOpen([{ title: "x" }])).toBe(false);
    expect(hasLegacyOpen(undefined)).toBe(false);
  });
  it("merges: ours when the file didn't change, the file's when we didn't", () => {
    expect(mergeOpen(["a"], ["b", "a"], ["a"], 50)).toEqual(["b", "a"]);
    expect(mergeOpen(["a"], ["a"], ["c", "a"], 50)).toEqual(["c", "a"]);
  });
  it("merges toggles made on both sides", () => {
    // here: b expanded, a collapsed; there: c expanded
    expect(mergeOpen(["a", "x"], ["b", "x"], ["c", "a", "x"], 50)).toEqual(["b", "x", "c"]);
    expect(mergeOpen(["a", "x"], ["b", "x"], ["c", "a", "x"], 2)).toEqual(["b", "x"]);
  });
});
