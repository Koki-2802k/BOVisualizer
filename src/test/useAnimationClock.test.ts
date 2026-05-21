import { describe, expect, it } from "vitest";
import { clampFrameIndex } from "../hooks/useAnimationClock";

describe("clampFrameIndex", () => {
  it("clamps an out-of-range frame to the last valid index", () => {
    expect(clampFrameIndex(35, 35)).toBe(34);
  });

  it("returns zero for empty frame sets", () => {
    expect(clampFrameIndex(0, 12)).toBe(0);
  });

  it("returns zero for non-finite frame indices", () => {
    expect(clampFrameIndex(10, Number.NaN)).toBe(0);
  });
});
