# DEVELOPMENT_RULES

- 変更範囲をタスクに必要な最小限へ限定する．
- React componentへ解析ロジックを埋め込まず，domain/utils/hooksへ適切に分離する．
- `src/data` → `src/domain` → `src/store` → `src/components` の依存方向を維持する．
- 既存の型を優先して利用し，`any`の追加を避ける．
- 重い計算はrenderやanimation loopで繰り返さず，memoization/cacheを利用する．
- 既存CSV互換性と3D/GPS/chart同期を破壊しない．
- 新規UIはkeyboard操作，resize，error/fallbackも考慮する．
- magic numberは意味のある定数へ切り出す．
- 不要になった旧実装はGit履歴をbackupとして削除してよい．
- 変更後はlint/build/testを実行し，表示系の変更は可能ならE2Eでも確認する．
