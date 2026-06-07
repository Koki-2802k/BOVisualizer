/**
 * analyzers/types.ts — アナライザー汎用インターフェース
 *
 * 新しい解析を追加する手順:
 *   1. このファイルの型に合わせた Analyzer<T> 実装を作成（例: domain/analyzers/myAnalyzer.ts）
 *   2. index.ts の ANALYZERS 配列に登録
 *   3. DatasetAnalysis に結果フィールドを追加し、analysisRepository で呼び出す
 *
 * View 層（App.tsx / components）には一切触れない。
 */

import type { NormalizedFrame } from '../schema';
import type { TrajectoryPoint } from '../../utils/trajectory';
import type { StrokeSegment } from '../../types/strokeDetect';

/**
 * アナライザーへの入力。
 * 軌跡は重い計算なのでリポジトリが 1 度だけ構築し、全アナライザーへ共有する。
 */
export interface AnalysisInput {
  /** 正規化済みフレーム列（NormalizedFrame への変換済み） */
  readonly normalizedFrames: NormalizedFrame[];
  /** オール軌跡（ストローク検出・位相分割に使用） */
  readonly trajectory: TrajectoryPoint[];
  /** 検出されたストローク（追加のアナライザー用） */
  readonly strokes?: StrokeSegment[];
}

/**
 * アナライザーの汎用インターフェース。
 *
 * @template TResult アナライザーが返す計算結果の型
 *
 * @example
 * ```ts
 * export const myAnalyzer: Analyzer<MyResult> = {
 *   id: 'my-analysis',
 *   label: 'マイ解析',
 *   compute({ normalizedFrames, trajectory }) {
 *     return computeSomething(normalizedFrames, trajectory);
 *   },
 * };
 * ```
 */
export interface Analyzer<TResult> {
  /** 一意識別子（DatasetAnalysis.extra のキー / パネル依存宣言に使用） */
  readonly id: string;
  /** UI 上の表示名 */
  readonly label: string;
  /**
   * 純粋な計算関数。副作用なし。同じ入力には常に同じ結果を返す。
   * リポジトリが WeakMap でキャッシュするため、重い計算でも 1 DS あたり 1 回のみ実行される。
   */
  compute(input: AnalysisInput): TResult;
}
