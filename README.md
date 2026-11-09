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
- Works in Live Preview, Source mode and Reading view, in tabs, sidebars and popout windows. It isn't marked
  desktop-only, but it hasn't been tested on a phone or tablet.
- Keyboard: Tab to a pane or card header, Enter or Space to expand or collapse it.

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
plugin, the panes also show under lane cards (that plugin can turn them off there). How the two meet, and how other
plugins can opt notes out (`data-bfv-skip`), is in `SPEC.md`, "Working with other plugins".

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

Releasing: `npm run release` bumps the patch version only (0.1.0 → 0.1.1 …) in `package.json`, `manifest.json`
and `versions.json` and tags the commit with it; `git push --follow-tags` then runs the release workflow, which
checks, builds and publishes the GitHub release BRAT installs from. A new minor or major version is a deliberate
choice: `ALLOW_MINOR_BUMP=1 npm version minor`.

End-to-end tests run in a throwaway Obsidian on a virtual display (Linux: Xvfb, ImageMagick, node 22+, and the
Obsidian 1.15 AppImage, or `OBS_APP=<path>`), never in your own vaults:

```sh
npm run build && e2e/sandbox.sh reset 1 && npm run e2e       # alone, in a fresh vault
e2e/sandbox.sh stop 1
OBS_PLUGINS=blacksmithgu/obsidian-dataview@0.5.68:<folder of an Editor Multiple Lanes build> \
  OBS_SANDBOX_DIR=$PWD/.sandbox-together e2e/sandbox.sh reset 1 && npm run e2e:together    # with them
```

The cases are in `TEST-CASES.md`; how the sandbox works is in `SPEC.md` (Development).

## Licence

MIT
