# SYSTEM_SPEC

## Purpose

本ファイルはBOVisualizerのAIエージェント向け機能仕様の要約である．詳細設計は `doc/DETAIL.md`，ユーザー向け説明は `README.md` を参照する．仕様変更時は実装だけでなく必要な文書も更新する．

## Delivery model

1. BOVisualizerはGitHub Pagesへ配置するclient-side onlyの静的SPAである．
2. production buildは `dist/` の静的fileだけで動作し，application serverやcloud runtimeを要求しない．
3. GCP，Cloud Run，Firebase，serverless function，専用API/backend，database等を導入する変更は，ユーザーの明示的な仕様変更なしに行わない．
4. Dockerはローカル検証を再現するための任意手段としてのみ扱い，production architectureへ含めない．
5. asset URLはGitHub Pagesのbase pathを考慮し，既存の `import.meta.env.BASE_URL` 方針を維持する．

## Functional invariants

1. センサーデータとGPSデータを同一タイムライン上で再生し，3D表示・地図・グラフ・解析表示を同期させる．
2. ローカルCSVとマニフェスト定義データセットの双方を扱えること．
3. CSV列の一部が存在しない場合は，全体を失敗させず利用可能な機能へ縮退する．
4. 3D姿勢はボート，左オール，右オールのクォータニオンと補正角から導出する．
5. GPSは緯度経度を表示し，必要な計算では既存の座標変換ユーティリティを利用する．
6. ストローク解析・軌跡計算・メトリクス導出はUIから分離し，純粋関数またはdomain layerに置く．
7. 再生フレーム，FPS，データセット選択，表示設定等の共有状態はZustand storeへ集約する．

## Architecture rules

- Data layer: `src/data/*`
- Domain layer: `src/domain/*`, pure computation in `src/utils/*`
- State layer: `src/store/*`
- View layer: `src/components/*`

上位層の都合を下位層へ持ち込まない．特にDOM/React依存をdomain/utilへ追加しない．

server layerやcloud adapterをこの依存関係へ追加せず，外部データはbrowserのfile APIまたは静的resourceへのfetchを通じてdata layerへ入力する．

## Data compatibility

既存CSVで利用される `number`, `time`, GPS，SPM/SPLIT/speed，加速度・角速度，boat/oar quaternion，補正角等の列を破壊的に変更しない．列名変更が必要な場合は互換層を設けるか明示的なmigrationを伴わせる．

## Performance

- frameごとのrenderで重い全データ解析を再実行しない．
- dataset単位の解析は既存キャッシュを利用する．
- React render内で大規模配列を不必要に再生成しない．
- 3D animation loopではallocationとstate更新を最小化する．

## UI

- 既存の主要可視化パネルを維持する．
- 操作と表示の意味が変わるUI変更は，見た目だけの変更として扱わない．
- responsive layoutを壊さない．
- 3D/GPS/chartの表示不可能時は，silent failureではなく既存のerror/fallback方針に従う．

## Specification changes

仕様変更が必要な場合は，変更理由，ユーザー影響，互換性，テスト方法を明示する．ユーザー要求と矛盾する仕様をエージェント判断だけで採用しない．
