# BOVisualizer — パネル全画面拡大機能 引き継ぎメモ

## 実装した機能（動作済み）

### パネルフィーチャー（全画面拡大）基本機能
- **ダブルクリックで拡大**: 各パネルのタブ行（ヘッダー div）をダブルクリックすると `expandedPanel` state がそのパネルIDにセットされる
- **× ボタンで閉じる**: 拡大中のパネル右上に `✕` ボタンが出現し、クリックで通常表示に戻る
- **Esc キーでも閉じる**: キーボードショートカット（`handleKeyDown` useEffect 内に実装済み）
- **データセット切り替えで拡大状態が解除されない**: `expandedPanel` と `selectedDatasetId` は独立した state のため、ストローク切り替えをしても拡大が維持される
- **将来タブが増えても対応**: ヘッダー div に `onDoubleClick` を付けているため、その div 内に新しいタブボタンを追加するだけで自動的に拡大対象になる

### その他修正済み
- `TimeSeriesChart.tsx` / `OarTrajectoryChart.tsx`: ResizeObserver コールバック内でキャンバスサイズキャッシュをリセットするよう修正（`canvasSizeRef.current = { w: 0, h: 0 }`）
- `RowingMap.tsx`: `MapInvalidator` コンポーネントを追加（ResizeObserver → `map.invalidateSize()`）

---

## 未解決の問題（すべてウィンドウサイズ関連）

### 問題1: 高さが伸びず横幅のみ2倍になる（全パネル共通）

**期待**: ダブルクリックで横幅2倍・高さ2倍（4パネル分）に拡大  
**実際**: 横幅のみ2倍、高さは元のまま

**原因の仮説**  
`grid-template-areas` による名前付き配置（`grid-area: map` 等）がグリッドアイテムの行位置をピン留めしており、後から設定した `gridRow: '1 / -1'` のインラインスタイルが行方向には効いていない可能性がある。列方向（`gridColumn`）は効いているため、行方向にのみ何らかのブラウザ挙動の違いがある。

**試したアプローチ（すべて高さ修正には失敗）**
1. `grid-column: 1/-1; grid-row: 1/-1` を CSS に追加（名前付きエリアが優先され高さ変わらず）
2. `grid-row-start: 1 !important; grid-row-end: -1 !important` をロングハンドで指定（同様に効かず）
3. `position: absolute; top:0; left:0; right:0; bottom:0` でグリッドから外す → グリッドが高さ0に縮んでパネルが完全非表示になった（リバート済み）
4. React インラインスタイルで `style={{ gridRow: '1 / -1', gridColumn: '1 / -1' }}` → 現在の実装。横幅は正しく2倍になるが高さは依然変化なし

**現在の実装の場所**  
`src/App.tsx` の `expandedStyle` 定数：
```tsx
const expandedStyle: React.CSSProperties = {
  gridRow: '1 / -1',
  gridColumn: '1 / -1',
  zIndex: 50,
};
```
各 `<section>` タグに `style={expandedPanel === 'panelId' ? expandedStyle : undefined}` として適用。

**次に試すべきアプローチの候補**
- `.dashboard-grid` の `grid-template-rows` を動的に変更する（`expandedPanel` がセットされたとき `'1fr 1fr'` → `'1fr'` にして行を1本にするなど）
- `dashboard-grid` に `height: Xpx` を動的に計算してセットする
- パネルを `position: absolute` にしつつ、親グリッドが潰れないよう `dashboard-grid` に `min-height: Ypx` を動的設定する
- Three.js（Scene）/ Recharts などが wrapper の高さを内部的に固定してしまっていないか調査する

---

### 問題2: グラフ・チャートがコンテナサイズに追従しない

**期待**: 拡大後にキャンバスベースのグラフ（TimeSeriesChart、OarTrajectoryChart）および Three.js（Scene）がパネルの新サイズに合わせてリサイズされる  
**実際**: 横幅は広がるが高さはリサイズされない（問題1で高さが変わらないためとも考えられる）

**関連ファイル**
- `src/components/TimeSeriesChart.tsx`: Canvas + ResizeObserver。ResizeObserver キャッシュバグは修正済みだが、高さが変化しないためリサイズが発生しない
- `src/components/OarTrajectoryChart.tsx`: 同上
- `src/components/Scene.tsx`: Three.js（未調査）

---

### 問題3: GPS地図が拡大時に表示されない

**期待**: 拡大後もマップが正常に表示される  
**実際**: 地図部分だけが白紙・非表示になる（ヘッダーのタブは見える）

**原因**  
Leaflet（react-leaflet）は初期化時のコンテナサイズをキャッシュする。コンテナが拡大後に `invalidateSize()` を呼んでも初期化自体が誤ったサイズで行われていると再描画できない。

**試したアプローチ**
1. `MapInvalidator` コンポーネント（ResizeObserver → `map.invalidateSize()`）→ 効果なし
2. `key={String(expandedPanel === 'map')}` で再マウント → 現在の実装だが依然表示されない

**次に試すべきアプローチ**
- `key` の値をユニークなものにして（例: カウンター）、拡大のたびに確実に再マウントする
- `MapContainer` の `style` を動的に変更してサイズを強制リセットする
- `react-leaflet` のバージョン固有の挙動を確認する

---

### 問題4: 時系列グラフでタブ切り替え後にパネルが異常なサイズになる

**症状**: 拡大中にメトリクスタブに切り替え → 時系列グラフタブに戻す → パネルサイズが崩れる（4つ分とも言えないが異常なサイズ）  
**原因**: 高さ問題（問題1）と Canvas キャッシュ問題（問題2）の複合。問題1が解決すれば連動して改善する可能性が高い

---

## ファイル変更一覧

| ファイル | 変更内容 |
|---|---|
| `src/App.tsx` | `expandedPanel` state、`handleExpandPanel`・`handleCloseExpanded` ハンドラ、各パネルへの `onDoubleClick`・close ボタン・`style` props、`expandedStyle` 定数、Esc キーハンドラ、RowingMap の `key` prop |
| `src/App.css` | `.panel-featured`（z-index のみ）、`.dashboard-grid.has-featured .panel:not(.panel-featured) { display: none }`、`.panel-close-btn` スタイル追加 |
| `src/components/TimeSeriesChart.tsx` | ResizeObserver コールバックで `canvasSizeRef.current = { w: 0, h: 0 }` を追加 |
| `src/components/OarTrajectoryChart.tsx` | 同上 |
| `src/components/RowingMap.tsx` | `MapInvalidator` コンポーネント追加、`<MapContainer>` 内に `<MapInvalidator />` 挿入 |

---

## グリッドレイアウト構造メモ

```
.app-shell (grid, 100vh, rows: auto auto 1fr)
  └─ <PlaybackControls>       ← row 1 (auto) ＝ ツールバー（常時表示）
  └─ .dashboard-area          ← row 2 か 3（要確認）
       └─ .dashboard-grid (grid, 2col × 2row, grid-template-areas)
            ├─ .map-wrapper      (grid-area: map      = 上左)
            ├─ .oar-wrapper      (grid-area: oar      = 上右)
            ├─ .scene-wrapper    (grid-area: scene    = 下左)
            └─ .timeseries-wrapper (grid-area: timeseries = 下右)
```

`app-shell` が `grid-template-rows: auto auto minmax(0, 1fr)` で3行を定義しているが、直接の子要素は `PlaybackControls` と `dashboard-area` の2つのみ。`dashboard-area` が実際に何行目に配置されているか（`auto` 行か `1fr` 行か）の確認が、高さ問題のデバッグにおいて重要かもしれない。

---

## 参考: 現在の panel-featured 判定ロジック

```tsx
// App.tsx 内
const [expandedPanel, setExpandedPanel] = useState<string | null>(null);
// パネルID: 'scene' | 'oar' | 'map' | 'timeseries'

// 各 <section> タグ
<section
  className={`panel map-wrapper${expandedPanel === 'map' ? ' panel-featured' : ''}`}
  style={expandedPanel === 'map' ? expandedStyle : undefined}
  aria-label="地図"
>
  {expandedPanel === 'map' && (
    <button className="panel-close-btn" onClick={handleCloseExpanded}>✕</button>
  )}
  {/* ... ヘッダー div に onDoubleClick={() => handleExpandPanel('map')} ... */}
</section>
```
