export const PANEL_CLASS = "bfv-panel";
export const HOVER_SOURCE = "backlinks-full-view"; // Settings → Page preview lists it as "Backlinks Full View"
export const DEFAULT_EMBED_LIMIT = 25; // max notes rendered per bfv.embed() call
export const MAX_EMBED_DEPTH = 3; // max nesting of embeds inside embeds
export const MAX_OPEN_SAVED = 50; // expanded cards remembered per pane in frontmatter, most recent first
export const CONFIG_SAVE_DELAY = 600; // ms after a filter/sort/title/query edit before it's written
export const OPEN_SAVE_DELAY = 5000; // ms after a card toggle before `open` is written (flushed early on switch/close/unload)
export const REFRESH_DELAY = 300; // ms debounce for event-driven refreshes
export const CARD_RERENDER_DELAY = 500; // ms debounce before an open card re-renders after its note changed
/** A host element with this attribute opts the note views inside it out (Editor Lanes: backlinks panes off). */
export const SKIP_SELECTOR = "[data-bfv-skip]";
