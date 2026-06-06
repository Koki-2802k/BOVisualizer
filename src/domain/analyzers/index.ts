/**
 * analyzers/index.ts — アナライザーレジストリ
 *
 * 新しい解析を追加する場合は、このファイルの ANALYZERS 配列に追記するだけでよい。
 * analysisRepository が ANALYZERS を参照して DatasetAnalysis.extra へ自動格納する。
 *
 * 組み込みアナライザー（strokes / metrics）は型安全のため
 * analysisRepository から直接呼ばれる。ANALYZERS はそれ以外の「追加アナライザー」のリスト。
 */

export type { Analyzer, AnalysisInput } from './types';
export { strokeAnalyzer } from './strokeAnalyzer';
export { metricsAnalyzer } from './metricsAnalyzer';

import type { Analyzer } from './types';

/**
 * 組み込み以外の追加アナライザー登録リスト。
 *
 * ここに新しいアナライザーを追加すると、getAnalysis() が自動的に計算・キャッシュし、
 * DatasetAnalysis.extra.get(analyzer.id) で結果を参照できる。
 *
 * @example
 * ```ts
 * import { forceCurveAnalyzer } from './forceCurveAnalyzer';
 * export const ANALYZERS: Analyzer<unknown>[] = [forceCurveAnalyzer];
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ANALYZERS: Analyzer<any>[] = [
  // ← 新しいアナライザーをここに追加
];
