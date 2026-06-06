/**
 * panels/types.ts — パネル定義インターフェース
 *
 * 新しい表示パネルを追加する手順:
 *   1. PanelDefinition を実装したオブジェクトを作成
 *   2. panels/index.ts の PANELS 配列に登録
 *   3. App.tsx でそのパネルを描画するセクションを追加
 *
 * App.tsx のレイアウト変更は最小限（新 <section> の追加のみ）で済む。
 */

/**
 * パネルの宣言的定義。
 * 将来は `component` や `icon` フィールドも追加し、
 * App.tsx が PANELS をイテレートするだけで全パネルを描画できる形を目指す。
 */
export interface PanelDefinition {
  /** パネルの一意識別子 */
  readonly id: string;
  /** UI 上の表示名（タブラベル等に使用） */
  readonly label: string;
  /**
   * このパネルの表示に必要なアナライザー ID 一覧。
   * 指定した全アナライザーが結果を持つ場合のみパネルを有効化する。
   * 未指定の場合は常に表示可能。
   */
  readonly requiredAnalyzers?: readonly string[];
}
