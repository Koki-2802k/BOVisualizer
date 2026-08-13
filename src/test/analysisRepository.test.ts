import { beforeEach, describe, expect, it } from 'vitest';
import { clearAnalysisCache, getAnalysis } from '../domain/analysisRepository';
import type { RowingFrame } from '../types/rowing';

describe('analysisRepository', () => {
  beforeEach(() => {
    clearAnalysisCache();
  });

  it('reuses one analysis result for the same frame array', () => {
    const frames: RowingFrame[] = [
      { number: 0, time_s: 0, speed: 2.1, latitude: 35, longitude: 139 },
      { number: 1, time_s: 1 / 60, speed: 2.2, latitude: 35.1, longitude: 139.1 },
    ];

    const first = getAnalysis(frames);
    const second = getAnalysis(frames);

    expect(second).toBe(first);
    expect(first.normalizedFrames).toHaveLength(2);
    expect(first.trajectory).toHaveLength(2);
    expect(first.metrics.graphSeries.speed).toHaveLength(2);
  });

  it('returns a complete empty result without caching shared mutable state', () => {
    const first = getAnalysis([]);
    const second = getAnalysis([]);

    expect(first).not.toBe(second);
    expect(first).toMatchObject({
      normalizedFrames: [],
      trajectory: [],
      strokes: [],
      metrics: {
        spm: [],
        split: [],
        timeAxis: [],
        gpsValidPoints: [],
        graphSeries: {},
      },
    });
  });
});
