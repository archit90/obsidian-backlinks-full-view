import { describe, expect, it } from "vitest";
import { Entry, defaults, listJson, merge, parseEntry, parseList, sanitizeGroup, serializeEntry } from "./config";
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
      open: ["a.md", "b.md", "a.md", ""],
    });
    expect(errors).toEqual([]);
    expect(cfg.title).toBe("Logs");
    expect(cfg.filter).toEqual(filter);
    expect(cfg.sorts).toEqual([{ prop: "file.mtime", dir: "desc" }]);
    expect(cfg.query).toBe("LIST FROM #a");
    expect(cfg.open).toEqual(["a.md", "b.md"]); // de-duplicated, blanks dropped
  });
  it("also reads hand-written YAML values", () => {
    const { cfg, errors } = parseEntry({ sort: [{ prop: "file.name" }], filter: { children: [] } });
    expect(errors).toEqual([]);
    expect(cfg.sorts).toEqual([{ prop: "file.name", dir: "asc" }]);
    expect(cfg.filter).toEqual({ type: "group", mode: "and", children: [] });
  });
  it("caps the remembered open cards", () => {
    const open = Array.from({ length: MAX_OPEN_SAVED + 10 }, (_, i) => `n${i}.md`);
    expect(parseEntry({ open }).cfg.open).toHaveLength(MAX_OPEN_SAVED);
  });
  it("reports each unreadable key and keeps defaults for it", () => {
    const { cfg, errors } = parseEntry({ filter: "{bad", sort: "[1]", title: ["x"], open: "nope" });
    expect(errors).toEqual([
      "`title` isn't text",
      "`filter` isn't valid JSON",
      "`sort` isn't a list of sort rules",
      "`open` isn't valid JSON",
    ]);
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
    expect(serializeEntry(e)).toEqual({ title: "Logs", filter: null, sort: null, query: null, open: null });
  });
  it("keeps unknown keys and the user's spelling of unchanged keys", () => {
    const raw = { title: "Logs", sort: [{ prop: "file.name" }], color: "red" };
    const e = entry(raw);
    e.cfg.query = "LIST";
    const out = serializeEntry(e);
    expect(out.color).toBe("red");
    expect(out.sort).toEqual([{ prop: "file.name" }]); // same meaning: left as written
    expect(out.query).toBe("LIST");
    expect(out).not.toHaveProperty("open"); // still default and wasn't there
  });
  it("round-trips through parseEntry", () => {
    const e = entry({ title: "T" });
    e.cfg.sorts = [{ prop: "file.mtime", dir: "desc" }];
    e.cfg.open = ["a.md"];
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
