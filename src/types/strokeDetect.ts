/**
 * strokeDetect.ts の型定義
 */

export type StrokePhase = 'catch' | 'drive' | 'finish' | 'recovery';

export interface PhaseSegment {
  phase: StrokePhase;
  /** 位相の開始フレーム番号（0-indexed、frames 配列のインデックス） */
  startFrame: number;
  /** 位相の終了フレーム番号（inclusive） */
  endFrame: number;
}

export interface StrokeSegment {
  /** 0-based のストローク連番 */
  strokeIndex: number;
  /** ストローク全体の開始フレーム */
  startFrame: number;
  /** ストローク全体の終了フレーム（inclusive） */
  endFrame: number;
  /** キャッチ→ドライブ→フィニッシュ→リカバリー の 4 要素 */
  phases: PhaseSegment[];
}
