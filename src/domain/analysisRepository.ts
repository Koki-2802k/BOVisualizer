import type { DatasetCsv, DerivedMetrics, RowingFrame } from '../types/rowing';
import { buildOarTrajectoryInternal, type TrajectoryPoint } from '../utils/trajectory';
import { detectStrokesInternal } from '../utils/strokeDetect';
import type { StrokeSegment } from '../types/strokeDetect';
import { deriveMetricsInternal } from '../utils/metrics';

export interface DatasetAnalysis {
  trajectory: TrajectoryPoint[];
  strokes: StrokeSegment[];
  metrics: DerivedMetrics;
}

let analysisCache = new WeakMap<RowingFrame[], DatasetAnalysis>();

export function getAnalysis(frames: RowingFrame[]): DatasetAnalysis {
  if (frames.length === 0) {
    return {
      trajectory: [],
      strokes: [],
      metrics: {
        spm: [],
        split: [],
        timeAxis: [],
        gpsValidPoints: [],
        graphSeries: {},
      },
    };
  }

  let cached = analysisCache.get(frames);
  if (cached) {
    return cached;
  }

  const trajectory = buildOarTrajectoryInternal(frames);
  const strokes = detectStrokesInternal(frames, trajectory);

  const dummyDataset: DatasetCsv = {
    headers: [],
    frames,
    meta: { measurementMode: '', totalFrames: frames.length },
  };
  const metrics = deriveMetricsInternal(dummyDataset);

  const analysis: DatasetAnalysis = {
    trajectory,
    strokes,
    metrics,
  };

  analysisCache.set(frames, analysis);
  return analysis;
}

export function clearAnalysisCache(): void {
  analysisCache = new WeakMap<RowingFrame[], DatasetAnalysis>();
}
