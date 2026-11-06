import { MAX_OPEN_SAVED } from "./constants";
import { isPlainObject } from "./values";

// ---------- config model (mirrors Bases: nested and/or/not filters + multi-sort) ----------

export type PropType = "text" | "number" | "date" | "boolean" | "list";
export interface Rule {
  type: "rule";
  prop: string;
  op: string;
  value: string;
}
export interface Group {
  type: "group";
  mode: "and" | "or" | "not";
  children: FilterNode[];
}
export type FilterNode = Rule | Group;
export interface SortRule {
  prop: string;
  dir: "asc" | "desc";
}
export interface Settings {
  title: string;
  filter: Group;
  sorts: SortRule[];
  query: string;
  open: string[];
}

export const defaults = (): Settings => ({
  title: "", // pane heading; falls back to "Backlinks" or "Query"
  filter: { type: "group", mode: "and", children: [] },
  sorts: [{ prop: "file.name", dir: "asc" }],
  query: "", // optional Dataview query that supplies the notes instead of backlinks
  open: [], // paths of expanded cards, most recent first (at most MAX_OPEN_SAVED)
});
export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** One `backlinks:` entry as read from frontmatter. */
export interface Entry {
  cfg: Settings;
  raw: Record<string, unknown> | null; // the entry as written (kept so unknown keys survive a write)
  errors: string[]; // why parts of it couldn't be read; any error blocks writes for the note
  src: number | null; // index in the list it was read from (null: added in this session)
}

/** frontmatter key → the Settings field it holds */
export const KEYS: [string, keyof Settings][] = [
  ["title", "title"],
  ["filter", "filter"],
  ["sort", "sorts"],
  ["query", "query"],
  ["open", "open"],
];

export interface PropDef {
  id: string;
  label: string;
  type: PropType;
  group: "file" | "note";
}
export const FILE_PROPS: PropDef[] = [
  { id: "file.name", label: "name", type: "text", group: "file" },
  { id: "file.path", label: "path", type: "text", group: "file" },
  { id: "file.folder", label: "folder", type: "text", group: "file" },
  { id: "file.ext", label: "extension", type: "text", group: "file" },
  { id: "file.ctime", label: "created time", type: "date", group: "file" },
  { id: "file.mtime", label: "modified time", type: "date", group: "file" },
  { id: "file.size", label: "size", type: "number", group: "file" },
  { id: "file.tags", label: "tags", type: "list", group: "file" },
];

export const OPS: Record<PropType, string[]> = {
  text: ["is", "is not", "contains", "does not contain", "starts with", "ends with", "is empty", "is not empty"],
  number: ["=", "≠", "<", "≤", ">", "≥", "is empty", "is not empty"],
  date: ["is", "is not", "before", "after", "on or before", "on or after", "is empty", "is not empty"],
  boolean: ["is true", "is false", "is empty", "is not empty"],
  list: ["contains", "does not contain", "is empty", "is not empty"],
};
export const NO_VALUE = new Set(["is empty", "is not empty", "is true", "is false"]);
/** Order in which a type is guessed from an operator when the property's own type doesn't fit it. */
export const OP_TYPE_ORDER: PropType[] = ["number", "text", "date", "list", "boolean"];

export function dirLabels(t: PropType): [string, string] {
  if (t === "number") return ["1 → 9", "9 → 1"];
  if (t === "date") return ["Old → New", "New → Old"];
  if (t === "boolean") return ["False → True", "True → False"];
  return ["A → Z", "Z → A"];
}

// ---------- reading / writing the `backlinks` frontmatter list (pure, unit-tested) ----------

export function parseList(raw: unknown): { entries: Entry[]; error: string } {
  if (raw === null || raw === undefined) return { entries: [], error: "" };
  const arr = Array.isArray(raw) ? raw : isPlainObject(raw) ? [raw] : null;
  if (!arr) return { entries: [], error: "The `backlinks` property isn't a list of panes" };
  return { entries: arr.map((e, i) => ({ ...parseEntry(e), src: i })), error: "" };
}

/** A JSON string (current format) or an already-parsed value (hand-written YAML); undefined if absent. */
export function jsonField(v: unknown, name: string, errors: string[]): unknown {
  if (v === null || v === undefined || v === "") return undefined;
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    errors.push(`\`${name}\` isn't valid JSON`);
    return undefined;
  }
}

export function parseEntry(e: unknown): Omit<Entry, "src"> {
  const cfg = defaults();
  const errors: string[] = [];
  if (e === null || e === undefined) return { cfg, raw: null, errors };
  if (!isPlainObject(e))
    return { cfg, raw: null, errors: ["the entry isn't a set of pane keys (title, filter, sort, query, open)"] };
  const r = e;
  if (typeof r.title === "string" || typeof r.title === "number") cfg.title = String(r.title).trim();
  else if (r.title != null) errors.push("`title` isn't text");
  const fv = jsonField(r.filter, "filter", errors);
  if (fv !== undefined) {
    const g = sanitizeGroup(fv);
    if (g) cfg.filter = g;
    else errors.push("`filter` isn't a filter group");
  }
  const sv = jsonField(r.sort, "sort", errors);
  if (sv !== undefined) {
    if (Array.isArray(sv) && sv.every((x: any) => x && typeof x.prop === "string")) {
      cfg.sorts = sv.map((x: any): SortRule => ({ prop: x.prop, dir: x.dir === "desc" ? "desc" : "asc" }));
    } else errors.push("`sort` isn't a list of sort rules");
  }
  if (typeof r.query === "string") cfg.query = r.query.trim();
  else if (r.query != null) errors.push("`query` isn't text");
  const ov = jsonField(r.open, "open", errors);
  if (ov !== undefined) {
    if (Array.isArray(ov)) {
      cfg.open = [...new Set(ov.filter((x: unknown): x is string => typeof x === "string" && x !== ""))].slice(
        0,
        MAX_OPEN_SAVED,
      );
    } else errors.push("`open` isn't a list of paths");
  }
  return { cfg, raw: r, errors };
}

/** null if `x` (or anything inside it) isn't a valid filter group, so nothing is silently dropped. */
export function sanitizeGroup(x: any): Group | null {
  if (!x || typeof x !== "object" || !Array.isArray(x.children)) return null;
  if (x.mode !== undefined && x.mode !== "and" && x.mode !== "or" && x.mode !== "not") return null;
  const children: FilterNode[] = [];
  for (const c of x.children) {
    if (Array.isArray(c?.children)) {
      const g = sanitizeGroup(c);
      if (!g) return null;
      children.push(g);
    } else if (typeof c?.prop === "string" && typeof c?.op === "string") {
      children.push({ type: "rule", prop: c.prop, op: c.op, value: String(c.value ?? "") });
    } else return null;
  }
  return { type: "group", mode: x.mode ?? "and", children };
}

export function listJson(entries: Entry[]): string {
  return JSON.stringify(entries.map(e => [e.cfg, e.errors]));
}

/**
 * Three-way merge of this view's panes (`ours`) with the list on disk, against the list this view last
 * saw (`base`). Keys changed here win; everything else comes from disk. If both sides added or removed
 * panes, ours wins.
 */
export function merge(base: Entry[], ours: Entry[], disk: Entry[]): Entry[] {
  const fromDisk = (o: Entry): Entry => {
    const d = o.src !== null ? disk[o.src] : undefined;
    return { ...o, raw: d ? d.raw : o.raw };
  };
  if (listJson(disk) === listJson(base)) return ours.map(fromDisk);
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const oursStructural = ours.length !== base.length || ours.some((o, i) => o.src !== i);
  if (!oursStructural) {
    return disk.map((d, i) => {
      const o = ours[i],
        b = base[i];
      if (!o || !b) return d;
      const cfg = clone(d.cfg);
      for (const [, f] of KEYS) if (!same(o.cfg[f], b.cfg[f])) (cfg as any)[f] = clone(o.cfg[f]);
      return { cfg, raw: d.raw, errors: [], src: i };
    });
  }
  if (disk.length === base.length) return ours.map(fromDisk); // only we changed the structure
  console.warn("[backlinks-full-view] panes were added or removed both here and in the file; keeping this view's list");
  return ours.map(o => ({ ...o, src: null }));
}

/** The frontmatter value for one entry. Unchanged keys keep the user's own spelling; unknown keys are kept. */
export function serializeEntry(e: Entry): Record<string, unknown> {
  const def = defaults();
  const c = e.cfg;
  const vals: Record<string, unknown> = {
    title: c.title || null,
    filter: JSON.stringify(c.filter) === JSON.stringify(def.filter) ? null : JSON.stringify(c.filter),
    sort: JSON.stringify(c.sorts) === JSON.stringify(def.sorts) ? null : JSON.stringify(c.sorts),
    query: c.query || null,
    open: c.open.length ? [...c.open] : null,
  };
  if (!e.raw) return vals; // a new pane: every key, as before
  const was = parseEntry(e.raw).cfg;
  const out: Record<string, unknown> = { ...e.raw };
  for (const [k, f] of KEYS) {
    if (k in e.raw && JSON.stringify(was[f]) === JSON.stringify(c[f])) continue;
    if (vals[k] === null) {
      // cleared: remove the key rather than writing `key: null`
      delete out[k];
      continue;
    }
    out[k] = vals[k];
  }
  return out;
}
