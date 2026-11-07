// Obsidian (and Dataview) internals Backlinks Full View relies on. Checked against Obsidian 1.15.0.
import "obsidian";

declare module "obsidian" {
  interface App {
    plugins?: {
      plugins: {
        dataview?: {
          manifest?: { version?: string };
          index?: { initialized?: boolean };
          api?: {
            query(
              source: string,
              originFile?: string,
            ): Promise<{ successful: boolean; value?: unknown; error?: unknown }>;
          };
        };
      };
    };
  }

  /** What Obsidian hands an embed creator (`![[note]]` in a note, a canvas file card, a hover…). */
  interface EmbedContext {
    app: App;
    linktext: string;
    sourcePath: string;
    containerEl: HTMLElement;
    displayMode?: boolean;
    /** Set for a `![[…]]` embed in note text (Reading view, Live Preview, rendered Markdown); unset for canvas file cards. */
    showInline?: boolean;
    depth?: number;
  }
  /** An embed: a Component Obsidian loads, then asks to load its file. */
  interface EmbedComponent extends Component {
    loadFile(): unknown;
  }
  type EmbedCreator = (ctx: EmbedContext, file: TFile, subpath: string) => EmbedComponent;

  interface App {
    /** Obsidian's embed renderers by file extension (core Markdown embeds under "md"). */
    embedRegistry?: { embedByExtension: Record<string, EmbedCreator | undefined> };
  }

  interface WorkspaceLeaf {
    /** Rebuilds the leaf's view in place (internal), so embeds render afresh. */
    rebuildView?(): void;
  }

  interface MetadataCache {
    /** Dataview's events, fired on the metadata cache. */
    on(name: "dataview:index-ready" | "dataview:metadata-change", callback: (...args: unknown[]) => unknown): EventRef;
  }

  interface MarkdownPreviewView {
    /** Reading view: the panel goes in the renderer's footer, after the rendered note. */
    renderer?: { footer?: { el?: HTMLElement } };
  }

  /** A canvas tab (core Canvas). Its note cards aren't leaves: each holds a markdown embed as `child`. */
  interface View {
    canvas?: { nodes?: Map<string, { child?: unknown }> };
  }

  /**
   * The editing mode of a note view (MarkdownEditView, not exported). Obsidian keeps half the editor's height
   * of padding below the last line (`updateBottomPadding`, called from `onResize`); with core Backlinks shown in
   * the note it uses 100px and gives that element the rest as min-height.
   */
  interface MarkdownEditModeInternal {
    sizerEl?: HTMLElement;
    containerEl?: HTMLElement;
    /** CodeMirror's EditorView; `defaultLineHeight` is its measured height of one text line, in px. */
    cm?: { contentDOM?: HTMLElement; defaultLineHeight?: number };
    view?: { backlinksEl?: HTMLElement };
    updateBottomPadding?(height: number): void;
  }

  interface MarkdownView {
    /** Editing views: the panel goes at the end of the editor's sizer, after the last line. */
    editMode?: MarkdownEditModeInternal;
    /** Switches between editing and Reading view (internal; the mode button and Ctrl+E go through setViewState). */
    setMode?(mode: unknown): Promise<void>;
  }
}

declare global {
  interface Window {
    /** The DataviewJS helper API (`bfv.embed(...)`), set while the plugin is loaded. */
    bfv?: unknown;
  }
}
