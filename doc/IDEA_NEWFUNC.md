# BOVisualizer 新機能アイデア集 (IDEA_NEWFUNC)

ローイング競技用 漕艇動作可視化システムへの追加機能案。
現行システム（React + Three.js による 3D 可視化 / GPS マップ / 時系列グラフ / オール軌跡）の延長線上で、**「見る」から「分析・コーチング・比較」へ** 価値を拡張することを狙う。

> 補足: 前身となった Python システムの学会記事（`IEEJ-BTC205TC081002`）はパスワード保護されており本作業では本文を読み取れなかった。記載のうち PDF 由来であるべき項目（特に「11. Python 解析エンジン由来メトリクスの移植」）は、ロック解除版を頂ければ内容を突き合わせて精緻化する。

---

## 現状機能の整理（前提）

| カテゴリ | 既存機能 |
| :--- | :--- |
| 3D 可視化 | IMU クォータニオンによる艇・左右オールのリアルタイム描画 |
| 軌跡 | オールブレードの 2D/3D 軌跡チャート |
| 位置 | GPS トラックマップ（WGS84→ローカル XY 変換） |
| 時系列 | 速度・加速度・角速度・SPM・SPLIT の同期プロット |
| 操作 | シーク／再生速度／データセット切替／CSV ドラッグ&ドロップ |

現状は **「1 セッションを再生・観察する」** ことに最適化されている。
以下では「定量分析」「比較」「リアルタイム」「共有」の 4 軸で不足を埋める機能を提案する。

---

## 優先度サマリ

| # | 機能 | 価値 | 実装難度 | 優先度 | 進捗 |
| :-- | :--- | :--- | :--- | :--- | :--- |
| 1 | ストローク自動分割・位相検出 | ★★★ | 中 | **最優先（基盤）** | ✅ **実装完了** |
| 2 | キャッチ／フィニッシュ角・ストローク長の自動算出 | ★★★ | 中 | 高 | ✅ **実装完了** |
| 3 | ストローク重ね合わせ（ゴースト比較） | ★★★ | 中 | 高 | 🔲 未実装 |
| 4 | 左右対称性（バランス）分析 | ★★★ | 低〜中 | 高 | 🔲 未実装 |
| 5 | 艇速の周期変動（チェック／ラン）解析 | ★★ | 中 | 中 | 🔲 未実装 |
| 6 | セッション間／クルー間 比較ビュー | ★★ | 中 | 中 | 🔲 未実装 |
| 7 | GPS トラックのメトリクス・ヒートマップ | ★★ | 低 | 中 | 🔲 未実装 |
| 8 | ストローク・メトリクスのレポート出力 | ★★ | 低 | 中 | 🔲 未実装 |
| 9 | ビデオ同期オーバーレイ | ★★★ | 高 | 中 | 🔲 未実装 |
| 10 | リアルタイム・ストリーミング入力 | ★★★ | 高 | 将来 | 🔲 未実装 |
| 11 | Python 解析エンジン由来メトリクスの移植 | ★★ | 中 | 要 PDF 確認 | 🔲 未実装 |
| 12 | コーチ用アノテーション／タグ付け | ★ | 低 | 低 | 🔲 未実装 |

---

## 1. ストローク自動分割・位相検出 ★最優先（基盤機能） ✅ 実装完了

**概要**: オール角（クォータニオン由来の水平面角）またはジャイロ／加速度の周期から、1 ストロークを自動検出し、**キャッチ → ドライブ → フィニッシュ → リカバリー** の 4 位相に分割する。

**価値**: 以降のほぼ全機能（2〜9）の前提となる土台。タイムラインに「ストローク番号」と「位相」を付与でき、シークバーを位相／ストローク単位でスナップ移動できる。

### 実装済み内容

- **軌跡Z軸（水深）基準のストローク自動検出**: [strokeDetect.ts](file:///home/koki/BOVisualizer/src/utils/strokeDetect.ts) / [domain/analyzers/](file:///home/koki/BOVisualizer/src/domain/analyzers/) にて、ブレードのZ座標が -30cm 以下を「水中」と判定。チャタリング除去処理後、4位相に分割。
- **時系列グラフの位相背景色分け**: [TimeSeriesChart.tsx](file:///home/koki/BOVisualizer/src/components/TimeSeriesChart.tsx) に Recharts `ReferenceArea` で薄い4色（青・緑・橙・灰）を実装済み。
- **位相単位のシークナビゲーション**: `Shift + ←` / `Shift + →` で前後の位相開始位置にスナップ移動。[PlaybackControls.tsx](file:///home/koki/BOVisualizer/src/components/PlaybackControls.tsx) に実装済み。
- **ストローク・メトリクス表**: [StrokeMetricsTable.tsx](file:///home/koki/BOVisualizer/src/components/StrokeMetricsTable.tsx) にストローク毎の開始/終了フレーム、各位相フレーム範囲を表示。設定ポップオーバーでオン/オフ可能。

### UI / 表示方針（参考）

- 色割り当て（薄め・互いに区別可能）:
  - キャッチ: 薄い青 `rgba(59,130,246,0.12)`
  - ドライブ: 薄い緑 `rgba(34,197,94,0.12)`
  - フィニッシュ: 薄い橙 `rgba(249,115,22,0.12)`
  - リカバリー: 薄い灰 `rgba(148,163,184,0.10)`
- 新規ウィンドウは追加せず、既存コンポーネントに重ねて表現。「解析モード」トグルでオン/オフ（→ 末尾「全機能共通の UI 方針」参照）。

---

## 2. キャッチ／フィニッシュ角・ストローク長の自動算出 ★高 ✅ 実装完了

**概要**: 各ストロークについてキャッチ角・フィニッシュ角・総スイープ角（アーク）・ドライブ／リカバリー比（リズム）を算出し、ストローク単位のメトリクス表として提示する。

**価値**: ローイングで最重要の技術指標。「キャッチが浅い」「フィニッシュが抜けている」を **数値とトレンド** で可視化でき、感覚に頼らないコーチングが可能になる。

### 実装済み内容

- **ストローク毎のキャッチ角・フィニッシュ角・総スイープ角（アーク）・リズム（水中/水上比）**: [StrokeMetricsTable.tsx](file:///home/koki/BOVisualizer/src/components/StrokeMetricsTable.tsx) / [metrics.ts](file:///home/koki/BOVisualizer/src/utils/metrics.ts) にて、機能1で検出したストロークセグメントを入力に、左右オールの水平角の最小・最大からキャッチ角・フィニッシュ角を算出。
- **左右別メトリクス**: 左右オール各々のキャッチ角・フィニッシュ角・スイープ角を個別に集計し、`StrokeMetricsTable` に一覧表示。
- **ダッシュボード統合**: `MetricsBar` 上にも現在フレームのオール角度をリアルタイム表示。設定ポップオーバーで表示テーブルのオン/オフ可能。

---

## 3. ストローク重ね合わせ（ゴースト比較） ★高

**概要**: 複数ストローク（または別セッションのお手本ストローク）のオール軌跡・艇姿勢を **重ね描き** し、位相を時間正規化して整合性・再現性を可視化する。3D シーンには半透明の「ゴースト艇／ゴーストオール」を重畳。

**価値**: ストローク間のばらつき（一貫性）が一目で分かる。理想フォームとの差分提示はコーチング価値が非常に高い。

**実装方針**:
- `OarTrajectoryChart` に複数系列オーバーレイ＋位相時間正規化（0–100%）オプション。
- `Scene` に `GhostOar` / `GhostBoat`（透明マテリアル）を追加し、選択ストロークを重畳描画。

---

## 4. 左右対称性（バランス）分析 ★高

**概要**: 左右オールの角度・タイミング（キャッチ/フィニッシュの時間差）・軌跡を対比し、**ポート／スターボードの非対称**やキャッチのズレを定量化する。艇のロール（左右傾き）との相関も表示。

**価値**: 艇のバランス崩れ・片側依存の即時検出。スイープ艇・スカルどちらでも有効。

**実装方針**:
- 左右メトリクス（機能 2）の差分系列を計算し、`TimeSeriesChart` に「左右差」モードを追加。
- 艇ロール（`wb,xb,yb,zb` 由来）と左右タイミング差の散布図／相関を表示。

---

## 5. 艇速の周期変動（チェック／ラン）解析 ★中

**概要**: 1 ストローク内の艇速プロファイルを抽出し、キャッチでの減速（チェック）とリカバリー中の伸び（ラン）、速度変動率を算出する。

**価値**: 「艇を止めない漕ぎ」の効率指標。平均速度では見えない **ストローク内ロス** を可視化し、技術改善に直結。

**実装方針**:
- 機能 1 の位相境界で速度（または前後加速度 `accx`）を区切り、位相内平均・変動係数を算出。
- ストローク内速度プロファイルを重ね描き（機能 3 と共通基盤）。

---

## 6. セッション間／クルー間 比較ビュー ★中

**概要**: 2 つ以上のデータセットを同時ロードし、3D・グラフ・メトリクスを **左右並置（または同一軸オーバーレイ）** で同期再生・比較する。

**価値**: 練習前後、選手間、レース間の比較。成長やクルー編成検討の意思決定を支援。

**実装方針**:
- ストアをマルチデータセット対応に拡張（現行は単一前提）。同期クロックで複数 `AnimationClock` を駆動。
- 比較レイアウト（split / overlay）を切替えるトグル UI。

---

## 7. GPS トラックのメトリクス・ヒートマップ ★中

**概要**: GPS 航跡を速度・SPM・ストローク効率などで **色分け（カラーマッピング）** する。コース上のどこで速い／崩れたかが地理的に分かる。

**価値**: 低工数で見栄え・実用性が高い。インターバルやコース取りの振り返りに有効。

**実装方針**:
- `RowingMap` のポリラインをセグメント分割し、値→色のグラデーション適用。凡例カラーバー追加。
- 区間（ラップ）選択でその区間のメトリクスを集計表示。

---

## 8. ストローク・メトリクスのレポート出力 ★中

**概要**: ストローク単位メトリクス表・主要グラフ・サマリを **CSV / PDF** に書き出し、セッションの記録・共有を可能にする。

**価値**: アプリ外（コーチ・選手間）での共有とアーカイブ。練習日誌との連携。

**実装方針**:
- メトリクス CSV エクスポート（PapaParse の逆変換）。
- グラフ／3D ビューのスナップショット（canvas → PNG）を含む簡易 PDF 生成。

---

## 9. ビデオ同期オーバーレイ ★中（高インパクト）

**概要**: 外部撮影動画をアップロードし、センサー再生タイムラインと **時刻同期** して並置／重畳表示する。シークが映像とセンサーで連動。

**価値**: 「映像で見える動き」と「センサーの数値」を結びつけられ、説得力のあるフィードバックになる。

**実装方針**:
- `<video>` 要素を再生クロックに従属させ、オフセット調整 UI（クラップ／特徴点で同期）を提供。
- レイアウトに動画パネルを追加。

---

## 10. リアルタイム・ストリーミング入力 ★将来

**概要**: CSV 事後読み込みに加え、Web Bluetooth / WebSocket でセンサーから **ライブ受信** し、オンウォーターでリアルタイム表示する。

**価値**: 乗艇中の即時フィードバック。コーチボートやコックスでの活用。

**実装方針**:
- データ供給を抽象化（`DataSource` インターフェース：file / stream）。リングバッファでストリーミングフレームを保持。
- 接続管理・再接続・欠損補間。難度は高いがインパクト大。

---

## 11. Python 解析エンジン由来メトリクスの移植 ★要 PDF 確認

**概要**: 前身の Python システム（学会記事の対象）で実装済みの解析・補正アルゴリズムを Web 側へ移植・統合する。

**価値**: 既に検証済みの計算ロジックを再利用でき、研究との一貫性を確保できる。

**実装方針**:
- 記事に記載の手法（クォータニオン補正、ストローク検出、メトリクス定義、座標系定義など）を確認し、本書 1〜5 と対応付ける。
- **次アクション**: パスワード解除版 PDF（または本文テキスト）を共有いただければ、本項を具体的な移植チェックリストに展開する。

---

## 12. コーチ用アノテーション／タグ付け ★低

**概要**: タイムライン上の任意フレーム／ストロークにコメント・タグ（例「キャッチ早い」）を付与し、保存・ジャンプできる。

**価値**: レビュー時の指摘箇所を記録・共有。レポート（機能 8）にも反映可能。

**実装方針**:
- アノテーションをストアに保持（フレーム/ストローク ID 紐付け）。シークバー上にマーカー表示。
- localStorage または CSV 同梱でのエクスポート/インポート。

---

## 現在のコード構成と新規機能の拡張方針 (Code Structure & Extension Policy)

> ⚠️ **重要**: 新規機能を実装する際は、つぎ足し開発による肥大化やパフォーマンス低下を防ぐため、**最適化済みの4層アーキテクチャ・レジストリ拡張ポイント・キャッシュ設計に必ず従ってください**。以下に定義する拡張ポイントを使用せず、View 層やストア層に直接ロジックを追加することは禁止です。

### 最適化ステータス（2026-06-06 完了）

全6ステップの最適化リファクタリングが完了しています。

| ステップ | 内容 | 状態 |
| :-- | :--- | :--- |
| Step 1 | `domain/` レイヤー新設・解析リポジトリ（trajectory/stroke/metrics をキャッシュ集約） | ✅ 完了 |
| Step 2 | `App.tsx` から計算を `useAnalysis` カスタムフックへ抽出 | ✅ 完了 |
| Step 3 | データロードを `data/datasetLoader.ts` に集約・manifest/custom 分岐を統合 | ✅ 完了 |
| Step 4 | ストアをスライス分割（playback/dataset/view）・`strokes` を導出値へ移行 | ✅ 完了 |
| Step 5 | `NormalizedFrame` 型・列スキーマ（`METRIC_COLUMNS`）の一元化 | ✅ 完了 |
| Step 6 | 解析アナライザー・パネルのレジストリ化（拡張ポイントの完成） | ✅ 完了 |

### 1. レイヤー構造の定義

```
[表示層 View]       components/*   … props で受け取った結果を描画するだけ
      ▲
[状態層 Store]      store/slices/* … 再生・選択・UI設定など「状態」のみ保持
      ▲
[ドメイン層 Domain] domain/*       … trajectory/stroke/metrics の純粋計算 + レジストリ＋キャッシュ
      ▲
[データ層 Data]     data/*         … manifest/CSV/フォルダの読み込みを単一API化
```

* **データ層 (Data Layer)**: [datasetLoader.ts](file:///home/koki/BOVisualizer/src/data/datasetLoader.ts) / [useDataset.ts](file:///home/koki/BOVisualizer/src/hooks/useDataset.ts)
  * CSV やマニフェストファイル等のフェッチおよびパース処理を一元管理。
  * リモートデータ（サーバー）とローカルデータ（ディレクトリピッカー）のローディング・エラー状態を透過的に取得できる単一 API に集約済み。
* **状態層 (Store Layer)**: [playbackStore.ts](file:///home/koki/BOVisualizer/src/store/playbackStore.ts)（3スライス合成）
  * `playbackSlice.ts` … `isPlaying` / `fps` / `seekFrame` / `maxFrame`（再生制御のみ）
  * `datasetSlice.ts` … `datasets` / `selectedDatasetId` / `customDatasets` / `directoryHandle`
  * `viewSlice.ts` … `oarSide` / `graphMode` / `analysisMode` / `showStrokePhases` / `showStrokeMetrics` 等
  * 重い算出値（軌跡・ストローク情報）はストアに保持させず、ドメイン・キャッシュ層へ委譲。
* **ドメイン・キャッシュ層 (Domain/Cache Layer)**: [analysisRepository.ts](file:///home/koki/BOVisualizer/src/domain/analysisRepository.ts) / [useAnalysis.ts](file:///home/koki/BOVisualizer/src/hooks/useAnalysis.ts)
  * 生フレーム配列を走査する重い計算（オールの3D軌跡・ストローク自動検出・時系列メトリクス加工など）を一元的に受け持ち、`Map` キャッシュで多重実行を防止。
  * **アナライザーレジストリ** ([domain/analyzers/](file:///home/koki/BOVisualizer/src/domain/analyzers/)): 新しい解析は `ANALYZERS` 配列へ `Analyzer<T>` を1エントリ追加するだけで自動的に計算・キャッシュされる。
  * **パネルレジストリ** ([domain/panels/](file:///home/koki/BOVisualizer/src/domain/panels/)): 新しい表示パネルは `PANELS` 配列へ `PanelDefinition` を1エントリ追加するだけでレイアウトに組み込まれる。
  * 型付きスキーマ ([domain/schema.ts](file:///home/koki/BOVisualizer/src/domain/schema.ts)): `NormalizedFrame` / `METRIC_COLUMNS` / `MetricKey` を定義。新しい計測列は `METRIC_COLUMNS` の 1 行追加でグラフ・メトリクス導出に自動波及。
* **表示層 (View Layer)**: 各コンポーネント ([App.tsx](file:///home/koki/BOVisualizer/src/App.tsx), [Scene.tsx](file:///home/koki/BOVisualizer/src/components/Scene.tsx), [RowingMap.tsx](file:///home/koki/BOVisualizer/src/components/RowingMap.tsx), [TimeSeriesChart.tsx](file:///home/koki/BOVisualizer/src/components/TimeSeriesChart.tsx), [OarTrajectoryChart.tsx](file:///home/koki/BOVisualizer/src/components/OarTrajectoryChart.tsx), [StrokeMetricsTable.tsx](file:///home/koki/BOVisualizer/src/components/StrokeMetricsTable.tsx))
  * レンダリングに特化。表示に必要なデータは `useAnalysis` フックや props 経由で、計算済み（キャッシュ済み）の状態として受け取る。コンポーネント内で生 `frames` から再計算しない。

### 2. 拡張ポイントを用いた新規機能の実装手順

> **新規機能（機能 3〜12）の実装時には、以下の拡張ポイントを必ず使用してください。** View 層やストア層での生データループ処理・直接追記は禁止です。

#### 拡張ポイント① — 新しい解析アルゴリズムの追加

[domain/analyzers/](file:///home/koki/BOVisualizer/src/domain/analyzers/) に `Analyzer<T>` を実装し、`ANALYZERS` レジストリへ登録する。

```ts
// domain/analyzers/symmetryAnalyzer.ts の例（機能4: 左右対称性分析）
import type { Analyzer, AnalysisInput } from './index';

export interface SymmetryResult { /* ... */ }

export const symmetryAnalyzer: Analyzer<SymmetryResult> = {
  id: 'symmetry',
  label: '左右対称性分析',
  compute({ normalizedFrames, trajectory, strokes }: AnalysisInput): SymmetryResult {
    // キャッシュ済みの trajectory / strokes を注入して再利用
    // 自前で buildOarTrajectory や detectStrokes を呼ばない
    return { /* ... */ };
  },
};

// domain/analyzers/index.ts の ANALYZERS 配列に追加するだけで自動登録
export const ANALYZERS = [strokeAnalyzer, metricsAnalyzer, symmetryAnalyzer /* ← 追加 */];
```

結果は `analysis.extra.get('symmetry')` として各コンポーネントから型付きで取得可能。

#### 拡張ポイント② — 新しい表示パネルの追加

[domain/panels/](file:///home/koki/BOVisualizer/src/domain/panels/) に `PanelDefinition` を追加し、`PANELS` レジストリへ登録する。

```ts
// domain/panels/index.ts の PANELS 配列に追加するだけで組み込まれる
export const PANELS: PanelDefinition[] = [
  { id: 'scene',     label: '3D',         component: () => import('../components/Scene') },
  { id: 'trajectory',label: '軌跡',        component: () => import('../components/OarTrajectoryChart') },
  // ... 既存パネル
  { id: 'symmetry',  label: '左右対称性',  component: () => import('../components/SymmetryChart') }, // ← 追加例
];
```

#### 拡張ポイント③ — 新しい計測列（グラフ系列）の追加

[domain/schema.ts](file:///home/koki/BOVisualizer/src/domain/schema.ts) の `METRIC_COLUMNS` に列名を追加するだけで、時系列グラフ・メトリクス導出の両方に自動波及する。

```ts
// domain/schema.ts
export const METRIC_COLUMNS = [
  'speed','accx','accy','accz','gyrox','gyroy','gyroz',
  'force_left', // ← 新しい計測列を1行追加するだけ
] as const;
```

#### 拡張ポイント④ — 新しい状態の追加

対応するスライスファイルのみを編集し、単一の `playbackStore.ts` を直接拡張しない。

- **再生制御に関する状態**: `store/slices/playbackSlice.ts`
- **データセット管理に関する状態**: `store/slices/datasetSlice.ts`
- **表示・UI設定に関する状態**: `store/slices/viewSlice.ts`

#### 拡張ポイント⑤ — キャッシュ済み算出値の再利用（注入型設計）

新機能でオールの軌跡・ストローク分割位置が必要な場合は、`useAnalysis` フックが返す `analysis` オブジェクトから取得し、自前で計算しない。

```ts
// コンポーネント内での利用例
const { analysis } = useAnalysis();
const trajectory = analysis?.trajectory;   // キャッシュ済み軌跡
const strokes    = analysis?.strokes;      // キャッシュ済みストローク
const symmetry   = analysis?.extra.get('symmetry') as SymmetryResult | undefined;
```

---

## 全機能共通の UI 方針（重要・全機能に適用）

現状のレイアウト（3D シーン / オール軌跡 / GPS マップ / 時系列グラフの並置）は分かりやすく、**この基本レイアウトは維持する**。以下を全機能共通の原則とする。

- **新しいウィンドウ／パネルを安易に増やさない**。追加情報は、まず既存コンポーネント上への**重ね描き・色分け・モード切替**で表現できないかを優先検討する（例: 機能 1 の位相帯、機能 7 の GPS 色分け、機能 3 のゴースト重畳）。
- どうしても情報量が増える機能は、**「解析モード」トグル**で表示を切り替える。
  - 通常モード: 現行のシンプルな再生・観察ビュー。
  - 解析モード: 位相帯・ストロークメトリクス表・左右差・ゴースト等の分析要素を、既存パネル内に追加表示／差し替え。
  - 実装は Zustand に `analysisMode: boolean` を持たせ、各コンポーネントが参照して表示要素を出し分ける。レイアウトの枠（パネル配置）は変えない。
- やむを得ず領域が足りない場合のみ、既存パネルの**タブ切替**（同一枠内で内容を切替）を用い、ウィンドウ追加は最終手段とする。

## 推奨ロードマップ

1. **基盤フェーズ**: 機能 1（ストローク分割）→ 2（角度メトリクス）。以降の全機能の土台。
2. **分析フェーズ**: 機能 4（左右対称性）→ 3（ゴースト比較）→ 5（速度変動）。
3. **共有・比較フェーズ**: 機能 7（ヒートマップ）→ 8（レポート）→ 6（セッション比較）。
4. **発展フェーズ**: 機能 9（ビデオ同期）→ 11（Python 移植）→ 10（リアルタイム）。

# ローイング競技（ボート競技）の1ストローク

ローイング競技（ボート競技）の一連の動作（1ストローク）は，大きく分けて「ドライブ（漕ぐ局面）」と「リカバリー（次の準備をする局面）」の2つのフェーズに分かれる．そして，その2つのフェーズの切り替え点となる瞬間が「キャッチ」と「フィニッシュ」である．

それぞれの定義と役割を，動作の流れに沿って解説する．

## 1. キャッチ (Catch)
* **定義**: オール（ブレード）を水に入れる瞬間．
* **役割**: ドライブ（加速）を始めるためのスタート地点である．
* **状態**: 体を前方に最も折りたたんだ状態（フォワード）から，シートの動きが止まる直前にブレードを水に落とし込み，水への抵抗（キャッチ）を作る．

## 2. ドライブ (Drive)
* **定義**: ブレードが水に入っている，艇を加速させる（漕いでいる）局面．
* **役割**: 脚・体幹・腕の筋力を使い，艇に推進力を与える．
* **状態**: キャッチの直後，まず「脚の力（レッグドライブ）」でシートを後方に押し出し，続いて「体幹の後傾（スウィング）」，最後に「腕での引き込み」へと連動させてハンドルを強く引く．

## 3. フィニッシュ (Finish / Release)
* **定義**: オール（ブレード）を水から抜く瞬間．
* **役割**: ドライブで得た推進力をロスすることなく，スムーズに次のリカバリーへ移行するための切り替え点である．
* **状態**: ハンドルをみぞおちの高さまで引ききった局面で，ハンドルをわずかに押し下げてブレードを水面から抜き，同時に手首を返してブレードを水平（フェザー）にする．

## 4. リカバリー (Recovery)
* **定義**: ブレードが水から出ている，次のキャッチに向けて体を前に戻す局面．
* **役割**: 漕ぎ手が体を休めつつ，ドライブで得た艇の慣性（スピード）を殺さないようにバランスを維持する．
* **状態**: フィニッシュ後，まず「腕」を前に伸ばし，次に「上半身」を前に傾け，最後に「シート」を前方にスライドさせて，次のキャッチの姿勢を作る．

## まとめ（1ストロークの流れ）
ローイングは，以下のサイクルを無限に繰り返す．

```
【 キャッチ 】 ➔ 水に入る
　　↓
【 ドライブ 】 ➔ 水を押し，艇を加速させる（ブレードは水中）
　　↓
【 フィニッシュ 】 ➔ 水から抜ける
　　↓
【 リカバリー 】 ➔ 体を前に戻す（ブレードは水上）
　　↓
（次のキャッチへ）
```

---
© 2026 BOVisualizer Development Team
