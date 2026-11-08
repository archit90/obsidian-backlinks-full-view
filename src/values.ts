// Reading property values: anything to strings, relative dates, a note's content properties.
import { CONFIG_KEYS } from "./constants";

export function toStrings(v: unknown): string[] {
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) return v.flatMap(toStrings);
  if (typeof v === "object") return [JSON.stringify(v)];
  return [String(v)];
}
export const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

export const pad = (n: number) => String(n).padStart(2, "0");
export const localIso = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export function normDate(s: string): string {
  const t = s.trim().toLowerCase();
  const m = /^(today|yesterday|tomorrow)?\s*(?:([+-])\s*(\d+)\s*d)?$/.exec(t);
  if (m && (m[1] || m[2])) {
    const d = new Date();
    if (m[1] === "yesterday") d.setDate(d.getDate() - 1);
    if (m[1] === "tomorrow") d.setDate(d.getDate() + 1);
    if (m[2]) d.setDate(d.getDate() + (m[2] === "-" ? -1 : 1) * Number(m[3]));
    return localIso(d.getTime()).slice(0, 10);
  }
  return t.slice(0, 10);
}
export const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

/** The frontmatter keys that are the note's content (in their order): the plugin's own keys left out. */
export function contentKeys(fm: Record<string, unknown> | null | undefined): string[] {
  return Object.keys(fm ?? {}).filter(k => !CONFIG_KEYS.has(k));
}

/** What search and filters read of a note's properties. */
export interface NoteProps {
  props: Record<string, string[]>; // lower-cased key -> values
  labels: Record<string, string>; // lower-cased key -> key as written
  lists: Set<string>; // lower-cased keys whose value is an array
}

/** A note's content properties as strings, keyed by lower-cased name (the first spelling labels it). */
export function noteProps(fm: Record<string, unknown> | null | undefined): NoteProps {
  const props: Record<string, string[]> = {};
  const labels: Record<string, string> = {};
  const lists = new Set<string>();
  for (const k of contentKeys(fm)) {
    const v = fm?.[k];
    const lk = k.toLowerCase();
    props[lk] = toStrings(v);
    if (!(lk in labels)) labels[lk] = k;
    if (Array.isArray(v)) lists.add(lk);
  }
  return { props, labels, lists };
}

/** A note's text without its frontmatter block (`fmEnd`: where the block ends, from the metadata cache). */
export function noteBody(text: string, fmEnd: number | undefined): string {
  return fmEnd !== undefined && fmEnd > 0 && fmEnd <= text.length ? text.slice(fmEnd) : text;
}
