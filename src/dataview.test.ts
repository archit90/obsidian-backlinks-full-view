import { describe, expect, it } from "vitest";
import { notePathsInResult, resultRowCount } from "./dataview";

const link = (path: string) => ({ path, type: "file" });
const paths = (v: unknown) => [...notePathsInResult(v)];

describe("notePathsInResult", () => {
  it("takes a TABLE's first column", () => {
    expect(
      paths({
        type: "table",
        values: [
          [link("a.md"), link("other.md")],
          [link("b.md"), "x"],
        ],
      }),
    ).toEqual(["a.md", "b.md"]);
  });
  it("takes every column of a grouped TABLE", () => {
    expect(
      paths({ type: "table", idMeaning: { type: "group" }, values: [["g", [link("a.md"), link("b.md")]]] }),
    ).toEqual(["a.md", "b.md"]);
  });
  it("takes LIST items, and grouped values only when grouped", () => {
    const pair = { $widget: "dataview:list-pair", key: link("k.md"), value: link("v.md") };
    expect(paths({ type: "list", values: [link("a.md"), pair] })).toEqual(["a.md", "k.md"]);
    expect(paths({ type: "list", primaryMeaning: { type: "group" }, values: [pair] })).toEqual(["k.md", "v.md"]);
  });
  it("takes CALENDAR links and page objects", () => {
    expect(paths({ type: "calendar", values: [{ link: link("c.md") }] })).toEqual(["c.md"]);
    expect(paths({ type: "task", values: [{ file: { path: "t.md" } }] })).toEqual(["t.md"]);
  });
  it("stops at depth 5 and ignores non-objects", () => {
    expect(paths(null)).toEqual([]);
    expect(paths({ type: "list", values: ["text", 3] })).toEqual([]);
    const deep = { a: { b: { c: { d: { e: { f: link("deep.md") } } } } } };
    expect(paths({ type: "other", values: [deep] })).toEqual([]);
  });
});

describe("resultRowCount", () => {
  it("counts rows, so an empty result can be told from one without links", () => {
    expect(resultRowCount({ type: "list", values: [] })).toBe(0);
    expect(resultRowCount({ type: "table", values: [[3], [4]] })).toBe(2);
    expect(resultRowCount(null)).toBe(0);
    expect(resultRowCount({ type: "list" })).toBe(0);
  });
});
