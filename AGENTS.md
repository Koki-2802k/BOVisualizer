# AGENTS.md

このリポジトリで作業するCodex CLIおよびAIコーディングエージェントは，作業開始時に本ファイルを読み，**タスクに必要な規則だけを `agent/` から追加で読む**こと．すべての規則を毎回無条件に読み込まず，関係する規則を選ぶ．

## 常に確認する

1. `agent/PROJECT_CONTEXT.md`
2. 機能挙動・データ処理・UI仕様に関係する変更では `agent/SYSTEM_SPEC.md`

## タスク別の参照先

| 作業 | 参照するファイル |
| --- | --- |
| 実装・設計変更 | `agent/DEVELOPMENT_RULES.md` |
| 新しいfile / class / function等の追加 | `agent/NAMING_CONVENTIONS.md` |
| format / lint / type check | `agent/QUALITY_RULES.md` |
| test追加・変更 | `agent/TESTING_RULES.md` |
| commit / push / branch操作 | `agent/GIT_WORKFLOW.md` |
| PR作成・review | `agent/REVIEW_RULES.md` |
| package / library / external asset等の追加 | `agent/DEPENDENCY_RULES.md` |
| 外部入力，fetch，filesystem，secret，GitHub Actions等 | `agent/SECURITY_RULES.md` |
| Markdownや設計文書の更新 | `agent/DOCUMENTATION_RULES.md` |
| README変更 | `agent/README_GUIDE.md` |
| 完了報告の直前 | `agent/DEFINITION_OF_DONE.md` |

## 優先順位

指示が矛盾する場合は以下の順に扱う．

1. ユーザーの今回の明示的な要求
2. `agent/SYSTEM_SPEC.md` の承認済み仕様
3. `agent/PROJECT_CONTEXT.md` のプロジェクト固有制約
4. `agent/` 以下の開発規則
5. 既存コードの慣習

## 基本原則

- 現在のタスクに関係しない「ついでの改善」を行わない．
- `src/data` → `src/domain` → `src/store` → `src/components` の依存方向を崩さない．
- 既存の可視化挙動，CSV互換性，3D/GPS/グラフ同期を壊さない．
- Git履歴をbackupとして利用し，`.bak`や`old_`等のbackup copyを作らない．
- secret，API key，token，credentialをsource，log，commitへ含めない．
- 新規dependencyは既存依存・Web標準機能で代替できないか先に確認する．
- 変更後は対象に応じて `npm run lint`，`npm run build`，`npm run test -- --run`，必要なら `npm run e2e:cdp` を実行する．
- 「コードを書いた」だけで完了とせず，`agent/DEFINITION_OF_DONE.md`を確認する．

詳細は各規則ファイルを正本とする．
