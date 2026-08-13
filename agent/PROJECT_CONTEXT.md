# PROJECT_CONTEXT

## Project

BOVisualizerは，Xsens DOT等のIMUセンサーとGPSから得たローイング計測データを，3Dシーン，GPS地図，時系列グラフ，オール軌跡，ストローク指標として同期可視化するReact/TypeScript Webアプリケーションである．

## Technology

- React 19 / TypeScript / Vite 8
- Zustandによる状態管理
- Three.js / React Three Fiber / Dreiによる3D可視化
- Leaflet / react-leafletによるGPS表示
- Rechartsによるチャート
- PapaParseによるCSV読込
- Vitestによるunit test
- CDPベースのE2E検証

## Architecture

主要な依存方向は次を維持する．

`src/data` → `src/domain` → `src/store` → `src/components`

- `src/data`: 外部データ取得と読込
- `src/domain`: 正規化，解析，純粋計算，キャッシュ
- `src/store`: 再生・データセット・表示状態
- `src/components`: UIと可視化
- `src/hooks`: 各層の橋渡しを行うが，UI固有処理と純粋ドメイン計算を混在させない

## Core behavior to preserve

- CSVロード後に3D，GPS，時系列，軌跡，メトリクスが同じ再生フレームに同期すること．
- 一部列が欠損したCSVでも，可能な機能だけを表示する縮退動作を維持すること．
- 3D表示ではボート・左右オールの姿勢計算と補正角の意味を変更しないこと．
- 計算量の大きい解析は `analysisRepository` 等の既存キャッシュ設計を尊重すること．
- UI変更でデータ処理ロジックをReact componentへ移さないこと．

## Source documents

現状仕様を確認する際は，コードに加えて以下を参照する．

- `README.md`
- `doc/DETAIL.md`
- `doc/HISTORY.md`
- `doc/PLAN.md`
- `doc/IDEA_NEWFUNC.md`

これらと実装が矛盾する場合は，ユーザー要求と最新実装の意図を確認し，暗黙にどちらかへ合わせない．
