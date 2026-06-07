/**
 * velocityAnalyzer.ts — 艇速周期変動（チェック／ラン）解析アナライザー（機能 5）
 *
 * ストローク毎の速度プロファイルを抽出し、
 * キャッチでの減速（チェック）・フィニッシュ後の伸び（ラン）・
 * 速度変動率を算出する。
 *
 * 拡張ポイント①: domain/analyzers/index.ts の ANALYZERS に登録済み。
 * 結果は analysis.extra.get('velocity') として取得可能。
 */

import type { Analyzer, AnalysisInput } from './types';
import type { NormalizedFrame } from '../schema';

// ───────────────────────────────────────────────────────────────────────────
// 型定義
// ───────────────────────────────────────────────────────────────────────────

/** 1ストロークの速度指標 */
export interface StrokeVelocity {
  strokeIndex: number;
  /** ドライブ相平均速度 [m/s] */
  driveAvgSpeed: number | null;
  /** リカバリー相平均速度 [m/s] */
  recoveryAvgSpeed: number | null;
  /** キャッチ相の最低速度（チェック量）[m/s] */
  checkSpeed: number | null;
  /** フィニッシュ相の最高速度（ラン）[m/s] */
  runSpeed: number | null;
  /** ストローク内速度変動係数 σ/μ（0〜1; 大きいほどムラが大） */
  variationCoeff: number | null;
  /** 正規化速度プロファイル（0–100% を VELOCITY_PROFILE_POINTS 点でサンプリング） */
  normalizedProfile: (number | null)[];
}

export interface VelocityResult {
  perStroke: StrokeVelocity[];
  /** 全ストローク平均プロファイル */
  meanProfile: (number | null)[];
  /** プロファイルのサンプル点数 */
  profilePoints: number;
  /** 速度軸スケール上限 [m/s]（グラフ描画用） */
  maxSpeed: number;
}

// ───────────────────────────────────────────────────────────────────────────
// 定数
// ───────────────────────────────────────────────────────────────────────────

export const VELOCITY_PROFILE_POINTS = 100;

// ───────────────────────────────────────────────────────────────────────────
// ヘルパー
// ───────────────────────────────────────────────────────────────────────────

function getValidSpeeds(frames: NormalizedFrame[], start: number, end: number): number[] {
  const vals: number[] = [];
  for (let i = start; i <= end && i < frames.length; i++) {
    const v = frames[i]?.metrics.speed;
    if (v !== null && v !== undefined && Number.isFinite(v) && v >= 0) vals.push(v);
  }
  return vals;
}

function avgOf(vals: number[]): number | null {
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function stdDevOf(vals: number[], mean: number): number | null {
  if (vals.length < 2) return null;
  return Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
}

/**
 * startFrame〜endFrame の速度を VELOCITY_PROFILE_POINTS 点に線形補間してリサンプリングする。
 */
function buildNormalizedProfile(
  frames: NormalizedFrame[],
  startFrame: number,
  endFrame: number,
): (number | null)[] {
  const n = endFrame - startFrame + 1;
  if (n <= 0) return Array(VELOCITY_PROFILE_POINTS).fill(null);

  return Array.from({ length: VELOCITY_PROFILE_POINTS }, (_, i) => {
    const frac = VELOCITY_PROFILE_POINTS <= 1 ? 0 : i / (VELOCITY_PROFILE_POINTS - 1);
    const rawIdx = startFrame + frac * (n - 1);
    const lo = Math.min(Math.floor(rawIdx), endFrame);
    const hi = Math.min(lo + 1, endFrame);
    const t = rawIdx - lo;
    const vLo = frames[lo]?.metrics.speed;
    const vHi = frames[hi]?.metrics.speed;
    if (vLo == null || !Number.isFinite(vLo)) return typeof vHi === 'number' && Number.isFinite(vHi) ? vHi : null;
    if (vHi == null || !Number.isFinite(vHi)) return vLo;
    return vLo + t * (vHi - vLo);
  });
}

// ───────────────────────────────────────────────────────────────────────────
// アナライザー実装
// ───────────────────────────────────────────────────────────────────────────

export const velocityAnalyzer: Analyzer<VelocityResult> = {
  id: 'velocity',
  label: '艇速周期変動解析',

  compute({ normalizedFrames, strokes }: AnalysisInput): VelocityResult {
    const perStroke: StrokeVelocity[] = strokes.map((stroke) => {
      const drive      = stroke.phases.find((p) => p.phase === 'drive');
      const catchPhase = stroke.phases.find((p) => p.phase === 'catch');
      const finishPhase = stroke.phases.find((p) => p.phase === 'finish');
      const recoveryPhases = stroke.phases.filter((p) => p.phase === 'recovery');

      const driveVals   = drive        ? getValidSpeeds(normalizedFrames, drive.startFrame,       drive.endFrame)       : [];
      const catchVals   = catchPhase   ? getValidSpeeds(normalizedFrames, catchPhase.startFrame,  catchPhase.endFrame)  : [];
      const finishVals  = finishPhase  ? getValidSpeeds(normalizedFrames, finishPhase.startFrame, finishPhase.endFrame) : [];
      const recoveryVals: number[] = recoveryPhases.flatMap((rp) =>
        getValidSpeeds(normalizedFrames, rp.startFrame, rp.endFrame),
      );

      const allVals = getValidSpeeds(normalizedFrames, stroke.startFrame, stroke.endFrame);
      const mean = avgOf(allVals);
      const sd = mean !== null ? stdDevOf(allVals, mean) : null;

      return {
        strokeIndex: stroke.strokeIndex,
        driveAvgSpeed:    avgOf(driveVals),
        recoveryAvgSpeed: avgOf(recoveryVals),
        checkSpeed:  catchVals.length  > 0 ? Math.min(...catchVals)  : null,
        runSpeed:    finishVals.length > 0 ? Math.max(...finishVals) : null,
        variationCoeff: mean !== null && mean > 0 && sd !== null ? sd / mean : null,
        normalizedProfile: buildNormalizedProfile(normalizedFrames, stroke.startFrame, stroke.endFrame),
      };
    });

    // 平均プロファイル
    const meanProfile = Array.from({ length: VELOCITY_PROFILE_POINTS }, (_, i) => {
      const vals = perStroke
        .map((s) => s.normalizedProfile[i])
        .filter((v): v is number => v !== null && Number.isFinite(v));
      return avgOf(vals);
    });

    // Y軸スケール上限（最大値の 10% 余白を確保）
    const allVals = perStroke
      .flatMap((s) => s.normalizedProfile)
      .filter((v): v is number => v !== null && Number.isFinite(v) && v > 0);
    const maxSpeed = allVals.length > 0 ? Math.max(...allVals) * 1.1 : 4;

    return { perStroke, meanProfile, profilePoints: VELOCITY_PROFILE_POINTS, maxSpeed };
  },
};
