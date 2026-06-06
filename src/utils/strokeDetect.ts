/**
 * strokeDetect.ts
 *
 * ローイングフレーム列からストロークを自動検出し、
 * キャッチ → ドライブ → フィニッシュ → リカバリー の 4 位相に分割する純粋関数群。
 *
 * 検出アルゴリズム:
 *   1. angle_right（なければ angle_left、なければ accx）の平滑化系列を作る
 *   2. 局所最小値（キャッチ端）と局所最大値（フィニッシュ端）を交互に検出する
 *   3. 最小 → 最大 の間隔をドライブ、最大 → 次の最小 の間隔をリカバリー＋キャッチとする
 */

import type { RowingFrame } from '../types/rowing';
import type { StrokePhase, PhaseSegment, StrokeSegment } from '../types/strokeDetect';

// ─────────────────────────────────────────
// 内部ユーティリティ
// ─────────────────────────────────────────

const toNum = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
};

/** 移動平均スムージング（windowSize は奇数推奨）*/
function movingAverage(arr: number[], windowSize: number): number[] {
  const half = Math.floor(windowSize / 2);
  return arr.map((_, i) => {
    const from = Math.max(0, i - half);
    const to = Math.min(arr.length - 1, i + half);
    let sum = 0;
    for (let j = from; j <= to; j++) sum += arr[j];
    return sum / (to - from + 1);
  });
}

/**
 * フレーム列からオール角（または加速度）の数値配列を抽出する。
 * angle_right → angle_left → accx の優先順で選択する。
 */
function extractAngleSeries(frames: RowingFrame[]): { series: number[]; key: string } | null {
  const candidates: string[] = ['angle_right', 'angle_left', 'accx'];
  for (const key of candidates) {
    const nums = frames.map((f) => toNum(f[key]));
    const validCount = nums.filter((v) => v !== null).length;
    if (validCount > frames.length * 0.5) {
      // 欠損は線形補間で埋める
      const filled = interpolateMissing(nums);
      return { series: filled, key };
    }
  }
  return null;
}

/** null を線形補間で埋める */
function interpolateMissing(arr: (number | null)[]): number[] {
  const result: number[] = new Array(arr.length).fill(0);
  // 最初の有効値を探す
  let lastValidIdx = -1;
  let lastValidVal = 0;

  for (let i = 0; i < arr.length; i++) {
    if (arr[i] !== null) {
      lastValidIdx = i;
      lastValidVal = arr[i] as number;
      break;
    }
  }
  if (lastValidIdx === -1) return result;

  // 前半の null を先頭の値で埋める
  for (let i = 0; i < lastValidIdx; i++) result[i] = lastValidVal;

  for (let i = lastValidIdx; i < arr.length; i++) {
    if (arr[i] !== null) {
      result[i] = arr[i] as number;
      lastValidIdx = i;
      lastValidVal = arr[i] as number;
    } else {
      // 次の有効値を探して線形補間
      let nextIdx = i + 1;
      while (nextIdx < arr.length && arr[nextIdx] === null) nextIdx++;
      if (nextIdx < arr.length) {
        const nextVal = arr[nextIdx] as number;
        result[i] = lastValidVal + ((nextVal - lastValidVal) * (i - lastValidIdx)) / (nextIdx - lastValidIdx);
      } else {
        result[i] = lastValidVal;
      }
    }
  }
  return result;
}

/**
 * 平滑化された系列から局所極値のインデックスを検出する。
 * minDist: 隣り合う極値間の最小フレーム数（ノイズ除去）
 */
function findPeaks(series: number[], minDist: number, type: 'min' | 'max'): number[] {
  const sign = type === 'max' ? 1 : -1;
  const peaks: number[] = [];
  let lastPeakIdx = -minDist * 2;

  for (let i = 1; i < series.length - 1; i++) {
    const cur = series[i] * sign;
    const prev = series[i - 1] * sign;
    const next = series[i + 1] * sign;
    if (cur > prev && cur >= next && i - lastPeakIdx >= minDist) {
      peaks.push(i);
      lastPeakIdx = i;
    }
  }
  return peaks;
}

// ─────────────────────────────────────────
// メイン: detectStrokes
// ─────────────────────────────────────────

/**
 * フレーム列からストロークセグメント列を検出して返す。
 * データが不足している場合は空配列を返す（クラッシュしない）。
 */
export function detectStrokes(frames: RowingFrame[]): StrokeSegment[] {
  if (frames.length < 10) return [];

  // 1. 角度系列の抽出
  const extracted = extractAngleSeries(frames);
  if (!extracted) return [];
  const { series: rawSeries } = extracted;

  // 2. SPM から最小ストローク幅を推定（なければ 30フレーム ≒ 1秒@30fps を最小とする）
  let minStrokeFrames = 30;
  const spmValues = frames.map((f) => toNum(f['SPM'])).filter((v): v is number => v !== null && v > 0);
  if (spmValues.length > 0) {
    const avgSpm = spmValues.reduce((a, b) => a + b, 0) / spmValues.length;
    // fps を推定（time_s が使える場合）
    const t0 = toNum(frames[0]?.['time_s']);
    const t1 = toNum(frames[Math.min(30, frames.length - 1)]?.['time_s']);
    const estimatedFps = t0 !== null && t1 !== null && t1 > t0 ? 30 / (t1 - t0) : 30;
    // 1ストロークのフレーム数 = fps * 60 / spm
    minStrokeFrames = Math.max(10, Math.floor((estimatedFps * 60) / avgSpm / 2));
  }

  // 3. 平滑化（ウィンドウ = minStrokeFrames の半分程度）
  const smoothed = movingAverage(rawSeries, Math.max(3, Math.floor(minStrokeFrames / 4)));

  // 4. 局所最小（キャッチ相当）と局所最大（フィニッシュ相当）を検出
  const localMins = findPeaks(smoothed, minStrokeFrames, 'min');
  const localMaxs = findPeaks(smoothed, minStrokeFrames, 'max');

  if (localMins.length < 2) return [];

  // 5. ストロークを組み立てる（min → max → min → max … の順序で）
  const strokes: StrokeSegment[] = [];

  for (let i = 0; i < localMins.length - 1; i++) {
    const catchFrame = localMins[i];
    const nextCatchFrame = localMins[i + 1];

    // このストローク区間内にある局所最大を探す
    const driveMaxIdx = localMaxs.find((m) => m > catchFrame && m < nextCatchFrame);

    const strokeStart = catchFrame;
    const strokeEnd = nextCatchFrame - 1;

    let phases: PhaseSegment[];

    if (driveMaxIdx !== undefined) {
      // フィニッシュ端 = ドライブ最大値の直後（ここでは driveMaxIdx + 少し）
      // キャッチ端 = catchFrame
      // ドライブ端 = driveMaxIdx
      // フィニッシュ端 ≒ driveMaxIdx + (nextCatch - driveMaxIdx) * 0.2
      const finishEnd = Math.round(driveMaxIdx + (nextCatchFrame - driveMaxIdx) * 0.25);

      phases = [
        { phase: 'catch', startFrame: strokeStart, endFrame: catchFrame },
        { phase: 'drive', startFrame: catchFrame, endFrame: driveMaxIdx },
        { phase: 'finish', startFrame: driveMaxIdx, endFrame: finishEnd },
        { phase: 'recovery', startFrame: finishEnd, endFrame: strokeEnd },
      ];
    } else {
      // 局所最大が見つからない場合はシンプルに 2 分割
      const mid = Math.round((strokeStart + strokeEnd) / 2);
      phases = [
        { phase: 'catch', startFrame: strokeStart, endFrame: strokeStart },
        { phase: 'drive', startFrame: strokeStart, endFrame: mid },
        { phase: 'finish', startFrame: mid, endFrame: mid },
        { phase: 'recovery', startFrame: mid, endFrame: strokeEnd },
      ];
    }

    strokes.push({
      strokeIndex: i,
      startFrame: strokeStart,
      endFrame: strokeEnd,
      phases,
    });
  }

  return strokes;
}

// ─────────────────────────────────────────
// セレクタ: 現在フレームの位相を求める
// ─────────────────────────────────────────

export interface CurrentPhaseInfo {
  strokeIndex: number;
  phaseIndex: number; // 0=catch, 1=drive, 2=finish, 3=recovery
  phase: StrokePhase;
  segment: PhaseSegment;
  stroke: StrokeSegment;
}

/**
 * 現在フレーム番号から対応する位相情報を返す。
 * どのストロークにも属さない場合は null を返す。
 */
export function getCurrentPhaseInfo(
  strokes: StrokeSegment[],
  currentFrame: number,
): CurrentPhaseInfo | null {
  for (const stroke of strokes) {
    if (currentFrame < stroke.startFrame || currentFrame > stroke.endFrame) continue;
    for (let pi = 0; pi < stroke.phases.length; pi++) {
      const seg = stroke.phases[pi];
      if (currentFrame >= seg.startFrame && currentFrame <= seg.endFrame) {
        return {
          strokeIndex: stroke.strokeIndex,
          phaseIndex: pi,
          phase: seg.phase,
          segment: seg,
          stroke,
        };
      }
    }
  }
  return null;
}

/**
 * 現在の位相から N ステップ進んだ位相の先頭フレームを返す。
 * strokes が空の場合は currentFrame をそのまま返す。
 */
export function seekByPhase(
  strokes: StrokeSegment[],
  currentFrame: number,
  delta: number, // +1 = 次の位相, -1 = 前の位相
): number {
  if (strokes.length === 0) return currentFrame;

  // 全位相をフラットな配列に展開
  const allPhases: Array<{ strokeIndex: number; phaseIndex: number; seg: PhaseSegment }> = [];
  for (const stroke of strokes) {
    for (let pi = 0; pi < stroke.phases.length; pi++) {
      allPhases.push({ strokeIndex: stroke.strokeIndex, phaseIndex: pi, seg: stroke.phases[pi] });
    }
  }

  // 現在フレームが属する位相のインデックスを探す
  let currentFlatIdx = allPhases.findIndex(
    (p) => currentFrame >= p.seg.startFrame && currentFrame <= p.seg.endFrame,
  );

  // 見つからない場合は最も近い位相を選ぶ
  if (currentFlatIdx === -1) {
    let minDist = Infinity;
    allPhases.forEach((p, i) => {
      const dist = Math.min(
        Math.abs(currentFrame - p.seg.startFrame),
        Math.abs(currentFrame - p.seg.endFrame),
      );
      if (dist < minDist) {
        minDist = dist;
        currentFlatIdx = i;
      }
    });
  }

  const targetIdx = Math.max(0, Math.min(allPhases.length - 1, currentFlatIdx + delta));
  return allPhases[targetIdx].seg.startFrame;
}

export type { StrokePhase, PhaseSegment, StrokeSegment };
