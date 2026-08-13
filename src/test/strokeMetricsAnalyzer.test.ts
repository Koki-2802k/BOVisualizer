import { describe, expect, it } from 'vitest';
import { computeStrokeMetricRow } from '../domain/analyzers/strokeMetricsAnalyzer';
import type { StrokeSegment } from '../types/strokeDetect';
import type { TrajectoryPoint } from '../utils/trajectory';

const stroke: StrokeSegment = {
  strokeIndex: 3,
  startFrame: 0,
  endFrame: 3,
  phases: [
    { phase: 'catch', startFrame: 0, endFrame: 0 },
    { phase: 'drive', startFrame: 1, endFrame: 2 },
    { phase: 'finish', startFrame: 3, endFrame: 3 },
  ],
};

const trajectory: TrajectoryPoint[] = [
  { frameNumber: 0, leftX: 0, leftZ: 0, rightX: 0, rightZ: 0, leftAngleDeg: 60, rightAngleDeg: -60 },
  { frameNumber: 1, leftX: 0, leftZ: 0, rightX: 0, rightZ: 0, leftAngleDeg: 75, rightAngleDeg: -75 },
  { frameNumber: 2, leftX: 0, leftZ: 0, rightX: 0, rightZ: 0, leftAngleDeg: 120, rightAngleDeg: -120 },
  { frameNumber: 3, leftX: 0, leftZ: 0, rightX: 0, rightZ: 0, leftAngleDeg: 150, rightAngleDeg: -150 },
];

describe('computeStrokeMetricRow', () => {
  it('derives symmetric catch and finish differences', () => {
    const result = computeStrokeMetricRow(trajectory, stroke);

    expect(result.strokeIndex).toBe(3);
    expect(result.leftCatch).toBe(60);
    expect(result.rightCatch).toBe(-60);
    expect(result.catchAngleDiff).toBe(0);
    expect(result.finishAngleDiff).toBe(0);
  });

  it('calculates ideal-angle ratios over the catch-to-finish interval', () => {
    const result = computeStrokeMetricRow(trajectory, stroke);

    expect(result.leftIdealRatio).toBe(75);
    expect(result.rightIdealRatio).toBe(75);
  });
});
