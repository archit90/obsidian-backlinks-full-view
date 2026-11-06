// Reading property values: anything to strings, relative dates.

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
