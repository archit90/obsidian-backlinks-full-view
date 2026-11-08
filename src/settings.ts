import { App, PluginSettingTab, Setting } from "obsidian";
import type FullBacklinksPlugin from "./main";
import { MAX_OPEN_SAVED } from "./constants";

/** Plugin-wide settings (data.json). Per-note pane settings live in frontmatter (see config.ts). */
export interface PluginSettings {
  canvas: boolean; // show panes on canvas note cards (while editing, and in reading view when the note opts in)
  noteEmbeds: boolean; // render `![[note]]` embeds as collapsible cards, as in the panes
  embedFullPath: boolean; // embed cards (and bfv.embed cards) are titled with the note's full path
  maxOpen: number; // expanded cards remembered per note in `backlinks-open` (0: not remembered)
}

export const PLUGIN_DEFAULTS: PluginSettings = {
  canvas: true,
  noteEmbeds: true,
  embedFullPath: true,
  maxOpen: MAX_OPEN_SAVED,
};

/** A saved or typed number of remembered cards: a whole number from 0 to 500, else the default. */
export function maxOpenOf(v: unknown): number {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 500 ? n : MAX_OPEN_SAVED;
}

export class FullBacklinksSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: FullBacklinksPlugin,
  ) {
    super(app, plugin);
  }

  override display() {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName("Show backlinks panes on canvas cards")
      .setDesc(
        'A note card on a canvas shows its panes while you edit it, and when not editing if the note has "Enable in canvas" ' +
          "(canvas-full-backlinks-enabled: true). Off: no panes on canvas cards, and the Enable in canvas button is hidden.",
      )
      .addToggle(t =>
        t.setValue(this.plugin.settings.canvas).onChange(async v => {
          this.plugin.settings.canvas = v;
          await this.plugin.saveSettings();
        }),
      );
    new Setting(containerEl)
      .setName("Show embedded notes as cards")
      .setDesc(
        "A whole-note embed (![[note]]) renders as a collapsible card, as in the panes: collapsed at first, with the note's " +
          "properties and the card border. Embeds of a heading or block (![[note#…]]) stay Obsidian's.",
      )
      .addToggle(t =>
        t.setValue(this.plugin.settings.noteEmbeds).onChange(async v => {
          this.plugin.settings.noteEmbeds = v;
          await this.plugin.saveSettings();
          this.plugin.rerenderNoteEmbeds();
        }),
      );
    new Setting(containerEl)
      .setName("Full path in embedded note cards")
      .setDesc(
        "On: an embedded note's card (![[note]], and bfv.embed() in DataviewJS) is titled with the note's full path " +
          "(folder/sub/name). Off: the note's name, with its folder in a faint label on the right, as in the panes.",
      )
      .addToggle(t =>
        t.setValue(this.plugin.settings.embedFullPath).onChange(async v => {
          this.plugin.settings.embedFullPath = v;
          await this.plugin.saveSettings();
          this.plugin.rerenderNoteEmbeds();
        }),
      );
    new Setting(containerEl)
      .setName("Remembered expanded cards")
      .setDesc(
        "How many expanded cards each note remembers, most recent first, in its backlinks-open property (one list for " +
          "all its panes: a remembered note opens expanded in every pane that shows it). 0: cards always start " +
          "collapsed and the property isn't written. 0–500.",
      )
      .addText(t => {
        t.inputEl.type = "number";
        t.inputEl.min = "0";
        t.inputEl.max = "500";
        t.setValue(String(this.plugin.settings.maxOpen)).onChange(async v => {
          const n = Number(v);
          if (v.trim() === "" || !Number.isInteger(n) || n < 0 || n > 500) return;
          this.plugin.settings.maxOpen = n;
          await this.plugin.saveSettings();
        });
      });
  }
}
