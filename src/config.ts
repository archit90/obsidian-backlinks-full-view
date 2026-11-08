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
/** One pane's own settings: what a `backlinks` entry holds. */
export interface PaneConfig {
  title: string;
  filter: Group;
  sorts: SortRule[];
  query: string;
}

export const defaults = (): PaneConfig => ({
  title: "", // pane heading; falls back to "Backlinks" or "Query"
  filter: { type: "group", mode: "and", children: [] },
  sorts: [{ prop: "file.name", dir: "asc" }],
  query: "", // optional Dataview query that supplies the notes instead of backlinks
});
export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** One `backlinks:` entry as read from frontmatter. */
export interface Entry {
  cfg: PaneConfig;
  raw: Record<string, unknown> | null; // the entry as written (kept so unknown keys survive a write)
  errors: string[]; // why parts of it couldn't be read; any error blocks writes for the note
  src: number | null; // index in the list it was read from (null: added in this session)
}

/** frontmatter key → the PaneConfig field it holds */
export const KEYS: [string, keyof PaneConfig][] = [
  ["title", "title"],
  ["filter", "filter"],
  ["sort", "sorts"],
  ["query", "query"],
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
    return { cfg, raw: null, errors: ["the entry isn't a set of pane keys (title, filter, sort, query)"] };
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
    const isRule = (x: unknown): x is { prop: string; dir?: unknown } => isPlainObject(x) && typeof x.prop === "string";
    if (Array.isArray(sv) && sv.every(isRule)) {
      cfg.sorts = sv.map((x): SortRule => ({ prop: x.prop, dir: x.dir === "desc" ? "desc" : "asc" }));
    } else errors.push("`sort` isn't a list of sort rules");
  }
  if (typeof r.query === "string") cfg.query = r.query.trim();
  else if (r.query != null) errors.push("`query` isn't text");
  // `open` (expanded cards, per pane) is an older format: read by legacyOpen, dropped on the next write
  return { cfg, raw: r, errors };
}

/** null if `x` (or anything inside it) isn't a valid filter group, so nothing is silently dropped. */
export function sanitizeGroup(x: unknown): Group | null {
  if (!isPlainObject(x) || !Array.isArray(x.children)) return null;
  const mode = x.mode ?? "and";
  if (mode !== "and" && mode !== "or" && mode !== "not") return null;
  const children: FilterNode[] = [];
  for (const c of x.children as unknown[]) {
    if (isPlainObject(c) && Array.isArray(c.children)) {
      const g = sanitizeGroup(c);
      if (!g) return null;
      children.push(g);
    } else if (isPlainObject(c) && typeof c.prop === "string" && typeof c.op === "string") {
      children.push({ type: "rule", prop: c.prop, op: c.op, value: String(c.value ?? "") });
    } else return null;
  }
  return { type: "group", mode, children };
}

/** Number of rules in a filter group, nested groups included. */
export function countRules(g: Group): number {
  return g.children.reduce((n, c) => n + (c.type === "group" ? countRules(c) : 1), 0);
}

export function listJson(entries: Entry[]): string {
  return JSON.stringify(entries.map(e => [e.cfg, e.errors]));
}

/** `to[f] = clone(from[f])` for one PaneConfig field, keeping the field's own type. */
function copyField<K extends keyof PaneConfig>(to: PaneConfig, from: PaneConfig, f: K) {
  to[f] = clone(from[f]);
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const changedHere = (o: Entry, b: Entry) => KEYS.some(([, f]) => !sameJson(o.cfg[f], b.cfg[f]));

/**
 * Which entry of `disk` each entry of `base` is now (-1: gone from the file). Identical panes match first (the
 * nearest one when there are several), then panes with the same title (when it's the only one left with it), then
 * the rest in order when as many are left on both sides: panes edited in place.
 */
export function matchEntries(base: Entry[], disk: Entry[]): number[] {
  const match = base.map(() => -1);
  const used = new Set<number>();
  const take = (i: number, j: number) => {
    match[i] = j;
    used.add(j);
  };
  base.forEach((b, i) => {
    let best = -1;
    disk.forEach((d, j) => {
      if (used.has(j) || !sameJson(d.cfg, b.cfg)) return;
      if (best < 0 || Math.abs(j - i) < Math.abs(best - i)) best = j;
    });
    if (best >= 0) take(i, best);
  });
  const rest = () => ({
    base: base.map((_, i) => i).filter(i => match[i] < 0),
    disk: disk.map((_, j) => j).filter(j => !used.has(j)),
  });
  const titled = rest();
  for (const i of titled.base) {
    const t = base[i].cfg.title;
    if (!t || titled.base.filter(k => base[k].cfg.title === t).length > 1) continue;
    const js = titled.disk.filter(j => disk[j].cfg.title === t);
    if (js.length === 1 && !used.has(js[0])) take(i, js[0]);
  }
  const left = rest();
  if (left.base.length === left.disk.length) left.base.forEach((i, k) => take(i, left.disk[k]));
  return match;
}

/**
 * Three-way merge of this view's panes (`ours`, each `src` an index into `base`) with the list on disk, against the
 * list this view last read or wrote (`base`). Panes are matched between `base` and the file by `matchEntries`.
 * - A pane kept here and still in the file: per key, a change made here wins, else the file's value; unknown keys
 *   come from the file.
 * - A pane removed here is removed from the file too.
 * - A pane removed in the file stays removed, unless it was edited here: then the edit is kept.
 * - Panes added here and panes added in the file are all kept. The file's order is kept, and a pane added here
 *   goes after the pane it follows here.
 */
export function merge(base: Entry[], ours: Entry[], disk: Entry[]): Entry[] {
  if (listJson(disk) === listJson(base)) {
    // only this view changed the list: ours, with the file's spelling and unknown keys
    return ours.map(o => {
      const d = o.src !== null ? disk[o.src] : undefined;
      return { ...o, raw: d ? d.raw : o.raw };
    });
  }
  const match = matchEntries(base, disk);
  const merged = new Map<number, Entry>(); // disk index -> the pane kept here, merged
  const removedHere = new Set<number>(); // disk indexes of panes removed here
  const lead: Entry[] = []; // panes of ours without a place in the file, before any that has one
  const after = new Map<number, Entry[]>(); // ... and those following the pane at a disk index
  base.forEach((_, i) => {
    if (match[i] >= 0 && !ours.some(o => o.src === i)) removedHere.add(match[i]);
  });
  let anchor = -1;
  for (const o of ours) {
    const b = o.src !== null ? base[o.src] : undefined;
    const j = o.src !== null ? (match[o.src] ?? -1) : -1;
    if (b && j >= 0) {
      const d = disk[j];
      const cfg = clone(d.cfg);
      for (const [, f] of KEYS) if (!sameJson(o.cfg[f], b.cfg[f])) copyField(cfg, o.cfg, f);
      merged.set(j, { cfg, raw: d.raw, errors: [], src: j });
      anchor = j;
      continue;
    }
    if (b && !changedHere(o, b)) continue; // removed in the file, untouched here
    const e: Entry = { ...o, errors: [], src: null };
    if (anchor < 0) lead.push(e);
    else after.set(anchor, [...(after.get(anchor) ?? []), e]);
  }
  const out: Entry[] = [...lead];
  disk.forEach((d, j) => {
    if (!removedHere.has(j)) out.push(merged.get(j) ?? { ...d, src: j });
    out.push(...(after.get(j) ?? []));
  });
  return out;
}

/** The frontmatter value for one entry. Unchanged keys keep the user's own spelling; unknown keys are kept. */
export function serializeEntry(e: Entry): Record<string, unknown> {
  const def = defaults();
  const c = e.cfg;
  const vals: Record<string, unknown> = {
    title: c.title || null,
    // a filter without a single rule filters nothing, whatever its groups' modes: cleared
    filter: countRules(c.filter) === 0 ? null : JSON.stringify(c.filter),
    sort: JSON.stringify(c.sorts) === JSON.stringify(def.sorts) ? null : JSON.stringify(c.sorts),
    query: c.query || null,
  };
  if (!e.raw) return Object.fromEntries(Object.entries(vals).filter(([, v]) => v !== null)); // a new pane: set keys only
  const was = parseEntry(e.raw).cfg;
  const out: Record<string, unknown> = { ...e.raw };
  delete out.open; // the older per-pane expanded cards: they live in `backlinks-open` now
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

// ---------- the `backlinks-open` property: expanded cards, one list for the note (pure, unit-tested) ----------

/** Paths as written: strings only, blanks dropped, de-duplicated, at most `max` (most recent first). */
function cleanPaths(v: unknown[], max: number): string[] {
  return [...new Set(v.filter((x: unknown): x is string => typeof x === "string" && x !== ""))].slice(0, max);
}

/** The `backlinks-open` value: a list of paths (a single path is accepted too); error when it's neither. */
export function parseOpen(raw: unknown, max: number): { paths: string[]; error: string } {
  if (raw === null || raw === undefined || raw === "") return { paths: [], error: "" };
  if (typeof raw === "string") return { paths: cleanPaths([raw], max), error: "" };
  if (!Array.isArray(raw)) return { paths: [], error: "The `backlinks-open` property isn't a list of paths" };
  return { paths: cleanPaths(raw, max), error: "" };
}

/** Expanded cards in the older format (`open` inside each `backlinks` entry), as one list: first pane first. */
export function legacyOpen(backlinks: unknown, max: number): string[] {
  const arr = Array.isArray(backlinks) ? backlinks : isPlainObject(backlinks) ? [backlinks] : [];
  const all: unknown[] = [];
  for (const e of arr) {
    if (!isPlainObject(e)) continue;
    let v: unknown = e.open;
    if (typeof v === "string") {
      try {
        v = JSON.parse(v);
      } catch {
        continue;
      }
    }
    if (Array.isArray(v)) all.push(...(v as unknown[]));
  }
  return cleanPaths(all, max);
}

/** True when some `backlinks` entry still holds the older `open` key. */
export function hasLegacyOpen(backlinks: unknown): boolean {
  const arr = Array.isArray(backlinks) ? backlinks : isPlainObject(backlinks) ? [backlinks] : [];
  return arr.some(e => isPlainObject(e) && "open" in e);
}

/**
 * Three-way merge of this view's expanded cards (`ours`, most recent first) with the list on disk, against
 * the list this view last saw (`base`): cards expanded here come first, cards collapsed here are dropped,
 * and the rest of the disk list follows.
 */
export function mergeOpen(base: string[], ours: string[], disk: string[], max: number): string[] {
  const same = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify(b);
  if (same(ours, base)) return disk.slice(0, max);
  if (same(disk, base)) return ours.slice(0, max);
  const was = new Set(base),
    now = new Set(ours);
  const added = ours.filter(p => !was.has(p));
  const removed = new Set(base.filter(p => !now.has(p)));
  return cleanPaths([...added, ...ours.filter(p => was.has(p)), ...disk.filter(p => !removed.has(p))], max);
}
