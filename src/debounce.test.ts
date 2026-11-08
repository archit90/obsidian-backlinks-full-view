import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { debounce } from "./debounce";

describe("debounce (main-window timers)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs once, with the latest arguments, after the wait", () => {
    const seen: number[] = [];
    const d = debounce((n: number) => seen.push(n), 300);
    d(1);
    d(2);
    vi.advanceTimersByTime(299);
    expect(seen).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(seen).toEqual([2]);
  });

  it("without resetTimer, a burst runs `wait` after its first call", () => {
    const fn = vi.fn();
    const d = debounce(fn, 300);
    d();
    vi.advanceTimersByTime(200);
    d();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("with resetTimer, each call moves the deadline", () => {
    const fn = vi.fn();
    const d = debounce(fn, 300, true);
    d();
    vi.advanceTimersByTime(200);
    d();
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("keeps working after a run: a later call schedules again", () => {
    const fn = vi.fn();
    const d = debounce(fn, 300, true);
    d();
    vi.advanceTimersByTime(300);
    d();
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("cancel drops a pending run; run() runs a pending one at once and only then", () => {
    const fn = vi.fn();
    const d = debounce(fn, 300, true);
    d();
    d.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
    d.run(); // nothing pending
    expect(fn).not.toHaveBeenCalled();
    d();
    d.run();
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
