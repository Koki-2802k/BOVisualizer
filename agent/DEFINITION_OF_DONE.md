# DEFINITION_OF_DONE

完了報告前に以下を確認する．

- ユーザー要求を満たしている．
- `PROJECT_CONTEXT.md` / `SYSTEM_SPEC.md` と矛盾していない．
- GitHub Pagesで動作する静的SPAの境界を維持し，不要なcloud/backend依存を追加していない．
- unrelated changeを含めていない．
- 型エラー・lint errorを残していない．
- 対象に応じたtestを追加または更新した．
- `npm run lint` を確認した．
- `npm run build` を確認した．
- `npm run test -- --run` を確認した．
- UI/3D/再生/データ読込変更では，可能なら `npm run e2e:cdp` を確認した．
- secretやcredentialがdiffへ含まれていない．
- 必要なdocumentationを更新した．
- 未検証事項，既知の制約，ユーザー側で必要な設定があれば明記した．

実行できなかったcheckを「問題なし」と扱わない．未実行理由を明示する．
