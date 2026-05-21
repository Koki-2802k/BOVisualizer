import { describe, expect, it } from "vitest";
import { buildOarTrajectory } from "../utils/trajectory";
import type { RowingFrame } from "../types/rowing";

// RowingFrame は index signature を持つため as cast で簡易フレームを作れる
function makeFrame(fields: Record<string, unknown>): RowingFrame {
  return fields as unknown as RowingFrame;
}

describe("buildOarTrajectory", () => {
  it("returns empty array for empty input", () => {
    expect(buildOarTrajectory([])).toEqual([]);
  });

  it("uses explicit tip coordinates when present", () => {
    const frame = makeFrame({
      number: 1,
      left_tip_x: 1.5,
      left_tip_z: 0.3,
      right_tip_x: -1.5,
      right_tip_z: 0.3,
    });
    const result = buildOarTrajectory([frame]);

    expect(result).toHaveLength(1);
    expect(result[0].leftX).toBeCloseTo(1.5, 5);
    expect(result[0].leftZ).toBeCloseTo(0.3, 5);
    expect(result[0].rightX).toBeCloseTo(-1.5, 5);
    expect(result[0].rightZ).toBeCloseTo(0.3, 5);
    expect(result[0].frameNumber).toBe(1);
  });

  it("falls back to angle-based calculation when tip coords absent", () => {
    // angle=0 → reach=200, cos(0)=1, sin(0)=0 → leftX=200, leftZ=0
    const frame = makeFrame({ number: 5, angle_left: 0, angle_right: 0 });
    const result = buildOarTrajectory([frame]);

    expect(result[0].leftX).toBeCloseTo(200.0, 5);
    expect(result[0].leftZ).toBeCloseTo(0, 5);
    expect(result[0].rightX).toBeCloseTo(-200.0, 5); // right side flips X
    expect(result[0].rightZ).toBeCloseTo(0, 5);
  });

  it("uses angle=90° fallback correctly", () => {
    // angle=90 → cos(π/2)=0, sin(π/2)=1 → x=0, z=200
    const frame = makeFrame({ angle_left: 90, angle_right: 90 });
    const result = buildOarTrajectory([frame]);

    expect(result[0].leftX).toBeCloseTo(0, 5);
    expect(result[0].leftZ).toBeCloseTo(200.0, 5);
    expect(result[0].rightX).toBeCloseTo(0, 5); // -0 = 0
    expect(result[0].rightZ).toBeCloseTo(200.0, 5);
  });

  it("includes leftAngleDeg and rightAngleDeg in output points", () => {
    const frame = makeFrame({ angle_left: 45, angle_right: -30 });
    const [pt] = buildOarTrajectory([frame]);

    expect(typeof pt.leftAngleDeg).toBe("number");
    expect(typeof pt.rightAngleDeg).toBe("number");
    expect(Number.isFinite(pt.leftAngleDeg)).toBe(true);
    expect(Number.isFinite(pt.rightAngleDeg)).toBe(true);
    expect(pt.leftAngleDeg).toBeCloseTo(45, 5);
    expect(pt.rightAngleDeg).toBeCloseTo(-30, 5);
  });

  it("accepts string-encoded numeric values", () => {
    const frame = makeFrame({
      number: "10",
      left_tip_x: "2.1",
      left_tip_z: "0.5",
      right_tip_x: "-2.1",
      right_tip_z: "0.5",
    });
    const result = buildOarTrajectory([frame]);

    expect(result[0].frameNumber).toBe(10);
    expect(result[0].leftX).toBeCloseTo(2.1, 5);
  });

  it("all output coordinates are finite (no NaN/Infinity)", () => {
    const frames = [
      makeFrame({ angle_left: 45, angle_right: 45 }),
      makeFrame({ left_tip_x: 1.0, left_tip_z: 0.2, right_tip_x: -1.0, right_tip_z: 0.2 }),
      makeFrame({}), // empty frame → fallback with angle=0
    ];
    const result = buildOarTrajectory(frames);

    expect(result).toHaveLength(3);
    for (const pt of result) {
      expect(Number.isFinite(pt.leftX)).toBe(true);
      expect(Number.isFinite(pt.leftZ)).toBe(true);
      expect(Number.isFinite(pt.rightX)).toBe(true);
      expect(Number.isFinite(pt.rightZ)).toBe(true);
    }
  });

  it("uses index as frameNumber fallback when number field absent", () => {
    const frames = [makeFrame({}), makeFrame({}), makeFrame({})];
    const result = buildOarTrajectory(frames);

    expect(result[0].frameNumber).toBe(0);
    expect(result[1].frameNumber).toBe(1);
    expect(result[2].frameNumber).toBe(2);
  });

  it("prefers first matching key in TRAJECTORY_KEYS over later aliases", () => {
    // left_tip_x takes priority over oar_left_tip_x
    const frame = makeFrame({
      left_tip_x: 3.0,
      oar_left_tip_x: 9.9, // should be ignored
      left_tip_z: 0.1,
      right_tip_x: -3.0,
      right_tip_z: 0.1,
    });
    const result = buildOarTrajectory([frame]);

    expect(result[0].leftX).toBeCloseTo(3.0, 5);
  });
});
