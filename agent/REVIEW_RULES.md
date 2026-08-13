# REVIEW_RULES

PR reviewでは，単なるstyle指摘よりも挙動・互換性・安全性・検証不足を優先する．

## Priority

1. ユーザー要求・`SYSTEM_SPEC.md`との矛盾
2. CSV互換性，3D/GPS/chart同期，再生挙動のregression
3. data/domain/store/viewの依存方向違反
4. TypeScript型安全性，React hook/stateの不具合
5. performance regression，特にanimation loopと大規模配列解析
6. security，secret，外部入力処理
7. test不足
8. readability / naming / documentation

## Review comments

- 問題が起きる条件と影響を具体的に書く．
- 推測だけでblockerにしない．
- 既存仕様を変更する提案は，単なるfixと区別する．
- 自動生成reviewは補助であり，仕様変更を自動承認するものではない．
