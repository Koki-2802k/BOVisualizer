# PLAN — 加速度積分による速度推定（実測値／積分値の切替）

> **目的**: GPS 由来の `speed` がセンサ仕様上 **1 fps** しか更新されない問題を解消するため、
> 高サンプリング（≈60 Hz）の加速度 `accx` を時間積分して **滑らかな速度系列** を生成し、
> 時系列グラフの速度表示に用いる。設定オプションで **実測値（measured）／積分値（integrated）** を
> 切替可能とし、**デフォルトは積分値** とする。
>
> **対象読者**: 本機能を実装する開発者。`doc/DETAIL.md` の 4 層アーキテクチャ・拡張ポイントを前提とする。
> **作成日**: 2026-06-18

---

## 1. 背景・課題

| 項目 | 現状 |
| :--- | :--- |
| `speed` 列 | GPS 由来。**約 1 Hz** でしか更新されず、60 Hz の各フレームには同一値が保持される（`sample_1.csv` で確認: 連続 4 フレームが `3.0976...` で一定）。 |
| `accx` 列 | ボート IMU の前後（進行）方向加速度 [m/s²]。**約 60 Hz**（タイムスタンプ差 ≈ 0.0167 s）。ストローク内のチェック／ランの動態を含む。 |
| 時系列グラフ | `TimeSeriesChart.tsx` の `speed` モードが `frame.speed` を直接描画 → **階段状（1 Hz）** で、ストローク内変動が見えない。 |

**狙い**: `accx` を積分して **ストローク内の速度プロファイル**（キャッチでの減速＝チェック、リカバリーでの伸び＝ラン）を可視化する。これは `IDEA_NEWFUNC.md` の機能 5「艇速の周期変動解析」の基盤にもなる。

---

## 2. 積分手法

### 2.1 素朴な積分の問題点

離散台形積分

```
v[n] = v[0] + Σ_{k=1..n} (a[k] + a[k-1]) / 2 · dt[k]
```

をそのまま適用すると、加速度センサの **バイアス（オフセット）** が時間に比例して累積し（ドリフト）、ノイズはランダムウォークとして発散する。`accx` は平均が 0 ではなく明確なオフセットを含む（`sample_1.csv` で −4〜−1 m/s² 程度に偏る）ため、無補正の積分は数十秒で実速度から大きく乖離する。**そのため、ドリフト補正が必須。**

### 2.2 採用方式 — GPS アンカーによる区間線形ドリフト補正（2-pass / オフライン）

本システムは **録画済み CSV を後から再生する** オフライン可視化であり、かつ **1 Hz の GPS 実速度という真値（アンカー）** を持つ。これを使い、加速度の高周波成分（ストローク内形状）と GPS の低周波真値（区間平均速度）を融合する。実装が単純で頑健、かつ全アンカーを必ず通過する点が利点。

**手順**:

1. **時間刻み `dt[n]` の決定**
   既存 `metrics.ts buildTimeAxis` と同一ロジック: `time_s` があれば優先、無ければ `time`（ISO 文字列）の差分、いずれも無ければ `1/60` s フォールバック。

2. **加速度の前処理**
   - 進行方向成分 `a[n] = accx[n]` を使用。
   - （推奨拡張）ボートクォータニオン `wb,xb,yb,zb` で IMU 加速度ベクトルをワールド系へ回転し、重力 `g` を除去した水平前後成分を用いると、ピッチによる重力漏れを抑えられる（`coordTransform.ts` の既存クォータニオン演算を再利用。初版では `accx` 直接でも可）。

3. **GPS アンカーの抽出**
   `speed` 列が **値変化した最初のフレーム** をアンカー点 `t_k`（実速度 `v_gps(t_k)`）として列挙する（1 Hz で値が変わるため、保持された同一値の先頭を 1 アンカーとする）。GPS 欠損（`null`）区間はアンカーをスキップ。

4. **区間積分（生）**
   各隣接アンカー `t_k → t_{k+1}` の間を、`v_raw(t_k) = v_gps(t_k)` を初期値として台形積分し `v_raw[n]` を得る。

5. **区間線形デドリフト（端点拘束）**
   区間終端 `t_{k+1}` で積分値の誤差
   `e = v_raw(t_{k+1}) − v_gps(t_{k+1})`
   を、区間内で **経過時間に比例して線形に差し引く**:

   ```
   v[n] = v_raw[n] − e · (t[n] − t_k) / (t_{k+1} − t_k)
   ```

   これにより補正後の速度系列は **全 GPS アンカーを必ず通過** しつつ、アンカー間ではストローク内の高周波形状を保持する。バイアス起因の線形ドリフトはこの線形デランプで相殺される。

6. **端の処理**
   - 最初のアンカーより前: `v_gps(最初)` を初期値に前方積分（または同値保持）。
   - 最後のアンカーより後: 直近誤差勾配を据え置いて外挿、または `v_gps(最後)` 保持。
   - アンカーが 1 個以下: デドリフト不可。`v_gps` 一定値 ＋ 加速度の高周波成分（平均除去後）を重畳して表示し、`measured` と大差ない旨をログ。

### 2.3 代替・将来拡張（記録のみ）

- **相補フィルタ（因果・リアルタイム向き）**: `v[n] = (1−k)(v[n−1] + a[n]·dt) + k·v_gps[n]`。`IDEA_NEWFUNC.md` 機能 10（リアルタイム入力）導入時はこちらが適する。
- **カルマン/RTS スムーザ**: より厳密だが本可視化用途には過剰。区間線形デドリフトで十分。

---

## 3. 実装計画（4 層アーキテクチャ準拠）

> **原則**: `DETAIL.md` の拡張ポイントに従い、計算は **ドメイン層のアナライザー**、状態は **viewSlice**、表示は **コンポーネント** に分離する。View 層での生データ積分ループの直書きは禁止。

### 3.1 ドメイン層 — 速度アナライザー新設（拡張ポイント①）

**新規** `src/domain/analyzers/velocityAnalyzer.ts`

```ts
import type { Analyzer, AnalysisInput } from './types';

export interface VelocityResult {
  /** arrayIndex に整列した積分速度 [m/s]（null = 算出不可） */
  integrated: (number | null)[];
  /** 実測（GPS 保持）速度 [m/s]。比較・フォールバック用 */
  measured: (number | null)[];
  anchorCount: number;   // 使用した GPS アンカー数
  usable: boolean;       // アンカー >= 2 で true
}

export const velocityAnalyzer: Analyzer<VelocityResult> = {
  id: 'velocity',
  label: '速度（加速度積分）',
  compute({ normalizedFrames }: AnalysisInput): VelocityResult {
    // 1) dt 配列  2) accx 取得  3) GPS アンカー抽出
    // 4) 区間台形積分  5) 区間線形デドリフト  6) 端処理
    // ※ buildTimeAxis と同等の時刻ロジックを共有（重複回避のため utils へ切出し可）
  },
};
```

`src/domain/analyzers/index.ts` の `ANALYZERS` 配列に `velocityAnalyzer` を追加 → `analysis.extra.get('velocity')` で型付き取得可能（`analysisRepository.ts` が自動実行・キャッシュ）。

> 純粋積分ロジックは `src/utils/velocityIntegration.ts` に副作用なし関数として切り出し、Vitest で単体テストする（`metrics.ts` 等と同様の公開ラッパー＋内部実装パターン）。

### 3.2 状態層 — 速度ソース設定（拡張ポイント④）

**編集** `src/store/slices/viewSlice.ts`

```ts
export type SpeedSource = 'measured' | 'integrated';
// ViewSlice 型に追加
speedSource: SpeedSource;
setSpeedSource: (s: SpeedSource) => void;
// 初期値（デフォルト積分値）
speedSource: 'integrated',
setSpeedSource: (speedSource) => set({ speedSource }),
```

（DS 切替時のリセット対象に含めるかは任意。基本は維持で良い。）

### 3.3 配線 — useAnalysis → App → TimeSeriesChart

- `src/hooks/useAnalysis.ts`: 既存の `analysis` から `velocity` 結果を取り出し、`App.tsx` へ渡す（既にキャッシュ済みのため追加計算なし）。
- `src/App.tsx`: `usePlaybackStore` から `speedSource` を取得し、`velocity` 結果と共に `TimeSeriesChart` の props へ流す。

### 3.4 表示層 — TimeSeriesChart の速度モード切替

**編集** `src/components/TimeSeriesChart.tsx`

- Props 追加: `speedSeries?: (number|null)[]`（選択済みソースの配列、`App` 側で `speedSource` により `integrated`／`measured` を選択して渡す）と `speedSource?: SpeedSource`。
- `buildTimeSeriesData` 内の `speed` 値を、`frame.speed` 直読みではなく **arrayIndex に対応する `speedSeries[index]`** から取得するよう変更。
- 凡例／単位ラベルに現在のソース（例: `speed (積分)` / `speed (実測)`）を併記し、どちらを見ているか明示。
- `Y_DOMAINS.speed` は実速度レンジに収まるため現状 `[0, 5]` のまま流用可（必要なら自動スケール）。

### 3.5 UI — 設定トグル

**編集** `src/components/PlaybackControls.tsx`（設定ポップオーバー内）

- 「速度ソース」セグメント or ラジオ: **積分値（推奨・既定）／実測値**。`setSpeedSource` を呼ぶ。
- `graphMode === 'speed'` のときのみ意味を持つ旨の補足表示。

**編集（任意）** `src/components/MetricsBar.tsx`: 現在速度表示も選択ソースに追従させ、整合を取る。

---

## 4. テスト・検証計画

> `DETAIL.md §14` 準拠。**最終ステップに検証を必ず含める。**

1. **ユニットテスト（Vitest, `src/test/`）**
   - 既知の合成データで積分精度を検証: 一定加速度 `a` → `v = v0 + a·t` と一致（デドリフト無効時）。
   - **端点拘束**: 全 GPS アンカー点で `v[anchor] == v_gps[anchor]`（誤差 < 1e-9）。
   - **バイアス耐性**: `accx` に定数オフセットを足してもアンカー通過後の速度が不変（線形デドリフトで相殺）。
   - **退化系**: アンカー 0/1 個、GPS 全欠損、frames 空 → クラッシュせず `usable=false`。
   - `dt` ソース分岐（`time_s` / ISO `time` / フォールバック）の単体確認。
2. **スナップショット的確認**: 同一サンプル CSV で計算結果が再実行間で不変。
3. **ビルド**: `npm run build`（TypeScript エラー 0）。
4. **Lint**: `npm run lint`。
5. **E2E（CDP）**: `npm run e2e:cdp` — 速度グラフが階段状でなく滑らかに描画され、トグル切替で `measured`↔`integrated` が反映されることを確認。

---

## 5. 実装ステップ（チェックリスト）

1. 🔲 `src/utils/velocityIntegration.ts`（純粋関数）＋ Vitest テストを先に作成（TDD）。
2. 🔲 `src/domain/analyzers/velocityAnalyzer.ts` 実装 → `ANALYZERS` 登録。
3. 🔲 `viewSlice.ts` に `speedSource`（既定 `'integrated'`）＋ setter 追加。
4. 🔲 `useAnalysis` / `App.tsx` で `velocity` 結果と `speedSource` を `TimeSeriesChart` へ配線。
5. 🔲 `TimeSeriesChart.tsx` の速度モードを選択ソース駆動に変更（凡例にソース併記）。
6. 🔲 `PlaybackControls.tsx` に速度ソース切替 UI を追加。
7. 🔲 （推奨）クォータニオン回転による重力補償を `velocityIntegration` に追加。
8. 🔲 ビルド・Lint・ユニット・E2E をすべて通過させて完了。

---

## 6. 留意点

- **`arrayIndex` 基準で整列**: 速度配列は `csvNumber` ではなく `arrayIndex`（再生位置 `seekFrame`）に一致させる（`DETAIL.md §16.1`）。
- **キャッシュ**: 計算は `analysisRepository` 経由で frames 参照が同じ間キャッシュされる。コンポーネント内で frames を再生成しない（`§16.2`）。
- **単位**: `accx` [m/s²]、`speed` [m/s] を前提（`sample_1.csv` の SPLIT≒177s ↔ speed≒3 m/s と整合）。実データの単位が異なる場合はスケール係数を `velocityIntegration` に集約。
- **デフォルト挙動**: 積分値を既定とするが、アンカー不足等で `usable=false` の場合は自動的に `measured` へフォールバックし、その旨を UI に控えめに表示する。

---

*© 2026 BOVisualizer Development Team*
