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
  tags are `#tag`, a string of tags is several), then its text. This plugin's own keys (`backlinks`,
  `backlinks-open`, `canvas-full-backlinks-enabled`) are its settings, not the note's content: cards don't show them,
  and search and filters don't see them.
- **Keyboard:** pane and card headers are buttons (`role="button"`, a tab stop, `aria-expanded`): Enter or Space
  toggles the one that has the focus. A mouse press on a header doesn't take the focus, so an editor keeps its cursor.
- **Placement:** below the note text in Live Preview and Source mode, in the renderer's footer in Reading
  view (as core Backlinks), and as wide as the note text, so it follows "Readable line length". A host element can
  turn the panes off for the notes inside it (`data-bfv-skip`, see Working with other plugins). In editing modes
  Obsidian's room to scroll past the
  end goes below the panes (as core Backlinks does): the panes follow the text by one empty line (the editor's line
  height; the same gap in Reading view) (the edit mode's `updateBottomPadding` is patched; a host whose CSS sets the
  editor's bottom padding keeps it, and the panes add no room). Mode switches made with `view.setMode` move the panes
  too.
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
  (`.interactive-child`). Only `true` opts in (a vault can give the property the checkbox type).

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
  back to frontmatter. A vault's templates can pre-fill the panes.
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
- **Merging with the file:** the panes of the view and the list in the file are matched against the list as last
  read: identical panes first, then panes with the same title, then the rest in order when as many are left on
  both sides (panes edited in place). Per pane and key, a change made here wins, else the file's value; unknown keys
  come from the file. A pane removed here is removed; one removed in the file stays removed unless it was edited
  here (the edit is kept). Panes added on either side are all kept: the file's order, with one added here after the
  pane it follows here.
- **A write that fails** (the frontmatter isn't valid YAML, so Obsidian can't update it) changes nothing: the edits
  stay in the panes, a notice says why (once, until a write works again), and they're written with the next change
  of the note (for example once its YAML is fixed) or the next edit here.
- **Known limit:** writes go through Obsidian's `processFrontMatter`, which writes the whole frontmatter block again:
  YAML comments in it are lost and its lists may change style. A card toggle in a note writes its frontmatter 5 s
  later (when "Remembered expanded cards" isn't 0), so browsing a note's cards can do this.

## Links, search and refresh

- **Links** in card titles and inside cards follow Obsidian: click opens in place, Ctrl/Cmd-click or
  middle-click a new tab, Ctrl+Alt-click a split, Ctrl+Alt+Shift-click a new window, and hover with
  Ctrl/Cmd shows Page preview (hover source "Backlinks Full View" in Settings → Page preview), in Reading view
  too (the note's own no-Ctrl preview doesn't apply to the panes). Links resolve
  relative to the card's note. Clicking a card title navigates; the rest of the header toggles the card.
- **Search** (per pane, per session) matches paths, tags (the frontmatter's `tags` or `tag`, a list or a string,
  and the #tags in the text) and properties (keys and values, not this plugin's own), plus the note text without its
  frontmatter when _Full text_ is ticked (read 100 notes at a time on first use, then cached until a note changes).
  Filters read the same properties and tags (`file.tags`). Syntax: adjacent
  words are ANDed; `AND`, `OR`, `NOT` or `-word`, `"quoted phrases"` and parentheses, operators in capitals,
  precedence NOT > AND > OR, unbalanced parentheses tolerated. Example: `(billing AND v2) OR acme`.
- **Speed:** what search and filters read of a note is worked out once per version of the note, shared by every
  pane and the collapsed counts; a search or filter change only toggles the cards whose visibility changes;
  re-sorting happens only when the sort or the set of notes changes. Event refreshes are debounced 300 ms; views
  left without panes on purpose (opted out, a canvas card without them) cost no refresh when they resize. Query
  panes re-run 2.5 s after Dataview stops reindexing (a result from before the index changed is never reused), and
  an open card waits for a pause in typing before it re-renders its changed note. A view whose refresh fails is
  logged and the others go on.
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
  the setting on or off, enabling or disabling the plugin, redraws the open notes that have a whole-note embed
  (Reading view re-renders; an editing view is rebuilt, an internal that also resets that editor's undo history),
  and open cards of such notes render again; other notes are left alone.
- Folder labels in card headers keep a leading `_` or `.` in place (left-to-right marks around the
  right-to-left text).

## DataviewJS and diagnostics

- `bfv.embed(dv, pages, opts)` renders full-note cards inside a DataviewJS block (it needs DataviewJS, which is off
  by default in Dataview's settings, so it renders nothing until it's turned on; at most 25 notes per call unless
  `{ limit: N }`, then a "Showing N of M" line; embeds nested at most 3 deep). Cards start open unless
  `{ collapsed: true }`; the note holding the block and the notes of cards it sits in are skipped. The target is
  Dataview's `dv` (its `container`, `component` and `currentFilePath`) or an element; pages are paths or link
  paths, Dataview pages (`file.path`), links (`path`), or an array, Dataview array (`values`) or other iterable of
  them. The cards belong to `opts.component`, else the block's `dv.component`, and are unloaded with it; cards in a
  plain element without one belong to the plugin until the element has left the page. An open card renders again
  when its note changes.
- Command "Show diagnostics": Dataview's state, the Obsidian APIs and the Obsidian internals the plugin relies on
  (each found or not, as far as the open notes let it tell), the active note's host and panes, and the number of
  tracked views. A missing internal is also logged once when the plugin loads.

## Settings

Saved in the plugin's `data.json` (missing or invalid values take the default; settings changed there from elsewhere,
such as sync, apply at once):

- `canvas` "Show backlinks panes on canvas cards" (on), `noteEmbeds` "Show embedded notes as cards" (on),
  `cardFullPath` "Full path in note cards" (on; data saved by older versions as `embedFullPath` is read once and
  saved under the new key), `maxOpen` "Remembered expanded cards" (50; a whole number from 0 to 500).

## Working with other plugins

The plugin needs no other plugin and imports none. Where it meets one, it goes through the DOM, Obsidian's events or
the other plugin's public API. Each meeting point is tested on this side without the other plugin, by simulating
what that plugin provides (a contract case), and with it where a case `needs` it (a together case, skipped without
it; see `TEST-CASES.md`). These contracts don't change without a note here and in the other plugin.

- **`data-bfv-skip`:** an element with this attribute (any value) opts the note views inside it out. No panes are
  built in them; panes already there are removed on the next refresh (a `layout-change`, a file opening, a mode
  switch), and until then `[data-bfv-skip] .bfv-container { display: none }` hides them. This plugin owns that CSS
  rule; other plugins don't style its elements. Editor Multiple Lanes sets `data-bfv-skip="editor-lanes"` on a lanes
  tab while its "Show backlinks panes under lane notes" is off, and fires `layout-change` when that setting changes.
  Tested by I4 (contract) and I2 (with Editor Multiple Lanes).
- **`data-bfv-path`:** every card (`.bfv-item`: pane cards, embed cards and `bfv.embed` cards) carries the path of
  the note it shows. Links in a card resolve from that note, and `workspace.openLinkText` gets it as the source
  path. Editor Multiple Lanes reads it to route a link clicked in a card (its own suite tests that). Tested by I3
  (contract) and I1.
- **Hosted note views:** panes go under every markdown note view that `workspace.iterateAllLeaves` reports,
  wherever it's hosted: tabs, sidebars, popout windows, and Editor Multiple Lanes' cards, which are ordinary
  markdown leaves. Tested by J7, P1, and I1 and Q7 (with Editor Multiple Lanes).
- **A host's editor padding:** a host whose CSS sets the editor's bottom padding (`.cm-content`; Editor Multiple
  Lanes cards use `padding-bottom: 0 !important`) keeps it, and the panes add no room below them. Tested by I5.
- **Dataview** (`dataview`, optional): a query pane runs `app.plugins.plugins.dataview.api.query(query, notePath)`
  and takes the notes from its result (a TABLE's first column, all columns when grouped; a LIST's items; TASK items'
  files; CALENDAR links). Query panes re-run at `dataview:index-ready` and 2.5 s after the last
  `dataview:metadata-change` (both fired on the metadata cache); pruning `backlinks-open` waits for its
  `index.initialized`. Without Dataview a query pane says "Dataview plugin is not installed or enabled." Tested by K4
  (without it), K5 (a stand-in with Dataview's API and events), and B3 and K1–K3 (with Dataview).
- **DataviewJS:** `window.bfv` (the plugin's `api`) is set while the plugin is loaded; `bfv.embed` is described in
  DataviewJS and diagnostics. Tested by L2 and L3 (called directly), L1 (from a DataviewJS block, with Dataview) and
  M2 (the global goes on unload).
- **Page preview** (core): the hover source `backlinks-full-view` ("Backlinks Full View", Ctrl/Cmd by default).
  Hovering a link in the panes triggers `hover-link` with that source, the link and the card's note, and the note's
  own handler doesn't see it. Tested by C6 and C7, and C4 and J8 (with the core plugin on).
- **Excalidraw** (optional): a note whose frontmatter has the key `excalidraw-plugin` keeps Obsidian's own embed,
  which Excalidraw draws. Tested by Q9.
- **Core Canvas and core Backlinks:** canvas cards are described in Panes (J1–J4, Q6). With core Backlinks shown in a
  note ("Backlinks in document"), the panes leave Obsidian's room below the note as it is.

The suite drives Editor Multiple Lanes only through its test API: the settings `lanesOnly` and `showBacklinks`
followed by `settingsChanged("routing")` / `settingsChanged("backlinks")` (saved before and put back after), its view
type `editor-lanes` and its `.lanes-view` element.

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
- **Timers:** debounced work uses `src/debounce.ts`, which runs on the main window's timers, never Obsidian's
  `debounce()`: that one puts its timer on the window active at the first call, and when that window closes
  first (a popout, or Settings, which the "Trust author" prompt opens on a vault's first open) the timer is
  lost and the debouncer never runs again. Seen 2026-11-08: Backlinks Full View built no panes until a restart.
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
- **End-to-end tests:** `e2e/sandbox.sh start|stop|restart|reset|deploy|shot|status <n>` runs a throwaway Obsidian
  (`OBS_APP`, default the 1.15.0 AppImage) on its own Xvfb display `:110+n` (never on your screen), with its own
  profile, its own vault in `.sandbox/sb<n>/` (git-ignored; `OBS_SANDBOX_DIR` for another place) and the DevTools
  port `9310+n`; this plugin's suite uses sandbox 1. The vault is a fresh empty one with only this plugin, plus any
  plugins in `OBS_PLUGINS` (built folders or GitHub releases `owner/repo@version`, separated by `:`) to test them
  together; or a copy of `OBS_VAULT` (for a big vault). `e2e/make-vault.mjs` then writes the fixtures that belong on
  disk: vault settings (`app.json`: links updated on rename, readable line length off), core plugins on or off
  (Page preview, Canvas, Search on; core Backlinks off), and a hub note with 3,000 backlinks. Every start installs
  the current build. `npm run e2e` (`e2e/run.mjs`, `e2e/cases.mjs`, fixtures in `e2e/fixtures.mjs`) drives it over
  the DevTools protocol (`e2e/cdp.mjs`) with real key and mouse input: it refuses any vault outside a sandbox,
  writes its notes in `_bfv/`, puts back every setting it changes, skips a case that `needs` a plugin that isn't
  enabled (`E2E_REQUIRE=<ids>` makes that a failure), scales its time limits by `BFV_PERF_SCALE`, writes
  `e2e/results.md` (`RESULTS=<file>` for another name) and exits 1 when a case fails. Needs Xvfb, rsync, curl,
  node 22+ and ImageMagick.

## Verification status

- **Confirmed in Obsidian by the user:** link navigation in all three modes.
- **End-to-end suite** (`e2e/`; the catalogue is `TEST-CASES.md`, results in `e2e/results.md` and
  `e2e/results-together.md`): tabs in all three modes, the sidebar, splits, a popout window, narrow width, canvas
  cards, Editor Multiple Lanes cards, query panes and DataviewJS, embedded notes as cards, unload and reload, a
  3,000-backlink hub, and contract cases for every meeting point with another plugin (Working with other plugins).
  Last full run alone (2026-11-08), in a fresh vault with only this plugin (`e2e/sandbox.sh reset 1`): 101/101 cases and 329/329 checks pass; the 8 cases that need another plugin are skipped (B3, I1, I2, K1, K2, K3, L1, Q7).
  Last full run together (2026-11-08), with Dataview 0.5.68 and the Editor Multiple Lanes build of the same day (`OBS_PLUGINS`, `npm run e2e:together`): 109/109 cases and 352/352 checks pass, 0 skipped.
- **Unit tests** (`npm test`): the pure logic (the `backlinks` and `backlinks-open` properties and their merges,
  search, Dataview results, property values, settings).
- **Everything else** is built and tested as above, but not confirmed by the user in Obsidian. Mobile isn't tested
  (J6's narrow width stands in).
