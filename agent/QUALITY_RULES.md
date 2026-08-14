# QUALITY_RULES

## Required checks

変更内容に応じて以下を実行する．

```bash
npm run lint
npm run build
npm run test -- --run
```

`npm run build` ではGitHub Pagesへ配置する静的成果物が生成されることを確認する．cloud環境へのdeployや接続確認は通常の完了条件に含めない．

UI・3D・データ読込・再生挙動に影響する変更では，環境が利用可能なら次も実行する．

```bash
npm run e2e:cdp
```

これらはhost上または任意のDocker環境で実行できる．Docker固有の結果だけでbrowser上の確認を代替しない．

## TypeScript

- 新規の型エラーを残さない．
- 不要な`any`，型アサーション，non-null assertionを増やさない．
- public APIや共有データ構造の変更では型定義と利用箇所を同時に更新する．

## React

- hookの依存配列を正しく保つ．
- render中の副作用を禁止する．
- 不要なglobal state化を避ける．
- animation loopでReact stateを高頻度更新しない．

## Completion

checkを実行できなかった場合は，未実行理由を完了報告に明記する．
