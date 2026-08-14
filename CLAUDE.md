# Claude Code Instructions

このRepositoryでは，CodexとClaude Codeで別々の開発規則を管理しない．共通のAgent入口としてルート `AGENTS.md` を使用する．

@AGENTS.md

Claude Codeは作業開始時に上記指示を確認し，`AGENTS.md` が指定するtask別の `agent/` 文書を必要に応じて読むこと．

## BOVisualizer固有の確認

- 機能仕様の正本は `agent/SYSTEM_SPEC.md` とする．
- プロジェクト前提は `agent/PROJECT_CONTEXT.md` を確認する．
- React/TypeScript/Viteの実装変更では `agent/DEVELOPMENT_RULES.md` を確認する．
- CSV，外部入力，fetch，filesystem等では `agent/SECURITY_RULES.md` を確認する．
- PR reviewでは `agent/REVIEW_RULES.md` を確認する．
- 完了報告前に `agent/DEFINITION_OF_DONE.md` を確認する．

`CLAUDE.md`へ詳細規則を複製しない．変更が必要な場合は `AGENTS.md` または該当する `agent/` 文書の正本へ反映する．
