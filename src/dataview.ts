// Reading the notes out of a Dataview query result (no app access, so it can be unit-tested).

/* eslint-disable @typescript-eslint/no-explicit-any -- Dataview's result values are untyped */

/**
 * The paths of the notes a Dataview query result lists: a TABLE's first column (all columns when grouped),
 * a LIST's items (and grouped values), TASK items' files, CALENDAR links. Not checked against the vault.
 */
export function notePathsInResult(val: any): Set<string> {
  const paths = new Set<string>();
  const walk = (v: any, depth: number) => {
    if (v == null || depth > 5 || typeof v !== "object") return;
    if (typeof v.path === "string") {
      paths.add(v.path);
      return;
    } // Link / task
    if (typeof v.file?.path === "string") {
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
  const values: any[] = Array.isArray(val?.values) ? val.values : [];
  switch (val?.type) {
    case "table": {
      const grouped = val.idMeaning?.type === "group";
      for (const row of values) walk(grouped ? row : Array.isArray(row) ? row[0] : row, 0);
      break;
    }
    case "list": {
      const grouped = val.primaryMeaning?.type === "group";
      for (const x of values) {
        if (x?.$widget === "dataview:list-pair") {
          walk(x.key, 0);
          if (grouped) walk(x.value, 0);
        } else walk(x, 0);
      }
      break;
    }
    case "calendar":
      for (const x of values) walk(x?.link, 0);
      break;
    default:
      walk(val?.values ?? val, 0);
  }
  return paths;
}
