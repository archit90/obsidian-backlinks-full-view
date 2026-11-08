export const PANEL_CLASS = "bfv-panel";
export const HOVER_SOURCE = "backlinks-full-view"; // Settings → Page preview lists it as "Backlinks Full View"
export const DEFAULT_EMBED_LIMIT = 25; // max notes rendered per bfv.embed() call
export const MAX_EMBED_DEPTH = 3; // max nesting of embeds inside embeds
export const MAX_OPEN_SAVED = 50; // default for the setting: expanded cards remembered per note, most recent first
/** Frontmatter property holding the note's expanded cards (paths, most recent first), shared by all its panes. */
export const OPEN_PROP = "backlinks-open";
export const CONFIG_SAVE_DELAY = 600; // ms after a filter/sort/title/query edit before it's written
export const OPEN_SAVE_DELAY = 5000; // ms after a card toggle before `backlinks-open` is written (flushed early on switch/close/unload)
export const REFRESH_DELAY = 300; // ms debounce for event-driven refreshes
export const DV_DELAY = 2500; // ms of quiet after Dataview reindexes a note before query panes re-run
export const CARD_RERENDER_DELAY = 500; // ms debounce before an open card re-renders after its note changed
/**
 * A host element with this attribute opts the note views inside it out: no panes are built there, and the CSS
 * hides any already shown until the next refresh drops them. Any plugin can set it (Editor Multiple Lanes does,
 * on a lanes tab, while its "Show backlinks panes under lane notes" is off) and fire `layout-change` after.
 */
export const SKIP_SELECTOR = "[data-bfv-skip]";
/** Frontmatter property that opts a note in to panes on its canvas cards (`true`); off by default. */
export const CANVAS_OPT_IN = "canvas-full-backlinks-enabled";
/**
 * Frontmatter keys that hold this plugin's own settings (or Obsidian's bookkeeping), not the note's content: cards
 * don't show them, and search and filters don't see them.
 */
export const CONFIG_KEYS: ReadonlySet<string> = new Set(["position", "backlinks", OPEN_PROP, CANVAS_OPT_IN]);
