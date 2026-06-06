import type { DerivedMetrics, RowingFrame } from '../types/rowing';
import { normalizeFrames, type NormalizedFrame } from './schema';
import { buildOarTrajectoryInternal, type TrajectoryPoint } from '../utils/trajectory';
import type { StrokeSegment } from '../types/strokeDetect';
import { strokeAnalyzer, metricsAnalyzer, ANALYZERS } from './analyzers';

export interface DatasetAnalysis {
  /** 正規化済みフレーム（型付きアクセス用; キャッシュされる） */
  normalizedFrames: NormalizedFrame[];
  trajectory: TrajectoryPoint[];
  strokes: StrokeSegment[];
  metrics: DerivedMetrics;
  /**
   * ANALYZERS レジストリ内の追加アナライザー結果。
   * analyzer.id をキーとして参照: `extra.get('forceCurve')`
   */
  extra: Map<string, unknown>;
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
      extra: new Map(),
    };
  }

  const cached = analysisCache.get(frames);
  if (cached) return cached;

  // RowingFrame[] → NormalizedFrame[] への変換はここでのみ行う（パース境界）
  const normalizedFrames = normalizeFrames(frames);
  const trajectory = buildOarTrajectoryInternal(normalizedFrames);

  const input = { normalizedFrames, trajectory } as const;

  // 組み込みアナライザー（型安全のため直接呼び出し）
  const strokes = strokeAnalyzer.compute(input);
  const metrics = metricsAnalyzer.compute(input);

  // 追加アナライザー（ANALYZERS レジストリ経由で自動実行）
  const extra = new Map<string, unknown>();
  for (const analyzer of ANALYZERS) {
    extra.set(analyzer.id, analyzer.compute(input));
  }

  const analysis: DatasetAnalysis = {
    normalizedFrames,
    trajectory,
    strokes,
    metrics,
    extra,
  };

  analysisCache.set(frames, analysis);
  return analysis;
}

export function clearAnalysisCache(): void {
  analysisCache = new WeakMap<RowingFrame[], DatasetAnalysis>();
}
