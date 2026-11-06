import { describe, expect, it } from "vitest";
import { evalSearch, parseSearch } from "./search";

/** Does `q` match a note whose searchable text is `hay`? (terms are substring matches, as in the plugin) */
const matches = (q: string, hay: string) => {
  const tree = parseSearch(q);
  return tree === null ? true : evalSearch(tree, t => hay.toLowerCase().includes(t));
};

describe("parseSearch", () => {
  it("gives null for an empty or blank query", () => {
    expect(parseSearch("")).toBeNull();
    expect(parseSearch("   ")).toBeNull();
    expect(parseSearch('""')).toBeNull();
  });
  it("ANDs adjacent terms and lower-cases them", () => {
    expect(parseSearch("Maya Standup")).toEqual({
      t: "and",
      c: [
        { t: "term", v: "maya" },
        { t: "term", v: "standup" },
      ],
    });
  });
  it("keeps quoted phrases whole", () => {
    expect(parseSearch('"daily log"')).toEqual({ t: "term", v: "daily log" });
  });
  it("gives NOT precedence over AND over OR", () => {
    expect(parseSearch("a OR b AND NOT c")).toEqual({
      t: "or",
      c: [
        { t: "term", v: "a" },
        {
          t: "and",
          c: [
            { t: "term", v: "b" },
            { t: "not", c: { t: "term", v: "c" } },
          ],
        },
      ],
    });
  });
  it("searches lower-case and / or / not as words", () => {
    expect(parseSearch("rock and roll")).toEqual({
      t: "and",
      c: [
        { t: "term", v: "rock" },
        { t: "term", v: "and" },
        { t: "term", v: "roll" },
      ],
    });
  });
  it("tolerates unbalanced parentheses and stray operators", () => {
    expect(() => parseSearch("((a OR b")).not.toThrow();
    expect(() => parseSearch("a) OR")).not.toThrow();
    expect(() => parseSearch("AND OR NOT")).not.toThrow();
    expect(matches("((billing OR acme", "acme corp")).toBe(true);
  });
});

describe("search evaluation", () => {
  const note = "projects/acme billing v2 maya standup";
  it.each([
    ["maya standup", true],
    ["maya draft", false],
    ["(billing AND v2) OR nothing", true],
    ["(billing AND v3) OR acme", true],
    ["(billing AND v3) OR zzz", false],
    ["NOT draft", true],
    ["-draft", true],
    ["-maya", false],
    ['-"daily log"', true],
    ['"acme billing"', true],
    ["-(maya OR zzz)", false],
    ["maya -(zzz OR yyy)", true],
  ])("%s → %s", (q, want) => {
    expect(matches(q, note)).toBe(want);
  });
});
