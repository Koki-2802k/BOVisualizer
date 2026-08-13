# TESTING_RULES

- bug fixでは可能な限り再現testを先に追加する．
- 純粋計算，CSV parse，座標変換，ストローク解析等はVitestでunit testする．
- UI integration，データ読込，3D sceneのload，再生操作等は必要に応じて `scripts/cdp-e2e.mjs` を利用する．
- testは実装詳細よりユーザー観測可能な契約と数値変換の不変条件を検証する．
- 浮動小数点・クォータニオン・座標変換は厳密一致ではなく妥当なtoleranceを使う．
- 欠損列，不正値，空データ，短いデータセット等のedge caseを考慮する．
- testを通す目的でproduction codeの意味を弱めない．
