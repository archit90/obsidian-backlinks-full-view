import { describe, expect, it } from "vitest";
import { PLUGIN_DEFAULTS, maxOpenOf, settingsFrom } from "./settings";

describe("settingsFrom", () => {
  it("gives the defaults for no data", () => {
    expect(settingsFrom(null)).toEqual({ settings: PLUGIN_DEFAULTS, migrated: false });
    expect(settingsFrom("nonsense").settings).toEqual(PLUGIN_DEFAULTS);
  });
  it("reads every setting, and the default for an invalid one", () => {
    const raw = { canvas: false, noteEmbeds: "yes", cardFullPath: false, maxOpen: 7 };
    expect(settingsFrom(raw)).toEqual({
      settings: { canvas: false, noteEmbeds: true, cardFullPath: false, maxOpen: 7 },
      migrated: false,
    });
    expect(settingsFrom({ maxOpen: 501 }).settings.maxOpen).toBe(PLUGIN_DEFAULTS.maxOpen);
  });
  it("takes the older embedFullPath as cardFullPath once, and says the data needs saving", () => {
    expect(settingsFrom({ embedFullPath: false })).toEqual({
      settings: { ...PLUGIN_DEFAULTS, cardFullPath: false },
      migrated: true,
    });
    // both: the newer key wins
    expect(settingsFrom({ embedFullPath: false, cardFullPath: true }).settings.cardFullPath).toBe(true);
    expect("embedFullPath" in settingsFrom({ embedFullPath: false }).settings).toBe(false);
  });
});

describe("maxOpenOf", () => {
  it("accepts whole numbers from 0 to 500, typed or saved", () => {
    expect(maxOpenOf(0)).toBe(0);
    expect(maxOpenOf("12")).toBe(12);
    expect(maxOpenOf(2.5)).toBe(PLUGIN_DEFAULTS.maxOpen);
    expect(maxOpenOf("")).toBe(PLUGIN_DEFAULTS.maxOpen);
  });
});
