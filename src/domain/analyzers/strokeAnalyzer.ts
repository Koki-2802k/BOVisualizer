/**
 * strokeAnalyzer.ts — ストローク検出アナライザー
 *
 * 軌跡 Z 軸（水深）基準で 1 ストロークを検出し、
 * Catch / Drive / Finish / Recovery の 4 位相に分割する。
 */

import type { Analyzer } from './types';
import type { StrokeSegment } from '../../types/strokeDetect';
import { detectStrokesInternal } from '../../utils/strokeDetect';

export const strokeAnalyzer: Analyzer<StrokeSegment[]> = {
  id: 'strokes',
  label: 'ストローク検出',

  compute({ normalizedFrames, trajectory }) {
    return detectStrokesInternal(normalizedFrames, trajectory);
  },
};
