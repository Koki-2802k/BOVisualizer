/**
 * velocityAnalyzer.ts — 加速度積分による艇速推定アナライザー
 *
 * accx を GPS 実速度（1Hz アンカー）でデドリフトしながら積分し、
 * 60Hz の滑らかな速度系列を生成する。結果は DatasetAnalysis.extra.get('velocity')。
 *
 * 計算ロジックは utils/velocityIntegration.ts（純粋関数・単体テスト済み）に分離。
 */
import type { Analyzer, AnalysisInput } from './types';
import {
  computeIntegratedVelocity,
  type VelocityResult,
} from '../../utils/velocityIntegration';

export type { VelocityResult };

export const velocityAnalyzer: Analyzer<VelocityResult> = {
  id: 'velocity',
  label: '速度（加速度積分）',
  compute({ normalizedFrames }: AnalysisInput): VelocityResult {
    return computeIntegratedVelocity(normalizedFrames);
  },
};
