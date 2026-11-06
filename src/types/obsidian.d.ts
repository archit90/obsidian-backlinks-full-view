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

  interface MetadataCache {
    /** Dataview's events, fired on the metadata cache. */
    on(name: "dataview:index-ready" | "dataview:metadata-change", callback: (...args: unknown[]) => unknown): EventRef;
  }

  interface MarkdownPreviewView {
    /** Reading view: the panel goes in the renderer's footer, after the rendered note. */
    renderer?: { footer?: { el?: HTMLElement } };
  }

  interface MarkdownView {
    /** Editing views: the panel goes at the end of the editor's sizer, after the last line. */
    editMode?: { sizerEl?: HTMLElement };
  }
}

declare global {
  interface Window {
    /** The DataviewJS helper API (`bfv.embed(...)`), set while the plugin is loaded. */
    bfv?: unknown;
  }
}
