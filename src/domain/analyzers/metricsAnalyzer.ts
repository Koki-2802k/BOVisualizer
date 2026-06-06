/**
 * metricsAnalyzer.ts — メトリクス導出アナライザー
 *
 * METRIC_COLUMNS で定義された全計測列をスキーマ駆動で集計し、
 * DerivedMetrics（SPM / SPLIT / 時刻軸 / GPS / graphSeries）を生成する。
 */

import type { Analyzer } from './types';
import type { DerivedMetrics } from '../../types/rowing';
import { deriveMetricsInternal } from '../../utils/metrics';

export const metricsAnalyzer: Analyzer<DerivedMetrics> = {
  id: 'metrics',
  label: 'メトリクス導出',

  compute({ normalizedFrames }) {
    return deriveMetricsInternal(normalizedFrames);
  },
};
