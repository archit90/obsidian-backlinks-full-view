import {
  Component,
  Keymap,
  MarkdownRenderer,
  MarkdownView,
  Notice,
  Plugin,
  TFile,
  debounce,
} from "obsidian";

const PANEL_CLASS = "bfv-panel";
const HOVER_SOURCE = "backlinks-full-view"; // Settings → Page preview lists it as "Backlinks Full View"
const DEFAULT_EMBED_LIMIT = 25; // max notes rendered per bfv.embed() call
const MAX_EMBED_DEPTH = 3;      // max nesting of embeds inside embeds
const MAX_OPEN_SAVED = 50;      // expanded cards remembered per pane in frontmatter, most recent first
// ---------- config model (mirrors Bases: nested and/or/not filters + multi-sort) ----------

type PropType = "text" | "number" | "date" | "boolean" | "list";
interface Rule { type: "rule"; prop: string; op: string; value: string }
interface Group { type: "group"; mode: "and" | "or" | "not"; children: Node[] }
type Node = Rule | Group;
interface SortRule { prop: string; dir: "asc" | "desc" }
interface Settings { title: string; filter: Group; sorts: SortRule[]; query: string; open: string[] }

const defaults = (): Settings => ({
  title: "", // pane heading; falls back to "Backlinks" or "Query"
  filter: { type: "group", mode: "and", children: [] },
  sorts: [{ prop: "file.name", dir: "asc" }],
  query: "", // optional Dataview query that supplies the notes instead of backlinks
  open: [],  // paths of expanded cards, most recent first (at most MAX_OPEN_SAVED)
});

interface PropDef { id: string; label: string; type: PropType; group: "file" | "note" }
const FILE_PROPS: PropDef[] = [
  { id: "file.name", label: "name", type: "text", group: "file" },
  { id: "file.path", label: "path", type: "text", group: "file" },
  { id: "file.folder", label: "folder", type: "text", group: "file" },
  { id: "file.ext", label: "extension", type: "text", group: "file" },
  { id: "file.ctime", label: "created time", type: "date", group: "file" },
  { id: "file.mtime", label: "modified time", type: "date", group: "file" },
  { id: "file.size", label: "size", type: "number", group: "file" },
  { id: "file.tags", label: "tags", type: "list", group: "file" },
];

const OPS: Record<PropType, string[]> = {
  text: ["is", "is not", "contains", "does not contain", "starts with", "ends with", "is empty", "is not empty"],
  number: ["=", "≠", "<", "≤", ">", "≥", "is empty", "is not empty"],
  date: ["is", "is not", "before", "after", "on or before", "on or after", "is empty", "is not empty"],
  boolean: ["is true", "is false", "is empty", "is not empty"],
  list: ["contains", "does not contain", "is empty", "is not empty"],
};
const NO_VALUE = new Set(["is empty", "is not empty", "is true", "is false"]);

function dirLabels(t: PropType): [string, string] {
  if (t === "number") return ["1 → 9", "9 → 1"];
  if (t === "date") return ["Old → New", "New → Old"];
  if (t === "boolean") return ["False → True", "True → False"];
  return ["A → Z", "Z → A"];
}

// ---------- runtime state ----------

interface ItemState {
  file: TFile;
  sig: string;
  el: HTMLElement;
  comp: Component;
  setOpen: (open: boolean) => Promise<void>;
  props: Record<string, string[]>; // lower-cased key -> values
  lists: Set<string>;              // lower-cased keys whose value is an array
  tags: string[];
  hay?: string;                    // lower-cased path + tags + properties, built on first search
  body?: string;                   // lower-cased note text, read on first full-text search
}

interface PanelState {
  el: HTMLElement;
  listEl: HTMLElement;
  countEl: HTMLElement;
  filterBtn: HTMLElement;
  sortBtn: HTMLElement;
  filterPanel: HTMLElement;
  sortPanel: HTMLElement;
  component: Component;
  signature: string;
  collapsed: boolean;
  opened: Set<string>;             // cards currently expanded; every other card starts collapsed
  openOrder: string[];             // expanded cards in the order they were opened, most recent last
  items: Map<string, ItemState>;
  propDefs: PropDef[];
  types: Map<string, PropType>;
  search: string;
  fullText: boolean;               // search note text as well (session only, not saved)
  searchId: number;                // guards against out-of-order full-text loads
  itemsVersion: number;            // bumped whenever items are added, replaced or removed
  sortedKey: string;               // sorts + itemsVersion the current DOM order was built for
  emptyEl: HTMLElement;
  renderEditors: () => void;
  updateButtons: () => void;
  titleEl: HTMLElement;
  queryInput: HTMLInputElement;
  titleInput: HTMLInputElement;
  reqId: number;                    // guards against out-of-order async query results
  error: string;                    // Dataview query error, shown in place of the list
  ephemeral: boolean;               // the built-in "All backlinks" pane: never written to frontmatter
  deferred: boolean;                // built lazily: cards are created only once the pane is first expanded
  config: Settings;                 // this pane's filter/sort (stored as one entry of the note's `backlinks` list)
  view: ViewState;
}

/** All backlinks panes shown under one note view. */
interface ViewState {
  el: HTMLElement;
  addBtn: HTMLElement;
  panes: PanelState[];             // the note's own panes, saved in its `backlinks` frontmatter
  base: PanelState | null;          // built-in pane every note gets (plain backlinks, starts collapsed, not saved)
  notePath: string | null;
  savedJson: string;   // last config list known to be in the frontmatter
  dirty: boolean;      // local edits not yet written
  graceUntil: number;  // ignore possibly-stale cache reads right after our own write
  save: () => void;
  observer: MutationObserver | null; // re-attaches the container if the editor DOM drops it
  reattachCount: number;
  reattachSince: number;
}

function toStrings(v: unknown): string[] {
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) return v.flatMap(toStrings);
  if (typeof v === "object") return [JSON.stringify(v)];
  return [String(v)];
}

const pad = (n: number) => String(n).padStart(2, "0");
const localIso = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
function normDate(s: string): string {
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
const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

// ---------- search query: terms, "quoted phrases", AND / OR / NOT (or -term), parentheses ----------
//   maya standup             both terms (adjacent terms are ANDed)
//   (billing AND v2) OR acme
//   NOT draft   /   -draft
// Operators are recognised in upper case only, so a lower-case "and" / "or" is searched as a word.
// Precedence: NOT > AND > OR. Unbalanced parentheses are tolerated.
type SearchNode =
  | { t: "term"; v: string }
  | { t: "not"; c: SearchNode }
  | { t: "and" | "or"; c: SearchNode[] };

function parseSearch(q: string): SearchNode | null {
  const toks: string[] = [];
  const re = /\s*(?:(\()|(\))|"([^"]*)"?|(-?)([^\s()"]+))/y;
  let m: RegExpExecArray | null;
  while (re.lastIndex < q.length && (m = re.exec(q))) {
    if (m[1]) toks.push("(");
    else if (m[2]) toks.push(")");
    else if (m[3] !== undefined) { if (m[3].trim()) toks.push("t:" + m[3].toLowerCase()); }
    else if (m[5]) {
      if (m[4]) toks.push("NOT");
      toks.push(["AND", "OR", "NOT"].includes(m[5]) && !m[4] ? m[5] : "t:" + m[5].toLowerCase());
    }
  }
  let i = 0;
  const atom = (): SearchNode | null => {
    const tk = toks[i];
    if (tk === undefined) return null;
    if (tk === "NOT") { i++; const c = atom(); return c ? { t: "not", c } : null; }
    if (tk === "(") { i++; const e = or(); if (toks[i] === ")") i++; return e; }
    if (tk.startsWith("t:")) { i++; return { t: "term", v: tk.slice(2) }; }
    return null; // a stray AND / OR / ")"
  };
  const and = (): SearchNode | null => {
    const c: SearchNode[] = [];
    while (i < toks.length && toks[i] !== "OR" && toks[i] !== ")") {
      if (toks[i] === "AND") { i++; continue; }
      const a = atom();
      if (a) c.push(a); else if (toks[i] !== "OR" && toks[i] !== ")") i++;
    }
    return c.length === 0 ? null : c.length === 1 ? c[0] : { t: "and", c };
  };
  const or = (): SearchNode | null => {
    const c: SearchNode[] = [];
    for (;;) {
      const a = and();
      if (a) c.push(a);
      if (toks[i] === "OR") { i++; continue; }
      break;
    }
    return c.length === 0 ? null : c.length === 1 ? c[0] : { t: "or", c };
  };
  const out: SearchNode[] = [];
  while (i < toks.length) { const e = or(); if (e) out.push(e); if (toks[i] === ")") i++; }
  return out.length === 0 ? null : out.length === 1 ? out[0] : { t: "and", c: out };
}

function evalSearch(n: SearchNode, has: (term: string) => boolean): boolean {
  switch (n.t) {
    case "term": return has(n.v);
    case "not": return !evalSearch(n.c, has);
    case "and": return n.c.every((c) => evalSearch(c, has));
    case "or": return n.c.some((c) => evalSearch(c, has));
  }
}

export default class FullBacklinksPlugin extends Plugin {
  private views = new WeakMap<MarkdownView, ViewState>();
  private linksResolvedOnce = false; // set by the first "resolved" event after the plugin loads
  private allViews = new Set<ViewState>();

  async onload() {
    // short global for DataviewJS:  bfv.embed(dv, dv.pages("#x"))
    (window as any).bfv = this.api;
    this.registerHoverLinkSource(HOVER_SOURCE, { display: "Backlinks Full View", defaultMod: true });
    this.addCommand({
      id: "diagnostics",
      name: "Show diagnostics",
      callback: () => new Notice(this.diagnostics().join("\n"), 12000),
    });
    for (const m of this.missingApis()) this.warnOnce("api-" + m, `Obsidian API not available: ${m}. Some features are disabled.`);
    const refresh = debounce(() => this.refreshAll(), 300, true);
    this.registerEvent(this.app.workspace.on("layout-change", refresh));
    this.registerEvent(this.app.workspace.on("file-open", refresh));
    this.registerEvent(this.app.workspace.on("active-leaf-change", refresh));
    this.registerEvent(this.app.metadataCache.on("resolved", () => { this.linksResolvedOnce = true; refresh(); }));
    this.registerEvent(this.app.metadataCache.on("changed", refresh));
    this.registerEvent(this.app.vault.on("modify", refresh));
    // Dataview signals (only fire when Dataview is installed)
    try {
      const mc = this.app.metadataCache as any;
      this.registerEvent(mc.on("dataview:index-ready", refresh));
      this.registerEvent(mc.on("dataview:metadata-change", refresh));
    } catch (e) {
      this.warnOnce("dv-events", "Could not subscribe to Dataview events; query panes refresh on note changes only.");
    }
    this.app.workspace.onLayoutReady(() => this.refreshAll());
  }

  onunload() {
    if ((window as any).bfv === this.api) delete (window as any).bfv;
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView) this.destroyView(leaf.view);
    });
  }

  private missingApis(): string[] {
    const out: string[] = [];
    if (typeof this.app.fileManager?.processFrontMatter !== "function") out.push("FileManager.processFrontMatter (saving pane settings)");
    if (typeof MarkdownRenderer?.render !== "function") out.push("MarkdownRenderer.render (note rendering)");
    return out;
  }

  private diagnostics(): string[] {
    const lines = ["Backlinks Full View diagnostics"];
    const dv = (this.app as any).plugins?.plugins?.dataview;
    lines.push(`Dataview: ${dv ? "v" + (dv.manifest?.version ?? "?") + (typeof dv.api?.query === "function" ? ", query API ok" : ", query API MISSING") : "not enabled"}`);
    const missing = this.missingApis();
    lines.push(missing.length ? "Missing Obsidian APIs: " + missing.join("; ") : "Obsidian APIs: ok");
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view) {
      const host = this.getHost(view);
      lines.push(`Active note (${view.getMode()}): host ${host ? "found <" + host.className.split(" ")[0] + ">" : "NOT found, using fallback"}`);
      const vs = this.views.get(view);
      lines.push(vs ? `Panes: ${vs.panes.length} + All backlinks, attached: ${vs.el.isConnected}` : "No panes created for this note yet");
    } else lines.push("No active note.");
    return lines;
  }

  private destroyView(view: MarkdownView) {
    const vs = this.views.get(view);
    if (!vs) return;
    vs.observer?.disconnect();
    for (const p of vs.panes) p.component.unload();
    vs.base?.component.unload();
    vs.el.remove();
    this.views.delete(view);
    this.allViews.delete(vs);
  }

  private refreshAll() {
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (!(leaf.view instanceof MarkdownView)) return;
      try { this.refreshView(leaf.view); }
      catch (e) { console.error("[backlinks-full-view] refresh failed for", leaf.view.file?.path, e); }
    });
  }

  private getBacklinkSources(file: TFile): TFile[] {
    const resolved = this.app.metadataCache.resolvedLinks;
    const out: TFile[] = [];
    for (const src in resolved) {
      if (src === file.path || !resolved[src][file.path]) continue;
      const f = this.app.vault.getAbstractFileByPath(src);
      if (f instanceof TFile && f.extension === "md") out.push(f);
    }
    return out;
  }

  /**
   * Where to inject the panes. Prefers the scrolling content container so the panes scroll with the note.
   * Class names below are Obsidian/CodeMirror internals, so several candidates are tried and the
   * documented `view.contentEl` is the last resort.
   */
  private getHost(view: MarkdownView): HTMLElement | null {
    const c = view.containerEl;
    const sels = view.getMode() === "preview"
      ? [".markdown-preview-sizer", ".markdown-preview-view"]
      : [".cm-sizer", ".cm-scroller"];
    for (const sel of sels) {
      const el = c.querySelector<HTMLElement>(sel);
      if (el) return el;
    }
    return null;
  }

  private warned = new Set<string>();
  private warnOnce(key: string, msg: string) {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    console.warn("[backlinks-full-view] " + msg);
  }

  /** Watch the host so the container is put back if the editor re-renders and drops it. */
  private watchHost(vs: ViewState, host: HTMLElement) {
    vs.observer?.disconnect();
    vs.observer = new MutationObserver(() => {
      if (vs.el.isConnected) return;
      const now = Date.now();
      if (now - vs.reattachSince > 3000) { vs.reattachSince = now; vs.reattachCount = 0; }
      if (++vs.reattachCount > 5) { // something keeps removing us: stop fighting it
        vs.observer?.disconnect();
        this.warnOnce("fight", "The editor keeps removing the backlinks panel; giving up re-attaching.");
        return;
      }
      host.appendChild(vs.el);
    });
    vs.observer.observe(host, { childList: true });
  }

  private createViewState(host: HTMLElement): ViewState {
    const el = host.createDiv({ cls: "bfv-container" });
    this.wireLinks(el);
    const addBtn = el.createEl("button", { cls: "bfv-add", text: "+ Add backlinks pane" });
    const vs: ViewState = {
      el, addBtn, panes: [], base: null, notePath: null, savedJson: "", dirty: false, graceUntil: 0,
      observer: null, reattachCount: 0, reattachSince: 0,
      save: debounce(() => void this.writeConfig(vs), 600, true),
    };
    addBtn.addEventListener("click", () => {
      const file = vs.notePath ? this.app.vault.getAbstractFileByPath(vs.notePath) : null;
      const pane = this.createPanel(vs, defaults());
      vs.panes.push(pane);
      this.updateTitles(vs);
      (pane.el.querySelector(".bfv-header") as HTMLElement | null)?.click(); // a pane just added starts expanded
      if (file instanceof TFile) this.refreshPane(pane, file, this.getBacklinkSources(file));
      vs.dirty = true;
      vs.save();
    });
    return vs;
  }

  private updateTitles(vs: ViewState) {
    vs.panes.forEach((p, i) => {
      const title = p.config.title.trim();
      const base = p.config.query ? "Query" : "Backlinks";
      p.titleEl.setText(title || (vs.panes.length > 1 ? `${base} · ${i + 1}` : base));
    });
  }

  private removePane(vs: ViewState, st: PanelState) {
    const i = vs.panes.indexOf(st);
    if (i < 0) return;
    st.component.unload();
    st.el.remove();
    vs.panes.splice(i, 1);
    this.updateTitles(vs);
    vs.dirty = true;
    vs.save();
    this.refreshAll();
  }

  private refreshView(view: MarkdownView) {
    const file = view.file;
    if (!file) return this.destroyView(view);
    let host = this.getHost(view);
    if (!host) {
      this.warnOnce("host-" + view.getMode(),
        `Could not find the ${view.getMode()} content container (Obsidian's DOM may have changed); ` +
        "falling back to the view's content element.");
      host = view.contentEl;
    }

    let vs = this.views.get(view);
    if (vs && vs.el.parentElement !== host) {
      host.appendChild(vs.el);
      vs.panes.forEach((p) => (p.signature = ""));
      if (vs.base) vs.base.signature = "";
      this.watchHost(vs, host);
    }
    if (!vs) {
      vs = this.createViewState(host);
      this.views.set(view, vs);
      this.allViews.add(vs);
      this.watchHost(vs, host);
    }

    const switched = vs.notePath !== file.path;
    this.loadConfig(vs, file);
    if (switched || !vs.base) this.resetBase(vs);
    vs.el.appendChild(vs.addBtn);
    if (vs.el.firstChild !== vs.base!.el) vs.el.prepend(vs.base!.el); // always the first pane

    const sources = this.getBacklinkSources(file);
    for (const pane of vs.panes) this.refreshPane(pane, file, sources);
    this.refreshPane(vs.base!, file, sources);
  }

  private updatePane(st: PanelState) {
    const f = st.view.notePath ? this.app.vault.getAbstractFileByPath(st.view.notePath) : null;
    if (!(f instanceof TFile)) return;
    st.signature = "";
    this.refreshPane(st, f, this.getBacklinkSources(f));
  }

  private refreshPane(st: PanelState, file: TFile, backlinks: TFile[]) {
    // collapsed and never expanded: show the backlink count only (a query pane's count needs the query run)
    if (st.deferred) { st.countEl.setText(st.config.query.trim() ? "" : String(backlinks.length)); return; }
    const q = st.config.query.trim();
    const id = ++st.reqId;
    if (!q) {
      st.error = "";
      return this.finishRefresh(st, file, backlinks, "");
    }
    void this.runQuery(q, file).then((r) => {
      if (id !== st.reqId) return; // superseded
      st.error = r.error ?? "";
      this.finishRefresh(st, file, r.files, q);
    });
  }

  /** Runs a Dataview query (DQL) and collects the notes it references. */
  private async runQuery(query: string, origin: TFile): Promise<{ files: TFile[]; error?: string }> {
    const dv = (this.app as any).plugins?.plugins?.dataview?.api;
    if (!dv) return { files: [], error: "Dataview plugin is not installed or enabled." };
    try {
      const res = await dv.query(query, origin.path);
      if (!res?.successful) return { files: [], error: "Dataview: " + String(res?.error ?? "query failed") };
      const paths = new Set<string>();
      const walk = (v: any, depth: number) => {
        if (v == null || depth > 5 || typeof v !== "object") return;
        if (typeof v.path === "string") { paths.add(v.path); return; }          // Link / task
        if (typeof v.file?.path === "string") { paths.add(v.file.path); return; } // page object
        if (Array.isArray(v)) { for (const x of v) walk(x, depth + 1); return; }
        if (Array.isArray(v.values)) { for (const x of v.values) walk(x, depth + 1); return; } // DataArray / result
        if (Object.getPrototypeOf(v) === Object.prototype) for (const x of Object.values(v)) walk(x, depth + 1);
      };
      walk(res.value?.values ?? res.value, 0);
      const files: TFile[] = [];
      for (const p of paths) {
        const f = this.app.vault.getAbstractFileByPath(p);
        if (f instanceof TFile && f.extension === "md") files.push(f);
      }
      return { files, error: files.length ? undefined : "The query returned no note links (use LIST or TABLE with file.link)." };
    } catch (e) {
      return { files: [], error: "Dataview: " + String((e as Error)?.message ?? e) };
    }
  }

  private finishRefresh(st: PanelState, file: TFile, sources: TFile[], q: string) {
    const sig =
      q + "|" + st.error + "|" + file.path + "|" +
      sources.map((s) => {
        const fm = this.app.metadataCache.getFileCache(s)?.frontmatter;
        return s.path + ":" + s.stat.mtime + ":" + JSON.stringify(fm ?? {});
      }).join(",");
    if (sig === st.signature) return;
    st.signature = sig;
    this.sync(st, sources);
    this.pruneOpen(st);
  }

  /** True once Obsidian's link index covers the whole vault (so missing backlinks really are gone). */
  private linksReady(): boolean {
    if (this.linksResolvedOnce) return true;
    const resolved = Object.keys(this.app.metadataCache.resolvedLinks).length;
    return resolved > 0 && resolved >= this.app.vault.getMarkdownFiles().length;
  }

  /**
   * Drop remembered cards that are no longer in the pane's results (deleted, renamed, or no longer matching
   * the query), so `open:` only lists existing notes. Skipped while indexes are still loading or the query
   * failed, when an empty or partial result would wrongly wipe the list.
   */
  private pruneOpen(st: PanelState) {
    if (!st.config.open.length || st.error || !this.linksReady()) return;
    if (st.config.query && !(this.app as any).plugins?.plugins?.dataview?.index?.initialized) return;
    const keep = st.config.open.filter((p) => st.items.has(p));
    if (keep.length === st.config.open.length) return;
    const gone = st.config.open.filter((p) => !st.items.has(p));
    for (const p of gone) st.opened.delete(p);
    st.openOrder = st.openOrder.filter((p) => st.items.has(p));
    st.config.open = keep;
    this.persist(st);
  }

  // ---------- panel skeleton ----------

  private createPanel(vs: ViewState, config: Settings, ephemeral = false): PanelState {
    const el = vs.el.createDiv({ cls: PANEL_CLASS });
    vs.el.appendChild(vs.addBtn);
    const component = new Component();
    component.load();

    const header = el.createDiv({ cls: "bfv-header" });
    const chev = header.createSpan({ cls: "bfv-chevron" });
    const titleEl = header.createSpan({ cls: "bfv-title", text: "Backlinks" });
    const countEl = header.createSpan({ cls: "bfv-count" });
    const rmBtn = header.createEl("button", {
      cls: "bfv-icon-btn bfv-remove", text: "✕", attr: { "aria-label": "Remove this backlinks pane" },
    });

    const body = el.createDiv({ cls: "bfv-body" });
    const bar = body.createDiv({ cls: "bfv-toolbar" });
    const sortBtn = bar.createEl("button", { cls: "bfv-tool-btn" });
    const filterBtn = bar.createEl("button", { cls: "bfv-tool-btn" });
    const searchInput = bar.createEl("input", {
      cls: "bfv-filter", type: "text", placeholder: "Search… (a b, a OR b, NOT a, \"a phrase\", ( ))",
      attr: { title: "Adjacent words must all match. Use OR, NOT (or -word), \"quoted phrases\" and parentheses; operators in capitals." },
    });
    const ftLabel = bar.createEl("label", { cls: "bfv-fulltext", attr: { title: "Also search the text of every note in this pane" } });
    const ftBox = ftLabel.createEl("input", { type: "checkbox" });
    ftLabel.appendText("Full text");
    const titleInput = body.createEl("input", {
      cls: "bfv-query bfv-title-input", type: "text", placeholder: "Pane title (optional)",
    });
    titleInput.value = config.title;
    const queryInput = body.createEl("input", {
      cls: "bfv-query", type: "text",
      placeholder: 'Dataview query (optional, replaces backlinks) e.g. LIST FROM "Projects" WHERE status = "active"',
    });
    queryInput.value = config.query;
    const sortPanel = body.createDiv({ cls: "bfv-editor bfv-hidden" });
    const filterPanel = body.createDiv({ cls: "bfv-editor bfv-hidden" });
    const listEl = body.createDiv({ cls: "bfv-list" });
    const emptyEl = body.createDiv({ cls: "bfv-empty" });

    const st: PanelState = {
      el, listEl, countEl, filterBtn, sortBtn, filterPanel, sortPanel, component,
      // every pane starts collapsed and is built on first expand
      signature: "", collapsed: true, ephemeral, deferred: true, opened: new Set(config.open), openOrder: [...config.open].reverse(), items: new Map(),
      propDefs: [...FILE_PROPS], types: new Map(), search: "", emptyEl,
      fullText: false, searchId: 0, itemsVersion: 0, sortedKey: "",
      titleEl, queryInput, titleInput, reqId: 0, error: "", config, view: vs,
      renderEditors: () => {
        if (!filterPanel.hasClass("bfv-hidden")) this.renderFilterEditor(st);
        if (!sortPanel.hasClass("bfv-hidden")) this.renderSortEditor(st);
      },
      updateButtons: () => {
        const nf = this.countRules(st.config.filter);
        const ns = st.config.sorts.length;
        filterBtn.setText("Filter" + (nf ? ` · ${nf}` : ""));
        sortBtn.setText("Sort" + (ns ? ` · ${ns}` : ""));
        filterBtn.toggleClass("is-active", nf > 0);
        sortBtn.toggleClass("is-active", ns > 0);
      },
    };

    const applyCollapse = () => {
      el.toggleClass("is-collapsed", st.collapsed);
      chev.setText(st.collapsed ? "▸" : "▾");
    };
    header.addEventListener("click", () => {
      st.collapsed = !st.collapsed;
      applyCollapse();
      if (!st.collapsed && st.deferred) { st.deferred = false; this.updatePane(st); }
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
    const onSearch = debounce(() => { st.search = searchInput.value; this.applyView(st); }, 150, true);
    searchInput.addEventListener("input", onSearch);
    ftBox.addEventListener("change", () => { st.fullText = ftBox.checked; this.applyView(st); });

    const onQuery = debounce(() => {
      st.config.query = queryInput.value.trim();
      this.persist(st);
      this.updateTitles(st.view);
      this.updatePane(st);
    }, 600, true);
    queryInput.addEventListener("input", onQuery);
    const onTitle = debounce(() => {
      st.config.title = titleInput.value.trim();
      this.persist(st);
      this.updateTitles(st.view);
    }, 400, true);
    titleInput.addEventListener("input", onTitle);
    rmBtn.addEventListener("click", (e) => { e.stopPropagation(); this.removePane(vs, st); });
    st.updateButtons();
    return st;
  }

  // ---------- config editing UI ----------

  /** Mark a pane's settings as changed and schedule a frontmatter write (never for the built-in pane). */
  private persist(st: PanelState) {
    if (st.ephemeral) return;
    st.view.dirty = true;
    st.view.save();
  }

  /** (Re)creates the built-in "All backlinks" pane (shown first): collapsed, unsaved, built on first expand. */
  private resetBase(vs: ViewState) {
    if (vs.base) { vs.base.component.unload(); vs.base.el.remove(); }
    vs.base = this.createPanel(vs, defaults(), true);
    vs.base.titleEl.setText("All backlinks");
  }

  /** Called after any filter/sort edit. structural=true re-renders editors (including the source). */
  private configChanged(st: PanelState, structural: boolean) {
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
  //   - filter:
  //     sort:

  private parseList(raw: unknown): Settings[] {
    const arr = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : [];
    const out = arr.map((e: any) =>
      this.parseConfig({ title: e?.title, filter: this.jsonish(e?.filter), sort: this.jsonish(e?.sort), query: e?.query, open: this.jsonish(e?.open) })
    );
    return out;
  }

  private loadConfig(vs: ViewState, file: TFile) {
    const switched = vs.notePath !== file.path;
    if (!switched && (vs.dirty || Date.now() < vs.graceUntil)) return; // keep our own pending/just-written edits
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    const list = this.parseList(fm?.backlinks);
    const json = JSON.stringify(list);
    if (!switched && json === vs.savedJson) return;

    if (switched && vs.dirty) void this.writeConfig(vs); // flush edits belonging to the previous note
    vs.notePath = file.path;
    vs.savedJson = json;
    vs.dirty = false;

    if (switched) {
      for (const p of vs.panes) { p.component.unload(); p.el.remove(); }
      vs.panes = [];
    }
    // match pane count to the list, reusing existing panes (keeps their UI state)
    while (vs.panes.length > list.length) {
      const p = vs.panes.pop()!;
      p.component.unload();
      p.el.remove();
    }
    list.forEach((cfg, i) => {
      if (vs.panes[i]) {
        vs.panes[i].config = cfg;
        vs.panes[i].queryInput.value = cfg.query;
        vs.panes[i].titleInput.value = cfg.title;
        this.syncOpen(vs.panes[i]);
        vs.panes[i].updateButtons();
        if (!switched) { vs.panes[i].renderEditors(); this.applyView(vs.panes[i]); }
      } else {
        vs.panes.push(this.createPanel(vs, cfg));
      }
    });
    this.updateTitles(vs);
  }

  /** Accepts a JSON string (current format) or an already-parsed value (hand-written YAML). */
  private jsonish(v: unknown): unknown {
    if (typeof v !== "string") return v;
    try { return JSON.parse(v); } catch { return undefined; }
  }

  private parseConfig(raw: unknown): Settings {
    const d = defaults();
    if (!raw || typeof raw !== "object") return d;
    const r = raw as Record<string, unknown>;
    const filter = this.sanitizeGroup(r.filter) ?? d.filter;
    const sorts = Array.isArray(r.sort)
      ? r.sort
          .filter((x: any) => x && typeof x.prop === "string")
          .map((x: any): SortRule => ({ prop: x.prop, dir: x.dir === "desc" ? "desc" : "asc" }))
      : d.sorts;
    const query = typeof r.query === "string" ? r.query.trim() : "";
    const title = typeof r.title === "string" || typeof r.title === "number" ? String(r.title).trim() : "";
    const open = Array.isArray(r.open)
      ? [...new Set(r.open.filter((x: unknown): x is string => typeof x === "string" && x !== ""))].slice(0, MAX_OPEN_SAVED)
      : [];
    return { title, filter, sorts, query, open };
  }

  private sanitizeGroup(x: any): Group | null {
    if (!x || typeof x !== "object" || !Array.isArray(x.children)) return null;
    const children: Node[] = [];
    for (const c of x.children) {
      if (Array.isArray(c?.children)) {
        const g = this.sanitizeGroup(c);
        if (g) children.push(g);
      } else if (typeof c?.prop === "string" && typeof c?.op === "string") {
        children.push({ type: "rule", prop: c.prop, op: c.op, value: String(c.value ?? "") });
      }
    }
    const mode = x.mode === "or" || x.mode === "not" ? x.mode : "and";
    return { type: "group", mode, children };
  }

  private async writeConfig(vs: ViewState) {
    const file = vs.notePath ? this.app.vault.getAbstractFileByPath(vs.notePath) : null;
    if (!(file instanceof TFile)) return;
    if (typeof this.app.fileManager?.processFrontMatter !== "function") return;
    const def = defaults();
    // canonical form: what parseList will read back, so our own write is recognised as a no-op
    const list = this.parseList(vs.panes.map((p) => ({
      title: p.config.title,
      filter: JSON.parse(JSON.stringify(p.config.filter)),
      sort: JSON.parse(JSON.stringify(p.config.sorts)),
      query: p.config.query,
      open: p.config.open,
    })));
    const allDefault = list.length === 0;
    vs.savedJson = JSON.stringify(list);
    vs.dirty = false;
    vs.graceUntil = Date.now() + 1500;
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      if (allDefault) { delete fm.backlinks; return; }
      fm.backlinks = list.map((c) => ({
        title: c.title || null,
        filter: JSON.stringify(c.filter) === JSON.stringify(def.filter) ? null : JSON.stringify(c.filter),
        sort: JSON.stringify(c.sorts) === JSON.stringify(def.sorts) ? null : JSON.stringify(c.sorts),
        query: c.query || null,
        open: c.open.length ? c.open : null,
      }));
    });
  }

  private typeOf(st: PanelState, id: string): PropType {
    return st.types.get(id) ?? FILE_PROPS.find((p) => p.id === id)?.type ?? "text";
  }

  private propSelect(parent: HTMLElement, st: PanelState, current: string, onChange: (v: string) => void) {
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

  private renderFilterEditor(st: PanelState) {
    st.filterPanel.empty();
    this.renderGroup(st.filterPanel, st.config.filter, st);
  }

  private renderGroup(parentEl: HTMLElement, group: Group, st: PanelState, onRemove?: () => void) {
    const box = parentEl.createDiv({ cls: "bfv-group" });
    const head = box.createDiv({ cls: "bfv-group-head" });
    const modeSel = head.createEl("select", { cls: "dropdown" });
    for (const [v, l] of [["and", "All"], ["or", "Any"], ["not", "None"]]) {
      modeSel.createEl("option", { value: v, text: l });
    }
    modeSel.value = group.mode;
    modeSel.addEventListener("change", () => {
      group.mode = modeSel.value as Group["mode"];
      this.configChanged(st, false);
    });
    head.createSpan({ text: "of the following are true", cls: "bfv-muted" });
    if (onRemove) {
      const del = head.createEl("button", { cls: "bfv-icon-btn", text: "✕", attr: { "aria-label": "Remove group" } });
      del.addEventListener("click", onRemove);
    }

    const kids = box.createDiv({ cls: "bfv-group-kids" });
    group.children.forEach((c, i) => {
      const remove = () => { group.children.splice(i, 1); this.configChanged(st, true); };
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

  private renderRule(parentEl: HTMLElement, rule: Rule, st: PanelState, onRemove: () => void) {
    const row = parentEl.createDiv({ cls: "bfv-rule" });
    const type = this.typeOf(st, rule.prop);
    if (!OPS[type].includes(rule.op)) {
      // operator invalid for this property type: fix it and write the fix back so UI == frontmatter
      rule.op = OPS[type][0];
      this.persist(st);
    }

    this.propSelect(row, st, rule.prop, (v) => {
      rule.prop = v;
      const nt = this.typeOf(st, v);
      if (!OPS[nt].includes(rule.op)) rule.op = OPS[nt][0];
      if (nt !== type) rule.value = "";
      this.configChanged(st, true);
    });

    const opSel = row.createEl("select", { cls: "dropdown bfv-op" });
    for (const o of OPS[type]) opSel.createEl("option", { value: o, text: o });
    opSel.value = rule.op;
    opSel.addEventListener("change", () => { rule.op = opSel.value; this.configChanged(st, true); });

    if (!NO_VALUE.has(rule.op)) {
      const input = row.createEl("input", {
        cls: "bfv-value",
        type: type === "number" ? "number" : "text",
        placeholder: type === "date" ? "YYYY-MM-DD, today, today-7d" : "Value",
      });
      input.value = rule.value;
      const commit = debounce(() => this.configChanged(st, false), 200, true);
      input.addEventListener("input", () => { rule.value = input.value; commit(); });
    }

    const del = row.createEl("button", { cls: "bfv-icon-btn", text: "✕", attr: { "aria-label": "Remove filter" } });
    del.addEventListener("click", onRemove);
  }

  private renderSortEditor(st: PanelState) {
    const el = st.sortPanel;
    el.empty();
    const sorts = st.config.sorts;
    sorts.forEach((s, i) => {
      const row = el.createDiv({ cls: "bfv-rule" });
      this.propSelect(row, st, s.prop, (v) => { s.prop = v; this.configChanged(st, true); });
      const [asc, desc] = dirLabels(this.typeOf(st, s.prop));
      const dir = row.createEl("select", { cls: "dropdown bfv-op" });
      dir.createEl("option", { value: "asc", text: asc });
      dir.createEl("option", { value: "desc", text: desc });
      dir.value = s.dir;
      dir.addEventListener("change", () => { s.dir = dir.value as SortRule["dir"]; this.configChanged(st, false); });
      const up = row.createEl("button", { cls: "bfv-icon-btn", text: "↑", attr: { "aria-label": "Move up" } });
      up.disabled = i === 0;
      up.addEventListener("click", () => { [sorts[i - 1], sorts[i]] = [sorts[i], sorts[i - 1]]; this.configChanged(st, true); });
      const del = row.createEl("button", { cls: "bfv-icon-btn", text: "✕", attr: { "aria-label": "Remove sort" } });
      del.addEventListener("click", () => { sorts.splice(i, 1); this.configChanged(st, true); });
    });
    el.createEl("button", { text: "+ Add sort" }).addEventListener("click", () => {
      sorts.push({ prop: "file.name", dir: "asc" });
      this.configChanged(st, true);
    });
  }

  private countRules(g: Group): number {
    return g.children.reduce((n, c) => n + (c.type === "group" ? this.countRules(c) : 1), 0);
  }

  // ---------- data sync ----------

  private sync(st: PanelState, sources: TFile[]) {
    const seen = new Set<string>();
    const keyLabels = new Map<string, string>();

    for (const src of sources) {
      seen.add(src.path);
      const cache = this.app.metadataCache.getFileCache(src);
      const fm = (cache?.frontmatter ?? {}) as Record<string, unknown>;
      const props: Record<string, string[]> = {};
      const lists = new Set<string>();
      for (const k of Object.keys(fm)) {
        if (k === "position") continue;
        const lk = k.toLowerCase();
        props[lk] = toStrings(fm[k]);
        if (Array.isArray(fm[k])) lists.add(lk);
        if (!keyLabels.has(lk)) keyLabels.set(lk, k);
      }
      const tags = [
        ...(cache?.tags ?? []).map((t) => t.tag.replace(/^#/, "")),
        ...toStrings(fm.tags ?? fm.tag).map((t) => t.replace(/^#/, "")),
      ];
      const sig = src.stat.mtime + JSON.stringify(fm);

      const old = st.items.get(src.path);
      if (old && old.sig === sig) {
        if (old.file.path !== src.path) st.itemsVersion++;
        Object.assign(old, { file: src, props, lists, tags, hay: undefined });
        continue;
      }
      if (old) { st.component.removeChild(old.comp); old.el.remove(); }
      st.items.set(src.path, this.createItem(st, src, sig, props, lists, tags));
      st.itemsVersion++;
    }
    for (const [path, it] of st.items) {
      if (!seen.has(path)) {
        st.component.removeChild(it.comp);
        it.el.remove();
        st.items.delete(path);
        st.itemsVersion++;
      }
    }

    // property catalogue + type inference
    const defs: PropDef[] = [...FILE_PROPS];
    st.types = new Map(FILE_PROPS.map((p) => [p.id, p.type]));
    const items = [...st.items.values()];
    for (const [lk, label] of [...keyLabels].sort((a, b) => a[1].localeCompare(b[1]))) {
      const id = "note." + lk;
      const type = this.inferType(items, lk);
      defs.push({ id, label, type, group: "note" });
      st.types.set(id, type);
    }
    st.propDefs = defs;

    st.renderEditors();
    this.applyView(st);
  }

  private inferType(items: ItemState[], lk: string): PropType {
    if (items.some((i) => i.lists.has(lk))) return "list";
    const vals = items.flatMap((i) => i.props[lk] ?? []).filter((v) => v !== "");
    if (!vals.length) return "text";
    if (vals.every((v) => /^(true|false)$/i.test(v))) return "boolean";
    if (vals.every((v) => !isNaN(Number(v)))) return "number";
    if (vals.every((v) => DATE_RE.test(v))) return "date";
    return "text";
  }

  // ---------- evaluation ----------

  private getVals(it: ItemState, id: string): string[] {
    const f = it.file;
    switch (id) {
      case "file.name": return [f.basename];
      case "file.path": return [f.path];
      case "file.folder": return [f.parent && f.parent.path !== "/" ? f.parent.path : ""];
      case "file.ext": return [f.extension];
      case "file.ctime": return [localIso(f.stat.ctime)];
      case "file.mtime": return [localIso(f.stat.mtime)];
      case "file.size": return [String(f.stat.size)];
      case "file.tags": return it.tags;
    }
    return id.startsWith("note.") ? it.props[id.slice(5)] ?? [] : [];
  }

  private evalRule(st: PanelState, it: ItemState, r: Rule): boolean {
    const type = this.typeOf(st, r.prop);
    const vals = this.getVals(it, r.prop);
    const present = vals.filter((v) => v !== "");
    if (r.op === "is empty") return present.length === 0;
    if (r.op === "is not empty") return present.length > 0;
    if (r.op === "is true") return present[0]?.toLowerCase() === "true";
    if (r.op === "is false") return present[0]?.toLowerCase() === "false";

    const raw = r.value.trim();
    if (raw === "") return true; // incomplete rule: ignored, like Bases
    const v = raw.toLowerCase();
    const lower = present.map((x) => x.toLowerCase());

    if (type === "number") {
      const target = Number(raw);
      if (isNaN(target)) return true;
      const n = Number(present[0]);
      if (!present.length || isNaN(n)) return r.op === "≠";
      switch (r.op) {
        case "=": return n === target;
        case "≠": return n !== target;
        case "<": return n < target;
        case "≤": return n <= target;
        case ">": return n > target;
        case "≥": return n >= target;
      }
      return true;
    }
    if (type === "date") {
      const t = normDate(raw);
      const d = present[0]?.slice(0, 10);
      if (!d) return r.op === "is not";
      switch (r.op) {
        case "is": return d === t;
        case "is not": return d !== t;
        case "before": return d < t;
        case "after": return d > t;
        case "on or before": return d <= t;
        case "on or after": return d >= t;
      }
      return true;
    }
    if (type === "list") {
      const w = v.replace(/^#/, "");
      const has = lower.some((x) => x === w || x.startsWith(w + "/"));
      return r.op === "contains" ? has : !has;
    }
    // text / boolean
    switch (r.op) {
      case "is": return lower.some((x) => x === v);
      case "is not": return !lower.some((x) => x === v);
      case "contains": return lower.some((x) => x.includes(v));
      case "does not contain": return !lower.some((x) => x.includes(v));
      case "starts with": return lower.some((x) => x.startsWith(v));
      case "ends with": return lower.some((x) => x.endsWith(v));
    }
    return true;
  }

  private evalNode(st: PanelState, it: ItemState, n: Node): boolean {
    if (n.type === "rule") return this.evalRule(st, it, n);
    if (!n.children.length) return true;
    const res = n.children.map((c) => this.evalNode(st, it, c));
    if (n.mode === "and") return res.every(Boolean);
    if (n.mode === "or") return res.some(Boolean);
    return !res.some(Boolean);
  }

  /** Lower-cased path, tags and properties of a note: what a normal (not full-text) search looks in. */
  private hayOf(it: ItemState): string {
    return [
      it.file.path, ...it.tags,
      ...Object.entries(it.props).flatMap(([k, vs]) => [k, ...vs]),
    ].join("\n").toLowerCase();
  }

  /** Reads (and caches, lower-cased) the text of notes for full-text search, 100 at a time. */
  private async loadBodies(items: ItemState[]) {
    for (let i = 0; i < items.length; i += 100) {
      await Promise.all(items.slice(i, i + 100).map(async (it) => {
        if (it.body !== undefined) return;
        try { it.body = (await this.app.vault.cachedRead(it.file)).toLowerCase(); } catch { it.body = ""; }
      }));
    }
  }

  private compareItems(st: PanelState, a: ItemState, b: ItemState): number {
    for (const s of st.config.sorts) {
      const t = this.typeOf(st, s.prop);
      const av = this.getVals(a, s.prop).filter((x) => x !== "").join(", ");
      const bv = this.getVals(b, s.prop).filter((x) => x !== "").join(", ");
      if (!av && !bv) continue;
      if (!av) return 1; // empty values always last
      if (!bv) return -1;
      let r = 0;
      if (t === "number") { r = Number(av) - Number(bv); if (isNaN(r)) r = 0; }
      else if (t === "date") r = av.slice(0, 16) < bv.slice(0, 16) ? -1 : av.slice(0, 16) > bv.slice(0, 16) ? 1 : 0;
      else if (t === "boolean") r = (av.toLowerCase() === "true" ? 1 : 0) - (bv.toLowerCase() === "true" ? 1 : 0);
      else r = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
      if (r !== 0) return s.dir === "asc" ? r : -r;
    }
    return a.file.path.localeCompare(b.file.path);
  }

  /**
   * Sort, search and filter a pane. The DOM is only reordered when the sort or the set of notes changes;
   * a search or filter change just toggles visibility on the cards whose visibility actually changed.
   */
  private applyView(st: PanelState) {
    const all = [...st.items.values()];
    const sortKey = JSON.stringify(st.config.sorts) + "|" + st.itemsVersion;
    if (sortKey !== st.sortedKey) {
      all.sort((a, b) => this.compareItems(st, a, b));
      const frag = document.createDocumentFragment();
      for (const it of all) frag.appendChild(it.el);
      st.listEl.appendChild(frag);
      st.sortedKey = sortKey;
    }
    const q = st.search.trim();
    const tree = q ? parseSearch(q) : null;
    const id = ++st.searchId;
    if (tree && st.fullText) {
      const missing = all.filter((it) => it.body === undefined);
      if (missing.length) {
        st.countEl.setText(`Reading ${missing.length} notes…`);
        void this.loadBodies(missing).then(() => { if (id === st.searchId) this.showMatches(st, all, tree, q); });
        return; // keep the current view until the text is loaded
      }
    }
    this.showMatches(st, all, tree, q);
  }

  private showMatches(st: PanelState, all: ItemState[], tree: SearchNode | null, q: string) {
    let shown = 0;
    for (const it of all) {
      let ok = true;
      if (tree) {
        if (it.hay === undefined) it.hay = this.hayOf(it);
        const hay = it.hay;
        const body = st.fullText ? it.body ?? "" : "";
        ok = evalSearch(tree, (t) => hay.includes(t) || (body !== "" && body.includes(t)));
      }
      if (ok) ok = this.evalNode(st, it, st.config.filter);
      if (ok) shown++;
      if (it.el.hasClass("bfv-hidden") === ok) it.el.toggleClass("bfv-hidden", !ok);
    }
    const filtered = q !== "" || this.countRules(st.config.filter) > 0;
    st.countEl.setText(filtered ? `${shown} / ${all.length}` : String(all.length));
    st.emptyEl.setText(
      st.error ? st.error : all.length === 0 ? (st.config.query ? "No notes." : "No backlinks found.") : shown === 0 ? "No notes match the filters." : ""
    );
  }

  // ---------- cards ----------

  private createItem(
    st: PanelState, src: TFile, sig: string,
    props: Record<string, string[]>, lists: Set<string>, tags: string[]
  ): ItemState {
    const { el, comp, setOpen } = this.buildCard(st.listEl, src, st.component, st.opened,
      (path, open) => this.cardToggled(st, path, open));
    return { file: src, sig, el, comp, setOpen, props, lists, tags };
  }

  /** The user expanded or collapsed a card: update recency and persist the most recent MAX_OPEN_SAVED. */
  private cardToggled(st: PanelState, path: string, open: boolean) {
    st.openOrder = st.openOrder.filter((p) => p !== path);
    if (open) st.openOrder.push(path);
    // drop remembered cards that are no longer in this pane (only once the pane has loaded its notes)
    if (st.items.size && !st.error) st.openOrder = st.openOrder.filter((p) => st.items.has(p));
    st.config.open = st.openOrder.slice(-MAX_OPEN_SAVED).reverse();
    this.persist(st);
  }

  /** Frontmatter changed from outside: expand exactly the cards it lists. */
  private syncOpen(st: PanelState) {
    st.opened.clear(); // mutate in place: existing cards hold a reference to this set
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
  private wireLinks(el: HTMLElement) {
    const hoverParent = { hoverPopover: null as any };
    const linkOf = (evt: Event) => {
      const a = (evt.target as HTMLElement | null)?.closest?.("a.internal-link") as HTMLElement | null;
      return a && el.contains(a) ? a : null;
    };
    const sourceOf = (a: HTMLElement) => a.closest("[data-bfv-path]")?.getAttribute("data-bfv-path") ?? "";
    const open = (evt: MouseEvent, a: HTMLElement, newLeaf: ReturnType<typeof Keymap.isModEvent>) => {
      const href = a.getAttribute("data-href") ?? a.getAttribute("href");
      if (!href) return;
      evt.preventDefault();
      evt.stopPropagation();
      void this.app.workspace.openLinkText(href, sourceOf(a), newLeaf);
    };
    el.addEventListener("click", (evt) => {
      const a = linkOf(evt);
      if (a) open(evt, a, Keymap.isModEvent(evt));
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
        event: evt, source: HOVER_SOURCE, hoverParent, targetEl: a, linktext: href, sourcePath: sourceOf(a),
      });
    });
  }

  /**
   * A full-note collapsible card. It starts collapsed unless its path is in `opened`, and the note is only
   * read and rendered when the card is first expanded, so large panes stay cheap.
   */
  private buildCard(
    parentEl: HTMLElement, src: TFile, parentComp: Component, opened: Set<string>,
    onToggle?: (path: string, open: boolean) => void,
  ) {
    const comp = new Component();
    parentComp.addChild(comp);

    const item = parentEl.createDiv({ cls: "bfv-item" });
    item.setAttr("data-bfv-path", src.path);
    const ih = item.createDiv({ cls: "bfv-item-header" });
    const ichev = ih.createSpan({ cls: "bfv-chevron" });
    ih.createEl("a", {
      cls: "bfv-item-title internal-link", text: src.basename, href: src.path,
      attr: { "data-href": src.path },
    });
    const folder = src.parent && src.parent.path !== "/" ? src.parent.path : "";
    if (folder) ih.createSpan({ cls: "bfv-item-path", text: folder + "/" });

    const content = item.createDiv({ cls: "bfv-item-content markdown-rendered" });

    let rendered = false;
    const setOpen = async (open: boolean) => {
      item.toggleClass("is-collapsed", !open);
      ichev.setText(open ? "▾" : "▸");
      if (open && !rendered) {
        rendered = true;
        try {
          const text = await this.app.vault.cachedRead(src);
          this.renderProperties(content, src);
          await MarkdownRenderer.render(this.app, text, content, src.path, comp);
        } catch (e) {
          console.error("[backlinks-full-view] failed to render", src.path, e);
          content.createDiv({ cls: "bfv-empty", text: "Couldn't render this note." });
        }
      }
    };
    ih.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("a")) return; // the title link navigates; it doesn't toggle
      const willOpen = item.hasClass("is-collapsed");
      if (willOpen) opened.add(src.path); else opened.delete(src.path);
      void setOpen(willOpen);
      onToggle?.(src.path, willOpen);
    });
    void setOpen(opened.has(src.path));

    return { el: item, comp, setOpen };
  }

  /**
   * A compact, read-only properties table at the top of a card (MarkdownRenderer drops frontmatter).
   * Wiki links become internal links, so the panel's click/hover handling applies to them. `backlinks`
   * is pane config, not content, so it's left out.
   */
  private renderProperties(el: HTMLElement, src: TFile) {
    const fm = this.app.metadataCache.getFileCache(src)?.frontmatter as Record<string, unknown> | undefined;
    const keys = Object.keys(fm ?? {}).filter((k) => k !== "backlinks" && k !== "position");
    if (!fm || !keys.length) return;
    const table = el.createDiv({ cls: "bfv-props" });
    const LINK = /^\[\[([^\]|#]+)(#[^\]|]*)?(?:\|([^\]]*))?\]\]$/;
    const value = (cell: HTMLElement, v: unknown, key: string) => {
      if (v === null || v === undefined || v === "") return;
      if (typeof v === "string") {
        const m = v.match(LINK);
        if (m) {
          const target = m[1] + (m[2] ?? "");
          const dest = this.app.metadataCache.getFirstLinkpathDest(m[1], src.path);
          cell.createEl("a", {
            cls: "internal-link" + (dest ? "" : " is-unresolved"),
            text: m[3] ?? (dest?.basename ?? m[1].split("/").pop() ?? m[1]) + (m[2] ?? ""),
            href: target, attr: { "data-href": target },
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
      const row = table.createDiv({ cls: "bfv-prop" });
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

  // ---------- public API (for DataviewJS) ----------
  //
  //   bfv.embed(dv, dv.pages('#project'));                    // full, collapsible notes
  //   bfv.embed(dv, dv.pages('"Inbox"'), { collapsed: true }); // start collapsed
  //   (bfv is a global alias of app.plugins.plugins["obsidian-backlinks-full-view"].api)

  api = {
    embed: (target: any, pages: any, opts: { collapsed?: boolean; sourcePath?: string; limit?: number } = {}): HTMLElement => {
      const container: HTMLElement = target instanceof HTMLElement ? target : target.container;
      const parentComp: Component = target?.component ?? this;
      const sourcePath: string = opts.sourcePath ?? target?.currentFilePath ?? "";
      const arr: any[] = Array.isArray(pages)
        ? pages
        : Array.isArray(pages?.values) ? pages.values : Array.from(pages ?? []);

      const wrap = container.createDiv({ cls: "bfv-embeds" });
      this.wireLinks(wrap);

      // Cycle guard: never embed a note that is already being rendered above us
      // (the note holding this block, or any card this block sits inside).
      const ancestors = new Set<string>();
      if (sourcePath) ancestors.add(sourcePath);
      let depth = 0;
      for (let el: HTMLElement | null = container.closest("[data-bfv-path]"); el; el = el.parentElement?.closest("[data-bfv-path]") ?? null) {
        ancestors.add(el.getAttribute("data-bfv-path") ?? "");
        depth++;
      }
      if (depth >= MAX_EMBED_DEPTH) {
        wrap.createDiv({ cls: "bfv-empty", text: "Embed depth limit reached." });
        return wrap;
      }

      const limit = opts.limit ?? DEFAULT_EMBED_LIMIT;
      let total = 0;
      const opened = new Set<string>();
      const seen = new Set<string>();
      for (const p of arr) {
        const path: string | undefined = typeof p === "string" ? p : p?.file?.path ?? p?.path;
        if (!path) continue;
        const f = this.app.vault.getAbstractFileByPath(path)
          ?? this.app.metadataCache.getFirstLinkpathDest(path, sourcePath);
        if (!(f instanceof TFile) || f.extension !== "md" || seen.has(f.path) || ancestors.has(f.path)) continue;
        seen.add(f.path);
        total++;
        if (total > limit) continue; // counted, not rendered
        if (!opts.collapsed) opened.add(f.path); // bfv.embed() keeps opening cards unless asked not to
        this.buildCard(wrap, f, parentComp, opened);
      }
      if (total > limit) {
        wrap.createDiv({ cls: "bfv-empty", text: `Showing ${limit} of ${total} notes. Pass { limit: N } to show more.` });
      }
      if (!total) wrap.createDiv({ cls: "bfv-empty", text: "No notes to embed." });
      return wrap;
    },
  };
}
