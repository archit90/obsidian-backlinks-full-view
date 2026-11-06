import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localIso, normDate, toStrings } from "./values";

describe("toStrings", () => {
  it("flattens values to strings", () => {
    expect(toStrings(null)).toEqual([]);
    expect(toStrings(["a", ["b", 3]])).toEqual(["a", "b", "3"]);
    expect(toStrings({ k: 1 })).toEqual(['{"k":1}']);
    expect(toStrings(false)).toEqual(["false"]);
  });
});

describe("normDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 6, 9, 30)); // 2026-11-06 local time
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    ["today", "2026-11-06"],
    ["Yesterday", "2026-11-05"],
    ["tomorrow", "2026-11-07"],
    ["today - 7d", "2026-10-30"],
    ["+30d", "2026-12-06"],
    ["2026-01-02T10:00", "2026-01-02"],
  ])("%s → %s", (input, want) => {
    expect(normDate(input)).toBe(want);
  });
  it("formats local times without a time zone", () => {
    expect(localIso(new Date(2026, 0, 2, 3, 4).getTime())).toBe("2026-01-02T03:04");
  });
});
