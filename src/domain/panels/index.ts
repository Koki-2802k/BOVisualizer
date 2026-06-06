/**
 * panels/index.ts — パネルレジストリ
 *
 * 現行の 5 パネルを宣言的に登録する。
 * App.tsx のレイアウトはまだ直接記述だが、将来は PANELS をイテレートする形に移行できる。
 *
 * 新しいパネルを追加する場合はここに 1 エントリ追加する。
 */

export type { PanelDefinition } from './types';
import type { PanelDefinition } from './types';

export const PANELS = [
  {
    id: 'scene',
    label: '3Dグラフ',
  },
  {
    id: 'trajectory',
    label: 'オール軌跡',
  },
  {
    id: 'map',
    label: 'GPS地図',
    requiredAnalyzers: ['metrics'],  // GPS点はmetricsアナライザーが生成
  },
  {
    id: 'timeseries',
    label: '時系列グラフ',
  },
  {
    id: 'stroke-metrics',
    label: 'メトリクステーブル',
    requiredAnalyzers: ['strokes'],  // ストローク検出結果が必要
  },
] as const satisfies readonly PanelDefinition[];

export type PanelId = typeof PANELS[number]['id'];
