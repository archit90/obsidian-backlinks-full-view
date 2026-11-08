# Backlinks Full View: specification

This document describes the plugin as it is now; `README.md` is the user guide and `TEST-CASES.md` the test
catalogue. **Keeping this current:** every change updates this document in the same commit. There is no change
log: git history has the past, this document the present.

Plugin id `backlinks-full-view` (until 2026-11-08 `obsidian-backlinks-full-view`); repo `archit90/obsidian-backlinks-full-view`.

Panes below each note that show its backlinks, or a Dataview query's results, as collapsible cards holding
the full rendered notes. It replaces the core Backlinks plugin.

## Panes

- **All backlinks:** every note has this pane, always first. Its settings are never saved: searching,
  filtering or sorting there doesn't touch the note, and it has no title, query or remove controls. Its
  expanded cards are saved like every pane's (see `backlinks-open`).
- **The note's own panes:** one per entry in the note's `backlinks` frontmatter property, below All
  backlinks. A note can have none; removing the last pane deletes the property. "+ Add backlinks pane" adds
  one (it opens expanded). ✕ removes one, with Undo for 10 seconds.
- **Start collapsed:** every pane starts collapsed when a note opens, and its cards are built only when it's
  first expanded. A collapsed pane's header shows the backlink count, or "matching / all" when the pane has
  filter rules (worked out from metadata, no cards built); a query pane shows nothing until expanded, because
  counting would mean running the query. Collapsed state isn't saved.
- **Cards** start collapsed and show only their header: a chevron and the title link, which is the note's full
  path without `.md` (`folder/sub/name`) or, with the setting "Full path in note cards" off (it's on by default),
  the note's name with its folder in a faint label on the right (cut from the left when long). The setting
  applies to every card (panes, embeds, `bfv.embed`); changing it retitles open cards in place. A note is read and rendered when its card is first
  expanded. An expanded card shows the note's properties first (read-only: links are links, lists are chips,
  tags are `#tag`; `backlinks` is left out), then its text.
- **Placement:** below the note text in Live Preview and Source mode, in the renderer's footer in Reading
  view (as core Backlinks), and as wide as the note text, so it follows "Readable line length". Editor Multiple Lanes
  can turn panes off inside lanes tabs (`data-bfv-skip`). In editing modes Obsidian's room to scroll past the
  end goes below the panes (as core Backlinks does): the panes follow the text by one empty line (the editor's line height; the same gap in Reading view) (the edit mode's
  `updateBottomPadding` is patched; a host that sets its own padding, as Editor Multiple Lanes cards do, keeps it). Mode
  switches made with `view.setMode` move the panes too.
- **Canvas cards** (setting "Show backlinks panes on canvas cards", on by default; off: no panes on canvas
  cards and no canvas button): a note card on a canvas always shows the panes while it's being edited. In the card's
  reading view they show only when the note has `canvas-full-backlinks-enabled: true` (opt-in per note).
  "Enable in canvas", beside "+ Add backlinks pane", sets it; once set the button reads "Disable in canvas"
  and deletes the key. Placement: at the end of the card's editor (`.cm-sizer`, inside the same-origin iframe Obsidian
  edits cards in, with the app's styles relayed into it) while editing, else in the card's reading-view
  footer (added to the embed's renderer). Obsidian destroys the card's editor when editing stops. Cards
  mount and unmount as they scroll in and out of view, and none of this fires an event: a MutationObserver
  on the canvas notices a card's content being filled or its editor iframe being added or removed, and
  schedules a refresh that builds or moves the panes; unmounting unloads the embed, which tears its panes
  down. Clicks in the panes don't start editing the card
  (`.interactive-child`). The property is registered as a checkbox in `types.json`.

## The `backlinks` property

```yaml
backlinks:
  - title: Logs # pane heading; default "Backlinks" or "Query", numbered
    filter: '{"type":"group","mode":"and","children":[…]}' # nested and / or / not rules, as in Bases
    sort: '[{"prop":"file.name","dir":"desc"}]' # one or more sort keys
    query: 'LIST FROM "z" WHERE contains(parents, this.file.link)' # optional: notes come from Dataview
backlinks-open: # expanded cards, all panes, most recent first
  - 0/2026-11-05-091500.md
```

- **Editing:** every field has a control in the pane (title, query, filter and sort dropdowns), which writes
  back to frontmatter. Templates pre-fill the panes (Logs, Ideas, Children, Projects…; see `templates.md`).
- **Filter operators** depend on the property type (text, number, date, boolean, list). A saved operator
  that doesn't fit the property's type is kept and flagged, not rewritten.
- **`backlinks-open`** (its own property, so card toggles never touch the pane settings): one list for the
  note, shared by all its panes, All backlinks included. A note on it starts expanded in every pane that shows
  it, and expanding or collapsing its card in one pane does the same in the others. You can expand any number;
  the most recent ones are saved, as many as the setting "Remembered expanded cards" (default 50, `MAX_OPEN_SAVED`;
  0: none are saved and the property isn't written). Entries are plain paths, so they make no backlinks. A value
  that isn't a list of paths shows a warning and isn't written until fixed.
  - **Older notes:** `open` inside a `backlinks` entry (the earlier per-pane format) is read as one list, first
    pane first, while the note has no `backlinks-open`; the next write for the note moves it there.
  - **Pruning:** a remembered note stays while any pane shows it. It's dropped once it's in none of the panes'
    full results (before search and filters): deleted, renamed, no longer linking here and in no query pane's
    results. Pruning waits until the link index covers the vault and, when the note has query panes, until
    Dataview has indexed and every query pane has run (been expanded) without failing. A renamed note's card
    keeps its expanded state.
- **Safe writes:** config edits are written 600 ms after the last change; card toggles 5 s after (sooner on
  note switch, close or unload, or with a config edit), skipped when nothing changed. Both properties are
  written in one frontmatter update and merged with the file at write time: for `backlinks-open`, cards
  toggled here win and cards toggled elsewhere since the last read are kept. Unknown keys are kept, and a cleared key is
  removed (not written as `null`); a filter with no rules left counts as cleared, and a new pane with nothing
  set is written as `- {}`. A pane whose saved config can't be parsed shows a red message and blocks
  all writes for that note until it's fixed.

## Links, search and refresh

- **Links** in card titles and inside cards follow Obsidian: click opens in place, Ctrl/Cmd-click or
  middle-click a new tab, Ctrl+Alt-click a split, Ctrl+Alt+Shift-click a new window, and hover with
  Ctrl/Cmd shows Page preview (hover source "Backlinks Full View" in Settings → Page preview), in Reading view
  too (the note's own no-Ctrl preview doesn't apply to the panes). Links resolve
  relative to the card's note. Clicking a card title navigates; the rest of the header toggles the card.
- **Search** (per pane, per session) matches paths, tags and properties, plus the note text when _Full text_
  is ticked (read 100 notes at a time on first use, then cached until a note changes). Syntax: adjacent
  words are ANDed; `AND`, `OR`, `NOT` or `-word`, `"quoted phrases"` and parentheses, operators in capitals,
  precedence NOT > AND > OR, unbalanced parentheses tolerated. Example: `(billing AND v2) OR acme`.
- **Speed:** search text is built once per note; a search or filter change only toggles the cards whose
  visibility changes; re-sorting happens only when the sort or the set of notes changes. Event refreshes
  are debounced 300 ms. Query panes re-run 2.5 s after Dataview stops reindexing, and an open card waits
  for a pause in typing before it re-renders its changed note.
- **Queries:** a query with no rows shows "No notes."; one whose rows hold no note links shows a hint and, like
  a failed query, doesn't prune `backlinks-open`.

## Embedded notes as cards

- Setting "Show embedded notes as cards" (on by default): a whole-note embed `![[note]]` in Reading view and Live
  Preview (normal tabs, Editor Multiple Lanes cards, popout windows, and inside rendered cards and canvas cards) is the
  panes' card: collapsed at first, with the card border and the same title (see Cards); expanding it renders the
  note's properties table and the note, and the card re-renders when the note changes. Expanded embed cards are
  remembered per note for the session. Source mode shows the text.
- **Inline embeds:** an embed inside a line (in a list item, `- ![[note]]`, or beside text in a sentence) stays on
  that line: collapsed, a compact card as wide as its title, on the bullet's line or in the sentence; expanded, it
  fills the rest of the line's width from there. An embed alone in its paragraph is a full-width card on its own.
  (Live Preview: a widget inside a `.cm-line`; Reading view: inside a list item or beside other content.)
  Toggling a card doesn't reach the editor, so the cursor doesn't move onto the embed's line and its `![[…]]`
  source stays hidden; the title link still navigates.
- Obsidian's own embed stays for a heading or block embed (`![[note#…]]`), a canvas file card (the note itself), an
  Excalidraw drawing, a note embedding itself (Obsidian's recursion guard) and nesting deeper than 3.
- How: Obsidian's Markdown embed creator (`app.embedRegistry.embedByExtension.md`) is wrapped with
  `monkey-around`; an inline embed (`showInline`) of a whole note gets a component that builds the card. Turning
  the setting off, or disabling the plugin, redraws open notes with Obsidian's embeds.
- Folder labels in card headers keep a leading `_` or `.` in place (left-to-right marks around the
  right-to-left text).

## DataviewJS and diagnostics

- `bfv.embed(dv, pages, opts)` renders full-note cards inside a DataviewJS block (it needs DataviewJS, which is
  off in Dataview's settings in these vaults, so it renders nothing until the user turns it on; at most 25 notes per call,
  embeds nested at most 3 deep). Cards start open unless `{ collapsed: true }`.
- Command "Show diagnostics": the number of tracked views and other internals.

## Working with other plugins

TODO (filled in from the cross-plugin review).

## Development

- **Repository:** this folder is the whole repo. `package.json` (scripts and tool versions), `tsconfig.json`
  (strict, `noImplicitOverride`, `noUnusedLocals`), `eslint.config.mjs`, `.prettierrc`, `.editorconfig`,
  `.gitattributes`, `esbuild.config.mjs` (`src/main.ts` → `main.js`, not minified; `npm run dev` rebuilds on save
  with an inline source map) and `vitest.config.mts`. `main.js` is built, never committed.
- **`npm run check`:** format check, lint, typecheck, unit tests (vitest, including `test/typing.test.ts`), build,
  and a smoke load of the bundle (`test/smoke.cjs`, with stubs for `obsidian` and `@codemirror/language`). It must
  pass before a commit or a release; CI (`.github/workflows/ci.yml`) runs it on every push.
- **Typing:** no untyped code. `noImplicitAny` (strict) in TypeScript; ESLint fails any explicit `any` (tests
  included) and `@ts-ignore` / `@ts-nocheck` / an undescribed `@ts-expect-error`. Obsidian internals are typed
  in `src/types/*.d.ts` or taken as `unknown` and narrowed. An `any` that can't be avoided carries
  `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- <reason>`; `test/typing.test.ts` fails
  any `eslint-disable` without its rules and a reason after `--`.
- **Code layout:** source in `src/` modules, with the pure logic kept free of Obsidian imports so it can be
  unit-tested (`test/obsidian-stub.ts` stands in for `obsidian`). Patches of Obsidian methods use
  `monkey-around` and are registered with the plugin, so they come off on unload.
- **Internals:** every Obsidian internal used was checked against Obsidian 1.15.0's `app.js` and `app.css`.
  `minAppVersion` is 1.15.0. A new Obsidian version means re-checking them.
- **Versions and releases:** `npm version patch|minor|major` bumps `package.json`, then `scripts/version-bump.mjs`
  copies the version into `manifest.json` and `versions.json`; npm commits and tags it (tag = the version, no
  `v`, `.npmrc`). `git push --follow-tags` runs `.github/workflows/release.yml`: `npm run check`, a check that the
  tag is the manifest version, then a GitHub release with `main.js`, `manifest.json` and `styles.css`, which BRAT
  installs. `isDesktopOnly` is false.
- **Trying a build in a vault:** `npm run deploy -- <vault> …` (or `OBSIDIAN_VAULTS`) builds and copies `main.js`,
  `manifest.json` and `styles.css` into each vault that already has the plugin (`--install` adds it); `data.json`
  is never touched. Reload the plugin in Obsidian afterwards.
- **End-to-end tests:** `e2e/sandbox.sh start|stop|restart|reset|deploy|shot <n>` runs a throwaway Obsidian
  (`OBS_APP`, default the 1.15.0 AppImage) on its own Xvfb display `:110+n` (never on your screen), with its own
  profile, its own vault in `.sandbox/sb<n>/` (git-ignored) and the DevTools port `9310+n`. The vault is a fresh
  empty one with only this plugin, plus any built plugins in `OBS_PLUGINS` (folders separated by `:`) to test them
  together; or a copy of `OBS_VAULT` (e.g. a big test vault). Every start installs the current build. The suite
  in `e2e/` drives it over the DevTools protocol (`e2e/cdp.mjs`) with real key and mouse input. Needs Xvfb, rsync,
  curl, node and ImageMagick.

## Verification status

- **Confirmed in Obsidian by the user:** link navigation in all three modes.
- **Backlinks Full View end-to-end suite:** `custom-plugins/backlinks-full-view/e2e/` (catalogue
  `../TEST-CASES.md`, runner `run.mjs`, results `results.md`) runs 90 cases (268 checks; last full run 2026-11-07: all pass) against a test Obsidian:
  tabs in all three modes, lanes cards, canvas cards, splits, the sidebar, a popout window, narrow width,
  DataviewJS, unload / reload, embedded notes as cards (Q1–Q6) and a 3,000-backlink hub.
- **Everything else** is built, unit-tested (`npm run check`) and was used in the author's vaults, but not confirmed
  by the user in Obsidian.
- **Deep test catalogue** (2026-11-07): `TEST-CASES.md`, cases checked against this spec and common sense, each run
  in an isolated test Obsidian over the DevTools protocol with real key and mouse input, then fixed and re-run until a
  full run was clean. It records the final status per case and the date of the final run.
