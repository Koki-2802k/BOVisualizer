/**
 * strokeDetect.ts — v3 (Rowing Biomechanics based on vertical trajectory)
 *
 * ローイングの 1 ストロークと 4 位相の定義（軌跡 Z 軸基準）:
 *
 *   水面しきい値: -30cm
 *   キャッチ (Catch)    : ブレードが空中 (Z >= -30cm) から水面についた (Z < -30cm) 瞬間。
 *                        左右でタイミングが違う場合は、「先についた瞬間」から「もう片方のオールがつくまで」をキャッチとする。
 *   ドライブ (Drive)    : キャッチの終了から、フィニッシュの開始まで（水中にある状態）。
 *   フィニッシュ (Finish): ブレードが水中 (Z <= -30cm) から空中 (Z > -30cm) に出る瞬間。
 *                        左右でタイミングが違う場合は、「最初に出た瞬間」から「もう片方のオールが出るまで」をフィニッシュとする。
 *   リカバリー (Recovery): フィニッシュから次のキャッチまでの間（空中にある状態）。
 *                        ※ストローク開始 (0フレーム目) から最初のキャッチまでもリカバリーに分類される。
 *
 * 1 ストロークの区切り:
 *   水中セッション (キャッチ〜フィニッシュ) の繰り返しに基づき、
 *   前のフィニッシュの直後から、今回のフィニッシュまでを 1 ストロークとして組み立てる。
 *   - ストローク i の開始: (i === 0) ? 0 : sessions[i-1].finishEnd + 1
 *   - ストローク i の終了: (i === M-1) ? frames.length - 1 : sessions[i].finishEnd
 *   - phases構成: [recovery, catch, drive, finish, (recovery ※最後のストロークのみ)]
 */

import type { RowingFrame } from '../types/rowing';
import type { StrokePhase, PhaseSegment, StrokeSegment } from '../types/strokeDetect';
import { buildOarTrajectoryInternal, type TrajectoryPoint } from './trajectory';
import { getAnalysis } from '../domain/analysisRepository';

/**
 * フレーム列からストロークセグメント列を検出して返す。
 */
const toNum = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
};

function estimateFps(frames: RowingFrame[]): number {
  const N = Math.min(frames.length - 1, 60);
  if (N < 2) return 30;

  // time_s (秒) を優先
  const t0s = toNum(frames[0]?.['time_s']);
  const tNs = toNum(frames[N]?.['time_s']);
  if (t0s !== null && tNs !== null && tNs > t0s) {
    return N / (tNs - t0s);
  }

  // 文字列の time (ISO 日時 or ms)
  const t0 = frames[0]?.['time'];
  const tN = frames[N]?.['time'];
  if (typeof t0 === 'string' && typeof tN === 'string') {
    const ms0 = Date.parse(t0);
    const msN = Date.parse(tN);
    if (!Number.isNaN(ms0) && !Number.isNaN(msN) && msN > ms0) {
      return (N * 1000) / (msN - ms0);
    }
  }

  return 30;
}

/**
 * フレーム列からストロークセグメント列を検出して返す。
 */
export function detectStrokes(frames: RowingFrame[]): StrokeSegment[] {
  return getAnalysis(frames).strokes;
}

/**
 * 内部で軌跡データを再構築せず、指定された軌跡データを用いてストローク検出を行う内部関数。
 */
export function detectStrokesInternal(frames: RowingFrame[], trajectory?: TrajectoryPoint[]): StrokeSegment[] {
  if (frames.length < 10) return [];

  const fps = estimateFps(frames);

  // 軌跡データを構築して Z 軸座標（水面クロス -30cm）を基にしたタイミングをスキャンする
  const traj = trajectory || buildOarTrajectoryInternal(frames);
  const N = traj.length;

  const isLeftIn = (tIdx: number) => {
    const z = traj[tIdx]?.leftZ;
    return z !== undefined && z !== null && z <= -30;
  };
  const isRightIn = (tIdx: number) => {
    const z = traj[tIdx]?.rightZ;
    return z !== undefined && z !== null && z <= -30;
  };
  const isInWater = (tIdx: number) => isLeftIn(tIdx) || isRightIn(tIdx);
  const isBothIn = (tIdx: number) => isLeftIn(tIdx) && isRightIn(tIdx);

  interface WaterSession {
    catchStart: number;
    catchEnd: number;
    finishStart: number;
    finishEnd: number;
  }

  const sessions: WaterSession[] = [];
  let tScan = 0;

  while (tScan < N) {
    if (!isInWater(tScan)) {
      tScan++;
      continue;
    }

    const catchStart = tScan;

    // 左右両方が水に入る瞬間を探す
    let catchEnd = catchStart;
    let searchT = catchStart;
    let foundBoth = false;

    while (searchT < N && isInWater(searchT)) {
      if (isBothIn(searchT)) {
        catchEnd = searchT;
        foundBoth = true;
        break;
      }
      searchT++;
    }

    if (!foundBoth) {
      catchEnd = catchStart;
    }

    // フィニッシュの開始（いずれかが水から出る瞬間）を探す
    let finishStart = catchEnd + 1;
    if (foundBoth) {
      let searchFinish = catchEnd;
      while (searchFinish < N && isInWater(searchFinish)) {
        if (!isBothIn(searchFinish)) {
          finishStart = searchFinish;
          break;
        }
        searchFinish++;
      }
      if (finishStart >= N || !isInWater(finishStart)) {
        let searchEndW = catchEnd;
        while (searchEndW < N && isInWater(searchEndW)) searchEndW++;
        finishStart = Math.max(catchEnd + 1, searchEndW - 1);
      }
    } else {
      let searchEndW = catchStart;
      while (searchEndW < N && isInWater(searchEndW)) searchEndW++;
      finishStart = Math.max(catchStart + 1, searchEndW - 1);
    }

    // 水から完全に脱出する瞬間を探す
    let finishEnd = finishStart;
    while (finishEnd < N && isInWater(finishEnd)) {
      finishEnd++;
    }
    finishEnd = Math.max(finishStart, finishEnd - 1);

    // チャタリング・ノイズ対策: あまりにも短い水中セッション（約0.25秒未満）はノイズとして除外
    const minSessionLen = Math.max(8, Math.round(fps * 0.25));
    if (finishEnd - catchStart + 1 < minSessionLen) {
      tScan = finishEnd + 1;
      continue;
    }

    sessions.push({
      catchStart,
      catchEnd,
      finishStart,
      finishEnd,
    });

    tScan = finishEnd + 1;
  }

  // 最終的なストロークと 4 位相の組み立て
  const strokes: StrokeSegment[] = [];
  if (sessions.length === 0) return [];

  for (let i = 0; i < sessions.length; i++) {
    const sess = sessions[i];

    // ストローク範囲の決定
    const strokeStart = (i === 0) ? 0 : sessions[i - 1].finishEnd + 1;
    const strokeEnd = (i === sessions.length - 1) ? N - 1 : sessions[i].finishEnd;

    const phases: PhaseSegment[] = [];

    // 1. recovery (開始前のリカバリー区間)
    if (strokeStart < sess.catchStart) {
      phases.push({
        phase: 'recovery',
        startFrame: strokeStart,
        endFrame: sess.catchStart - 1,
      });
    }

    // 2. catch
    const adjCatchEnd = Math.min(sess.catchEnd, sess.finishStart - 1);
    phases.push({
      phase: 'catch',
      startFrame: sess.catchStart,
      endFrame: adjCatchEnd,
    });

    // 3. drive
    const driveStart = adjCatchEnd + 1;
    const adjFinishStart = Math.max(sess.finishStart, driveStart);
    if (driveStart < adjFinishStart) {
      phases.push({
        phase: 'drive',
        startFrame: driveStart,
        endFrame: adjFinishStart - 1,
      });
    }

    // 4. finish
    const adjFinishEnd = Math.min(Math.max(sess.finishEnd, adjFinishStart), strokeEnd);
    phases.push({
      phase: 'finish',
      startFrame: adjFinishStart,
      endFrame: adjFinishEnd,
    });

    // 5. recovery (終了後のリカバリー区間。最後のストロークの末尾のみ適用される)
    if (adjFinishEnd < strokeEnd) {
      phases.push({
        phase: 'recovery',
        startFrame: adjFinishEnd + 1,
        endFrame: strokeEnd,
      });
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
 *
 * @param delta  +1 = 次の位相へ, -1 = 前の位相へ
 */
export function seekByPhase(
  strokes: StrokeSegment[],
  currentFrame: number,
  delta: number,
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
    allPhases.forEach((p, idx) => {
      const dist = Math.min(
        Math.abs(currentFrame - p.seg.startFrame),
        Math.abs(currentFrame - p.seg.endFrame),
      );
      if (dist < minDist) {
        minDist = dist;
        currentFlatIdx = idx;
      }
    });
  }

  const targetIdx = Math.max(0, Math.min(allPhases.length - 1, currentFlatIdx + delta));
  return allPhases[targetIdx].seg.startFrame;
}

export type { StrokePhase, PhaseSegment, StrokeSegment };
