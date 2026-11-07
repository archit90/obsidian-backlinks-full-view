import { App, PluginSettingTab, Setting } from "obsidian";
import type FullBacklinksPlugin from "./main";

/** Plugin-wide settings (data.json). Per-note pane settings live in frontmatter (see config.ts). */
export interface PluginSettings {
  canvas: boolean; // show panes on canvas note cards (while editing, and in reading view when the note opts in)
  noteEmbeds: boolean; // render `![[note]]` embeds as collapsible cards, as in the panes
}

export const PLUGIN_DEFAULTS: PluginSettings = {
  canvas: true,
  noteEmbeds: true,
};

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
  }
}
