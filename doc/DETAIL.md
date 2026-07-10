# BOVisualizer 詳細設計・引継ぎ資料

> **対象読者**: 本システムをこれから開発・保守・拡張する開発者  
> **作成日**: 2026-06-08  
> **関連資料**: [HISTORY.md](./HISTORY.md) / [IDEA_NEWFUNC.md](./IDEA_NEWFUNC.md) / [README.md](../README.md)

---

## 目次
o
1. [システム概要](#1-システム概要)
2. [技術スタック](#2-技術スタック)
3. [ディレクトリ構造と役割](#3-ディレクトリ構造と役割)
4. [4層アーキテクチャの詳細](#4-4層アーキテクチャの詳細)
5. [データモデルと型定義](#5-データモデルと型定義)
6. [CSVデータフォーマット仕様](#6-csvデータフォーマット仕様)
7. [各機能の実装詳細](#7-各機能の実装詳細)
8. [状態管理（Zustand）の詳細](#8-状態管理zustandの詳細)
9. [再生エンジンとアニメーション制御](#9-再生エンジンとアニメーション制御)
10. [3Dエンジンの実装詳細](#10-3dエンジンの実装詳細)
11. [座標変換エンジンの詳細](#11-座標変換エンジンの詳細)
12. [ストローク自動検出アルゴリズム](#12-ストローク自動検出アルゴリズム)
13. [新機能の追加手順（拡張ポイント）](#13-新機能の追加手順拡張ポイント)
14. [テスト・検証方針](#14-テスト検証方針)
15. [ビルド・デプロイ](#15-ビルドデプロイ)
16. [既知の設計上の注意点・落とし穴](#16-既知の設計上の注意点落とし穴)

---

## 1. システム概要

**BOVisualizer** は、ローイング（ボート競技）の乗艇中にXsens DOTセンサーおよびGPSで計測したデータを可視化・分析するWebアプリケーションです。CSVファイルをブラウザにロードするだけで、以下の機能が利用可能です。

| 機能カテゴリ | 概要 |
| :--- | :--- |
| **3D可視化** | IMUクォータニオンデータに基づく艇・左右オールのリアルタイム3D描画 |
| **GPS追跡** | LeafletによるGPS軌跡マップ表示・現在地アニメーション |
| **時系列グラフ** | 速度・加速度・角速度・SPM・SPLITの同期プロット |
| **オール軌跡** | ブレード先端の2D/3D軌跡チャート |
| **ストローク分析** | ストローク自動検出・4位相分割（キャッチ/ドライブ/フィニッシュ/リカバリー） |
| **メトリクス表** | ストローク毎のキャッチ角・フィニッシュ角・スイープ角・リズムの集計 |
| **再生制御** | シーク・再生速度調整・位相単位ジャンプ |
| **データロード** | リモートマニフェスト・ローカルフォルダ選択・CSV D&D・自動リロード |

---

## 2. 技術スタック

| 分類 | ライブラリ/ツール | バージョン | 用途 |
| :--- | :--- | :--- | :--- |
| コア | React | 19 | UIフレームワーク |
| 言語 | TypeScript | 5.x | 型安全なコーディング |
| ビルド | Vite | 8 | バンドル・HMR |
| 状態管理 | Zustand | 5.x | グローバル状態管理 |
| 3D描画 | Three.js + @react-three/fiber + @react-three/drei | — | 3Dシーン |
| 地図 | Leaflet + react-leaflet | — | GPS地図 |
| グラフ | Recharts | — | 時系列・軌跡グラフ |
| CSVパース | PapaParse | — | CSVデータ解析 |
| テスト | Vitest | — | ユニットテスト |
| E2Eテスト | CDP (Chrome DevTools Protocol) | — | ブラウザ統合テスト |

---

## 3. ディレクトリ構造と役割

```
BOVisualizer/
├── public/
│   ├── BOV_logo.png
│   └── data/
│       ├── manifest.json          # データセット・3Dモデルの定義ファイル
│       ├── models/                # 3Dモデル (boat.glb, left_oar.glb, right_oar.glb)
│       └── samples/               # サンプルCSVデータ (sample_1.csv, sample_2.csv, ...)
├── scripts/
│   └── cdp-e2e.mjs                # CDPベースのE2Eテストスクリプト
├── doc/
│   ├── DETAIL.md                  # ★本ファイル（設計・引継ぎ資料）
│   ├── HISTORY.md                 # 開発・機能追加の履歴
│   ├── IDEA_NEWFUNC.md            # 新機能アイデア集
│   └── XsensDOT_Usage.md          # センサー設定・使い方マニュアル
└── src/
    ├── main.tsx                   # アプリエントリポイント
    ├── App.tsx                    # コンポジションルート（レイアウト配線のみ）
    ├── App.css                    # ダッシュボードレイアウト・UIスタイル全体
    │
    ├── data/                      # ★ データ層
    │   └── datasetLoader.ts       # マニフェスト・CSV の fetch を一元管理
    │
    ├── domain/                    # ★ ドメイン層（純粋計算・キャッシュ・レジストリ）
    │   ├── schema.ts              # NormalizedFrame型・METRIC_COLUMNS定義
    │   ├── analysisRepository.ts  # 解析キャッシュの中核（WeakMapキャッシュ）
    │   ├── analyzers/
    │   │   ├── index.ts           # ANALYZERSレジストリ（新解析はここに登録）
    │   │   ├── types.ts           # Analyzer<T>・AnalysisInputインターフェース
    │   │   ├── strokeAnalyzer.ts  # 組み込み: ストローク検出アナライザー
    │   │   ├── metricsAnalyzer.ts # 組み込み: メトリクス導出アナライザー

    │   └── panels/
    │       ├── index.ts           # PANELSレジストリ（新パネルはここに登録）
    │       └── types.ts           # PanelDefinitionインターフェース
    │
    ├── store/                     # ★ 状態層（Zustand）
    │   ├── playbackStore.ts       # 3スライスを結合した合成ストア
    │   └── slices/
    │       ├── playbackSlice.ts   # 再生制御: isPlaying / fps / seekFrame / maxFrame
    │       ├── datasetSlice.ts    # データセット管理: datasets / selectedId / customDS
    │       └── viewSlice.ts       # UI設定: oarSide / graphMode / 各種トグル
    │
    ├── hooks/                     # カスタムフック
    │   ├── useDataset.ts          # データセットのfetch・ローディング管理
    │   ├── useAnalysis.ts         # 解析結果の集約・allDatasetsData横断計算
    │   └── useAnimationClock.ts   # requestAnimationFrameによる再生タイマー
    │
    ├── utils/                     # ★ 純粋関数群（副作用なし）
    │   ├── coordTransform.ts      # センサー座標系変換・クォータニオン演算
    │   ├── trajectory.ts          # オール軌跡計算（公開ラッパー + 内部実装）
    │   ├── strokeDetect.ts        # ストローク検出（公開ラッパー + 内部実装）
    │   ├── metrics.ts             # メトリクス導出（公開ラッパー + 内部実装）
    │   ├── csvParser.ts           # PapaParseを使ったCSVパーサー
    │   └── oarAngle.ts            # オール角度計算ユーティリティ
    │
    ├── components/                # ★ 表示層（Reactコンポーネント）
    │   ├── Scene.tsx              # 3Dシーン（Three.js / @react-three/fiber）
    │   ├── OarTrajectoryChart.tsx # オール軌跡グラフ（Recharts）
    │   ├── TimeSeriesChart.tsx    # 時系列グラフ（Recharts）
    │   ├── RowingMap.tsx          # GPS地図（Leaflet）
    │   ├── PlaybackControls.tsx   # 再生UI・設定ポップオーバー
    │   ├── MetricsBar.tsx         # 上部メトリクス表示バー
    │   ├── StrokeMetricsTable.tsx # ストローク単位メトリクステーブル
    │   └── ErrorBoundary.tsx      # エラー境界コンポーネント
    │
    ├── types/                     # TypeScript型定義
    │   ├── rowing.ts              # 共通型（RowingFrame, DatasetCsv, DerivedMetrics等）
    │   └── strokeDetect.ts        # ストローク関連型（StrokeSegment, PhaseSegment等）
    │
    ├── scene/                     # 3Dシーン用定数
    └── test/                      # Vitestユニットテスト群
```

---

## 4. 4層アーキテクチャの詳細

本システムは以下の4層で構成されており、**依存方向は必ず下から上（データ層 → 表示層）** に固定されます。

```
[表示層 View]       src/components/*
      ▲
[状態層 Store]      src/store/slices/*
      ▲
[ドメイン層 Domain]  src/domain/* + src/hooks/*
      ▲
[データ層 Data]     src/data/*
```

### 4.1 データ層 (`src/data/`)

CSVおよびマニフェストファイルの取得・パースを担当します。外部からデータを取り込む唯一の窓口です。

**`datasetLoader.ts`** の3つの公開関数:

| 関数 | 説明 |
| :--- | :--- |
| `fetchManifest()` | `public/data/manifest.json` を fetch してデータセット一覧を返す |
| `fetchDatasetCsv(item)` | マニフェスト項目のCSVをfetch・パースして `DatasetCsv` を返す |
| `loadAllManifestDatasets(manifest)` | 全マニフェストCSVを非同期一括取得（横断分析用） |

### 4.2 ドメイン層 (`src/domain/`)

重い計算（軌跡構築・ストローク検出・メトリクス導出）を一元管理し、WeakMapキャッシュで多重実行を防ぎます。

**`analysisRepository.ts`** — キャッシュの核心:

```ts
// フレーム配列を渡すと、初回は計算・以降はキャッシュを返す
const analysis = getAnalysis(frames);
// analysis.trajectory  … オール軌跡
// analysis.strokes     … ストローク分割結果
// analysis.metrics     … 時系列メトリクス
// analysis.extra       … 追加アナライザー結果（Map<string, unknown>）
```

**`schema.ts`** — 型定義と変換:

- `NormalizedFrame`: ドメイン内部で使用する型付きフレーム（文字列キー依存なし）
- `METRIC_COLUMNS`: グラフ系列に含める列名の定義（ここに追加するだけでグラフに自動反映）
- `normalizeFrames()`: `RowingFrame[]` → `NormalizedFrame[]` への変換関数

**`analyzers/index.ts`** — 追加アナライザーのレジストリ:

```ts
export const ANALYZERS: Analyzer<any>[] = [
  // ← 新しいアナライザーをここに追加するだけで自動実行される
];
```

**`panels/index.ts`** — 表示パネルのレジストリ:

```ts
export const PANELS = [
  { id: 'scene',          label: '3Dグラフ' },
  { id: 'trajectory',     label: 'オール軌跡' },
  { id: 'map',            label: 'GPS地図' },
  { id: 'timeseries',     label: '時系列グラフ' },
  { id: 'stroke-metrics', label: 'メトリクステーブル' },
] as const;
```

### 4.3 状態層 (`src/store/`)

Zustandの3スライスで構成されます。**重い算出値（軌跡・ストローク情報）はストアに持たせず、ドメイン・キャッシュ層へ委譲** します。

| スライス | ファイル | 管理する状態 |
| :--- | :--- | :--- |
| PlaybackSlice | `playbackSlice.ts` | `isPlaying` / `fps` / `seekFrame` / `maxFrame` |
| DatasetSlice | `datasetSlice.ts` | `datasets` / `selectedDatasetId` / `customDatasets` / `directoryHandle` / `autoReload*` |
| ViewSlice | `viewSlice.ts` | `oarSide` / `graphMode` / `analysisMode` / `showStrokePhases` / `showStrokeMetrics` 等 |

### 4.4 表示層 (`src/components/`)

propsで受け取ったデータを描画することに専念します。コンポーネント内で生 `frames` から再計算しないことが鉄則です。

---

## 5. データモデルと型定義

### 5.1 公開型（`src/types/rowing.ts`）

```ts
// CSVの生フレーム（パース境界まで）
type RowingValue = number | string | null;
type RowingFrame = Record<string, RowingValue>;

// CSVファイル全体を表す型
interface DatasetCsv {
  headers: string[];
  frames: RowingFrame[];
  meta: DatasetMeta;
}

// マニフェスト項目
interface DatasetManifestItem {
  id: string;
  label: string;
  path: string;
}

// 導出されたメトリクス
interface DerivedMetrics {
  spm: MetricSeriesPoint[];
  split: MetricSeriesPoint[];
  timeAxis: TimePoint[];
  gpsValidPoints: GpsPoint[];
  graphSeries: Record<string, MetricSeriesPoint[]>;
}
```

### 5.2 内部型（`src/domain/schema.ts`）

`NormalizedFrame` はドメイン内部でのみ使用される型安全なフレーム型です。`RowingFrame` → `NormalizedFrame` への変換は `analysisRepository.ts` の境界でのみ行います。

```ts
interface NormalizedFrame {
  arrayIndex: number;        // フレーム配列の添字（再生位置と一致）
  csvNumber: number | null;  // CSV 'number' 列の実測値
  timeStr: string | null;    // CSV 'time' 列
  timeSec: number | null;    // CSV 'time_s' 列

  leftOarQ: Quaternion;      // 左オールクォータニオン (wol/xol/yol/zol)
  rightOarQ: Quaternion;     // 右オールクォータニオン (wor/xor/yor/zor)
  boatQ: Quaternion;         // ボートクォータニオン (wb/xb/yb/zb)

  angleDegLeft: number | null;
  angleDegRight: number | null;
  errDegOarLeftZ: number | null;
  errDegOarRightZ: number | null;
  errDegBoatZ: number | null;

  tipLeftX: number | null;   // ブレード先端X座標（複数CSVエイリアスを正規化済み）
  tipLeftZ: number | null;
  tipRightX: number | null;
  tipRightZ: number | null;

  gpsLat: number | null;     // GPS緯度（(0,0)の無効値は null に変換済み）
  gpsLon: number | null;

  metrics: Record<MetricKey, number | null>;  // METRIC_COLUMNSで定義された列
}
```

### 5.3 ストローク型（`src/types/strokeDetect.ts`）

```ts
type StrokePhase = 'catch' | 'drive' | 'finish' | 'recovery';

interface PhaseSegment {
  phase: StrokePhase;
  startFrame: number;
  endFrame: number;
}

interface StrokeSegment {
  strokeIndex: number;
  startFrame: number;
  endFrame: number;
  phases: PhaseSegment[];
}
```

---

## 6. CSVデータフォーマット仕様

### 6.1 ファイル構造

```
1行目: Measurement Mode: <任意のモード名>   ← 必須のヘッダー識別子
2行目: number,time,latitude,longitude,...   ← CSVヘッダー行
3行目以降: 0,2026-05-01T10:00:00,...       ← データ行
```

### 6.2 カラム仕様

| カラム名 | 型 | 説明 |
| :--- | :--- | :--- |
| `number` | 整数 | フレーム番号（実測値。非ゼロ開始・非連続あり。**再生位置には使用しない**） |
| `time` | 日時文字列 | 計測実時刻（ISO形式推奨）。`time_s` が存在しない場合の経過秒計算に使用 |
| `time_s` | 実数 | 経過秒数。これがある場合はFPS推定・時間軸の優先ソースとして使用 |
| `latitude` / `longitude` | 実数 | GPS座標（WGS84）。`(0,0)` は欠損として無視 |
| `SPM` | 実数 | ストローク毎分 |
| `SPLIT` | 実数 | スプリットタイム（速度指標） |
| `speed` | 実数 | 移動速度 |
| `accx` / `accy` / `accz` | 実数 | ボートIMUの3軸加速度 |
| `gyrox` / `gyroy` / `gyroz` | 実数 | ボートIMUの3軸角速度 |
| `wb` / `xb` / `yb` / `zb` | 実数 | ボートのクォータニオン姿勢データ |
| `wol` / `xol` / `yol` / `zol` | 実数 | 左オールのクォータニオンデータ |
| `wor` / `xor` / `yor` / `zor` | 実数 | 右オールのクォータニオンデータ |
| `err_deg_boat_z` | 実数 | ボートZ軸基準補正角（度） |
| `err_deg_oar_left_z` | 実数 | 左オールZ軸補正角（度） |
| `err_deg_oar_right_z` | 実数 | 右オールZ軸補正角（度） |
| `left_tip_x` / `left_tip_z` | 実数 | 左ブレード先端XZ座標（直接指定する場合）。`oar_left_tip_x` / `blade_left_x` もエイリアスとして認識 |
| `right_tip_x` / `right_tip_z` | 実数 | 右ブレード先端XZ座標（同上） |

> **注意**: `number` 列の値は再生位置インデックスとして使用しないこと。`arrayIndex`（配列の添字）で管理します。GPS座標の `frameNumber` も `arrayIndex` を使用します（`metrics.ts` の `buildGpsValidPoints` を参照）。

### 6.3 マニフェストファイル (`public/data/manifest.json`)

```json
{
  "datasets": [
    { "id": "sample_1", "label": "Sample 1", "path": "data/samples/sample_1.csv" },
    { "id": "sample_2", "label": "Sample 2", "path": "data/samples/sample_2.csv" }
  ]
}
```

---

## 7. 各機能の実装詳細

### 7.1 3Dシーン (`src/components/Scene.tsx`)

`@react-three/fiber` の `Canvas` コンポーネントを使って Three.js シーンを構築します。

**描画要素**:
- **ボートモデル**: `public/data/models/boat.glb` をGLTFローダーでロード
- **左右オールモデル**: `public/data/models/left_oar.glb` / `right_oar.glb`
- **水面**: `PlaneGeometry` + ステンシルマスクでコクピット内への水の侵入を防止
- **カメラ**: `OrbitControls` で自由回転・パン・ズームを提供

**姿勢計算フロー** (`src/utils/coordTransform.ts`):
1. CSVのクォータニオン値（`wb, xb, yb, zb` 等）を読む
2. `sensorQuaternionToThree()` でセンサー座標系 → Three.js座標系へ変換（X軸周り -90° 回転）
3. ボートは変換済みクォータニオンをそのまま適用
4. オールはボートクォータニオン × Z軸補正 × 固定取付角を合成して最終姿勢を決定

**ステンシルマスク（コクピット水侵入防止）**:
艇体コクピット部分のメッシュをステンシルバッファのマスクとして使用し、水面（Water plane）の描画をマスク領域外に限定することで、艇体内部に水が入り込まない視覚表現を実現しています。

### 7.2 オール軌跡チャート (`src/components/OarTrajectoryChart.tsx`)

**`buildOarTrajectory(frames)`** を通じて取得した `TrajectoryPoint[]` をRechartsの `ScatterChart` で描画します。

軌跡計算の詳細は [11章](#11-座標変換エンジンの詳細) を参照。

**表示モード**:
- 2Dモード: X-Z平面（水平面投影）
- 3Dモード: 実験的な3D軌跡表示

### 7.3 時系列グラフ (`src/components/TimeSeriesChart.tsx`)

RechartsのComposedChartで複数系列を同期描画します。

**グラフ系列**: `METRIC_COLUMNS` に定義された列（`speed`, `accx`...`gyroz`, `SPM`, `SPLIT`）が `graphSeries` として `DerivedMetrics` に含まれます。新しい計測列を追加する場合は `src/domain/schema.ts` の `METRIC_COLUMNS` に追加するだけです。

**位相背景（ReferenceArea）**: `analysisMode` かつ `showStrokePhases` がtrueの場合、各ストローク位相に対応した半透明の背景色（キャッチ=青/ドライブ=緑/フィニッシュ=橙/リカバリー=灰）を `ReferenceArea` で描画します。

**現在位置ライン**: `seekFrame` に対応する `ReferenceLine` を表示し、再生位置を視覚的に示します。

### 7.4 GPSマップ (`src/components/RowingMap.tsx`)

LeafletのOpenStreetMapタイルを背景に、GPS軌跡と現在位置ピンを描画します。

**実装上の重要な設計**:
- **データロード時の1回限り `fitBounds`**: `FitTrajectory` コンポーネントがデータセット読み込み時に1度だけ軌跡全体が収まるようにズームします。毎フレームセンタリングするとピンが固定されて動かないように見えるため廃止されました。
- **リセンターボタン**: ユーザーの現在ズーム倍率を維持したまま現在位置へパン移動します（強制最大ズームは廃止）。
- **Leafletの再描画**: 全画面拡大・縮小時には `key` プロパティを変更してコンポーネントを再マウントすることで白紙化を防いでいます。

### 7.5 再生コントロール (`src/components/PlaybackControls.tsx`)

**主な機能**:
- 再生・一時停止
- シークバー（スライダー）
- FPS調整
- データセット切り替え
- 設定ポップオーバー（各種トグル、自動リロード設定）
- ローカルフォルダ選択・CSV D&D

**キーボードショートカット**:
| キー | 動作 |
| :--- | :--- |
| `Space` | 再生/一時停止トグル |
| `ArrowLeft` | 前のデータセットへ |
| `ArrowRight` | 次のデータセットへ |
| `Shift + ArrowLeft` | 前の位相先頭フレームへシーク |
| `Shift + ArrowRight` | 次の位相先頭フレームへシーク |

### 7.6 ストロークメトリクステーブル (`src/components/StrokeMetricsTable.tsx`)

検出されたストロークの各種メトリクスを表形式で表示します。

**表示項目**:
- ストローク番号、開始/終了フレーム
- 各位相のフレーム範囲（キャッチ/ドライブ/フィニッシュ/リカバリー）
- 左右オールのキャッチ角・フィニッシュ角・スイープ角
- リズム（水中/水上比）

**全データセット横断表示**: `allDatasetsData` が存在する場合、複数データセットの比較テーブルも表示します。

### 7.7 メトリクスバー (`src/components/MetricsBar.tsx`)

現在フレームの主要数値（速度・SPM・SPLIT・現在位相・オール角度等）をヘッダー部に常時表示するバーコンポーネント。

### 7.8 自動リロード機能

`setInterval` を使ったバックグラウンドリロードで、選択ディレクトリを再スキャンして新しいCSVデータを検出します。設定ポップオーバーで有効/無効・間隔（秒）を設定可能です。

**スナップショット機構**: リロード中もメトリクステーブル等の表示を維持するため、ロード完了まで前の `metricsSnapshot` を保持します。これにより、データ更新中の一瞬の表示消えを防ぎます。

---

## 8. 状態管理（Zustand）の詳細

### 8.1 ストアの利用方法

```ts
import { usePlaybackStore } from '../store/playbackStore';

// コンポーネント内での使用例
const { seekFrame, setSeekFrame, isPlaying, setIsPlaying } = usePlaybackStore();

// ストア外（コールバック等）での状態取得
const state = usePlaybackStore.getState();
```

### 8.2 各スライスの詳細

#### PlaybackSlice (`src/store/slices/playbackSlice.ts`)

```ts
// 状態
isPlaying: boolean     // 再生中かどうか
fps: number            // 再生速度（1〜120の範囲にクランプ）
seekFrame: number      // 現在のフレーム番号（0〜maxFrame）
maxFrame: number       // 最大フレーム番号

// セッター
setIsPlaying(v: boolean)
setFps(v: number)      // クランプ処理あり
setSeekFrame(v: number) // クランプ処理あり
setMaxFrame(v: number)  // seekFrameが超えていればクランプ
```

#### DatasetSlice (`src/store/slices/datasetSlice.ts`)

```ts
// 状態
datasets: DatasetManifestItem[]         // 全データセット一覧（ソート済み）
selectedDatasetId: string               // 選択中のデータセットID
customDatasets: Record<string, DatasetCsv> // ローカルロード済みカスタムDS
directoryHandle: FileSystemDirectoryHandle | null  // フォルダ選択ハンドル
autoReloadEnabled: boolean              // 自動リロード有効/無効
autoReloadInterval: number             // 自動リロード間隔（秒）

// セッター
setDatasets(datasets)                  // データセット一覧を更新（自動ソート）
setSelectedDatasetId(id)               // データセット切替（seekFrame=0にリセット）
addCustomDataset(id, label, data)      // カスタムDS追加・選択
setCustomDatasets(items)               // カスタムDS一括置換
setDirectoryHandle(handle)
setAutoReloadEnabled(enabled)
setAutoReloadInterval(interval)        // 2〜60秒の範囲にクランプ
```

> **重要**: データセット切り替え時は、`seekFrame=0`, `isPlaying=playOnSwitch`, `oarSide=initialOarSide`, `graphMode=initialGraphMode` へ自動リセットされます。これはクロススライス更新として `get()` を使って実装されています。

#### ViewSlice (`src/store/slices/viewSlice.ts`)

```ts
// 状態
oarSide: 'right' | 'left'    // 表示するオール側（3D/軌跡チャートのデフォルト）
graphMode: GraphMode          // グラフ表示モード
initialOarSide: 'right' | 'left'  // DS切替時のリセット値
initialGraphMode: GraphMode        // DS切替時のリセット値
playOnSwitch: boolean         // DS切替時に自動再生するか
analysisMode: boolean         // 解析モードON/OFF（位相帯・メトリクス表示の大本スイッチ）
showStrokePhases: boolean     // グラフ上の位相背景表示ON/OFF
showStrokeMetrics: boolean    // ストロークメトリクステーブルのON/OFF
```

---

## 9. 再生エンジンとアニメーション制御

### 9.1 `useAnimationClock` (`src/hooks/useAnimationClock.ts`)

`requestAnimationFrame` を使って `seekFrame` を一定FPSで進めるカスタムフックです。

```ts
// App.tsx内での使用
useAnimationClock(); // これだけでストアのisPlayingとfpsに従ってseekFrameが自動更新される
```

**実装のポイント**:
- `isPlaying` がtrueの場合のみ `requestAnimationFrame` でループ
- 実時間（`performance.now()`）を基準にフレームを進めることで、ブラウザのタブ非アクティブ時やフレームスキップに対応
- フレームが `maxFrame` に達したら停止

---

## 10. 3Dエンジンの実装詳細

### 10.1 センサー座標系 → Three.js座標系変換

センサー（XsensDOT）とThree.jsでは座標系の向きが異なります。

```
センサー座標系: X=右, Y=上, Z=前
Three.js座標系: X=右, Y=上, Z=手前（画面手前）

変換式: sensor(x, y, z) → three(x, z, -y)
クォータニオン変換: Q_three = R_x(-90°) * Q_sensor * R_x(+90°)
```

実装は `coordTransform.ts` の `sensorQuaternionToThree()` を参照。

### 10.2 オールの姿勢計算

オールの最終的な回転は以下の合成です:

```
Q_final = Q_boat_yaw_correction × Q_oar_error_correction × Q_sensor_to_three × Q_fixed_mount
```

1. **センサー生値**: `wol, xol, yol, zol`（左オール）
2. **右オールのミラー補正**: `mirrorRightOarSensorQuaternion()` でx,yを反転
3. **Three.js変換**: `sensorQuaternionToThree()`
4. **固定取付角**: `LEFT_OAR_FIXED_ROTATION` / `RIGHT_OAR_FIXED_ROTATION`（艇への取付位置・向き）
5. **Z軸補正角**: `err_deg_oar_left_z` / `err_deg_boat_z` によるキャリブレーション補正

### 10.3 ブレード先端座標の計算

`computeOarTipXY()` がオール先端のXZ座標（cm単位）を計算します。

```
初期位置ベクトル（cm）:
  左オール: [12.0, 200.0, 3.0]   ← ピボット（オーロック）から先端までのオフセット
  右オール: [-12.0, 200.0, 3.0]

計算手順:
1. ボートのヨー角（yaw）を抽出
2. 合計Z回転角 = -boatYaw - errOarZ + errBoatZ
3. 初期位置ベクトルにオアー量 and Z軸回転を適用
4. XZ座標を返す（ストローク検出の水深判定に使用）
```

---

## 11. 座標変換エンジンの詳細

`src/utils/coordTransform.ts` に集約されています。

| 関数 | 説明 |
| :--- | :--- |
| `makeSensorQuaternion(w, x, y, z)` | センサー生値からSensorQuaternionを生成 |
| `normalizeSensorQuaternion(q)` | クォータニオンを正規化（ゼロ長の場合は単位クォータニオンを返す） |
| `sensorQuaternionToThree(q, prev?)` | センサー座標 → Three.js座標への変換。`prev` を渡すと符号フリップ（ジンバルロック対策）を適用 |
| `buildPivotQuaternion(q, errZ, side, prev?, boatErrZ?)` | オールのピボット（オーロック位置）における最終クォータニオンを計算 |
| `transformRigQuaternions(input, prev?)` | 艇・左右オール全体の変換を一括実行 |
| `extractZXYEulerYDeg(q)` | ZXY内因性オイラー分解のY成分（オール水平スイープ角）を抽出 |
| `computeOarTipXY(oarQ, boatQ, errOarZ, errBoatZ, initialCm)` | ブレード先端XZ座標（cm）を計算 |
| `getOarFixedRotation(side)` | オール側別の固定取付角（XYZ Euler）を返す |

---

## 12. ストローク自動検出アルゴリズム

`src/utils/strokeDetect.ts` に実装されています。

### 12.1 検出基準

- **水面しきい値**: ブレードZ座標 `≤ -30cm` を「水中」と判定
- **左右独立**: 左右どちらか一方でも水中なら「水中セッション」として扱う
- **チャタリング除去**: 約0.25秒（`fps * 0.25` フレーム）未満の水中状態は除去

### 12.2 検出フロー（4段階）

**Phase 1: 生検出** — Z座標しきい値を走査して水中セッション（開始〜終了フレーム）を生成

**Phase 2: チャタリング統合（マージ）** — 隣接するセッション間のギャップが短い（`fps * 0.15`フレーム以下）かつ少なくとも一方が短い場合にマージ。これにより入水・出水時のノイズを吸収

**Phase 3: 短いセッションの除去** — マージ後も `fps * 0.25` フレーム未満のセッションはノイズとして除外

**Phase 4: 位相境界の決定** — 各セッション内で:
- `catchEnd`: 左右両方が水中になる最初のフレーム
- `finishStart`: 両方水中の最後区間から、片方が出始めるフレーム

### 12.3 ストローク組み立て

```
ストローク i の構成:
  開始: sessions[i-1].finishEnd + 1 （最初のストロークは0から）
  終了: sessions[i].finishEnd

位相構成（最大5セグメント）:
  1. recovery  (strokeStart 〜 catchStart-1)  ← 前ストローク末尾のリカバリー
  2. catch     (catchStart 〜 catchEnd)
  3. drive     (catchEnd+1 〜 finishStart-1)
  4. finish    (finishStart 〜 finishEnd)
  5. recovery  (finishEnd+1 〜 strokeEnd)     ← 最後のストロークのみ
```

### 12.4 位相シーク (`seekByPhase`)

全ストロークの全位相をフラット配列に展開し、現在フレームから `delta` 個分の位相を移動した位相の先頭フレームを返します（`Shift+←/→` で使用）。

---

## 13. 新機能の追加手順（拡張ポイント）

> ⚠️ **重要**: 新機能追加時は以下の拡張ポイントを使用してください。**View層やストア層への直接ロジック追記は禁止**です。

### 拡張ポイント① — 新しい解析アルゴリズムの追加

1. `src/domain/analyzers/` に `MyAnalyzer.ts` を作成:

```ts
// src/domain/analyzers/myAnalyzer.ts
import type { Analyzer, AnalysisInput } from './types';

export interface MyAnalysisResult {
  someValue: number;
  // ...
}

export const myAnalyzer: Analyzer<MyAnalysisResult> = {
  id: 'myAnalysis',
  label: 'My Analysis',
  compute({ normalizedFrames, trajectory, strokes }: AnalysisInput): MyAnalysisResult {
    // ⚠️ 自前でbuildOarTrajectoryやdetectStrokesを呼ばない
    // キャッシュ済みの trajectory / strokes を再利用する
    return { someValue: 42 };
  },
};
```

2. `src/domain/analyzers/index.ts` の `ANALYZERS` 配列に追加:

```ts
import { myAnalyzer } from './myAnalyzer';

export const ANALYZERS: Analyzer<any>[] = [
  myAnalyzer,  // ← ここに追加するだけ
];
```

3. コンポーネントから結果を取得:

```ts
const { analysis } = useAnalysis(datasetState);
const result = analysis?.extra.get('myAnalysis') as MyAnalysisResult | undefined;
```

### 拡張ポイント② — 新しい表示パネルの追加

1. `src/components/MyPanel.tsx` を作成（描画のみ）
2. `src/domain/panels/index.ts` の `PANELS` に追加:

```ts
export const PANELS = [
  // ... 既存パネル
  { id: 'my-panel', label: 'My Panel', requiredAnalyzers: ['myAnalysis'] },
] as const satisfies readonly PanelDefinition[];
```

3. `App.tsx` のレイアウトに対応するグリッドセルを追加（現在はまだ手動配線）

### 拡張ポイント③ — 新しい計測列（グラフ系列）の追加

`src/domain/schema.ts` の `METRIC_COLUMNS` に列名を追加するだけです:

```ts
export const METRIC_COLUMNS = [
  'speed', 'accx', 'accy', 'accz', 'gyrox', 'gyroy', 'gyroz',
  'SPM', 'SPLIT',
  'force_left',  // ← 追加するだけで TimeSeriesChart に自動表示される
] as const;
```

### 拡張ポイント④ — 新しい状態の追加

対応するスライスファイルのみを編集します（`playbackStore.ts` を直接変更しない）:

- 再生制御に関する状態 → `store/slices/playbackSlice.ts`
- データセット管理に関する状態 → `store/slices/datasetSlice.ts`
- 表示・UI設定に関する状態 → `store/slices/viewSlice.ts`

### 拡張ポイント⑤ — キャッシュ済み算出値の活用

コンポーネント内でオール軌跡やストロークが必要な場合:

```ts
// App.tsx → useAnalysis → 各コンポーネントへprops渡し
const { frames, strokes, metrics, allDatasetsData } = useAnalysis(datasetState);

// または、analysis.extraから拡張アナライザーの結果を取得
const analysis = getAnalysis(frames);  // リポジトリ経由（キャッシュ利用）
const symmetry = analysis.extra.get('symmetry') as SymmetryResult | undefined;
```

---

## 14. テスト・検証方針

### 14.1 ユニットテスト（Vitest）

```bash
npm run test
```

`src/test/` 配下にテストが配置されています。現在45件のテストが存在し、すべてパスしていることが確認されています。

テスト対象:
- 座標変換モジュール（`coordTransform.ts`）
- CSVパーサー（`csvParser.ts`）
- 軌跡計算エンジン（`trajectory.ts`）
- ストローク検出（`strokeDetect.ts`）
- メトリクス導出（`metrics.ts`）

### 14.2 E2Eテスト（CDP）

```bash
npm run e2e:cdp
```

Chrome DevTools Protocol を直接操作して、実際のブラウザ上での3Dシーンロード・アニメーション動作・エラーハンドリングをテストします（`scripts/cdp-e2e.mjs`）。

### 14.3 ビルド検証

```bash
npm run build
```

TypeScriptコンパイルエラーの検出とバンドルの正常生成を確認します。ビルド時間の目安: ~900ms。

### 14.4 Lintチェック

```bash
npm run lint
```

### 14.5 新機能追加時のテスト方針

1. **ユニットテストを先に書く**: `src/test/` に追加アナライザーや計算ロジックのテストを作成
2. **スナップショット的確認**: 同一サンプルCSVに対して前後で計算結果が変わらないことを確認
3. **ビルド通過確認**: TypeScriptエラーがないことを必ず確認
4. **E2Eで動作確認**: 実際のブラウザで3Dシーンとグラフが正常表示されることを確認

---

## 15. ビルド・デプロイ

### 15.1 開発サーバーの起動

```bash
npm install      # 初回のみ
npm run dev      # localhost:5173 で起動
```

### 15.2 GitHub Pages へのデプロイ

Viteの `base` パスが `/BOVisualizer/` に設定されており（`vite.config.ts`）、静的アセット（CSVや3Dモデル）は `import.meta.env.BASE_URL` を使って動的解決されます。

```bash
npm run build    # dist/ にビルドされる
# dist/ を GitHub Pages の gh-pages ブランチにプッシュ
```

### 15.3 コードスプリッティング

Three.js・Leaflet等の重量ライブラリは `React.lazy` で遅延ロードされ、個別の `vendor` チャンクに分割されています。初期バンドルサイズを削減し、初回読み込み時間を短縮しています。

---

## 16. 既知の設計上の注意点・落とし穴

### 16.1 `arrayIndex` vs `csvNumber` の使い分け

再生位置（`seekFrame`）は必ず **配列の添字（`arrayIndex`）** と一致させてください。CSVの `number` 列は実測値で非ゼロ開始・非連続なため、再生位置インデックスとして直接使用すると不一致が生じます。

**正しい実装**:
```ts
// GPS座標のframeNumberはarrayIndexを使う
frameNumber: frame.arrayIndex,  // ✅ 正しい

// 軌跡グラフの縦線との同期もarrayIndexで
```

### 16.2 `getAnalysis()` の呼び出しルール

`getAnalysis(frames)` はリポジトリ経由のキャッシュ取得です。フレーム配列の**参照**が同じである限りキャッシュが有効です。コンポーネント内でフレームを再生成すると毎回再計算が走るため注意してください。

```ts
// ❌ 毎レンダリングで再計算が走る
const analysis = getAnalysis([...frames]);  

// ✅ useMemoでフレーム参照を安定させてからgetAnalysisに渡す
const frames = useMemo(() => datasetState.dataset?.frames ?? [], [datasetState.dataset]);
```

### 16.3 Leaflet地図の白紙化

Leafletは初期化時にコンテナのサイズを読み取るため、非表示状態で初期化すると白紙になります。全画面拡大・縮小のタイミングで `key` プロパティを変更してコンポーネントを再マウントすることで対応しています。

### 16.4 `StrokeMetricsTable.tsx` の巨大化

現在のファイルサイズは約34KBで、メトリクス計算ロジック・表示・設定UIが混在しています。今後拡張する場合は計算部をアナライザーに分離し、表示コンポーネントを分割することを検討してください。

### 16.5 クォータニオンの符号フリップ問題

連続するフレーム間でクォータニオンの内積が負になる場合（= `dot(current, prev) < 0`）、`negateIfNeeded()` で成分を反転させてジャンプを防いでいます。この処理がないと3Dモデルが突然反転する現象が起きます。`Scene.tsx` でフレーム毎に前フレームのクォータニオンを渡すことが重要です。

### 16.6 `ANALYZERS` レジストリの組み込みアナライザーについて

`strokeAnalyzer` と `metricsAnalyzer` は型安全のため `analysisRepository.ts` から直接呼ばれており、`ANALYZERS` 配列には含まれていません。`ANALYZERS` は「組み込み以外の追加アナライザー」のリストです。

---

## 付録A: ローイング用語集

| 用語 | 説明 |
| :--- | :--- |
| **キャッチ (Catch)** | オールを水に入れる瞬間。ドライブの開始点 |
| **ドライブ (Drive)** | オールが水中にある漕ぎの局面。脚→体幹→腕の連動で推進力を生む |
| **フィニッシュ (Finish)** | オールを水から抜く瞬間。リカバリーへの切り替え点 |
| **リカバリー (Recovery)** | オールが水上にある、次のキャッチ準備の局面 |
| **SPM** | Strokes Per Minute。ストローク毎分（漕ぎの速さ） |
| **SPLIT** | 500m通過タイム（秒）。速度の指標 |
| **スイープ角 (Arc)** | 1ストロークでオールが水平方向に動く角度の総計 |
| **リズム (Rhythm)** | 水中時間/水上時間の比。通常1:2程度が理想 |
| **スカル** | 1人が左右2本のオールを持つスタイル |
| **スイープ** | 1人が1本のオールを持つスタイル（左右どちらかを担当） |

---

## 付録B: よくある開発作業フロー

### 新しいセンサー計測列をグラフに追加する

```ts
// 1. src/domain/schema.ts の METRIC_COLUMNS に列名を追加
export const METRIC_COLUMNS = [
  // ... 既存
  'new_sensor_col',  // ← ここに追加
] as const;

// 2. NormalizedFrame型のmetricsに自動で含まれる
// 3. deriveMetricsInternal() の graphSeries に自動で含まれる
// 4. TimeSeriesChart.tsx に自動で表示される（設定UIも不要）
```

### 新しいサンプルデータセットを追加する

```json
// public/data/manifest.json に追記
{
  "datasets": [
    { "id": "new_sample", "label": "New Sample", "path": "data/samples/new_sample.csv" }
  ]
}
```

### デバッグ: キャッシュをリセットしたい

```ts
import { clearAnalysisCache } from '../domain/analysisRepository';
clearAnalysisCache();  // WeakMapキャッシュを全クリア
```

---

*© 2026 BOVisualizer Development Team*
