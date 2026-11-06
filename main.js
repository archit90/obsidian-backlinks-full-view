/*
GENERATED FILE, built by esbuild from src/. Edit the TypeScript sources, not this file.
*/

"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => FullBacklinksPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// src/constants.ts
var PANEL_CLASS = "bfv-panel";
var HOVER_SOURCE = "backlinks-full-view";
var DEFAULT_EMBED_LIMIT = 25;
var MAX_EMBED_DEPTH = 3;
var MAX_OPEN_SAVED = 50;
var CONFIG_SAVE_DELAY = 600;
var OPEN_SAVE_DELAY = 5e3;
var REFRESH_DELAY = 300;
var CARD_RERENDER_DELAY = 500;
var SKIP_SELECTOR = "[data-bfv-skip]";

// src/values.ts
function toStrings(v) {
  if (v === null || v === void 0) return [];
  if (Array.isArray(v)) return v.flatMap(toStrings);
  if (typeof v === "object") return [JSON.stringify(v)];
  return [String(v)];
}
var isPlainObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var pad = (n) => String(n).padStart(2, "0");
var localIso = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
function normDate(s) {
  const t = s.trim().toLowerCase();
  const m = /^(today|yesterday|tomorrow)?\s*(?:([+-])\s*(\d+)\s*d)?$/.exec(t);
  if (m && (m[1] || m[2])) {
    const d = /* @__PURE__ */ new Date();
    if (m[1] === "yesterday") d.setDate(d.getDate() - 1);
    if (m[1] === "tomorrow") d.setDate(d.getDate() + 1);
    if (m[2]) d.setDate(d.getDate() + (m[2] === "-" ? -1 : 1) * Number(m[3]));
    return localIso(d.getTime()).slice(0, 10);
  }
  return t.slice(0, 10);
}
var DATE_RE = /^\d{4}-\d{2}-\d{2}/;

// src/config.ts
var defaults = () => ({
  title: "",
  // pane heading; falls back to "Backlinks" or "Query"
  filter: { type: "group", mode: "and", children: [] },
  sorts: [{ prop: "file.name", dir: "asc" }],
  query: "",
  // optional Dataview query that supplies the notes instead of backlinks
  open: []
  // paths of expanded cards, most recent first (at most MAX_OPEN_SAVED)
});
var clone = (v) => JSON.parse(JSON.stringify(v));
var KEYS = [
  ["title", "title"],
  ["filter", "filter"],
  ["sort", "sorts"],
  ["query", "query"],
  ["open", "open"]
];
var FILE_PROPS = [
  { id: "file.name", label: "name", type: "text", group: "file" },
  { id: "file.path", label: "path", type: "text", group: "file" },
  { id: "file.folder", label: "folder", type: "text", group: "file" },
  { id: "file.ext", label: "extension", type: "text", group: "file" },
  { id: "file.ctime", label: "created time", type: "date", group: "file" },
  { id: "file.mtime", label: "modified time", type: "date", group: "file" },
  { id: "file.size", label: "size", type: "number", group: "file" },
  { id: "file.tags", label: "tags", type: "list", group: "file" }
];
var OPS = {
  text: ["is", "is not", "contains", "does not contain", "starts with", "ends with", "is empty", "is not empty"],
  number: ["=", "\u2260", "<", "\u2264", ">", "\u2265", "is empty", "is not empty"],
  date: ["is", "is not", "before", "after", "on or before", "on or after", "is empty", "is not empty"],
  boolean: ["is true", "is false", "is empty", "is not empty"],
  list: ["contains", "does not contain", "is empty", "is not empty"]
};
var NO_VALUE = /* @__PURE__ */ new Set(["is empty", "is not empty", "is true", "is false"]);
var OP_TYPE_ORDER = ["number", "text", "date", "list", "boolean"];
function dirLabels(t) {
  if (t === "number") return ["1 \u2192 9", "9 \u2192 1"];
  if (t === "date") return ["Old \u2192 New", "New \u2192 Old"];
  if (t === "boolean") return ["False \u2192 True", "True \u2192 False"];
  return ["A \u2192 Z", "Z \u2192 A"];
}
function parseList(raw) {
  if (raw === null || raw === void 0) return { entries: [], error: "" };
  const arr = Array.isArray(raw) ? raw : isPlainObject(raw) ? [raw] : null;
  if (!arr) return { entries: [], error: "The `backlinks` property isn't a list of panes" };
  return { entries: arr.map((e, i) => ({ ...parseEntry(e), src: i })), error: "" };
}
function jsonField(v, name, errors) {
  if (v === null || v === void 0 || v === "") return void 0;
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    errors.push(`\`${name}\` isn't valid JSON`);
    return void 0;
  }
}
function parseEntry(e) {
  const cfg = defaults();
  const errors = [];
  if (e === null || e === void 0) return { cfg, raw: null, errors };
  if (!isPlainObject(e))
    return { cfg, raw: null, errors: ["the entry isn't a set of pane keys (title, filter, sort, query, open)"] };
  const r = e;
  if (typeof r.title === "string" || typeof r.title === "number") cfg.title = String(r.title).trim();
  else if (r.title != null) errors.push("`title` isn't text");
  const fv = jsonField(r.filter, "filter", errors);
  if (fv !== void 0) {
    const g = sanitizeGroup(fv);
    if (g) cfg.filter = g;
    else errors.push("`filter` isn't a filter group");
  }
  const sv = jsonField(r.sort, "sort", errors);
  if (sv !== void 0) {
    if (Array.isArray(sv) && sv.every((x) => x && typeof x.prop === "string")) {
      cfg.sorts = sv.map((x) => ({ prop: x.prop, dir: x.dir === "desc" ? "desc" : "asc" }));
    } else errors.push("`sort` isn't a list of sort rules");
  }
  if (typeof r.query === "string") cfg.query = r.query.trim();
  else if (r.query != null) errors.push("`query` isn't text");
  const ov = jsonField(r.open, "open", errors);
  if (ov !== void 0) {
    if (Array.isArray(ov)) {
      cfg.open = [...new Set(ov.filter((x) => typeof x === "string" && x !== ""))].slice(
        0,
        MAX_OPEN_SAVED
      );
    } else errors.push("`open` isn't a list of paths");
  }
  return { cfg, raw: r, errors };
}
function sanitizeGroup(x) {
  if (!x || typeof x !== "object" || !Array.isArray(x.children)) return null;
  if (x.mode !== void 0 && x.mode !== "and" && x.mode !== "or" && x.mode !== "not") return null;
  const children = [];
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
function listJson(entries) {
  return JSON.stringify(entries.map((e) => [e.cfg, e.errors]));
}
function merge(base, ours, disk) {
  const fromDisk = (o) => {
    const d = o.src !== null ? disk[o.src] : void 0;
    return { ...o, raw: d ? d.raw : o.raw };
  };
  if (listJson(disk) === listJson(base)) return ours.map(fromDisk);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const oursStructural = ours.length !== base.length || ours.some((o, i) => o.src !== i);
  if (!oursStructural) {
    return disk.map((d, i) => {
      const o = ours[i], b = base[i];
      if (!o || !b) return d;
      const cfg = clone(d.cfg);
      for (const [, f] of KEYS) if (!same(o.cfg[f], b.cfg[f])) cfg[f] = clone(o.cfg[f]);
      return { cfg, raw: d.raw, errors: [], src: i };
    });
  }
  if (disk.length === base.length) return ours.map(fromDisk);
  console.warn("[backlinks-full-view] panes were added or removed both here and in the file; keeping this view's list");
  return ours.map((o) => ({ ...o, src: null }));
}
function serializeEntry(e) {
  const def = defaults();
  const c = e.cfg;
  const vals = {
    title: c.title || null,
    filter: JSON.stringify(c.filter) === JSON.stringify(def.filter) ? null : JSON.stringify(c.filter),
    sort: JSON.stringify(c.sorts) === JSON.stringify(def.sorts) ? null : JSON.stringify(c.sorts),
    query: c.query || null,
    open: c.open.length ? [...c.open] : null
  };
  if (!e.raw) return vals;
  const was = parseEntry(e.raw).cfg;
  const out = { ...e.raw };
  for (const [k, f] of KEYS) {
    if (k in e.raw && JSON.stringify(was[f]) === JSON.stringify(c[f])) continue;
    if (vals[k] === null && !(k in e.raw)) continue;
    out[k] = vals[k];
  }
  return out;
}

// src/dataview.ts
function notePathsInResult(val) {
  const paths = /* @__PURE__ */ new Set();
  const walk = (v, depth) => {
    if (v == null || depth > 5 || typeof v !== "object") return;
    if (typeof v.path === "string") {
      paths.add(v.path);
      return;
    }
    if (typeof v.file?.path === "string") {
      paths.add(v.file.path);
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) walk(x, depth + 1);
      return;
    }
    if (Array.isArray(v.values)) {
      for (const x of v.values) walk(x, depth + 1);
      return;
    }
    if (Object.getPrototypeOf(v) === Object.prototype) for (const x of Object.values(v)) walk(x, depth + 1);
  };
  const values = Array.isArray(val?.values) ? val.values : [];
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

// src/search.ts
function parseSearch(q) {
  const toks = [];
  const re = /\s*(?:(-?)(\()|(\))|(-?)"([^"]*)"?|(-?)([^\s()"]+))/y;
  let m;
  while (re.lastIndex < q.length && (m = re.exec(q))) {
    if (m[2]) {
      if (m[1]) toks.push("NOT");
      toks.push("(");
    } else if (m[3]) toks.push(")");
    else if (m[5] !== void 0) {
      if (m[5].trim()) {
        if (m[4]) toks.push("NOT");
        toks.push("t:" + m[5].toLowerCase());
      }
    } else if (m[7]) {
      if (m[6]) toks.push("NOT");
      toks.push(["AND", "OR", "NOT"].includes(m[7]) && !m[6] ? m[7] : "t:" + m[7].toLowerCase());
    }
  }
  let i = 0;
  const atom = () => {
    const tk = toks[i];
    if (tk === void 0) return null;
    if (tk === "NOT") {
      i++;
      const c = atom();
      return c ? { t: "not", c } : null;
    }
    if (tk === "(") {
      i++;
      const e = or();
      if (toks[i] === ")") i++;
      return e;
    }
    if (tk.startsWith("t:")) {
      i++;
      return { t: "term", v: tk.slice(2) };
    }
    return null;
  };
  const and = () => {
    const c = [];
    while (i < toks.length && toks[i] !== "OR" && toks[i] !== ")") {
      if (toks[i] === "AND") {
        i++;
        continue;
      }
      const a = atom();
      if (a) c.push(a);
      else if (toks[i] !== "OR" && toks[i] !== ")") i++;
    }
    return c.length === 0 ? null : c.length === 1 ? c[0] : { t: "and", c };
  };
  const or = () => {
    const c = [];
    for (; ; ) {
      const a = and();
      if (a) c.push(a);
      if (toks[i] === "OR") {
        i++;
        continue;
      }
      break;
    }
    return c.length === 0 ? null : c.length === 1 ? c[0] : { t: "or", c };
  };
  const out = [];
  while (i < toks.length) {
    const e = or();
    if (e) out.push(e);
    if (toks[i] === ")") i++;
  }
  return out.length === 0 ? null : out.length === 1 ? out[0] : { t: "and", c: out };
}
function evalSearch(n, has) {
  switch (n.t) {
    case "term":
      return has(n.v);
    case "not":
      return !evalSearch(n.c, has);
    case "and":
      return n.c.every((c) => evalSearch(c, has));
    case "or":
      return n.c.some((c) => evalSearch(c, has));
  }
}

// src/main.ts
var FullBacklinksPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.views = /* @__PURE__ */ new Map();
    this.observed = /* @__PURE__ */ new WeakSet();
    // views whose close tears down their state
    this.roViews = /* @__PURE__ */ new WeakMap();
    this.ro = null;
    // notices a hidden view being shown again
    this.linksResolvedOnce = false;
    // set by the first "resolved" event after the plugin loads
    /** Per-path change counter, bumped on every metadata change, rename or delete. Signatures use it. */
    this.versions = /* @__PURE__ */ new Map();
    this.dvEpoch = 0;
    // bumped on every Dataview index event; query results are cached per epoch
    // what the next refresh has to look at
    this.pendingAll = false;
    this.pendingLayout = false;
    this.pendingPaths = /* @__PURE__ */ new Set();
    this.pendingViews = /* @__PURE__ */ new Set();
    this.pendingDv = false;
    this.queryCache = /* @__PURE__ */ new Map();
    // per refresh cycle
    this.bodies = /* @__PURE__ */ new Map();
    // lower-cased note text for full-text search, shared by panes
    this.fullTextPanes = /* @__PURE__ */ new Set();
    // panes whose full-text search holds bodies
    this.collator = new Intl.Collator(void 0, { numeric: true, sensitivity: "base" });
    this.schedule = () => {
    };
    this.warned = /* @__PURE__ */ new Set();
    // ---------- public API (for DataviewJS) ----------
    //
    //   bfv.embed(dv, dv.pages('#project'));                    // full, collapsible notes
    //   bfv.embed(dv, dv.pages('"Inbox"'), { collapsed: true }); // start collapsed
    //   (bfv is a global alias of app.plugins.plugins["obsidian-backlinks-full-view"].api)
    this.api = {
      embed: (target, pages, opts = {}) => {
        const container = target instanceof HTMLElement ? target : target.container;
        const parentComp = target?.component ?? this;
        const sourcePath = opts.sourcePath ?? target?.currentFilePath ?? "";
        const arr = Array.isArray(pages) ? pages : Array.isArray(pages?.values) ? pages.values : Array.from(pages ?? []);
        const wrap = container.createDiv({ cls: "bfv-embeds" });
        this.wireLinks(wrap);
        const ancestors = /* @__PURE__ */ new Set();
        if (sourcePath) ancestors.add(sourcePath);
        let depth = 0;
        for (let el = container.closest("[data-bfv-path]"); el; el = el.parentElement?.closest("[data-bfv-path]") ?? null) {
          ancestors.add(el.getAttribute("data-bfv-path") ?? "");
          depth++;
        }
        if (depth >= MAX_EMBED_DEPTH) {
          wrap.createDiv({ cls: "bfv-empty", text: "Embed depth limit reached." });
          return wrap;
        }
        const limit = opts.limit ?? DEFAULT_EMBED_LIMIT;
        let total = 0;
        const opened = /* @__PURE__ */ new Set();
        const seen = /* @__PURE__ */ new Set();
        for (const p of arr) {
          const path = typeof p === "string" ? p : p?.file?.path ?? p?.path;
          if (!path) continue;
          const f = this.app.vault.getAbstractFileByPath(path) ?? this.app.metadataCache.getFirstLinkpathDest(path, sourcePath);
          if (!(f instanceof import_obsidian.TFile) || f.extension !== "md" || seen.has(f.path) || ancestors.has(f.path)) continue;
          seen.add(f.path);
          total++;
          if (total > limit) continue;
          if (!opts.collapsed) opened.add(f.path);
          this.buildCard(wrap, f, parentComp, opened);
        }
        if (total > limit) {
          wrap.createDiv({
            cls: "bfv-empty",
            text: `Showing ${limit} of ${total} notes. Pass { limit: N } to show more.`
          });
        }
        if (!total) wrap.createDiv({ cls: "bfv-empty", text: "No notes to embed." });
        return wrap;
      }
    };
  }
  async onload() {
    window.bfv = this.api;
    this.registerHoverLinkSource(HOVER_SOURCE, { display: "Backlinks Full View", defaultMod: true });
    this.addCommand({
      id: "diagnostics",
      name: "Show diagnostics",
      callback: () => new import_obsidian.Notice(this.diagnostics().join("\n"), 12e3)
    });
    for (const m of this.missingApis())
      this.warnOnce("api-" + m, `Obsidian API not available: ${m}. Some features are disabled.`);
    this.schedule = (0, import_obsidian.debounce)(() => this.runRefresh(), REFRESH_DELAY, true);
    this.ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const view = this.roViews.get(e.target);
        if (!view?.file || !view.containerEl.isShown()) continue;
        const vs = this.views.get(view);
        if (!vs || vs.stale) {
          this.pendingViews.add(view);
          this.schedule();
        }
      }
    });
    const layout = () => {
      this.pendingLayout = true;
      this.schedule();
    };
    const touch = (path) => {
      this.versions.set(path, (this.versions.get(path) ?? 0) + 1);
      this.bodies.delete(path);
      this.pendingPaths.add(path);
      this.schedule();
    };
    this.registerEvent(this.app.workspace.on("layout-change", layout));
    this.registerEvent(this.app.workspace.on("file-open", layout));
    this.registerEvent(this.app.workspace.on("active-leaf-change", layout));
    this.registerEvent(this.app.metadataCache.on("changed", (file) => touch(file.path)));
    this.registerEvent(
      this.app.metadataCache.on("resolved", () => {
        if (!this.linksResolvedOnce) {
          this.linksResolvedOnce = true;
          this.pendingAll = true;
        }
        this.schedule();
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (!(file instanceof import_obsidian.TFile)) return;
        for (const vs of this.views.values()) if (vs.notePath === oldPath) vs.notePath = file.path;
        touch(oldPath);
        touch(file.path);
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof import_obsidian.TFile) touch(file.path);
      })
    );
    try {
      const mc = this.app.metadataCache;
      const dvChanged = () => {
        this.dvEpoch++;
        this.pendingDv = true;
        this.schedule();
      };
      this.registerEvent(mc.on("dataview:index-ready", dvChanged));
      this.registerEvent(mc.on("dataview:metadata-change", dvChanged));
    } catch (e) {
      this.warnOnce("dv-events", "Could not subscribe to Dataview events; query panes refresh on note changes only.");
    }
    this.app.workspace.onLayoutReady(() => {
      this.pendingAll = true;
      this.runRefresh();
    });
  }
  onunload() {
    if (window.bfv === this.api) delete window.bfv;
    this.ro?.disconnect();
    for (const view of [...this.views.keys()]) this.destroyView(view);
    this.bodies.clear();
  }
  missingApis() {
    const out = [];
    if (typeof this.app.fileManager?.processFrontMatter !== "function")
      out.push("FileManager.processFrontMatter (saving pane settings)");
    if (typeof import_obsidian.MarkdownRenderer?.render !== "function") out.push("MarkdownRenderer.render (note rendering)");
    return out;
  }
  diagnostics() {
    const lines = ["Backlinks Full View diagnostics"];
    const dv = this.app.plugins?.plugins?.dataview;
    lines.push(
      `Dataview: ${dv ? "v" + (dv.manifest?.version ?? "?") + (typeof dv.api?.query === "function" ? ", query API ok" : ", query API MISSING") : "not enabled"}`
    );
    const missing = this.missingApis();
    lines.push(missing.length ? "Missing Obsidian APIs: " + missing.join("; ") : "Obsidian APIs: ok");
    const view = this.app.workspace.getActiveViewOfType(import_obsidian.MarkdownView);
    if (view) {
      const host = this.getHost(view);
      lines.push(
        `Active note (${view.getMode()}): host ${host ? "found <" + host.className.split(" ")[0] + ">" : "NOT found, using fallback"}`
      );
      const vs = this.views.get(view);
      lines.push(
        vs ? `Panes: ${vs.panes.length} + All backlinks, attached: ${vs.el.isConnected}` : "No panes created for this note yet"
      );
      if (vs?.listError || vs?.panes.some((p) => p.parseErrors.length))
        lines.push("Frontmatter has errors: pane settings aren't saved.");
    } else lines.push("No active note.");
    lines.push(`Note views tracked: ${this.views.size}`);
    return lines;
  }
  /** First sight of a view: tear its state down when it closes (BFV-01) and notice when it's shown again. */
  observeView(view) {
    if (this.observed.has(view)) return;
    this.observed.add(view);
    this.roViews.set(view.containerEl, view);
    this.ro?.observe(view.containerEl);
    view.register(() => {
      this.ro?.unobserve(view.containerEl);
      this.destroyView(view);
    });
  }
  destroyView(view) {
    const vs = this.views.get(view);
    if (!vs) return;
    this.flush(vs);
    vs.observer?.disconnect();
    for (const p of vs.panes) p.component.unload();
    vs.base?.component.unload();
    vs.el.remove();
    this.views.delete(view);
  }
  // ---------- refresh scheduling ----------
  /**
   * One debounced pass over the open note views. A view is rebuilt only when it's new, switched note, was
   * skipped while hidden, or a changed path touches it (its note, one of its sources, or a note that now links
   * to it); query panes re-run only after a Dataview index event. Hidden views are skipped and marked stale.
   */
  runRefresh() {
    const all = this.pendingAll, layout = this.pendingLayout, dv = this.pendingDv;
    const paths = this.pendingPaths, forced = this.pendingViews;
    this.pendingAll = this.pendingLayout = this.pendingDv = false;
    this.pendingPaths = /* @__PURE__ */ new Set();
    this.pendingViews = /* @__PURE__ */ new Set();
    this.queryCache.clear();
    const jobs = [];
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view;
      if (!(view instanceof import_obsidian.MarkdownView)) return;
      this.observeView(view);
      const vs = this.views.get(view);
      if (view.containerEl.closest(SKIP_SELECTOR)) {
        if (vs) this.destroyView(view);
        return;
      }
      if (!view.file) {
        if (vs) this.destroyView(view);
        return;
      }
      if (!view.containerEl.isShown()) {
        if (vs && (all || paths.size || dv || vs.notePath !== view.file.path)) vs.stale = true;
        return;
      }
      if (!vs || all || forced.has(view) || vs.stale || vs.notePath !== view.file.path) {
        jobs.push({ view, needSources: true });
        return;
      }
      if (layout) this.attach(vs, this.hostFor(view));
      if (paths.size && this.affects(vs, paths)) jobs.push({ view, needSources: true });
      else if (dv && vs.panes.some((p) => !p.deferred && p.config.query.trim())) jobs.push({ view, needSources: false });
    });
    if (!jobs.length) return;
    const targets = new Set(jobs.filter((j) => j.needSources).map((j) => j.view.file.path));
    const index = targets.size ? this.backlinkIndex(targets) : null;
    for (const j of jobs) {
      try {
        this.refreshView(j.view, index?.get(j.view.file.path) ?? null);
      } catch (e) {
        console.error("[backlinks-full-view] refresh failed for", j.view.file?.path, e);
      }
    }
  }
  affects(vs, paths) {
    const resolved = this.app.metadataCache.resolvedLinks;
    const note = vs.notePath ?? "";
    for (const p of paths) {
      if (p === note || vs.sourcePaths.has(p) || resolved[p]?.[note]) return true;
      if (vs.panes.some((pane) => pane.items.has(p))) return true;
    }
    return false;
  }
  /** Backlink sources of every target path, in one pass over the resolved-link table. */
  backlinkIndex(targets) {
    const resolved = this.app.metadataCache.resolvedLinks;
    const out = /* @__PURE__ */ new Map();
    for (const t of targets) out.set(t, []);
    const few = targets.size <= 8;
    for (const src in resolved) {
      const links = resolved[src];
      let f;
      const add = (t) => {
        if (t === src) return;
        if (f === void 0) {
          const a = this.app.vault.getAbstractFileByPath(src);
          f = a instanceof import_obsidian.TFile && a.extension === "md" ? a : null;
        }
        if (f) out.get(t).push(f);
      };
      if (few) {
        for (const t of targets) if (links[t]) add(t);
      } else for (const t in links) if (targets.has(t)) add(t);
    }
    return out;
  }
  verOf(path) {
    return this.versions.get(path) ?? 0;
  }
  /**
   * Where to inject the panes, in the view's own mode only (never a nested embed's renderer):
   * - Reading view: the preview renderer's footer section, where core Backlinks puts its in-document list.
   *   It's a section of the renderer, so scrolling/re-rendering keeps it instead of stripping it.
   * - Editing modes: the editor's `.cm-sizer`, so the panes scroll with the note.
   * These are Obsidian internals (checked in 1.15.0); `view.contentEl` is the fallback.
   */
  getHost(view) {
    const el = view.getMode() === "preview" ? view.previewMode?.renderer?.footer?.el : view.editMode?.sizerEl;
    return el instanceof HTMLElement ? el : null;
  }
  hostFor(view) {
    const host = this.getHost(view);
    if (host) return host;
    this.warnOnce(
      "host-" + view.getMode(),
      `Could not find the ${view.getMode()} content container (Obsidian's internals may have changed); falling back to the view's content element.`
    );
    return view.contentEl;
  }
  attach(vs, host) {
    if (vs.el.parentElement === host) return;
    host.appendChild(vs.el);
    vs.host = host;
    this.watchHost(vs, host);
  }
  warnOnce(key, msg) {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    console.warn("[backlinks-full-view] " + msg);
  }
  /** Watch the host so the container is put back if something removes it from there. */
  watchHost(vs, host) {
    vs.observer?.disconnect();
    vs.observer = new MutationObserver(() => {
      if (vs.el.parentElement === host) return;
      const now = Date.now();
      if (now - vs.reattachSince > 3e3) {
        vs.reattachSince = now;
        vs.reattachCount = 0;
      }
      if (++vs.reattachCount > 5) {
        vs.observer?.disconnect();
        this.warnOnce("fight", "The editor keeps removing the backlinks panel; giving up re-attaching.");
        return;
      }
      host.appendChild(vs.el);
    });
    vs.observer.observe(host, { childList: true });
  }
  createViewState(view, host) {
    const el = host.createDiv({ cls: "bfv-container" });
    this.wireLinks(el);
    const warnEl = el.createDiv({ cls: "bfv-config-error bfv-hidden" });
    const addBtn = el.createEl("button", { cls: "bfv-add", text: "+ Add backlinks pane" });
    const vs = {
      view,
      el,
      warnEl,
      addBtn,
      host,
      panes: [],
      base: null,
      notePath: null,
      gen: 0,
      baseList: [],
      savedJson: "",
      prevJson: "",
      listError: "",
      dirty: false,
      configPending: false,
      graceUntil: 0,
      saveSoon: (0, import_obsidian.debounce)(() => this.flush(vs), CONFIG_SAVE_DELAY, true),
      saveLater: (0, import_obsidian.debounce)(() => this.flush(vs), OPEN_SAVE_DELAY, true),
      sources: [],
      sourcePaths: /* @__PURE__ */ new Set(),
      srcSig: "",
      stale: false,
      observer: null,
      reattachCount: 0,
      reattachSince: 0
    };
    this.watchHost(vs, host);
    addBtn.addEventListener("click", () => {
      const pane = this.createPanel(vs, defaults(), null);
      vs.panes.push(pane);
      this.updateTitles(vs);
      pane.el.querySelector(".bfv-header")?.click();
      this.persist(pane);
    });
    return vs;
  }
  updateTitles(vs) {
    vs.panes.forEach((p, i) => {
      const title = p.config.title.trim();
      const base = p.config.query ? "Query" : "Backlinks";
      p.titleEl.setText(title || (vs.panes.length > 1 ? `${base} \xB7 ${i + 1}` : base));
    });
  }
  /** Removes a pane at once and offers an Undo notice that puts it back (no confirm dialog). */
  removePane(vs, st) {
    const i = vs.panes.indexOf(st);
    if (i < 0) return;
    const notePath = vs.notePath, gen = vs.gen;
    const cfg = clone(st.config), raw = st.raw, title = st.titleEl.getText();
    st.component.unload();
    st.el.remove();
    vs.panes.splice(i, 1);
    this.updateTitles(vs);
    this.markDirty(vs);
    const notice = new import_obsidian.Notice(
      createFragment((f) => {
        f.appendText(`Removed pane \u201C${title}\u201D. `);
        f.createEl("button", { text: "Undo" }).addEventListener("click", () => {
          notice.hide();
          if (vs.gen !== gen || vs.notePath !== notePath || !this.views.has(vs.view)) {
            new import_obsidian.Notice("Can't undo: that note is no longer open in the same view.");
            return;
          }
          const pane = this.createPanel(vs, cfg, { raw, src: null, errors: [] });
          const at = Math.min(i, vs.panes.length);
          vs.el.insertBefore(pane.el, vs.panes[at]?.el ?? vs.addBtn);
          vs.panes.splice(at, 0, pane);
          this.updateTitles(vs);
          this.persist(pane);
        });
      }),
      1e4
    );
  }
  refreshView(view, sources) {
    const file = view.file;
    const host = this.hostFor(view);
    let vs = this.views.get(view);
    if (!vs) {
      vs = this.createViewState(view, host);
      this.views.set(view, vs);
    } else this.attach(vs, host);
    vs.stale = false;
    if (!sources && !vs.notePath) sources = this.backlinkIndex(/* @__PURE__ */ new Set([file.path])).get(file.path);
    if (sources) {
      vs.sources = sources;
      vs.sourcePaths = new Set(sources.map((s) => s.path));
      vs.srcSig = sources.map((s) => s.path + ":" + this.verOf(s.path)).join(",");
    }
    const switched = vs.notePath !== file.path;
    this.loadConfig(vs, file);
    if (switched || !vs.base) this.resetBase(vs);
    vs.el.appendChild(vs.addBtn);
    if (vs.el.children[1] !== vs.base.el) vs.warnEl.after(vs.base.el);
    for (const pane of vs.panes) this.refreshPane(pane, file);
    this.refreshPane(vs.base, file);
  }
  /** Refresh one pane now (it was expanded, or its own config changed). */
  updatePane(st) {
    const f = st.view.notePath ? this.app.vault.getAbstractFileByPath(st.view.notePath) : null;
    if (f instanceof import_obsidian.TFile) this.refreshPane(st, f, true);
  }
  refreshPane(st, file, force = false) {
    if (st.dead) return;
    const vs = st.view;
    const q = st.config.query.trim();
    if (st.deferred) {
      st.countEl.setText(q ? "" : String(vs.sources.length));
      return;
    }
    if (st.collapsed && !force) {
      st.stale = true;
      if (!q && !st.search.trim() && !this.countRules(st.config.filter)) st.countEl.setText(String(vs.sources.length));
      return;
    }
    st.stale = false;
    if (!q) {
      st.error = "";
      return this.finishRefresh(st, vs.sources, "B|" + file.path + "|" + vs.srcSig);
    }
    const key = q + "\0" + file.path;
    if (st.queryKey === key && st.queryEpoch === this.dvEpoch && st.queryPaths) return this.finishQuery(st, file, q);
    const id = ++st.reqId;
    const epoch = this.dvEpoch;
    void this.runQueryCached(q, file).then((r) => {
      if (id !== st.reqId || st.dead) return;
      st.queryKey = key;
      st.queryEpoch = epoch;
      st.queryPaths = r.paths;
      st.error = r.error ?? "";
      this.finishQuery(st, file, q);
    });
  }
  finishQuery(st, file, q) {
    const files = [];
    for (const p of st.queryPaths ?? []) {
      const f = this.app.vault.getAbstractFileByPath(p);
      if (f instanceof import_obsidian.TFile && f.extension === "md") files.push(f);
    }
    const sig = "Q|" + q + "|" + st.error + "|" + file.path + "|" + files.map((f) => f.path + ":" + this.verOf(f.path)).join(",");
    this.finishRefresh(st, files, sig);
  }
  runQueryCached(query, origin) {
    const key = query + "\0" + origin.path;
    let p = this.queryCache.get(key);
    if (!p) {
      p = this.runQuery(query, origin);
      this.queryCache.set(key, p);
    }
    return p;
  }
  /**
   * Runs a Dataview query (DQL) and collects the notes it lists: a TABLE's first column (all columns when
   * grouped), a LIST's items (and grouped values), TASK items' files, CALENDAR links.
   */
  async runQuery(query, origin) {
    const dv = this.app.plugins?.plugins?.dataview?.api;
    if (!dv) return { paths: [], error: "Dataview plugin is not installed or enabled." };
    try {
      const res = await dv.query(query, origin.path);
      if (!res?.successful) return { paths: [], error: "Dataview: " + String(res?.error ?? "query failed") };
      const paths = notePathsInResult(res.value);
      const out = [...paths].filter((p) => {
        const f = this.app.vault.getAbstractFileByPath(p);
        return f instanceof import_obsidian.TFile && f.extension === "md";
      });
      return {
        paths: out,
        error: out.length ? void 0 : "The query returned no note links (use LIST or TABLE with file.link)."
      };
    } catch (e) {
      return { paths: [], error: "Dataview: " + String(e?.message ?? e) };
    }
  }
  finishRefresh(st, sources, sig) {
    if (sig === st.signature) return;
    st.signature = sig;
    this.sync(st, sources);
    this.pruneOpen(st);
  }
  /** True once Obsidian's link index covers the whole vault (so missing backlinks really are gone). */
  linksReady() {
    if (this.linksResolvedOnce) return true;
    const resolved = Object.keys(this.app.metadataCache.resolvedLinks).length;
    return resolved > 0 && resolved >= this.app.vault.getMarkdownFiles().length;
  }
  /**
   * Drop remembered cards that are no longer in the pane's results (deleted, renamed, or no longer matching
   * the query), so `open:` only lists existing notes. Skipped while indexes are still loading or the query
   * failed, when an empty or partial result would wrongly wipe the list.
   */
  pruneOpen(st) {
    if (!st.config.open.length || st.error || !this.linksReady()) return;
    if (st.config.query && !this.app.plugins?.plugins?.dataview?.index?.initialized) return;
    const keep = st.config.open.filter((p) => st.items.has(p));
    if (keep.length === st.config.open.length) return;
    const gone = st.config.open.filter((p) => !st.items.has(p));
    for (const p of gone) st.opened.delete(p);
    st.openOrder = st.openOrder.filter((p) => st.items.has(p));
    st.config.open = keep;
    this.persist(st, true);
  }
  // ---------- panel skeleton ----------
  createPanel(vs, config, entry, ephemeral = false) {
    const el = vs.el.createDiv({ cls: PANEL_CLASS });
    vs.el.appendChild(vs.addBtn);
    const component = new import_obsidian.Component();
    component.load();
    const header = el.createDiv({ cls: "bfv-header" });
    const chev = header.createSpan({ cls: "bfv-chevron" });
    const titleEl = header.createSpan({ cls: "bfv-title", text: "Backlinks" });
    const countEl = header.createSpan({ cls: "bfv-count" });
    const rmBtn = header.createEl("button", {
      cls: "bfv-icon-btn bfv-remove",
      text: "\u2715",
      attr: { "aria-label": "Remove this backlinks pane (can be undone)" }
    });
    const warnEl = el.createDiv({ cls: "bfv-config-error bfv-hidden" });
    const body = el.createDiv({ cls: "bfv-body" });
    const bar = body.createDiv({ cls: "bfv-toolbar" });
    const sortBtn = bar.createEl("button", { cls: "bfv-tool-btn" });
    const filterBtn = bar.createEl("button", { cls: "bfv-tool-btn" });
    const searchInput = bar.createEl("input", {
      cls: "bfv-filter",
      type: "text",
      placeholder: 'Search\u2026 (a b, a OR b, NOT a, "a phrase", ( ))',
      attr: {
        title: 'Adjacent words must all match. Use OR, NOT (or -word, -"phrase", -(group)), "quoted phrases" and parentheses; operators in capitals.'
      }
    });
    const ftLabel = bar.createEl("label", {
      cls: "bfv-fulltext",
      attr: { title: "Also search the text of every note in this pane" }
    });
    const ftBox = ftLabel.createEl("input", { type: "checkbox" });
    ftLabel.appendText("Full text");
    const titleInput = body.createEl("input", {
      cls: "bfv-query bfv-title-input",
      type: "text",
      placeholder: "Pane title (optional)"
    });
    titleInput.value = config.title;
    const queryInput = body.createEl("input", {
      cls: "bfv-query",
      type: "text",
      placeholder: 'Dataview query (optional, replaces backlinks) e.g. LIST FROM "Projects" WHERE status = "active"'
    });
    queryInput.value = config.query;
    const sortPanel = body.createDiv({ cls: "bfv-editor bfv-hidden" });
    const filterPanel = body.createDiv({ cls: "bfv-editor bfv-hidden" });
    const listEl = body.createDiv({ cls: "bfv-list" });
    const emptyEl = body.createDiv({ cls: "bfv-empty" });
    const st = {
      el,
      listEl,
      countEl,
      warnEl,
      filterBtn,
      sortBtn,
      filterPanel,
      sortPanel,
      component,
      // every pane starts collapsed and is built on first expand
      signature: "",
      collapsed: true,
      stale: false,
      dead: false,
      ephemeral,
      deferred: true,
      opened: new Set(config.open),
      openOrder: [...config.open].reverse(),
      items: /* @__PURE__ */ new Map(),
      order: [],
      needsSort: true,
      propDefs: [...FILE_PROPS],
      propDefsKey: "",
      types: /* @__PURE__ */ new Map(),
      search: "",
      emptyEl,
      fullText: false,
      searchId: 0,
      titleEl,
      queryInput,
      titleInput,
      reqId: 0,
      queryKey: "",
      queryEpoch: -1,
      queryPaths: null,
      error: "",
      config,
      raw: entry?.raw ?? null,
      srcIndex: entry?.src ?? null,
      parseErrors: entry?.errors ?? [],
      view: vs,
      renderEditors: () => {
        if (!filterPanel.hasClass("bfv-hidden")) this.renderFilterEditor(st);
        if (!sortPanel.hasClass("bfv-hidden")) this.renderSortEditor(st);
      },
      updateButtons: () => {
        const nf = this.countRules(st.config.filter);
        const ns = st.config.sorts.length;
        filterBtn.setText("Filter" + (nf ? ` \xB7 ${nf}` : ""));
        sortBtn.setText("Sort" + (ns ? ` \xB7 ${ns}` : ""));
        filterBtn.toggleClass("is-active", nf > 0);
        sortBtn.toggleClass("is-active", ns > 0);
      }
    };
    this.showPaneErrors(st);
    const applyCollapse = () => {
      el.toggleClass("is-collapsed", st.collapsed);
      chev.setText(st.collapsed ? "\u25B8" : "\u25BE");
    };
    header.addEventListener("click", () => {
      st.collapsed = !st.collapsed;
      applyCollapse();
      if (st.collapsed) {
        this.releaseBodies(st);
        return;
      }
      st.deferred = false;
      this.updatePane(st);
    });
    applyCollapse();
    if (ephemeral) {
      el.addClass("bfv-base");
      rmBtn.remove();
      titleInput.remove();
      queryInput.remove();
    }
    filterBtn.addEventListener("click", () => {
      filterPanel.toggleClass("bfv-hidden", !filterPanel.hasClass("bfv-hidden"));
      st.renderEditors();
    });
    sortBtn.addEventListener("click", () => {
      sortPanel.toggleClass("bfv-hidden", !sortPanel.hasClass("bfv-hidden"));
      st.renderEditors();
    });
    const onSearch = (0, import_obsidian.debounce)(
      () => {
        if (!st.dead) {
          st.search = searchInput.value;
          this.applyView(st);
        }
      },
      150,
      true
    );
    searchInput.addEventListener("input", onSearch);
    ftBox.addEventListener("change", () => {
      st.fullText = ftBox.checked;
      if (!st.fullText) this.releaseBodies(st);
      this.applyView(st);
    });
    const onQuery = (0, import_obsidian.debounce)(
      () => {
        if (!st.dead) this.updatePane(st);
      },
      600,
      true
    );
    queryInput.addEventListener("input", () => {
      st.config.query = queryInput.value.trim();
      this.persist(st);
      this.updateTitles(st.view);
      onQuery();
    });
    titleInput.addEventListener("input", () => {
      st.config.title = titleInput.value.trim();
      this.persist(st);
      this.updateTitles(st.view);
    });
    rmBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.removePane(vs, st);
    });
    component.register(() => {
      st.dead = true;
      onQuery.cancel();
      onSearch.cancel();
      this.releaseBodies(st);
    });
    st.updateButtons();
    return st;
  }
  showPaneErrors(st) {
    const errs = st.parseErrors;
    st.warnEl.toggleClass("bfv-hidden", errs.length === 0);
    st.warnEl.setText(
      errs.length ? `\u26A0 Couldn't read this pane's frontmatter: ${errs.join("; ")}. Changes to this note's panes aren't saved until it's fixed.` : ""
    );
  }
  showViewErrors(vs) {
    const bad = vs.listError || vs.panes.some((p) => p.parseErrors.length);
    vs.warnEl.toggleClass("bfv-hidden", !bad);
    vs.warnEl.setText(
      vs.listError ? `\u26A0 ${vs.listError}. Pane settings for this note aren't saved until it's fixed.` : bad ? "\u26A0 A pane below has frontmatter errors; pane settings for this note aren't saved until they're fixed." : ""
    );
  }
  // ---------- config editing UI ----------
  /**
   * Mark a pane's settings as changed and schedule a frontmatter write (never for the built-in pane).
   * `openOnly`: just the expanded-cards list changed, which is written after a long delay.
   */
  persist(st, openOnly = false) {
    if (st.ephemeral || st.dead) return;
    this.markDirty(st.view, openOnly);
  }
  markDirty(vs, openOnly = false) {
    vs.dirty = true;
    if (openOnly && !vs.configPending) {
      vs.saveLater();
      return;
    }
    vs.configPending = true;
    vs.saveLater.cancel();
    vs.saveSoon();
  }
  /** Write pending edits now. */
  flush(vs) {
    vs.saveSoon.cancel();
    vs.saveLater.cancel();
    vs.configPending = false;
    void this.writeConfig(vs);
  }
  /** (Re)creates the built-in "All backlinks" pane (shown first): collapsed, unsaved, built on first expand. */
  resetBase(vs) {
    if (vs.base) {
      vs.base.component.unload();
      vs.base.el.remove();
    }
    vs.base = this.createPanel(vs, defaults(), null, true);
    vs.base.titleEl.setText("All backlinks");
  }
  /** Called after any filter/sort edit. structural=true re-renders editors (including the source). */
  configChanged(st, structural) {
    this.persist(st);
    st.updateButtons();
    if (structural) st.renderEditors();
    this.applyView(st);
  }
  // ---------- persistence in the note's frontmatter ----------
  //
  // backlinks:
  //   - title: Logs
  //     filter: '<one-line JSON>'
  //     sort: '<one-line JSON>'
  //     query: 'LIST FROM ...'
  //     open: [paths of expanded cards]
  //
  // Writes are skipped when nothing would change, refused while any entry can't be read, keep unknown keys
  // and values the user wrote in another accepted form, and merge with whatever is on disk at write time.
  hasErrors(vs) {
    return !!vs.listError || vs.baseList.some((e) => e.errors.length > 0);
  }
  loadConfig(vs, file) {
    const switched = vs.notePath !== file.path;
    if (switched && vs.notePath !== null) {
      this.flush(vs);
      vs.gen++;
      vs.graceUntil = 0;
    }
    const parsed = parseList(this.app.metadataCache.getFileCache(file)?.frontmatter?.backlinks);
    const json = listJson(parsed.entries);
    if (!switched) {
      if (json === vs.savedJson && parsed.error === vs.listError) {
        vs.baseList = parsed.entries;
        if (!vs.dirty)
          vs.panes.forEach((p, i) => {
            p.raw = parsed.entries[i]?.raw ?? p.raw;
            p.srcIndex = i;
          });
        return;
      }
      if (Date.now() < vs.graceUntil && json === vs.prevJson) return;
      const readable = !parsed.error && !parsed.entries.some((e) => e.errors.length) && !this.hasErrors(vs);
      if (vs.dirty && readable) {
        this.flush(vs);
        return;
      }
    }
    vs.notePath = file.path;
    vs.listError = parsed.error;
    vs.dirty = false;
    if (switched) {
      for (const p of vs.panes) {
        p.component.unload();
        p.el.remove();
      }
      vs.panes = [];
    }
    this.applyEntries(vs, parsed.entries, switched);
  }
  /** Make the panes match a list read from (or just written to) the frontmatter, reusing existing panes. */
  applyEntries(vs, entries, fresh) {
    vs.baseList = entries;
    vs.savedJson = vs.prevJson = listJson(entries);
    while (vs.panes.length > entries.length) {
      const p = vs.panes.pop();
      p.component.unload();
      p.el.remove();
    }
    entries.forEach((e, i) => {
      const cfg = clone(e.cfg);
      const p = vs.panes[i];
      if (p) {
        p.config = cfg;
        p.raw = e.raw;
        p.srcIndex = e.src;
        p.parseErrors = e.errors;
        p.queryInput.value = cfg.query;
        p.titleInput.value = cfg.title;
        this.showPaneErrors(p);
        this.syncOpen(p);
        p.updateButtons();
        if (!fresh) {
          p.renderEditors();
          this.applyView(p);
        }
      } else {
        vs.panes.push(this.createPanel(vs, cfg, e));
      }
    });
    this.updateTitles(vs);
    this.showViewErrors(vs);
  }
  async writeConfig(vs) {
    if (!vs.dirty) return;
    vs.dirty = false;
    const path = vs.notePath, gen = vs.gen;
    const file = path ? this.app.vault.getAbstractFileByPath(path) : null;
    if (!(file instanceof import_obsidian.TFile)) return;
    if (typeof this.app.fileManager?.processFrontMatter !== "function") return;
    if (this.hasErrors(vs)) return;
    const base = vs.baseList;
    const ours = vs.panes.map((p) => ({ cfg: clone(p.config), raw: p.raw, errors: [], src: p.srcIndex }));
    const cachedRaw = this.app.metadataCache.getFileCache(file)?.frontmatter?.backlinks;
    const cached = parseList(cachedRaw);
    if (cached.error || cached.entries.some((e) => e.errors.length)) return;
    const planned = merge(base, ours, cached.entries);
    const plannedOut = planned.map((e) => serializeEntry(e));
    if (JSON.stringify(plannedOut) === JSON.stringify(cachedRaw ?? [])) {
      this.afterWrite(vs, gen, planned, ours);
      return;
    }
    let written = planned;
    vs.prevJson = vs.savedJson;
    vs.savedJson = listJson(planned);
    vs.baseList = planned;
    vs.graceUntil = Date.now() + 1500;
    try {
      await this.app.fileManager.processFrontMatter(file, (fm) => {
        const disk = parseList(fm.backlinks);
        if (disk.error || disk.entries.some((e) => e.errors.length)) {
          written = disk.entries;
          return;
        }
        written = merge(base, ours, disk.entries);
        const out = written.map((e) => serializeEntry(e));
        if (JSON.stringify(out) === JSON.stringify(fm.backlinks ?? [])) return;
        if (out.length === 0) delete fm.backlinks;
        else fm.backlinks = out;
      });
    } catch (e) {
      console.error("[backlinks-full-view] couldn't save pane settings to", path, e);
      return;
    }
    this.afterWrite(vs, gen, written, ours);
  }
  /** Record what's on disk now; if the merge brought in changes made elsewhere, show them. */
  afterWrite(vs, gen, written, ours) {
    if (vs.gen !== gen || !this.views.has(vs.view)) return;
    const entries = written.map((e, i) => ({ ...e, src: i }));
    if (vs.dirty) {
      vs.baseList = entries;
      vs.savedJson = listJson(entries);
      return;
    }
    if (listJson(written) === listJson(ours) && written.length === vs.panes.length) {
      vs.baseList = entries;
      vs.savedJson = listJson(entries);
      vs.panes.forEach((p, i) => {
        p.raw = entries[i].raw;
        p.srcIndex = i;
      });
      return;
    }
    this.applyEntries(vs, entries, false);
    const f = this.app.vault.getAbstractFileByPath(vs.notePath ?? "");
    if (f instanceof import_obsidian.TFile) for (const p of vs.panes) this.refreshPane(p, f);
  }
  /** The property's inferred type (from the loaded notes), or the file property's type. */
  knownType(st, id) {
    return st.types.get(id) ?? FILE_PROPS.find((p) => p.id === id)?.type;
  }
  typeOf(st, id) {
    return this.knownType(st, id) ?? "text";
  }
  /** The type a rule is evaluated as: the property's type if the operator fits it, else the operator's own. */
  evalType(st, r) {
    const t = this.knownType(st, r.prop);
    if (t && OPS[t].includes(r.op)) return t;
    return OP_TYPE_ORDER.find((x) => OPS[x].includes(r.op)) ?? t ?? "text";
  }
  propSelect(parent, st, current, onChange) {
    const sel = parent.createEl("select", { cls: "dropdown bfv-prop" });
    const fileG = sel.createEl("optgroup", { attr: { label: "File properties" } });
    const noteG = sel.createEl("optgroup", { attr: { label: "Note properties" } });
    const defs = [...st.propDefs];
    if (!defs.some((d) => d.id === current)) {
      defs.push({ id: current, label: current.replace(/^note\./, ""), type: "text", group: "note" });
    }
    for (const d of defs) {
      (d.group === "file" ? fileG : noteG).createEl("option", { value: d.id, text: d.label });
    }
    sel.value = current;
    sel.addEventListener("change", () => onChange(sel.value));
    return sel;
  }
  renderFilterEditor(st) {
    st.filterPanel.empty();
    this.renderGroup(st.filterPanel, st.config.filter, st);
  }
  renderGroup(parentEl, group, st, onRemove) {
    const box = parentEl.createDiv({ cls: "bfv-group" });
    const head = box.createDiv({ cls: "bfv-group-head" });
    const modeSel = head.createEl("select", { cls: "dropdown" });
    for (const [v, l] of [
      ["and", "All"],
      ["or", "Any"],
      ["not", "None"]
    ]) {
      modeSel.createEl("option", { value: v, text: l });
    }
    modeSel.value = group.mode;
    modeSel.addEventListener("change", () => {
      group.mode = modeSel.value;
      this.configChanged(st, false);
    });
    head.createSpan({ text: "of the following are true", cls: "bfv-muted" });
    if (onRemove) {
      const del = head.createEl("button", { cls: "bfv-icon-btn", text: "\u2715", attr: { "aria-label": "Remove group" } });
      del.addEventListener("click", onRemove);
    }
    const kids = box.createDiv({ cls: "bfv-group-kids" });
    group.children.forEach((c, i) => {
      const remove = () => {
        group.children.splice(i, 1);
        this.configChanged(st, true);
      };
      if (c.type === "group") this.renderGroup(kids, c, st, remove);
      else this.renderRule(kids, c, st, remove);
    });
    const add = box.createDiv({ cls: "bfv-group-add" });
    add.createEl("button", { text: "+ Add filter" }).addEventListener("click", () => {
      group.children.push({ type: "rule", prop: "file.name", op: "contains", value: "" });
      this.configChanged(st, true);
    });
    add.createEl("button", { text: "+ Add filter group" }).addEventListener("click", () => {
      group.children.push({ type: "group", mode: "and", children: [] });
      this.configChanged(st, true);
    });
  }
  /** Rendering never changes the rule: an operator that doesn't fit the inferred type is shown as saved. */
  renderRule(parentEl, rule, st, onRemove) {
    const row = parentEl.createDiv({ cls: "bfv-rule" });
    const type = this.knownType(st, rule.prop) ?? this.evalType(st, rule);
    this.propSelect(row, st, rule.prop, (v) => {
      rule.prop = v;
      const nt = this.typeOf(st, v);
      if (!OPS[nt].includes(rule.op)) rule.op = OPS[nt][0];
      if (nt !== type) rule.value = "";
      this.configChanged(st, true);
    });
    const opSel = row.createEl("select", { cls: "dropdown bfv-op" });
    const fits = OPS[type].includes(rule.op);
    for (const o of fits ? OPS[type] : [...OPS[type], rule.op]) opSel.createEl("option", { value: o, text: o });
    opSel.value = rule.op;
    if (!fits) {
      opSel.addClass("bfv-op-mismatch");
      opSel.title = `\u201C${rule.op}\u201D isn't a ${type} operator for the notes loaded now; it's kept as saved and evaluated as ${this.evalType(st, rule)}.`;
    }
    opSel.addEventListener("change", () => {
      rule.op = opSel.value;
      this.configChanged(st, true);
    });
    if (!NO_VALUE.has(rule.op)) {
      const vt = this.evalType(st, rule);
      const input = row.createEl("input", {
        cls: "bfv-value",
        type: vt === "number" ? "number" : "text",
        placeholder: vt === "date" ? "YYYY-MM-DD, today, today-7d" : "Value"
      });
      input.value = rule.value;
      const commit = (0, import_obsidian.debounce)(
        () => {
          if (!st.dead) {
            st.updateButtons();
            this.applyView(st);
          }
        },
        200,
        true
      );
      input.addEventListener("input", () => {
        rule.value = input.value;
        this.persist(st);
        commit();
      });
    }
    const del = row.createEl("button", { cls: "bfv-icon-btn", text: "\u2715", attr: { "aria-label": "Remove filter" } });
    del.addEventListener("click", onRemove);
  }
  renderSortEditor(st) {
    const el = st.sortPanel;
    el.empty();
    const sorts = st.config.sorts;
    sorts.forEach((s, i) => {
      const row = el.createDiv({ cls: "bfv-rule" });
      this.propSelect(row, st, s.prop, (v) => {
        s.prop = v;
        this.configChanged(st, true);
      });
      const [asc, desc] = dirLabels(this.typeOf(st, s.prop));
      const dir = row.createEl("select", { cls: "dropdown bfv-op" });
      dir.createEl("option", { value: "asc", text: asc });
      dir.createEl("option", { value: "desc", text: desc });
      dir.value = s.dir;
      dir.addEventListener("change", () => {
        s.dir = dir.value;
        this.configChanged(st, false);
      });
      const up = row.createEl("button", { cls: "bfv-icon-btn", text: "\u2191", attr: { "aria-label": "Move up" } });
      up.disabled = i === 0;
      up.addEventListener("click", () => {
        [sorts[i - 1], sorts[i]] = [sorts[i], sorts[i - 1]];
        this.configChanged(st, true);
      });
      const del = row.createEl("button", { cls: "bfv-icon-btn", text: "\u2715", attr: { "aria-label": "Remove sort" } });
      del.addEventListener("click", () => {
        sorts.splice(i, 1);
        this.configChanged(st, true);
      });
    });
    el.createEl("button", { text: "+ Add sort" }).addEventListener("click", () => {
      sorts.push({ prop: "file.name", dir: "asc" });
      this.configChanged(st, true);
    });
  }
  countRules(g) {
    return g.children.reduce((n, c) => n + (c.type === "group" ? this.countRules(c) : 1), 0);
  }
  // ---------- data sync ----------
  itemData(src) {
    const cache = this.app.metadataCache.getFileCache(src);
    const fm = cache?.frontmatter ?? {};
    const props = {};
    const labels = {};
    const lists = /* @__PURE__ */ new Set();
    for (const k of Object.keys(fm)) {
      if (k === "position") continue;
      const lk = k.toLowerCase();
      props[lk] = toStrings(fm[k]);
      if (!(lk in labels)) labels[lk] = k;
      if (Array.isArray(fm[k])) lists.add(lk);
    }
    const tags = [
      ...(cache?.tags ?? []).map((t) => t.tag.replace(/^#/, "")),
      ...toStrings(fm.tags ?? fm.tag).map((t) => t.replace(/^#/, ""))
    ];
    return { props, labels, lists, tags };
  }
  /** Brings the pane's items in line with `sources`: unchanged notes are untouched, changed ones updated in place. */
  sync(st, sources) {
    const seen = /* @__PURE__ */ new Set();
    let changed = false;
    for (const src of sources) {
      seen.add(src.path);
      const ver = this.verOf(src.path);
      const old = st.items.get(src.path);
      if (old && old.ver === ver && old.file === src) continue;
      changed = true;
      if (old) {
        Object.assign(old, this.itemData(src), {
          file: src,
          ver,
          hay: void 0,
          sortFor: void 0,
          sortKeys: void 0
        });
        old.invalidate();
      } else {
        st.items.set(src.path, this.createItem(st, src, ver));
      }
    }
    for (const [path, it] of st.items) {
      if (!seen.has(path)) {
        st.component.removeChild(it.comp);
        it.el.remove();
        st.items.delete(path);
        changed = true;
      }
    }
    if (!changed) return this.applyView(st);
    st.needsSort = true;
    this.buildCatalogue(st);
    this.applyView(st);
  }
  /** Property list and type inference for the filter/sort editors, in one pass over the items. */
  buildCatalogue(st) {
    const stats = /* @__PURE__ */ new Map();
    for (const it of st.items.values()) {
      for (const lk in it.props) {
        let s = stats.get(lk);
        if (!s) {
          s = { label: it.labels[lk] ?? lk, list: false, any: false, bool: true, num: true, date: true };
          stats.set(lk, s);
        }
        if (it.lists.has(lk)) s.list = true;
        if (s.list) continue;
        for (const v of it.props[lk]) {
          if (v === "") continue;
          s.any = true;
          if (s.bool && !/^(true|false)$/i.test(v)) s.bool = false;
          if (s.num && isNaN(Number(v))) s.num = false;
          if (s.date && !DATE_RE.test(v)) s.date = false;
        }
      }
    }
    const defs = [...FILE_PROPS];
    st.types = new Map(FILE_PROPS.map((p) => [p.id, p.type]));
    for (const [lk, s] of [...stats].sort((a, b) => a[1].label.localeCompare(b[1].label))) {
      const type = s.list ? "list" : !s.any ? "text" : s.bool ? "boolean" : s.num ? "number" : s.date ? "date" : "text";
      defs.push({ id: "note." + lk, label: s.label, type, group: "note" });
      st.types.set("note." + lk, type);
    }
    st.propDefs = defs;
    const key = defs.map((d) => d.id + ":" + d.type).join(",");
    if (key !== st.propDefsKey) {
      st.propDefsKey = key;
      st.renderEditors();
    }
  }
  // ---------- evaluation ----------
  getVals(it, id) {
    const f = it.file;
    switch (id) {
      case "file.name":
        return [f.basename];
      case "file.path":
        return [f.path];
      case "file.folder":
        return [f.parent && f.parent.path !== "/" ? f.parent.path : ""];
      case "file.ext":
        return [f.extension];
      case "file.ctime":
        return [localIso(f.stat.ctime)];
      case "file.mtime":
        return [localIso(f.stat.mtime)];
      case "file.size":
        return [String(f.stat.size)];
      case "file.tags":
        return it.tags;
    }
    return id.startsWith("note.") ? it.props[id.slice(5)] ?? [] : [];
  }
  /** A rule as a predicate, with its type, operator and target value worked out once. */
  compileRule(st, r) {
    const present = (it) => this.getVals(it, r.prop).filter((v2) => v2 !== "");
    switch (r.op) {
      case "is empty":
        return (it) => present(it).length === 0;
      case "is not empty":
        return (it) => present(it).length > 0;
      case "is true":
        return (it) => present(it)[0]?.toLowerCase() === "true";
      case "is false":
        return (it) => present(it)[0]?.toLowerCase() === "false";
    }
    const raw = r.value.trim();
    if (raw === "") return () => true;
    const v = raw.toLowerCase();
    const type = this.evalType(st, r);
    const op = r.op;
    if (type === "number") {
      const target = Number(raw);
      if (isNaN(target)) return () => true;
      return (it) => {
        const p = present(it);
        const n = Number(p[0]);
        if (!p.length || isNaN(n)) return op === "\u2260";
        switch (op) {
          case "=":
            return n === target;
          case "\u2260":
            return n !== target;
          case "<":
            return n < target;
          case "\u2264":
            return n <= target;
          case ">":
            return n > target;
          case "\u2265":
            return n >= target;
        }
        return true;
      };
    }
    if (type === "date") {
      const t = normDate(raw);
      return (it) => {
        const d = present(it)[0]?.slice(0, 10);
        if (!d) return op === "is not";
        switch (op) {
          case "is":
            return d === t;
          case "is not":
            return d !== t;
          case "before":
            return d < t;
          case "after":
            return d > t;
          case "on or before":
            return d <= t;
          case "on or after":
            return d >= t;
        }
        return true;
      };
    }
    const lower = (it) => present(it).map((x) => x.toLowerCase());
    if (type === "list") {
      const w = v.replace(/^#/, "");
      const neg = op === "does not contain";
      return (it) => {
        const has = lower(it).some((x) => x === w || x.startsWith(w + "/"));
        return neg ? !has : has;
      };
    }
    switch (op) {
      case "is":
        return (it) => lower(it).some((x) => x === v);
      case "is not":
        return (it) => !lower(it).some((x) => x === v);
      case "contains":
        return (it) => lower(it).some((x) => x.includes(v));
      case "does not contain":
        return (it) => !lower(it).some((x) => x.includes(v));
      case "starts with":
        return (it) => lower(it).some((x) => x.startsWith(v));
      case "ends with":
        return (it) => lower(it).some((x) => x.endsWith(v));
    }
    return () => true;
  }
  compileNode(st, n) {
    if (n.type === "rule") return this.compileRule(st, n);
    if (!n.children.length) return () => true;
    const cs = n.children.map((c) => this.compileNode(st, c));
    if (n.mode === "and") return (it) => cs.every((c) => c(it));
    if (n.mode === "or") return (it) => cs.some((c) => c(it));
    return (it) => !cs.some((c) => c(it));
  }
  /** Lower-cased path, tags and properties of a note: what a normal (not full-text) search looks in. */
  hayOf(it) {
    return [it.file.path, ...it.tags, ...Object.entries(it.props).flatMap(([k, vs]) => [k, ...vs])].join("\n").toLowerCase();
  }
  /** Reads (and caches, lower-cased, shared across panes) the text of notes for full-text search, 100 at a time. */
  async loadBodies(items) {
    for (let i = 0; i < items.length; i += 100) {
      await Promise.all(
        items.slice(i, i + 100).map(async (it) => {
          const path = it.file.path;
          if (this.bodies.has(path)) return;
          let text = "";
          try {
            text = (await this.app.vault.cachedRead(it.file)).toLowerCase();
          } catch {
          }
          if (this.fullTextPanes.size) this.bodies.set(path, text);
        })
      );
    }
  }
  /** A pane stops full-text searching (unticked, collapsed or unloaded): drop note text no other pane needs. */
  releaseBodies(st) {
    if (!this.fullTextPanes.delete(st)) return;
    if (!this.fullTextPanes.size) {
      this.bodies.clear();
      return;
    }
    for (const path of this.bodies.keys()) {
      if (![...this.fullTextPanes].some((p) => p.items.has(path))) this.bodies.delete(path);
    }
  }
  /** Sort keys are computed once per item and sort order; nodes are re-appended only if the order changed. */
  sortItems(st) {
    const forKey = JSON.stringify(st.config.sorts);
    const sorts = st.config.sorts.map((s) => ({
      dir: s.dir === "asc" ? 1 : -1,
      t: this.typeOf(st, s.prop),
      prop: s.prop
    }));
    const all = [...st.items.values()];
    for (const it of all) {
      if (it.sortFor === forKey && it.sortKeys) continue;
      it.sortKeys = sorts.map(
        (s) => this.getVals(it, s.prop).filter((x) => x !== "").join(", ")
      );
      it.sortFor = forKey;
    }
    const coll = this.collator;
    all.sort((a, b) => {
      for (let i = 0; i < sorts.length; i++) {
        const av = a.sortKeys[i], bv = b.sortKeys[i], { t, dir } = sorts[i];
        if (!av && !bv) continue;
        if (!av) return 1;
        if (!bv) return -1;
        let r = 0;
        if (t === "number") {
          r = Number(av) - Number(bv);
          if (isNaN(r)) r = 0;
        } else if (t === "date") {
          const x = av.slice(0, 16), y = bv.slice(0, 16);
          r = x < y ? -1 : x > y ? 1 : 0;
        } else if (t === "boolean") r = (av.toLowerCase() === "true" ? 1 : 0) - (bv.toLowerCase() === "true" ? 1 : 0);
        else r = coll.compare(av, bv);
        if (r !== 0) return r * dir;
      }
      return a.file.path < b.file.path ? -1 : a.file.path > b.file.path ? 1 : 0;
    });
    const same = all.length === st.order.length && all.every((it, i) => it === st.order[i]);
    if (!same) {
      const frag = document.createDocumentFragment();
      for (const it of all) frag.appendChild(it.el);
      st.listEl.appendChild(frag);
    }
    st.order = all;
    st.needsSort = false;
  }
  /**
   * Sort, search and filter a pane. The DOM is only reordered when the sort or the items changed;
   * a search or filter change just toggles visibility on the cards whose visibility actually changed.
   */
  applyView(st) {
    if (st.dead) return;
    if (st.needsSort || st.order.length !== st.items.size || st.order[0]?.sortFor !== JSON.stringify(st.config.sorts)) {
      this.sortItems(st);
    }
    const all = st.order;
    const q = st.search.trim();
    const tree = q ? parseSearch(q) : null;
    const id = ++st.searchId;
    if (tree && st.fullText) {
      this.fullTextPanes.add(st);
      const missing = all.filter((it) => !this.bodies.has(it.file.path));
      if (missing.length) {
        st.countEl.setText(`Reading ${missing.length} notes\u2026`);
        void this.loadBodies(missing).then(() => {
          if (id === st.searchId && !st.dead) this.showMatches(st, all, tree, q);
        });
        return;
      }
    }
    this.showMatches(st, all, tree, q);
  }
  showMatches(st, all, tree, q) {
    const pred = this.compileNode(st, st.config.filter);
    let shown = 0;
    for (const it of all) {
      let ok = true;
      if (tree) {
        if (it.hay === void 0) it.hay = this.hayOf(it);
        const hay = it.hay;
        const body = st.fullText ? this.bodies.get(it.file.path) ?? "" : "";
        ok = evalSearch(tree, (t) => hay.includes(t) || body !== "" && body.includes(t));
      }
      if (ok) ok = pred(it);
      if (ok) shown++;
      if (it.el.hasClass("bfv-hidden") === ok) it.el.toggleClass("bfv-hidden", !ok);
    }
    const filtered = q !== "" || this.countRules(st.config.filter) > 0;
    st.countEl.setText(filtered ? `${shown} / ${all.length}` : String(all.length));
    st.emptyEl.setText(
      st.error ? st.error : all.length === 0 ? st.config.query ? "No notes." : "No backlinks found." : shown === 0 ? "No notes match the filters." : ""
    );
  }
  // ---------- cards ----------
  createItem(st, src, ver) {
    const { el, comp, setOpen, invalidate } = this.buildCard(
      st.listEl,
      src,
      st.component,
      st.opened,
      (path, open) => this.cardToggled(st, path, open)
    );
    return { file: src, ver, el, comp, setOpen, invalidate, ...this.itemData(src) };
  }
  /** The user expanded or collapsed a card: update recency and persist the most recent MAX_OPEN_SAVED. */
  cardToggled(st, path, open) {
    st.openOrder = st.openOrder.filter((p) => p !== path);
    if (open) st.openOrder.push(path);
    if (st.items.size && !st.error) st.openOrder = st.openOrder.filter((p) => st.items.has(p));
    const next = st.openOrder.slice(-MAX_OPEN_SAVED).reverse();
    if (JSON.stringify(next) === JSON.stringify(st.config.open)) return;
    st.config.open = next;
    this.persist(st, true);
  }
  /** Frontmatter changed from outside: expand exactly the cards it lists. */
  syncOpen(st) {
    st.opened.clear();
    for (const p of st.config.open) st.opened.add(p);
    st.openOrder = [...st.config.open].reverse();
    for (const it of st.items.values()) void it.setOpen(st.opened.has(it.file.path));
  }
  /**
   * Internal links anywhere under `el` (card titles and links inside rendered notes) follow Obsidian's
   * conventions: click opens in place, Ctrl/Cmd-click or middle-click opens a new tab, Ctrl+Alt a split,
   * Ctrl+Alt+Shift a new window, and hovering with Ctrl shows Page preview.
   * Needed because in editing modes Obsidian only wires up links inside CodeMirror's contentDOM, and the
   * panel lives outside it (in .cm-sizer), so links rendered in cards would otherwise do nothing.
   */
  wireLinks(el) {
    const hoverParent = { hoverPopover: null };
    const linkOf = (evt) => {
      const a = evt.target?.closest?.("a.internal-link");
      return a && el.contains(a) ? a : null;
    };
    const sourceOf = (a) => a.closest("[data-bfv-path]")?.getAttribute("data-bfv-path") ?? "";
    const open = (evt, a, newLeaf) => {
      const href = a.getAttribute("data-href") ?? a.getAttribute("href");
      if (!href) return;
      evt.preventDefault();
      evt.stopPropagation();
      void this.app.workspace.openLinkText(href, sourceOf(a), newLeaf);
    };
    el.addEventListener("click", (evt) => {
      const a = linkOf(evt);
      if (a) open(evt, a, import_obsidian.Keymap.isModEvent(evt));
    });
    el.addEventListener("auxclick", (evt) => {
      const a = linkOf(evt);
      if (a && evt.button === 1) open(evt, a, "tab");
    });
    el.addEventListener("mouseover", (evt) => {
      const a = linkOf(evt);
      if (!a) return;
      const href = a.getAttribute("data-href") ?? a.getAttribute("href");
      if (!href) return;
      this.app.workspace.trigger("hover-link", {
        event: evt,
        source: HOVER_SOURCE,
        hoverParent,
        targetEl: a,
        linktext: href,
        sourcePath: sourceOf(a)
      });
    });
  }
  /**
   * A full-note collapsible card. It starts collapsed unless its path is in `opened`, and the note is only
   * read and rendered when the card is first expanded, so large panes stay cheap. `invalidate()` re-renders
   * an open card (debounced) or makes a collapsed one render afresh on its next expand.
   */
  buildCard(parentEl, src, parentComp, opened, onToggle) {
    const comp = new import_obsidian.Component();
    parentComp.addChild(comp);
    const item = parentEl.createDiv({ cls: "bfv-item" });
    item.setAttr("data-bfv-path", src.path);
    const ih = item.createDiv({ cls: "bfv-item-header" });
    const ichev = ih.createSpan({ cls: "bfv-chevron" });
    ih.createEl("a", {
      cls: "bfv-item-title internal-link",
      text: src.basename,
      href: src.path,
      attr: { "data-href": src.path }
    });
    const folder = src.parent && src.parent.path !== "/" ? src.parent.path : "";
    if (folder) ih.createSpan({ cls: "bfv-item-path", text: folder + "/" });
    const content = item.createDiv({ cls: "bfv-item-content markdown-rendered" });
    let rendered = false;
    let isOpen = false;
    let renderComp = null;
    let seq = 0;
    const render = async () => {
      rendered = true;
      const my = ++seq;
      try {
        const text = await this.app.vault.cachedRead(src);
        if (my !== seq) return;
        if (renderComp) comp.removeChild(renderComp);
        renderComp = comp.addChild(new import_obsidian.Component());
        content.empty();
        this.renderProperties(content, src);
        await import_obsidian.MarkdownRenderer.render(this.app, text, content, src.path, renderComp);
      } catch (e) {
        console.error("[backlinks-full-view] failed to render", src.path, e);
        content.createDiv({ cls: "bfv-empty", text: "Couldn't render this note." });
      }
    };
    const rerender = (0, import_obsidian.debounce)(
      () => {
        if (isOpen) void render();
        else rendered = false;
      },
      CARD_RERENDER_DELAY,
      true
    );
    comp.register(() => rerender.cancel());
    const invalidate = () => {
      if (!rendered) return;
      if (isOpen) rerender();
      else rendered = false;
    };
    const setOpen = async (open) => {
      isOpen = open;
      item.toggleClass("is-collapsed", !open);
      ichev.setText(open ? "\u25BE" : "\u25B8");
      if (open && !rendered) await render();
    };
    ih.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      const willOpen = item.hasClass("is-collapsed");
      if (willOpen) opened.add(src.path);
      else opened.delete(src.path);
      void setOpen(willOpen);
      onToggle?.(src.path, willOpen);
    });
    void setOpen(opened.has(src.path));
    return { el: item, comp, setOpen, invalidate };
  }
  /**
   * A compact, read-only properties table at the top of a card (MarkdownRenderer drops frontmatter).
   * Wiki links become internal links, so the panel's click/hover handling applies to them. `backlinks`
   * is pane config, not content, so it's left out.
   */
  renderProperties(el, src) {
    const fm = this.app.metadataCache.getFileCache(src)?.frontmatter;
    const keys = Object.keys(fm ?? {}).filter((k) => k !== "backlinks" && k !== "position");
    if (!fm || !keys.length) return;
    const table = el.createDiv({ cls: "bfv-props" });
    const LINK = /^\[\[([^\]|#]+)(#[^\]|]*)?(?:\|([^\]]*))?\]\]$/;
    const value = (cell, v, key) => {
      if (v === null || v === void 0 || v === "") return;
      if (typeof v === "string") {
        const m = v.match(LINK);
        if (m) {
          const target = m[1] + (m[2] ?? "");
          const dest = this.app.metadataCache.getFirstLinkpathDest(m[1], src.path);
          cell.createEl("a", {
            cls: "internal-link" + (dest ? "" : " is-unresolved"),
            text: m[3] ?? (dest?.basename ?? m[1].split("/").pop() ?? m[1]) + (m[2] ?? ""),
            href: target,
            attr: { "data-href": target }
          });
        } else if (key === "tags" || key === "tag") {
          cell.createSpan({ cls: "tag", text: "#" + v.replace(/^#/, "") });
        } else {
          cell.createSpan({ text: v });
        }
      } else if (typeof v === "object") {
        cell.createSpan({ text: JSON.stringify(v) });
      } else {
        cell.createSpan({ text: String(v) });
      }
    };
    for (const k of keys) {
      const row = table.createDiv({ cls: "bfv-prop-row" });
      row.createDiv({ cls: "bfv-prop-key", text: k });
      const cell = row.createDiv({ cls: "bfv-prop-value" });
      const v = fm[k];
      if (Array.isArray(v)) {
        for (const x of v) {
          const chip = cell.createSpan({ cls: "bfv-prop-chip" });
          value(chip, x, k);
        }
      } else {
        value(cell, v, k);
      }
    }
  }
};
