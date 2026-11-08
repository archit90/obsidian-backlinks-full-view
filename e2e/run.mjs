// End-to-end tests of Backlinks Full View in a real Obsidian, driven over the Chrome DevTools Protocol with
// real mouse and key input where a user would use them. The catalogue is ../TEST-CASES.md; every case here
// carries its id from there.
//
// Usage (from the plugin folder)
//   npm run build && e2e/sandbox.sh reset 1 && npm run e2e         alone: a fresh vault with only this plugin
//   OBS_PLUGINS=blacksmithgu/obsidian-dataview@0.5.68:<path to Editor Multiple Lanes' build> \
//     OBS_SANDBOX_DIR=$PWD/.sandbox-together e2e/sandbox.sh reset 1 && npm run e2e     together with them
//   node e2e/run.mjs [--filter <regex>] [--no-deploy]   (CDP_PORT: default the sandbox's, see e2e/cdp.mjs)
// It refuses any vault but a sandbox's (it rewrites `_bfv/`, edits a few notes and restores them). It prints
// PASS / FAIL / SKIP per check and writes e2e/results.md (unless --filter). A case that needs another plugin
// (`needs`: plugin ids, or `core:<id>` for a core plugin) is skipped without it; E2E_REQUIRE=<id>,<id> makes those
// skips failures. BFV_PERF_SCALE=<factor> scales the time limits of the speed cases (default 1).
// Exits 1 when a case fails.
//
// Not a vitest file: vitest only runs src/**/*.test.ts and test/**/*.test.ts.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertSandboxVault, connect } from "./cdp.mjs";
import { writeFixturesExpr } from "./fixtures.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN = path.dirname(HERE);
const ID = "backlinks-full-view";
const LANES = "editor-multiple-lanes";
const args = process.argv.slice(2);
const opt = n => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const FILTER = opt("--filter") ? new RegExp(opt("--filter"), "i") : null;
const REQUIRE = (process.env.E2E_REQUIRE ?? "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);
const PERF = Number(process.env.BFV_PERF_SCALE) || 1;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- page-side helpers (window.__t) ----------
const PAGE = `(() => {
const T = (window.__t = window.__t || { errors: [] });
T.sleep = ms => new Promise(r => setTimeout(r, ms));
T.view = () => T.leaf?.view;
T.root = () => T.view()?.containerEl.querySelector(".bfv-container");
T.panesOf = root => !root ? null : [...root.querySelectorAll(":scope > .bfv-panel")].map(p => ({
  title: p.querySelector(".bfv-title")?.textContent,
  count: p.querySelector(".bfv-count")?.textContent,
  collapsed: p.classList.contains("is-collapsed"),
  base: p.classList.contains("bfv-base"),
  err: p.querySelector(":scope > .bfv-config-error:not(.bfv-hidden)")?.textContent ?? "",
  empty: p.querySelector(".bfv-empty")?.textContent ?? "",
  items: [...p.querySelectorAll(".bfv-list > .bfv-item")].map(i => ({ path: i.dataset.bfvPath, hidden: i.classList.contains("bfv-hidden"), open: !i.classList.contains("is-collapsed") })),
}));
T.panes = () => T.panesOf(T.root());
T.pane = i => T.root()?.querySelectorAll(":scope > .bfv-panel")[i];
T.card = (i, path) => T.pane(i)?.querySelector('.bfv-item[data-bfv-path="' + path + '"]');
T.shown = (i) => T.panes()[i].items.filter(x => !x.hidden).map(x => x.path.replace(/^_bfv\\/(src\\/)?/, "").replace(/\\.md$/, ""));
T.fm = p => app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(p))?.frontmatter;
T.read = p => app.vault.adapter.read(p);
// Editor Multiple Lanes' cards are ordinary markdown leaves inside a lanes tab: left alone here
T.inLanes = l => !!l.view.containerEl.closest(".lanes-view");
T.closeAll = async () => {
  for (const l of app.workspace.getLeavesOfType("markdown")) if (!T.inLanes(l)) l.detach();
  for (const l of app.workspace.getLeavesOfType("canvas")) l.detach();
  await T.sleep(200);
};
T.open = async (p, mode = "lp", where = "tab") => {
  const leaf = where === "split" ? app.workspace.getLeaf("split") : where === "same" && T.leaf ? T.leaf : app.workspace.getLeaf("tab");
  await leaf.setViewState({ type: "markdown", state: { file: p, mode: mode === "reading" ? "preview" : "source", source: mode === "source" }, active: true });
  app.workspace.setActiveLeaf(leaf, { focus: true });
  T.leaf = leaf;
  // ready once the plugin has refreshed this view for this note
  for (let i = 0; i < 50 && !(T.root()?.querySelector(".bfv-panel") && T.plugin()?.views?.get(leaf.view)?.notePath === p); i++) await T.sleep(100);
  await T.sleep(150);
  return !!T.root();
};
T.rect = el => { el.scrollIntoView({ block: "center" }); const b = el.getBoundingClientRect(); return { x: b.left + Math.min(b.width / 2, 30), y: b.top + b.height / 2 }; };
T.notices = () => [...document.querySelectorAll(".notice")].map(n => n.textContent);
T.clearNotices = async () => { document.querySelectorAll(".notice").forEach(n => n.click()); await T.sleep(400); return true; };
T.plugin = () => app.plugins.plugins[${JSON.stringify(ID)}];
// Obsidian's Component class (not reachable with require here): the root of the plugin's prototype chain
T.Component = () => { let p = Object.getPrototypeOf(T.plugin()); while (Object.getPrototypeOf(p) !== Object.prototype) p = Object.getPrototypeOf(p); return p.constructor; };
// Editor Multiple Lanes' settings (its test API: lanesOnly / showBacklinks and settingsChanged): returns the old values
T.lanes = async patch => {
  const p = app.plugins.plugins[${JSON.stringify(LANES)}];
  if (!p) return null;
  const prev = { lanesOnly: p.settings.lanesOnly, showBacklinks: p.settings.showBacklinks };
  Object.assign(p.settings, patch);
  if ("lanesOnly" in patch) await p.settingsChanged("routing");
  if ("showBacklinks" in patch) await p.settingsChanged("backlinks");
  return prev;
};
if (!T.hooked) {
  T.hooked = true;
  window.addEventListener("error", e => T.errors.push("error: " + e.message));
  window.addEventListener("unhandledrejection", e => T.errors.push("rejection: " + (e.reason?.stack ?? e.reason)));
  const ce = console.error.bind(console);
  console.error = (...a) => { T.errors.push(a.map(x => x?.stack ?? String(x)).join(" ")); ce(...a); };
  const cw = console.warn.bind(console);
  console.warn = (...a) => { const s = a.map(String).join(" "); if (s.includes("backlinks-full-view")) T.errors.push("warn: " + s); cw(...a); };
}
return true;
})()`;

// ---------- harness ----------
const c = await connect(process.env.CDP_PORT || undefined);
const ev = c.ev;
const vaultPath = await assertSandboxVault(c);
const results = [];
let current = "";
const check = (name, ok, detail) => {
  results.push({ id: current, name, ok: !!ok, detail });
  console.log(
    `${ok ? "PASS" : "FAIL"} ${current} ${name}${ok && !process.env.VERBOSE ? "" : detail === undefined ? "" : "  " + JSON.stringify(detail)}`,
  );
  return !!ok;
};
const eq = (name, got, want) => check(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const mods = m => (m.alt ? 1 : 0) | (m.ctrl ? 2 : 0) | (m.meta ? 4 : 0) | (m.shift ? 8 : 0);
async function clickAt(x, y, m = {}, button = "left", clickCount = 1) {
  await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, modifiers: mods(m) });
  await c.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button, clickCount, modifiers: mods(m) });
  await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button, clickCount, modifiers: mods(m) });
}
/** A real click on the element a page expression returns (scrolled into view first). */
async function click(expr, m = {}, button = "left") {
  const r = await ev(`(() => { const el = (${expr}); return el ? __t.rect(el) : null; })()`);
  if (!r) throw new Error("no element: " + expr);
  await sleep(80);
  await clickAt(r.x, r.y, m, button);
  await sleep(80);
}
async function hover(expr, m = {}) {
  const r = await ev(`(() => { const el = (${expr}); return el ? __t.rect(el) : null; })()`);
  if (!r) throw new Error("no element: " + expr);
  await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: r.x - 3, y: r.y - 3, modifiers: mods(m) });
  await sleep(50);
  await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: r.x, y: r.y, modifiers: mods(m) });
}
/** Click an input and type into it like a user (replacing what's there). */
async function typeInto(expr, text) {
  await click(expr);
  await c.key("a", { ctrl: true });
  await c.key("Backspace");
  if (text) await c.type(text);
}
/** Set a <select> (native dropdowns can't be driven over CDP) and fire `change` as a user's pick does. */
const pick = (expr, value) =>
  ev(
    `(() => { const s = (${expr}); s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event("change")); return s.value; })()`,
  );
const panes = () => ev(`__t.panes()`);
const shown = i => ev(`__t.shown(${i})`);
const fixtures = () => ev(writeFixturesExpr);
const read = p => ev(`__t.read(${JSON.stringify(p)})`);
const open = (p, mode = "lp", where = "tab") =>
  ev(`__t.open(${JSON.stringify(p)}, ${JSON.stringify(mode)}, ${JSON.stringify(where)})`);
const expand = async i => {
  await click(`__t.pane(${i}).querySelector(".bfv-header")`);
  await sleep(450);
};
const toggleCard = async (i, p) => {
  await click(`__t.card(${i}, ${JSON.stringify(p)}).querySelector(".bfv-chevron")`);
  await sleep(350);
};
const waitFor = async (expr, ms = 4000) => {
  for (let t = 0; t < ms; t += 100) {
    if (await ev(expr)) return true;
    await sleep(100);
  }
  return false;
};
const errors = async () => JSON.parse(await ev(`JSON.stringify(__t.errors.splice(0))`));
const shotDir = process.env.SHOT_DIR ? path.resolve(process.env.SHOT_DIR) : null; // absolute: ImageMagick policy
async function shot(name) {
  if (!shotDir) return;
  const r = await c.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(shotDir, name + ".png"), Buffer.from(r.result.data, "base64"));
}

const cases = [];
// a case that tests working with another plugin names it (`needs`: plugin ids, `core:<id>` for core plugins) and
// is skipped without it; Backlinks Full View itself needs none of them
const test = (id, title, fn, opts = {}) => cases.push({ id, title, fn, needs: [opts.needs ?? []].flat() });
const T = {
  ev,
  check,
  eq,
  click,
  clickAt,
  hover,
  typeInto,
  pick,
  panes,
  shown,
  fixtures,
  read,
  open,
  expand,
  toggleCard,
  waitFor,
  sleep,
  key: c.key,
  type: c.type,
  send: c.send,
  errors,
  shot,
  perf: ms => ms * PERF,
};

// ---------- the cases ----------
const { register } = await import(process.env.CASES || "./cases.mjs");
register(test, T);

// ---------- run ----------
await ev(PAGE);
if (!args.includes("--no-deploy")) {
  const dest = path.join(vaultPath, ".obsidian/plugins", ID);
  fs.mkdirSync(dest, { recursive: true });
  for (const f of ["main.js", "manifest.json", "styles.css"]) fs.copyFileSync(path.join(PLUGIN, f), path.join(dest, f));
  await ev(
    `(async () => { await app.plugins.loadManifests(); await app.plugins.disablePlugin(${JSON.stringify(ID)}); await app.plugins.enablePlugin(${JSON.stringify(ID)}); return true; })()`,
  );
  await sleep(1500);
}
// prepare: the vault settings the cases rely on (make-vault.mjs wrote them too; put back at the end), the link
// index complete (3,000 notes on a first start), and normal tabs staying tabs when Editor Multiple Lanes is there
const CONFIG = { alwaysUpdateLinks: true, readableLineLength: false };
const savedConfig = await ev(
  `(() => { const was = {}; for (const [k, v] of Object.entries(${JSON.stringify(CONFIG)})) { was[k] = app.vault.getConfig(k); app.vault.setConfig(k, v); } return was; })()`,
);
const indexed = await ev(`(async () => {
  for (let i = 0; i < 240; i++) {
    const files = app.vault.getMarkdownFiles().length, done = Object.keys(app.metadataCache.resolvedLinks).length;
    if (done >= files) return { files, done };
    await __t.sleep(500);
  }
  return null;
})()`);
if (!indexed) console.log("WARN the link index didn't cover every note within 2 minutes");
const hub = await ev(`!!app.vault.getAbstractFileByPath("n/Maya Iyer.md")`);
if (!hub) console.log("WARN no hub note n/Maya Iyer.md: e2e/make-vault.mjs makes it (B7, N1, N2 will fail)");
const savedLanes = await ev(`__t.lanes({ lanesOnly: false, showBacklinks: true })`);
await ev(`__t.errors.splice(0)`);
const started = Date.now();
let roLoops = 0;
const loaded = new Set(await ev(`Object.keys(app.plugins.plugins)`));
const coreOn = new Set(
  await ev(`Object.keys(app.internalPlugins.plugins).filter(id => !!app.internalPlugins.getEnabledPluginById(id))`),
);
const has = id => (id.startsWith("core:") ? coreOn.has(id.slice(5)) : loaded.has(id));
const skipped = [];
try {
  for (const k of cases) {
    if (FILTER && !FILTER.test(k.id + " " + k.title)) continue;
    current = k.id;
    const missing = k.needs.filter(id => !has(id));
    if (missing.length) {
      const required = missing.filter(id => REQUIRE.includes(id));
      if (required.length) check(`needs ${required.join(", ")}: not enabled (E2E_REQUIRE)`, false);
      else {
        skipped.push(k.id);
        console.log(`SKIP ${k.id} (needs ${missing.join(", ")}: not enabled)`);
      }
      continue;
    }
    try {
      await k.fn(T);
    } catch (e) {
      check(
        "threw",
        false,
        String(e?.stack ?? e)
          .split("\n")
          .slice(0, 3)
          .join(" | "),
      );
    }
    // Chromium's benign "ResizeObserver loop completed with undelivered notifications" also shows up without this
    // plugin (Obsidian resizes its editors inside its own ResizeObserver): counted, not failed
    const all = await errors();
    roLoops += all.filter(e => e.includes("ResizeObserver loop")).length;
    const errs = all.filter(e => !e.includes("ResizeObserver loop"));
    if (errs.length) check("console clean", false, errs.slice(0, 3));
  }
} finally {
  await ev(
    `(() => { for (const [k, v] of Object.entries(${JSON.stringify(savedConfig)})) app.vault.setConfig(k, v); return 1; })()`,
  );
  if (savedLanes) await ev(`__t.lanes(${JSON.stringify(savedLanes)})`);
}
const pass = results.filter(r => r.ok).length;
const ids = [...new Set(results.map(r => r.id))];
const failedIds = ids.filter(id => results.some(r => r.id === id && !r.ok));
const partners = [...loaded].filter(id => id !== ID).sort();
console.log(
  `\n${pass}/${results.length} checks passed; ${ids.length - failedIds.length}/${ids.length} cases passed, ${skipped.length} skipped in ${Math.round((Date.now() - started) / 1000)} s`,
);
if (failedIds.length) console.log("FAILED: " + failedIds.join(", "));
if (skipped.length) console.log("SKIPPED (another plugin not enabled): " + skipped.join(", "));
console.log(`ResizeObserver loop warnings (benign, not failed): ${roLoops}`);
const lines = [
  "# Backlinks Full View e2e results",
  "",
  `Run ${new Date().toISOString()} against a sandbox vault (Obsidian ${await ev("require('electron').ipcRenderer.sendSync('version')")}), ` +
    `other plugins: ${partners.length ? partners.join(", ") : "none"}${PERF !== 1 ? `, BFV_PERF_SCALE=${PERF}` : ""}.`,
  `${pass}/${results.length} checks, ${ids.length - failedIds.length}/${ids.length} cases passed, ${skipped.length} skipped. ResizeObserver loop warnings (benign): ${roLoops}.`,
  "",
  "| Case | Result | Failed checks |",
  "|---|---|---|",
  ...ids.map(id => {
    const bad = results.filter(r => r.id === id && !r.ok);
    return `| ${id} | ${bad.length ? "FAIL" : "PASS"} | ${bad.map(b => b.name + (b.detail === undefined ? "" : ": `" + JSON.stringify(b.detail).slice(0, 160) + "`")).join("; ")} |`;
  }),
  ...skipped.map(id => `| ${id} | SKIP | needs ${cases.find(k => k.id === id).needs.join(", ")} |`),
];
if (!FILTER) fs.writeFileSync(path.join(HERE, process.env.RESULTS ?? "results.md"), lines.join("\n") + "\n");
c.close();
process.exit(failedIds.length ? 1 : 0);
