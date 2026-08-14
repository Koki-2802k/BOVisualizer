# SECURITY_RULES

- secret，API key，OAuth token，credentialをsource，sample data，Issue，PR，logへ記録しない．
- ユーザーが読み込むCSVやローカルファイルはtrusted inputと仮定しない．
- file name，CSV field，manifest URL等をDOMへ表示する際はReactの標準escapeを迂回しない．
- `dangerouslySetInnerHTML`，動的script実行，`eval`等を追加しない．
- 外部fetch先やasset URLを追加する場合は，必要性とoriginを確認する．
- cloud SDK，credential，server用secretを必要とする構成を追加しない．BOVisualizerのproduction buildはsecretなしで動作させる．
- dependency追加時はmaintenance状況，license，既知脆弱性，bundle影響を確認する．
