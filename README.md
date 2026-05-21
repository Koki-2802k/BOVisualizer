# BOVisualizer (Rowing Sensor Data Visualizer)

センサーおよびGPSデータに基づき、ローイング（ボート競技）における艇（ボート）の挙動と左右オールの3次元的な動きをリアルタイムに可視化・分析するWebアプリケーションです。

---

## 🚀 主な機能

本アプリケーションは、センサー計測データ（CSV形式）からボートの姿勢やオールの動きを精密に再現し、多角的な分析を可能にする統合ダッシュボードを提供します。

1. **リアルタイム3Dシーン可視化**
   - Three.js / React Three Fiber (`@react-three/fiber`) を用いた滑らかな3D描画。
   - 慣性計測装置（IMU）のクォータニオンデータ（`wb, xb, yb, zb` など）に基づき、ボートの3軸回転（ロール・ピッチ・ヨー）をリアルタイムに反映。
   - 左右オールの個別クォータニオンと補正角を演算し、オールの細かな回転（フォワード、ドライブ、フェザー等）をボートの動きと完全同期。
   - カメラアングルの変更（回転・パン・ズーム）が自由に可能なOrbitControls。
   - 水面表示と精密な3Dモデル読み込み（GLTF形式）。

2. **オール軌跡チャート (2D / 3D)**
   - 左右オールのブレードの軌跡を2次元座標（または3次元的な動き）としてビジュアル描画。
   - 各ストロークごとのエントリー・リリース時のオールのブレード角度やキャッチ角の変動をキャプチャ。

3. **GPSトラッキングマップ**
   - Leafletおよび `react-leaflet` を使用した統合マップ表示。
   - 緯度経度データ（WGS84）からメートル単位のローカル平面座標（XY）への高精度な座標変換モジュールを内蔵。
   - 航走した経路全体と、現在フレームにおける艇の位置をアニメーションでマッピング。

4. **マルチモード時系列グラフ**
   - Rechartsを用いたインタラクティブな時系列プロット。
   - 速度（Speed）、3軸加速度（accx, accy, accz）、3軸角速度（gyrox, gyroy, gyroz）、ストローク数（SPM）、スプリットタイム（SPLIT）などを同期描画。
   - 再生ヘッドの動きに合わせてグラフ上の現在値バーがスムーズに移動。

5. **高度な再生コントロール**
   - シークバーによるタイムラインの任意位置への即時ジャンプ。
   - 再生/一時停止、FPS（再生速度）のリアルタイム調整。
   - 事前定義された複数のサンプルデータセットのシームレスな切り替え。
   - ユーザー手持ちのカスタム計測CSVファイルのドラッグ＆ドロップ/ファイル選択による即時読み込み（ブラウザ内完結）。

6. **グローバルショートカットキー**
   - `Space`: アニメーションの再生 / 一時停止のトグル。
   - `ArrowLeft` / `ArrowRight`: リスト内の前後のデータセットへ素早く切り替え。

---

## 🛠 技術スタック

- **コア・開発環境**
  - [React 19](https://react.dev/) / TypeScript
  - [Vite 8](https://vite.dev/) (高速なモジュールバンドル & HMR)
  - [Zustand](https://github.com/pmndrs/zustand) (軽量かつ高速なグローバル状態管理)

- **ビジュアライゼーション**
  - [Three.js](https://threejs.org/) / [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) / [@react-three/drei](https://github.com/pmndrs/drei)
  - [Leaflet](https://leafletjs.com/) / [react-leaflet](https://react-leaflet.js.org/) (高機能マップコンポーネント)
  - [Recharts](https://recharts.org/) (レスポンシブな時系列・軌跡チャート)

- **データ処理**
  - [PapaParse](https://www.papaparse.com/) (CSVデータのパース)
  - 自社開発のローイング専用メトリクス・座標系変換エンジン

- **テスト**
  - [Vitest](https://vitest.dev/) (高速なユニットテスト)
  - Chrome DevTools Protocol (CDP) を直接操作するカスタムE2Eテストスクリプト (`scripts/cdp-e2e.mjs`)

---

## 📂 ディレクトリ構造

```text
BOVisualizer/
├── public/                  # 静的資産
│   ├── BOV_logo.png         # ロゴ画像
│   └── data/
│       ├── manifest.json    # サンプルデータおよび3Dモデルのマニフェスト
│       ├── models/          # 3Dモデルデータ (boat, left_oar, right_oar)
│       └── samples/         # CSV計測サンプルデータ (sample_1.csv 〜 )
├── scripts/
│   └── cdp-e2e.mjs          # CDPによるヘッドレス/E2E検証スクリプト
├── src/
│   ├── assets/              # スタイル等アセット
│   ├── components/          # Reactコンポーネント
│   │   ├── Scene.tsx               # 3Dシーン描画コンポーネント
│   │   ├── OarTrajectoryChart.tsx  # オール軌跡グラフ
│   │   ├── TimeSeriesChart.tsx     # 時系列センサーグラフ
│   │   ├── RowingMap.tsx           # GPSトラックマップ
│   │   ├── PlaybackControls.tsx    # 再生・設定UI
│   │   ├── MetricsBar.tsx          # 走行指標表示バー
│   │   └── ErrorBoundary.tsx       # 耐障害用エラーハンドラー
│   ├── hooks/               # カスタムフック (AnimationClock, Dataset読み込み等)
│   ├── scene/               # 3Dシーン用定数定義
│   ├── store/               # Zustandを用いた再生状態・データ永続化管理
│   ├── test/                # 単体テスト群 (座標変換、軌跡計算、CSVパーサー等)
│   ├── types/               # TypeScript共通型定義
│   └── utils/               # 座標計算・物理値変換・CSV解析の純粋関数群
├── package.json             # 依存パッケージ定義
├── tsconfig.json            # TypeScript設定
└── vite.config.ts           # Viteビルド設定
```

---

## 🚀 起動手順

### 1. 依存関係のインストール

プロジェクトのルートディレクトリで以下を実行します。

```bash
cd /home/koki/BOVisualizer
npm install
```

### 2. 開発サーバーの起動

```bash
npm run dev
```

起動後、コンソールに表示されるURL（デフォルトは `http://localhost:5173`）にブラウザでアクセスします。

### 3. プロダクションビルドの確認

```bash
npm run build
```

---

## 🧪 テスト・検証

品質を保証するために、各種テストツールが統合されています。

- **単体テスト (Unit Tests)**
  座標系変換モジュール、CSVパーサ、軌跡演算エンジンのテストを Vitest で実行します。
  ```bash
  npm run test
  ```

- **E2Eテスト (Chrome DevTools Protocol)**
  Chrome DevTools Protocol (CDP) を使用して、実際にブラウザ上で3Dシーンのローディングやアニメーション動作、エラーハンドリングをシミュレーションテストします。
  ```bash
  npm run e2e:cdp
  ```

- **コードスタイルチェック**
  ```bash
  npm run lint
  ```

---

## 📊 CSVデータフォーマット仕様

独自のカスタムデータをロードする場合、CSVファイルは以下の仕様を満たしている必要があります。

### 1. 構成ルール
- **1行目**: `Measurement Mode: <任意のモード名>` であること。(例: `Measurement Mode: Standard`)
- **2行目**: カンマ区切りのヘッダー行。
- **3行目以降**: カンマ区切りの数値/文字列データ行。

### 2. 推奨されるヘッダー名と役割

| ヘッダーキー | データ型 | 説明 |
| :--- | :--- | :--- |
| `number` | 整数 | フレーム番号（連番） |
| `time` | 日時文字列 | 計測された実時刻（ISO format 推奨。経過秒算出に使用） |
| `latitude` | 実数 | GPS 緯度 (Degree Decimal) |
| `longitude` | 実数 | GPS 経度 (Degree Decimal) |
| `SPM` | 実数 | ストローク毎分 (Strokes Per Minute) |
| `SPLIT` | 実数 | スプリットタイム（速度指標） |
| `speed` | 実数 | 移動速度 |
| `accx`, `accy`, `accz` | 実数 | ボート搭載IMUの3軸加速度 |
| `gyrox`, `gyroy`, `gyroz` | 実数 | ボート搭載IMUの3軸角速度 |
| `wb`, `xb`, `yb`, `zb` | 実数 | ボートのクォータニオン姿勢データ ($w, x, y, z$) |
| `wol`, `xol`, `yol`, `zol` | 実数 | 左オールのクォータニオンデータ |
| `wor`, `xor`, `yor`, `zor` | 実数 | 右オールのクォータニオンデータ |
| `err_deg_boat_z` | 実数 | ボートのZ軸基準補正角（度） |
| `err_deg_oar_left_z` | 実数 | 左オールのZ軸補正角（度） |
| `err_deg_oar_right_z` | 実数 | 右オールのZ軸補正角（度） |

*※一部の列が存在しない場合、3D表示や一部グラフが自動で縮退モード（非表示またはエラーフォールバック）で動作します。*

---
© 2026 BOVisualizer Development Team

