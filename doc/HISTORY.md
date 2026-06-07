# BOVisualizer 開発履歴 & 機能追加の歴史 (Development and Feature History)

本ドキュメントは、ローイング動作可視化システム **BOVisualizer** の開発および機能追加の履歴をGitコミットログから整理したものです。これまでに順次つぎ足されてきた機能の全体構造を把握し、今後のリファクタリングやアーキテクチャ最適化の検討用資料として活用します。

---

## 1. 現状のブランチ構成

- **`main` ブランチ**
  安定動作している機能群が統合されている基本ブランチです。ストローク自動検出ロジックや [StrokeMetricsTable.tsx](../src/components/StrokeMetricsTable.tsx) による可視化、時系列グラフ上での位相帯表示などの基本機能に加え、アーキテクチャの抜本的リファクタリング、データロードの安定化（スナップショット機構）、および各パネルの全画面拡大機能がすべて統合されています。
- **`test_newfunc` ブランチ**
  新機能開発用の検証ブランチです。直近の機能追加および検証を終え、`main` ブランチへマージされたため、現在は `main` ブランチと同期されています。

---

## 2. 時系列開発履歴 (コミット履歴に基づく整理)

### Phase 1: 初期システムの構築 (2026-05-22)
プロジェクトの初版コミット（`bc0e375`）で、以下のコアとなる同期可視化システムが導入されました。
- **3D可視化エンジン** ([Scene.tsx](../src/components/Scene.tsx))
  Three.jsを用いて艇体および左右オールのリアルタイム姿勢描画を行う。
- **GPSマッピング** ([RowingMap.tsx](../src/components/RowingMap.tsx))
  Leafletを用いて地図上に航行軌跡を描画。
- **時系列折れ線グラフ** ([TimeSeriesChart.tsx](../src/components/TimeSeriesChart.tsx))
  Rechartsを用いて、速度、加速度、角速度、SPM、SPLIT等のデータを同期プロット。
- **オール軌跡グラフ** ([OarTrajectoryChart.tsx](../src/components/OarTrajectoryChart.tsx))
  ブレードの軌跡を2D/3Dのグラフとして描画。
- **再生制御と状態管理** ([PlaybackControls.tsx](../src/components/PlaybackControls.tsx) / [playbackStore.ts](../src/store/playbackStore.ts))
  Zustandを用いたグローバルな再生シーク、再生速度、データセット選択の状態管理。

### Phase 2: データ読み込みの機能拡張 (2026-05-22)
ローカルでのデータ操作を円滑にするため、CSVの一括インポートおよび自動更新機能が追加されました。
- **ディレクトリピッカー対応** (`929a1cd`)
  `window.showDirectoryPicker` を用いて、ブラウザからローカルフォルダを直接選択し、格納されたCSV群を一括読み込み（バッチロード）する機能。
- **バックグラウンド自動リロード** (`d0cd694`)
  設定された時間間隔で選択ディレクトリを再スキャンし、新しいCSVデータがあれば自動的に再読み込み（ホットリロード）を行う機能。

### Phase 3: デプロブおよびビルドパフォーマンスの最適化 (2026-05-22 〜 2026-05-25)
GitHub Pages等へのWeb配信および読み込み速度向上のための最適化が行われました。
- **GitHub Pages デプロイ対応** (`daae555` / `7d2e752` / `3504e21`)
  Viteのベースパスを `/BOVisualizer/` に設定し、CSVファイルなどの静的アセットをベース相対パスで動的解決するよう修正。
- **コードスプリッティング (Code Splitting)** (`ee2bc7e`)
  React.lazyによるコンポーネントの遅延ロードを導入。Three.jsやLeafletなど、初期表示に不要または重量なサードパーティライブラリを個別バンドル (`vendor` chunks) に分割し、初期読み込み時間を短縮。

### Phase 4: 3Dエンジン・物理演算の調整およびUIブラッシュアップ (2026-05-22 〜 2026-06-05)
より正確な3Dモデル描画と使い勝手の向上を目指した修正が行われました。
- **オールの回転と位置オフセットのキャリブレーション** (`563dbd6` / `45190cc` / `798b6ef` / `a481ea6`)
  - 左オールの3Dモデル高さオフセットを調整し、テレメトリグラフのデータと3D上のブレード入水タイミングの視覚的同期精度を向上。
  - 左右オールのクォータニオン回転ロジックを修正し、オールのスイープ角・仰俯角計算を物理的に正確なものへ微調整。
- **ステンシルマスクによる描画最適化** (`d85726a`)
  - 3D空間において、艇体内部のコクピットに水面（Water plane）がはみ出して描画（クリッピング）されるのを防ぐため、Three.jsのステンシルバッファマスク（Stencil Masking）処理を導入。これによりボートの内部に水が入らない表現を実現。
- **UIコンポーネントのモジュール化と改善** (`4650a7b` / `2548773` / `e3ef765` / `9600bba`)
  - `MetricsBar` の角度表示において、スタイリングの自由度を高めるために静的な「ラベル」と動的な「数値」を別コンポーネントに分離。
  - 地図上に `RecenterButton` (リセンターボタン) を導入。
  - Zustandストアに初期再生設定を持たせ、初回ロード時の状態を制御できるようにした。

### Phase 5: ストローク自動検出・フェーズ分割機能の導入 (2026-06-06)
ローイング競技の核心である「1ストローク」のメカニズムを自動解析する機能が追加されました。
- **軌跡Z軸（水深）基準のストローク自動検出** ([strokeDetect.ts](../src/utils/strokeDetect.ts))
  - ブレードのZ座標が **-30cm** 以下である状態を「水中（水中セッション）」と判定し、ノイズ除去処理（約0.25秒未満の入水はチャタリングとして無視）を行った上で、1ストロークを検出。
  - 1つのストロークを **Catch（キャッチ）**, **Drive（ドライブ）**, **Finish（フィニッシュ）**, **Recovery（リカバリー）** の4位相（フェーズ）に自動分割。
  - 左右の入水・出水タイミングがずれる場合、両方が入水するまでを「Catch」、いずれかが水から出るタイミングから「Finish」とする定義を実装。
- **時系列グラフ上のフェーズ背景色分け** (`6bdbb2e`)
  - [TimeSeriesChart.tsx](../src/components/TimeSeriesChart.tsx) に、Rechartsの `ReferenceArea` を用いて、各フェーズに対応した薄い背景色（青・緑・橙・灰）を透過描画。
- **フェーズ単位のシークナビゲーション**
  - キーボードショートカット `Shift + ←` / `Shift + →` で、前後のフェーズ開始位置へフレームをスナップシークできる機能を追加。
- **ストローク毎の分析テーブル** ([StrokeMetricsTable.tsx](../src/components/StrokeMetricsTable.tsx))
  - ストローク毎の開始フレーム、終了フレーム、キャッチ角・フィニッシュ角・総スイープ角（アーク）、リズム（水中/水上比）を集計し、ダッシュボード上に一覧表示。
  - 設定ポップオーバーで、このテーブルとグラフ上のフェーズ帯表示をオン・オフ可能にするトグルスイッチを導入。

### Phase 6: バグ修正と挙動の最適化 (最新コミット: `6fd4130`)
つぎ足した機能により発生した、再生位置の不整合と地図の操作性低下を解決しました。
- **フレームインデックス同期の正常化** ([metrics.ts](../src/utils/metrics.ts))
  - CSVの 'number' 列（非ゼロ開始や飛びがある実測値）を基準にGPSポイントのインデックスを生成していたため、再生位置インデックスとズレていた問題を修正。フレーム配列の配列添字 (index) をキーに同期するようにした。
- **地図のフィット挙動の最適化** ([RowingMap.tsx](../src/components/RowingMap.tsx))
  - 毎フレーム現在地に地図を再センタリング（`ChangeView`）していたため、航行中のピンが画面中央に固定され、軌跡の上を動く感覚が失われていた。
  - 対策として、データセット読み込み時に1度だけ軌跡全体が収まるように `fitBounds` する `FitTrajectory` コンポーネントへ置き換え、現在地ピンが地図上を滑らかに移動するのを視認できる設計へ変更。
- **リセンターボタンの挙動改善** ([RowingMap.tsx](../src/components/RowingMap.tsx))
  - リセンターボタン押下時に、最大ズーム率へ強制変更されていた挙動を廃止し、現在のユーザーのズーム倍率を維持したまま、ピンがある現在位置へパン（移動）する使い勝手の良い挙動に修正。

### Phase 7: アーキテクチャの抜本的リファクタリング、スナップショット機能、およびパネル全画面拡大の導入 (2026-06-07)
つぎ足し開発によって肥大化したコードベースの最適化と、ユーザー体験を大幅に向上させる新機能の実装を行いました。

- **アーキテクチャの再構築とパフォーマンス最適化 (Step 1〜6)**
  - **計算の一元キャッシュ化 (`AnalysisRepository` の導入)**: 艇体軌跡構築やストローク検出などの重い計算が複数箇所で重複実行されていた問題を解消するため、`WeakMap` による安全なメモリキャッシュを備えたリポジトリを導入。
  - **`App.tsx` のスリム化とカスタムフック化**: 100行以上の状態管理や副作用ロジックを新設した `useAnalysis.ts` カスタムフックへ抽出し、`App.tsx` を純粋なUI描画と配線のみを担当するコンポジションルートに縮小。
  - **データロード処理の単一API化**: リモートのマニフェスト経由とローカルフォルダ選択のロード系統を `datasetLoader.ts` および `useDataset.ts` に集約・透過化。
  - **状態管理ストア（Zustand）のスライス分割**: 単一で肥大化していた `playbackStore` を `playbackSlice`, `datasetSlice`, `viewSlice` に分割。不要な再レンダリングを防止し、`strokes` をストアから外し synchronous な派生値として算出するよう変更。
  - **型安全性の強化 (`NormalizedFrame` スキーマの導入)**: 文字列キー依存の生 `RowingFrame` をパース境界に閉じ込め、型安全な `NormalizedFrame` をドメイン内で使用。計測列追加が `schema.ts` の定義変更のみでグラフに自動波及するスキーマ駆動設計へ移行。
  - **解析・パネルのレジストリ/プラグイン化**: `Analyzer` / `PanelDefinition` レジストリを新設。新しい解析アルゴリズムや表示パネルをプラグインのように登録可能に。
- **データロード中の表示安定化 (スナップショット機構)** (`8a893c9`)
  - バックグラウンドでのデータリロード（手動・自動）が発生した際、読み込み中のデータ欠落によってメトリクステーブル等の表示が一瞬消えたりカクついたりする問題を解消するため、ロード完了まで前の表示状態を維持する `metricsSnapshot` 機構を導入。
- **ダッシュボードパネルの全画面拡大・縮小機能とレスポンシブ対応** (`e997dea`)
  - 各パネルのヘッダー（タブ行）をダブルクリックすることで、そのパネルを画面全体に拡大表示する機能を実装（✕ボタン、および Esc キーで縮小可能）。
  - **高さが追従しない問題の解消**: Grid スパン指定による拡大方式をやめ、`.dashboard-area` に対する絶対配置（`position: absolute; inset: 0`）に変更することで、縦横ともに正確な全画面化を実現。これに伴い、ResizeObserver がサイズ変更を正しく検知し、Three.js、Rechartsグラフ、Leaflet地図などのレスポンシブ追従を正常化。
  - **GPS地図（Leaflet）の再描画対応**: 拡大・縮小時にコンポーネントを再マウントするよう `key` プロパティを調整し、地図表示が白紙化する不具合を解消。

---

## 3. 全体構造見直しに向けた最適化の検討事項

本章は、Phase 1〜6 で「つぎ足し」により積み上がった現行コードを棚卸しし、(A) 処理コストの削減（最適化）と (B) 新機能追加に耐える拡張性の確保、の2軸でリファクタリング方針を整理したものである。コミット履歴ではなく、現時点のソース（`src/` 配下）を実地に確認した結果に基づく。

### 3.1 現状アーキテクチャの評価（課題の棚卸し）

現状のデータと制御の流れは概ね次の通りである。

```
manifest.json ─┐
               ├─→ useDataset ──→ DatasetCsv ──┐
CSV(フォルダ)  ─┘                              │
                                               ▼
                          App.tsx（全状態の配線・オーケストレーション）
                                               │
       ┌───────────────┬───────────────┬───────┴────────┬─────────────────┐
       ▼               ▼               ▼                ▼                 ▼
   Scene          OarTrajectory   TimeSeriesChart   RowingMap      StrokeMetricsTable
   (frames)        (frames)        (frames+strokes)  (gpsPoints)    (frames+strokes+全DS)
```

ここから、以下の構造的課題が確認された。

**課題1: `App.tsx` の肥大化（God Component / 456行）**
`App.tsx` が、ストアの全状態（約40個の値とセッターを一括 destructure）、データセットのロード制御、ストローク検出、全データセット一括読み込み、タブ状態、キーボードショートカット、パネルレイアウト、インラインスタイルまでを一手に引き受けている。新機能追加のたびにこのファイルへ配線が増える構造で、変更の影響範囲が読めず、つぎ足しのコストが逓増している。

**課題2: 計算の多重実行（最大のパフォーマンス負債）**
`buildOarTrajectory(frames)` が `strokeDetect` 内部・`OarTrajectoryChart`・`StrokeMetricsTable`（現在DS＋全DSループ）で個別に再計算されている。同様に `detectStrokes()` も `App.tsx` で3箇所（現在DS／カスタムDS全件／マニフェストDS全件）から呼ばれ、`StrokeMetricsTable` 内でも軌跡が再構築される。**同一データに対する軌跡構築・ストローク検出が、1フレーム描画とは無関係に何度も走っている。** データセット数が増えるほど線形以上に重くなる。

**課題3: データロード経路の二重化**
「マニフェスト経由」と「フォルダ選択（custom）」の2系統が、`frames` 導出・`allDatasetsData` 生成・エラー/ローディング判定・全件メトリクスのすべてで `isCustom` 分岐として散在している。さらに `App.tsx` の `loadAllManifest` は、横断メトリクス表示のためだけに全CSVを逐次 `fetch` して別途メモリ展開しており、`useDataset` の単体ロードと重複している。

**課題4: データモデルの型が脆弱**
中核型 `RowingFrame = Record<string, RowingValue>` は完全に文字列キー依存で、`frame['accz']`・`frame['SPM']` のような取得が型安全でない。列名のタイプミスやCSVスキーマ変更がコンパイル時に検出されず、メトリクスや解析を1つ追加するたびに各所へ生の文字列キーが散らばる。拡張性の最大の阻害要因。

**課題5: 状態ストアの責務混在**
`playbackStore` 単一スライスに、再生制御・データセット管理・カスタムDS・UI設定（oarSide/graphMode/位相帯表示）・解析設定・ストローク結果が平坦に同居している。機能追加のたびにこの1ファイルが膨らみ、無関係なコンポーネントの再レンダリングも誘発しやすい。

**課題6: 解析ロジックと表示の密結合・拡張点の不在**
ストローク検出・メトリクス導出は `utils/` にあるが、その起動（オーケストレーション）は `App.tsx`（View層）が握っている。新しい解析（力曲線、艇速効率、左右対称性など）を足すには、また `App.tsx` に手動配線する必要があり、解析を増やすほど View が太る。プラグイン的に解析を登録する仕組みがない。

### 3.2 最適化の設計方針

**方針A: レイヤー分離（関心の分離）**
責務を4層に明確化し、依存方向を一方向（下→上）に固定する。

```
[表示層 View]      components/*  … propsで受け取った結果を描画するだけ
      ▲
[状態層 Store]     store/slices/* … 再生・選択・UI設定など「状態」のみ保持
      ▲
[ドメイン層 Domain] domain/*    … trajectory / stroke / metrics の純粋計算 + キャッシュ
      ▲
[データ層 Data]    data/*       … manifest/CSV/フォルダの読み込みを単一API化
```

`App.tsx` は各層を束ねる薄い「コンポジションルート」に縮小し、ロジックは持たせない。

**方針B: 計算結果のキャッシュ化（課題2・3への対処）**
データセット単位で派生結果（trajectory・strokes・metrics）を一度だけ計算してメモ化する「解析リポジトリ」を導入する。キーはデータセットID＋フレーム参照（または内容ハッシュ）。各コンポーネントは生 `frames` から再計算せず、リポジトリ経由で確定済みの結果を受け取る。これにより `buildOarTrajectory` / `detectStrokes` の重複実行を実質1回/DSへ削減できる。

```ts
// 例: domain/analysisRepository.ts
const cache = new Map<string, DatasetAnalysis>();
export function getAnalysis(id: string, frames: RowingFrame[]): DatasetAnalysis {
  const cached = cache.get(id);
  if (cached && cached.frames === frames) return cached;        // 参照一致で再利用
  const trajectory = buildOarTrajectory(frames);
  const strokes = detectStrokes(frames, trajectory);            // 軌跡を渡して二重計算を排除
  const metrics = deriveMetrics(frames);
  const result = { frames, trajectory, strokes, metrics };
  cache.set(id, result);
  return result;
}
```

あわせて `detectStrokes(frames)` のシグネチャを `detectStrokes(frames, trajectory?)` に変更し、構築済み軌跡を受け取れるようにする（内部再構築の回避）。重い横断計算は Web Worker への退避も将来的な選択肢とする。

**方針C: データモデルの型強化（課題4への対処）**
CSVの生 `Record` はパース境界に閉じ込め、ドメイン内部では正規化済みの型付きフレームを用いる。列定義を一元化し、メトリクスはスキーマ駆動で生成する。

```ts
// 例: domain/schema.ts — 列を一箇所で定義
export const METRIC_COLUMNS = ['speed','accx','accy','accz','gyrox','gyroy','gyroz'] as const;
export type MetricKey = typeof METRIC_COLUMNS[number];

export interface NormalizedFrame {
  index: number;
  time: number | null;
  oar: { leftZ: number | null; rightZ: number | null; /* … */ };
  metrics: Record<MetricKey, number | null>;
  gps: { lat: number; lon: number } | null;
}
```

新しい計測列の追加は `METRIC_COLUMNS` への1行追加で、グラフ系列・メトリクス導出に自動波及する設計とする。

**方針D: ストアのスライス分割（課題5への対処）**
単一ストアを関心ごとに分割し、参照する状態のみを購読させて不要な再レンダリングを抑える。

```
store/
  playbackSlice.ts   … isPlaying / fps / seekFrame / maxFrame
  datasetSlice.ts    … datasets / selectedDatasetId / customDatasets
  viewSlice.ts       … oarSide / graphMode / activeTab群 / 表示トグル
  analysisSlice.ts   … analysisMode / strokes（※派生はリポジトリ参照に移行）
```

派生値である `strokes` は本来「状態」ではなくリポジトリの導出結果なので、ストアからは外し（または導出セレクタ化し）二重管理を解消する。

**方針E: 解析パイプラインのプラグイン化（課題6・拡張性の核）**
解析を「登録可能なモジュール」として定義し、View へ手動配線せずに増やせるようにする。

```ts
// 例: domain/analyzers/index.ts
export interface Analyzer<T> {
  id: string;
  label: string;
  compute(input: AnalysisInput): T;   // frames + trajectory を受け取る
}
export const analyzers = [strokeAnalyzer, /* forceCurveAnalyzer, symmetryAnalyzer … */];
```

新解析は配列へ1要素追加するだけで登録され、リポジトリがまとめて計算・キャッシュする。表示側も同様にパネル/タブをレジストリ駆動にすれば、現状プレースホルダ化している単一タブ（`activeMapTab`/`activeSceneTab`）を、追加パネルへ自然に拡張できる。

### 3.3 リファクタリング項目（優先度付き）

| 優先 | 項目 | 対象 | 主効果 |
|---|---|---|---|
| 高 | 解析リポジトリ導入・軌跡/ストローク計算の一元キャッシュ化 | `domain/`, `App.tsx`, `StrokeMetricsTable` | 多重計算の排除（最大の負債） |
| 高 | `detectStrokes` に構築済み trajectory を注入可能化 | `strokeDetect.ts` | 二重計算の排除 |
| 高 | `App.tsx` のロジック分離（フック/コンポジションルート化） | `App.tsx` | 変更容易性・つぎ足しコスト低減 |
| 中 | データロードの単一API化（manifest/custom の統合） | `data/`, `useDataset` | `isCustom` 分岐の集約 |
| 中 | 状態ストアのスライス分割・`strokes` の導出化 | `store/` | 再レンダリング抑制・責務分離 |
| 中 | `NormalizedFrame` 型・列スキーマの一元化 | `types/`, `domain/schema` | 型安全・列追加の局所化 |
| 低 | 解析/パネルのレジストリ化 | `domain/analyzers`, View | 新機能のプラグイン追加 |
| 低 | 巨大コンポーネントの分割（`StrokeMetricsTable` 855行 等） | `components/` | 可読性・テスト容易性 |

### 3.4 拡張性を担保する設計指針（新機能追加時の原則）

今後の新機能は、原則として次の手順で追加できる状態を目標とする。

1. 新しい解析は `domain/analyzers/` に Analyzer を1つ追加して登録する（View には触れない）。
2. 新しい計測列は `schema.ts` の列定義に追加する（メトリクス・グラフへ自動波及）。
3. 新しい表示パネル/タブはレジストリへ登録する（`App.tsx` のレイアウトは変更不要）。
4. 新しい状態は該当スライスにのみ追加する（単一巨大ストアを膨らませない）。
5. 重い計算はリポジトリ経由でキャッシュさせ、コンポーネント内で生 `frames` から再計算しない。

### 3.5 段階的移行ステップ（安全なリファクタリング順序）

既存テスト（`src/test/` のユニットテスト）を回帰の安全網として活用し、外形的な挙動を変えずに内部を置き換える順で進める。

```
Step 1: [完了] domain/ レイヤー新設 + 解析リポジトリ（trajectory/stroke/metrics をキャッシュ集約）
        → 既存 utils はリポジトリ経由の薄いラッパへ移行完了。ユニットテスト（45件）およびビルド通過を確認済み。
Step 2: [完了] App.tsx から計算オーケストレーションをカスタムフックへ抽出（useAnalysis 等）
        → useAnalysis.ts カスタムフックを新設し、App.tsx を表示用のコンポジションルートへスリム化完了。
Step 3: [完了] データロードを data/ に集約し manifest/custom 分岐を統合
        → datasetLoader.ts でフェッチを単一API化し、useDataset.ts でカスタムフォルダ・マニフェストロードを透過化。
Step 4: [完了] store をスライス分割、strokes を導出値へ移行
Step 5: [完了] NormalizedFrame 型を導入し、ドメイン内部を型付きに移行
Step 6: [完了] 解析/パネルのレジストリ化（拡張ポイントの完成）
```

各ステップは独立してマージ可能な単位とし、`test_newfunc` 系ブランチで小さく検証しながら `main` へ取り込む。

#### 最適化完了および成果 (2026-06-07)

2026-06-07時点で、Step 1 から Step 6 までのすべてのリファクタリングステップが計画通りに完了し、全ユニットテスト（45件）および本番環境ビルドの動作確認をパスしたうえで `main` ブランチへマージされました。これにより、初期に発生していた多重計算のパフォーマンス負債が完全に解消され、今後の新規解析アルゴリズムや表示パネルの追加が容易なプラグイン構成が整いました。

* **Step 1: 完了 (済)**
  * `src/domain/analysisRepository.ts` の新設。`WeakMap` によるガベージコレクション対応の安全なメモリキャッシュを実現。
  * `buildOarTrajectory` ([trajectory.ts](../src/utils/trajectory.ts))、`detectStrokes` ([strokeDetect.ts](../src/utils/strokeDetect.ts))、`deriveMetrics` ([metrics.ts](../src/utils/metrics.ts)) の薄いラッパー化および内部関数名 (`...Internal`) への分離。
  * 単一/全データセット間での軌跡・ストローク・メトリクス等の重複計算の排除。
  * テストスイート（全45件）および本番ビルドの動作確認済み。
* **Step 2: 完了 (済)**
  * `src/hooks/useAnalysis.ts` の新設。データセット導出、最大フレーム数同期、Zustandの `strokes` 同期、非同期でのマニフェストファイルの一括ロード、全データセットメトリクス集計などの計算ロジックをフックに抽出。
  * `App.tsx` から100行以上の計算ロジックや副作用（`useEffect` / `useMemo`）を排除し、コンポーネントをUI描画と配線のみを担当するシンプルな構造へとリファクタリング。
  * 挙動の変更がないこと、および本番ビルドが正常に通ることを検証済み。
* **Step 3: 完了 (済)**
  * `src/data/datasetLoader.ts` の新設。マニフェストの読み込み（`fetchManifest`）、データセットCSVのフェッチ（`fetchDatasetCsv`）、全マニフェストファイルの非同期一括取得（`loadAllManifestDatasets`）を一箇所に集約。
  * `useDataset.ts` 内で Zustand ストアの `customDatasets` を直接参照・突き合わせることで、カスタムフォルダ選択による CSV とリモートの CSV の読み込み・ローディング・エラー状態をすべて同じ API で透過的に取得可能にリファクタリング。
  * `useAnalysis.ts` から custom か manifest かを判定する分岐（`isCustom` 等）をすべて排除し、シンプル化を実現。
  * 既存ユニットテストおよびビルドが正常に通ることを確認済み。
* **Step 4: 完了 (済)**
  * `src/store/slices/` ディレクトリを新設し、単一の平坦なストアを3スライスへ分割。
    * `playbackSlice.ts` … `isPlaying` / `fps` / `seekFrame` / `maxFrame`（再生制御のみ）
    * `datasetSlice.ts` … `datasets` / `selectedDatasetId` / `customDatasets` / `directoryHandle` / autoReload設定。データセット切替時に再生・View状態をリセットするクロススライス更新も担う。
    * `viewSlice.ts` … `oarSide` / `graphMode` / `initialOarSide` / `initialGraphMode` / `playOnSwitch` / `analysisMode` / `showStrokePhases` / `showStrokeMetrics`
  * `playbackStore.ts` を3スライスの合成ルートへ書き換え。既存の `usePlaybackStore` API（`usePlaybackStore.getState()` を含む）は完全互換を維持。
  * `strokes` をストアから除外し、「フレームからの導出値」として `useAnalysis.ts` 内の `useMemo` で同期的に算出するよう移行。`setStrokes` / `strokes` の二重管理を解消。
  * `App.tsx` で `strokes` の取得元をストアから `useAnalysis` の戻り値に変更。
  * 単体テスト（全45件）および本番ビルド（`✓ built in 874ms`）の正常通過を確認済み。
* **Step 5: 完了 (済)**
  * `src/domain/schema.ts` を新設。`METRIC_COLUMNS` / `MetricKey` / `NormalizedFrame` / `normalizeFrame` / `normalizeFrames` を定義。
  * `analysisRepository.ts` の `getAnalysis` 境界で `RowingFrame[] → NormalizedFrame[]` 変換を一元実施。変換済み `normalizedFrames` をキャッシュして内部関数へ受け渡す。`dummyDataset` ハックを除去。
  * `buildOarTrajectoryInternal`（trajectory.ts）・`estimateFps` + `detectStrokesInternal`（strokeDetect.ts）・`deriveMetricsInternal`（metrics.ts）の引数型を `NormalizedFrame[]` へ変更。文字列キーによる動的アクセスを廃止し、型付きフィールドで簡潔に記述。
  * `deriveMetricsInternal` の `graphSeries` を `METRIC_COLUMNS` から自動生成するスキーマ駆動方式に変更。列追加は `schema.ts` の 1 行のみで全体に波及する。
  * 公開インターフェース（`RowingFrame[]` を受け取るコンポーネント・公開ラッパー・テスト）は一切変更なし。後方互換を完全維持。
  * 単体テスト（全45件）および本番ビルド（`✓ built in 893ms`）の正常通過を確認済み。
* **Step 6: 完了 (済)**
  * `src/domain/analyzers/` を新設。`Analyzer<TResult>` / `AnalysisInput` インターフェース、`strokeAnalyzer`・`metricsAnalyzer` の組み込みアナライザー、追加アナライザー登録用 `ANALYZERS` レジストリを実装。
  * `src/domain/panels/` を新設。`PanelDefinition` インターフェース、現行5パネル（3D/軌跡/GPS/時系列/メトリクス）を宣言的に登録する `PANELS` レジストリ、`PanelId` 型を実装。
  * `analysisRepository.ts` を更新。`strokeAnalyzer.compute()` / `metricsAnalyzer.compute()` 経由で結果を構築し、`ANALYZERS` 内の追加アナライザーを自動実行して `DatasetAnalysis.extra` に格納するよう変更。`extra: Map<string, unknown>` フィールドを追加。
  * `buildTimeAxis` を修正。`time_s` が0始まりでないデータに対して先頭フレームの値を引いて正規化するよう修正（`startSec` オフセット）。
  * `CrossSliceState` を `Pick<PlaybackSlice, ...> & Pick<ViewSlice, ...>` で再定義し、`graphMode: string` の型不一致を解消。
  * 新機能追加手順: アナライザーは `ANALYZERS` への1エントリ追加、パネルは `PANELS` への1エントリ追加のみで波及する。
  * 単体テスト（全45件）および本番ビルド（`✓ built in 931ms`）の正常通過を確認済み。

### 3.6 テスト・検証方針

リファクタリングの正しさは「出力の不変性」で担保する。`detectStrokes` / `buildOarTrajectory` / `deriveMetrics` の既存ユニットテストを基準に、リポジトリ化・型変更の前後で同一サンプル（`sample_1.csv` 等）に対する結果が一致することをスナップショット的に確認する。加えて、(1) 同一データに対する軌跡/ストローク計算回数の削減、(2) データセット切替時の再レンダリング範囲の縮小、を計測して最適化効果を定量的に検証する。

