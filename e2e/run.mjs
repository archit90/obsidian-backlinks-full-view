// End-to-end tests of Backlinks Full View in a real Obsidian, driven over the Chrome DevTools Protocol with
// real mouse and key input where a user would use them. The catalogue is ../TEST-CASES.md; every case here
// carries its id from there.
//
// Usage
//   1. Start a throwaway Obsidian (1.15.0) on a copy of test vault 948 with a debugging port, e.g.
//        DISPLAY=:99 obsidian --no-sandbox --user-data-dir=/tmp/obs-profile --remote-debugging-port=9311 \
//          --remote-allow-origins=http://localhost
//      Never point it at a vault whose notes matter: the runner rewrites `_bfv/`, edits a few stress notes and
//      restores them, and changes Editor Lanes' "lanes only" and "show backlinks" settings while it runs.
//   2. CDP_PORT=9311 node custom-plugins/backlinks-full-view/e2e/run.mjs [--filter <regex>] [--no-deploy]
//   It prints PASS / FAIL per check and writes e2e/results.md.
//
// Not a vitest file: vitest.config.mts in custom-plugins/ only includes */src/**/*.test.ts.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connect } from "../../editor-outliner/e2e/cdp.mjs";
import { writeFixturesExpr } from "./fixtures.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN = path.dirname(HERE);
const ID = "obsidian-backlinks-full-view";
const args = process.argv.slice(2);
const opt = n => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const FILTER = opt("--filter") ? new RegExp(opt("--filter"), "i") : null;
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
T.closeAll = async () => {
  for (const l of app.workspace.getLeavesOfType("markdown")) if (!l.view.containerEl.closest(".lanes-view")) l.detach();
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
T.mtime = p => app.vault.getAbstractFileByPath(p)?.stat.mtime;
T.notices = () => [...document.querySelectorAll(".notice")].map(n => n.textContent);
T.clearNotices = async () => { document.querySelectorAll(".notice").forEach(n => n.click()); await T.sleep(400); return true; };
T.plugin = () => app.plugins.plugins[${JSON.stringify(ID)}];
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
const c = await connect(process.env.CDP_PORT || 9311);
const ev = c.ev;
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
const shotDir = process.env.SHOT_DIR;
async function shot(name) {
  if (!shotDir) return;
  const r = await c.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(shotDir, name + ".png"), Buffer.from(r.result.data, "base64"));
}

const cases = [];
const test = (id, title, fn) => cases.push({ id, title, fn });
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
};

// ---------- the cases ----------
const { register } = await import(process.env.CASES || "./cases.mjs");
register(test, T);

// ---------- run ----------
await ev(PAGE);
if (!args.includes("--no-deploy")) {
  const vault = await ev(`app.vault.adapter.basePath`);
  const dest = path.join(vault, ".obsidian/plugins", ID);
  for (const f of ["main.js", "manifest.json", "styles.css"]) fs.copyFileSync(path.join(PLUGIN, f), path.join(dest, f));
  await ev(
    `(async () => { await app.plugins.disablePlugin(${JSON.stringify(ID)}); await app.plugins.enablePlugin(${JSON.stringify(ID)}); return true; })()`,
  );
  await sleep(1500);
}
// normal tabs stay tabs (Editor Lanes would move them into lanes)
await ev(
  `(async () => { const p = app.plugins.plugins["obsidian-editor-lanes"]; if (p) { p.settings.lanesOnly = false; p.settings.showBacklinks = true; await p.saveSettings?.(); } return true; })()`,
);
await ev(`__t.errors.splice(0)`);
const started = Date.now();
let roLoops = 0;
for (const k of cases) {
  if (FILTER && !FILTER.test(k.id + " " + k.title)) continue;
  current = k.id;
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
const pass = results.filter(r => r.ok).length;
const ids = [...new Set(results.map(r => r.id))];
const failedIds = ids.filter(id => results.some(r => r.id === id && !r.ok));
console.log(
  `\n${pass}/${results.length} checks passed; ${ids.length - failedIds.length}/${ids.length} cases passed in ${Math.round((Date.now() - started) / 1000)} s`,
);
if (failedIds.length) console.log("FAILED: " + failedIds.join(", "));
console.log(`ResizeObserver loop warnings (benign, not failed): ${roLoops}`);
const lines = [
  "# Backlinks Full View e2e results",
  "",
  `Run ${new Date().toISOString()} against ${await ev("app.vault.getName()")} (Obsidian ${await ev("require('electron').ipcRenderer.sendSync('version')")}).`,
  `${pass}/${results.length} checks, ${ids.length - failedIds.length}/${ids.length} cases passed. ResizeObserver loop warnings (benign): ${roLoops}.`,
  "",
  "| Case | Result | Failed checks |",
  "|---|---|---|",
  ...ids.map(id => {
    const bad = results.filter(r => r.id === id && !r.ok);
    return `| ${id} | ${bad.length ? "FAIL" : "PASS"} | ${bad.map(b => b.name + (b.detail === undefined ? "" : ": `" + JSON.stringify(b.detail).slice(0, 160) + "`")).join("; ")} |`;
  }),
];
if (!FILTER) fs.writeFileSync(path.join(HERE, "results.md"), lines.join("\n") + "\n");
c.close();
process.exit(failedIds.length ? 1 : 0);
