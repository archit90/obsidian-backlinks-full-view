# Backlinks Full View

An Obsidian plugin that shows a note's backlinks **in full**: every linking note as a collapsible card holding
the whole rendered note, in panes below the note you're reading. It replaces the core Backlinks pane.

## Features

- **All backlinks** pane under every note, plus any number of **your own panes** per note, saved in the
  note's `backlinks` frontmatter property: a title, **filters** (nested and / or / not rules on properties and
  file fields, as in Bases), **sorting** on several keys, or a **Dataview query** that supplies the notes.
- **Cards** start collapsed and render the note (properties first, then the text) when you expand them.
  Expanded cards are remembered per note in a separate `backlinks-open` property, shared by all its panes.
- **Search** within a pane: words, `AND` / `OR` / `NOT`, `"phrases"`, parentheses, optionally the full text.
- **Links** in cards behave as in Obsidian: click, Ctrl/Cmd-click for a new tab, hover preview.
- **Embedded notes as cards:** `![[note]]` renders as the same collapsible card, in Reading view and Live
  Preview. An embed in a list item or a sentence stays on its line.
- **Canvas:** panes on note cards while editing, and in reading view for notes that opt in.
- **DataviewJS:** `bfv.embed(dv, dv.pages('#project'))` renders full-note cards.
- Works in Live Preview, Source mode and Reading view, in tabs, popout windows and on mobile.

## Settings

- Show backlinks panes on canvas cards (on)
- Show embedded notes as cards (on)
- Full path in note cards (on): titles cards with `folder/sub/name`; off shows the name and a faint folder label
- Remembered expanded cards (50; 0 remembers none)

## Install with BRAT

1. Install **BRAT** (Obsidian42 - BRAT) from Community plugins.
2. BRAT → **Add beta plugin** → `archit90/obsidian-backlinks-full-view` → Add plugin.
3. Enable **Backlinks Full View** in Community plugins. Turn off the core **Backlinks** plugin.

Optional: Dataview, for query panes and `bfv.embed`.

## Notes

Works on its own. With the optional [Editor Multiple Lanes](https://github.com/archit90/obsidian-editor-multiple-lanes)
plugin, the panes also show under lane cards.

Requires Obsidian 1.15 or later. It uses some Obsidian internals (checked against 1.15.0), so a new Obsidian
version may need an update.

## Building

```sh
npm install
npm run build                    # main.js
npm test                         # unit tests
npm run check                    # format, lint, typecheck, unit tests, build, smoke load: before every commit
npm run deploy -- <vault> …      # build and copy into vaults that have the plugin installed (--install adds it)
```

Releasing: `npm version patch` (or `minor` / `major`) bumps `package.json`, `manifest.json` and `versions.json` and
tags the commit with the version; `git push --follow-tags` then runs the release workflow, which checks, builds and
publishes the GitHub release BRAT installs from. End-to-end tests: see `TEST-CASES.md` and `SPEC.md`
(Development).

## Licence

MIT
