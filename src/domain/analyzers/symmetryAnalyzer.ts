/**
 * symmetryAnalyzer.ts — 左右対称性（バランス）分析アナライザー（機能 4）
 *
 * キャッシュ済みの trajectory / strokes を注入して計算する。
 * 自前で buildOarTrajectory や detectStrokes を呼ばない。
 *
 * 計算対象:
 *   - キャッチ角の左右差 (左 - 右) [deg]
 *   - フィニッシュ角の左右差 (左 - 右) [deg]
 *   - スイープ角の左右差 (左 - 右) [deg]
 *   - キャッチ入水タイミング差 (左 - 右) [frames]
 *   - フィニッシュ離水タイミング差 (左 - 右) [frames]
 *   - キャッチ中央フレームの艇ロール角 [deg]
 */

import type { Analyzer, AnalysisInput } from './types';
import type { StrokeSegment } from '../../types/strokeDetect';

// ───────────────────────────────────────────────────────────────────────────
// 型定義
// ───────────────────────────────────────────────────────────────────────────

export interface StrokeSymmetry {
  strokeIndex: number;
  /**
   * キャッチ角の左右差 = leftCatch + rightCatch [deg]
   * 右オールセンサーは物理的に左と反転しているため対称位置では rightAngle ≈ -leftAngle。
   * よって (left - right) ではなく (left + right) を使う。
   * 対称ストロークで ≈ 0、正 = 左キャッチが進行方向に近い。
   */
  catchAngleDiff: number | null;
  /**
   * フィニッシュ角の左右差 = leftFinish + rightFinish [deg]
   * 対称ストロークで ≈ 0、負 = 左フィニッシュが艇後方寄り。
   */
  finishAngleDiff: number | null;
  /** スイープ角の左右差 (左sweep - 右sweep) [deg]. 正 = 左が広い */
  sweepDiff: number | null;
  /** キャッチ入水タイミング差 (左入水frame - 右入水frame). 正 = 左が遅い */
  catchTimingDiff: number | null;
  /** フィニッシュ離水タイミング差 (左離水frame - 右離水frame). 正 = 左が遅い */
  finishTimingDiff: number | null;
  /** キャッチ位相中央フレームの艇ロール角 [deg]. 正 = 左舷上がり */
  boatRollAtCatch: number | null;
}

export interface SymmetryResult {
  perStroke: StrokeSymmetry[];
}

// ───────────────────────────────────────────────────────────────────────────
// 定数
// ───────────────────────────────────────────────────────────────────────────

/** ブレード入水判定しきい値 [cm]（strokeDetect と合わせる） */
const WATER_THRESHOLD = -30;

// ───────────────────────────────────────────────────────────────────────────
// ヘルパー
// ───────────────────────────────────────────────────────────────────────────

/** ボートクォータニオン → ロール角 [deg]（正 = 左舷上がり） */
function quaternionToRollDeg(w: number, x: number, y: number, z: number): number {
  const sinr = 2 * (w * x + y * z);
  const cosr = 1 - 2 * (x * x + y * y);
  return (Math.atan2(sinr, cosr) * 180) / Math.PI;
}

/**
 * angles[phaseStart - offsetFrame .. phaseEnd - offsetFrame] の平均を返す。
 * @param angles  ストローク開始フレームを 0 とした角度配列
 * @param phaseStart  グローバルフレーム番号
 * @param phaseEnd    グローバルフレーム番号（inclusive）
 * @param offsetFrame ストローク開始グローバルフレーム番号
 */
function phaseAvg(
  angles: number[],
  phaseStart: number,
  phaseEnd: number,
  offsetFrame: number,
): number | null {
  const s = Math.max(0, phaseStart - offsetFrame);
  const e = Math.min(angles.length - 1, phaseEnd - offsetFrame);
  if (s > e) return null;
  const slice = angles.slice(s, e + 1);
  if (slice.length === 0) return null;
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/**
 * グローバルフレーム番号 [start, end] の範囲で最初に condition を満たすフレームを返す。
 * 見つからなければ null。
 */
function firstFrame(
  start: number,
  end: number,
  condition: (idx: number) => boolean,
): number | null {
  for (let i = start; i <= end; i++) {
    if (condition(i)) return i;
  }
  return null;
}

// ───────────────────────────────────────────────────────────────────────────
// アナライザー本体
// ───────────────────────────────────────────────────────────────────────────

export const symmetryAnalyzer: Analyzer<SymmetryResult> = {
  id: 'symmetry',
  label: '左右対称性分析',

  compute({ normalizedFrames, trajectory, strokes = [] }: AnalysisInput): SymmetryResult {
    const perStroke: StrokeSymmetry[] = strokes.map((stroke: StrokeSegment) => {
      const { strokeIndex, startFrame, phases } = stroke;

      // キャッシュ済み trajectory からストローク範囲のデータを取得
      const catchPhase  = phases.find((p) => p.phase === 'catch');
      const finishPhase = phases.find((p) => p.phase === 'finish');

      // ── 角度差 ──────────────────────────────────────────────────────────
      let catchAngleDiff:  number | null = null;
      let finishAngleDiff: number | null = null;
      let sweepDiff:       number | null = null;

      if (catchPhase && finishPhase) {
        const leftAngles  = trajectory.map((t) => t.leftAngleDeg);
        const rightAngles = trajectory.map((t) => t.rightAngleDeg);

        const lCatch  = phaseAvg(leftAngles,  catchPhase.startFrame,  catchPhase.endFrame,  0);
        const rCatch  = phaseAvg(rightAngles, catchPhase.startFrame,  catchPhase.endFrame,  0);
        const lFinish = phaseAvg(leftAngles,  finishPhase.startFrame, finishPhase.endFrame, 0);
        const rFinish = phaseAvg(rightAngles, finishPhase.startFrame, finishPhase.endFrame, 0);

        // 右オールセンサーは物理的に左と反転しているため、対称なら rightAngle ≈ -leftAngle。
        // (left - right) で計算すると対称でも大きな値になる（例: +60° - (-60°) = 120°）。
        // (left + right) を使うことで対称なら ≈ 0 になり、実際の非対称量が正しく表れる。
        if (lCatch !== null && rCatch !== null) {
          catchAngleDiff = lCatch + rCatch;
        }
        if (lFinish !== null && rFinish !== null) {
          finishAngleDiff = lFinish + rFinish;
        }
        if (lCatch !== null && lFinish !== null && rCatch !== null && rFinish !== null) {
          sweepDiff = Math.abs(lCatch - lFinish) - Math.abs(rCatch - rFinish);
        }
      }

      // ── タイミング差 ────────────────────────────────────────────────────
      let catchTimingDiff:  number | null = null;
      let finishTimingDiff: number | null = null;

      if (catchPhase) {
        const leftIn = firstFrame(
          catchPhase.startFrame,
          catchPhase.endFrame,
          (i) => { const z = trajectory[i]?.leftZ;  return z !== undefined && z !== null && z <= WATER_THRESHOLD; },
        );
        const rightIn = firstFrame(
          catchPhase.startFrame,
          catchPhase.endFrame,
          (i) => { const z = trajectory[i]?.rightZ; return z !== undefined && z !== null && z <= WATER_THRESHOLD; },
        );
        if (leftIn !== null && rightIn !== null) {
          catchTimingDiff = leftIn - rightIn;
        }
      }

      if (finishPhase) {
        const leftOut = firstFrame(
          finishPhase.startFrame,
          finishPhase.endFrame,
          (i) => { const z = trajectory[i]?.leftZ;  return z !== undefined && z !== null && z > WATER_THRESHOLD; },
        );
        const rightOut = firstFrame(
          finishPhase.startFrame,
          finishPhase.endFrame,
          (i) => { const z = trajectory[i]?.rightZ; return z !== undefined && z !== null && z > WATER_THRESHOLD; },
        );
        if (leftOut !== null && rightOut !== null) {
          finishTimingDiff = leftOut - rightOut;
        }
      }

      // ── キャッチ時の艇ロール ─────────────────────────────────────────────
      let boatRollAtCatch: number | null = null;
      {
        const midIdx = catchPhase
          ? Math.round((catchPhase.startFrame + catchPhase.endFrame) / 2)
          : startFrame;
        if (midIdx >= 0 && midIdx < normalizedFrames.length) {
          const bq = normalizedFrames[midIdx].boatQ;
          if (bq.w !== null && bq.x !== null && bq.y !== null && bq.z !== null) {
            boatRollAtCatch = quaternionToRollDeg(bq.w, bq.x, bq.y, bq.z);
          }
        }
      }

      return {
        strokeIndex,
        catchAngleDiff,
        finishAngleDiff,
        sweepDiff,
        catchTimingDiff,
        finishTimingDiff,
        boatRollAtCatch,
      };
    });

    return { perStroke };
  },
};
