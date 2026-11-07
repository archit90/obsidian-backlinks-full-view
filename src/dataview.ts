// Reading the notes out of a Dataview query result (no app access, so it can be unit-tested).
// Dataview's result values are untyped JSON-like data: everything is `unknown` and narrowed as it's read.

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null;
const valuesOf = (v: unknown): unknown[] => (isObj(v) && Array.isArray(v.values) ? v.values : []);
const meaning = (v: Obj, key: string) => {
  const m = v[key];
  return isObj(m) ? m.type : undefined;
};

/**
 * The paths of the notes a Dataview query result lists: a TABLE's first column (all columns when grouped),
 * a LIST's items (and grouped values), TASK items' files, CALENDAR links. Not checked against the vault.
 */
export function notePathsInResult(val: unknown): Set<string> {
  const paths = new Set<string>();
  const walk = (v: unknown, depth: number) => {
    if (!isObj(v) || depth > 5) return;
    if (typeof v.path === "string") {
      paths.add(v.path);
      return;
    } // Link / task
    if (isObj(v.file) && typeof v.file.path === "string") {
      paths.add(v.file.path);
      return;
    } // page object
    if (Array.isArray(v)) {
      for (const x of v) walk(x, depth + 1);
      return;
    }
    if (Array.isArray(v.values)) {
      for (const x of v.values) walk(x, depth + 1);
      return;
    } // DataArray / result
    if (Object.getPrototypeOf(v) === Object.prototype) for (const x of Object.values(v)) walk(x, depth + 1);
  };
  const values = valuesOf(val);
  const type = isObj(val) ? val.type : undefined;
  switch (type) {
    case "table": {
      const grouped = isObj(val) && meaning(val, "idMeaning") === "group";
      for (const row of values) walk(grouped ? row : Array.isArray(row) ? row[0] : row, 0);
      break;
    }
    case "list": {
      const grouped = isObj(val) && meaning(val, "primaryMeaning") === "group";
      for (const x of values) {
        if (isObj(x) && x.$widget === "dataview:list-pair") {
          walk(x.key, 0);
          if (grouped) walk(x.value, 0);
        } else walk(x, 0);
      }
      break;
    }
    case "calendar":
      for (const x of values) walk(isObj(x) ? x.link : undefined, 0);
      break;
    default:
      walk(isObj(val) ? (val.values ?? val) : val, 0);
  }
  return paths;
}

/** How many rows (items, table rows, tasks…) a Dataview query result has; 0 for a result that isn't one. */
export function resultRowCount(val: unknown): number {
  return valuesOf(val).length;
}
