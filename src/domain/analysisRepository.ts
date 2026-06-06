import type { DerivedMetrics, RowingFrame } from '../types/rowing';
import { normalizeFrames, type NormalizedFrame } from './schema';
import { buildOarTrajectoryInternal, type TrajectoryPoint } from '../utils/trajectory';
import { detectStrokesInternal } from '../utils/strokeDetect';
import type { StrokeSegment } from '../types/strokeDetect';
import { deriveMetricsInternal } from '../utils/metrics';

export interface DatasetAnalysis {
  /** 正規化済みフレーム（型付きアクセス用; キャッシュされる） */
  normalizedFrames: NormalizedFrame[];
  trajectory: TrajectoryPoint[];
  strokes: StrokeSegment[];
  metrics: DerivedMetrics;
}

let analysisCache = new WeakMap<RowingFrame[], DatasetAnalysis>();

export function getAnalysis(frames: RowingFrame[]): DatasetAnalysis {
  if (frames.length === 0) {
    return {
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
    };
  }

  const cached = analysisCache.get(frames);
  if (cached) return cached;

  // RowingFrame[] → NormalizedFrame[] への変換はここでのみ行う（パース境界）
  const normalizedFrames = normalizeFrames(frames);
  const trajectory = buildOarTrajectoryInternal(normalizedFrames);
  const strokes = detectStrokesInternal(normalizedFrames, trajectory);
  const metrics = deriveMetricsInternal(normalizedFrames);

  const analysis: DatasetAnalysis = {
    normalizedFrames,
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
