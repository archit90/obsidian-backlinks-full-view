import type { Component, MarkdownView, TFile, debounce } from "obsidian";

/**
 * The markdown embed inside a canvas note card (Obsidian internal, checked in 1.15.0). While the card is being
 * edited, `editMode` is set and its editor (with `.cm-sizer`) runs inside a same-origin iframe that Obsidian
 * relays the app's styles into; it's destroyed when editing stops.
 */
export interface CanvasEmbed extends Component {
  file: TFile | null;
  containerEl: HTMLElement;
  previewMode: { renderer?: { footer?: { el?: HTMLElement } | null; addFooter?: () => void } };
  editMode?: { sizerEl?: HTMLElement } | null;
}

/** Where panes are shown: a note tab, or a note card on a canvas. */
export type NoteView = MarkdownView | CanvasEmbed;
import type { Entry, PropDef, PropType, Settings } from "./config";

// ---------- runtime state ----------

export interface ItemState {
  file: TFile;
  ver: number; // the note's version (see FullBacklinksPlugin.versions) this item was built from
  el: HTMLElement;
  comp: Component;
  setOpen: (open: boolean) => Promise<void>;
  invalidate: () => void; // the note changed: re-render the card if it's open, else on next open
  props: Record<string, string[]>; // lower-cased key -> values
  labels: Record<string, string>; // lower-cased key -> key as written
  lists: Set<string>; // lower-cased keys whose value is an array
  tags: string[];
  hay?: string; // lower-cased path + tags + properties, built on first search
  sortFor?: string; // sorts JSON that sortKeys were computed for
  sortKeys?: string[]; // one joined value per sort rule
}

export interface PanelState {
  el: HTMLElement;
  listEl: HTMLElement;
  countEl: HTMLElement;
  warnEl: HTMLElement; // frontmatter parse errors for this entry
  filterBtn: HTMLElement;
  sortBtn: HTMLElement;
  filterPanel: HTMLElement;
  sortPanel: HTMLElement;
  component: Component;
  signature: string; // what the current items were synced from
  collapsed: boolean;
  stale: boolean; // collapsed after being built and skipped by a refresh: refresh on expand
  dead: boolean; // unloaded: late debounced callbacks must do nothing
  opened: Set<string>; // the view's expanded cards (ViewState.opened, shared by all its panes)
  items: Map<string, ItemState>;
  order: ItemState[]; // items in current DOM order
  needsSort: boolean;
  propDefs: PropDef[];
  propDefsKey: string;
  types: Map<string, PropType>;
  search: string;
  fullText: boolean; // search note text as well (session only, not saved)
  searchId: number; // guards against out-of-order full-text loads
  emptyEl: HTMLElement;
  renderEditors: () => void;
  updateButtons: () => void;
  titleEl: HTMLElement;
  queryInput: HTMLInputElement;
  titleInput: HTMLInputElement;
  reqId: number; // guards against out-of-order async query results
  queryKey: string; // query + origin the cached query result is for
  queryEpoch: number; // Dataview epoch of the cached query result
  queryPaths: string[] | null; // cached query result
  error: string; // Dataview query error, shown in place of the list
  ephemeral: boolean; // the built-in "All backlinks" pane: never written to frontmatter
  deferred: boolean; // built lazily: cards are created only once the pane is first expanded
  config: Settings; // this pane's filter/sort (stored as one entry of the note's `backlinks` list)
  raw: Record<string, unknown> | null; // the entry as read (unknown keys are written back unchanged)
  srcIndex: number | null; // index of that entry in the list on disk
  parseErrors: string[];
  view: ViewState;
}

/** All backlinks panes shown under one note view. */
export interface ViewState {
  view: NoteView;
  el: HTMLElement;
  warnEl: HTMLElement; // note-level frontmatter problems
  addBtn: HTMLElement; // the actions row (+ Add backlinks pane, canvas toggle): always last, panes go before it
  canvasBtn: HTMLElement; // "Enable in canvas" / "Disable in canvas"
  host: HTMLElement | null;
  panes: PanelState[]; // the note's own panes, saved in its `backlinks` frontmatter
  base: PanelState | null; // built-in pane every note gets (plain backlinks, starts collapsed, not saved)
  notePath: string | null;
  gen: number; // bumped on note switch, so a write that finishes later can tell
  baseList: Entry[]; // the list as last read from / written to the frontmatter (merge base)
  savedJson: string; // listJson(baseList)
  prevJson: string; // savedJson before our last write (a cache read equal to it within graceUntil is stale)
  listError: string; // `backlinks` itself isn't a pane list
  dirty: boolean; // local edits not yet written
  configPending: boolean; // a pane settings edit is waiting (uses the short save delay)
  // expanded cards: one list for the note (`backlinks-open`), shared by every pane, All backlinks included
  opened: Set<string>; // cards expanded now (cards hold a reference: mutate in place)
  openOrder: string[]; // expanded cards in the order they were opened, most recent last
  open: string[]; // the list to save, most recent first (at most the "Remembered expanded cards" setting)
  openBase: string[]; // the list as last read from / written to the frontmatter (merge base)
  openPrev: string[]; // openBase before our last write (a cache read equal to it within graceUntil is stale)
  openError: string; // `backlinks-open` isn't a list of paths: it isn't written until fixed
  openDirty: boolean; // `open` changed and isn't written yet
  graceUntil: number;
  saveSoon: ReturnType<typeof debounce>;
  saveLater: ReturnType<typeof debounce>;
  sources: TFile[]; // the note's backlinks as of the last refresh
  sourcePaths: Set<string>;
  srcSig: string; // path:version of every source
  stale: boolean; // skipped while hidden: refresh when shown
  observer: MutationObserver | null; // re-attaches the container if the host drops it
  reattachCount: number;
  reattachSince: number;
}

/** What filters and search read of a card's note (an item, or a lightweight stand-in for a collapsed pane's count). */
export type ItemData = Pick<ItemState, "file" | "props" | "labels" | "lists" | "tags">;
/** Property types a filter is evaluated with. */
export interface Typed {
  types: Map<string, PropType>;
}
export type Pred = (it: ItemData) => boolean;
export interface QueryResult {
  paths: string[];
  error?: string;
}
