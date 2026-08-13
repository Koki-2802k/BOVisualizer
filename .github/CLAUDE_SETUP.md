# Claude Code GitHub Actions Setup

BOVisualizerには，`bottle_detected` と同じClaude Code GitHub Actions構成を導入する．

- `.github/workflows/claude.yml`
  - Issue / PR上の `@claude` 指示を処理する
- `.github/workflows/claude-code-review.yml`
  - Pull Requestのopen / synchronize / ready_for_review / reopen時にClaude Code Reviewを実行する
- `CLAUDE.md`
  - Claude Codeが自動読込するproject instructionsとして，`@AGENTS.md` を通じて共通Agent規則へ接続する

## 必要なRepository設定

両Workflowは以下のRepository Secretを参照する．

```text
CLAUDE_CODE_OAUTH_TOKEN
```

GitHub Repositoryで `Settings` → `Secrets and variables` → `Actions` を開き，`CLAUDE_CODE_OAUTH_TOKEN` が設定されていることを確認する．Secret値をsource code，commit，Issue，PR，logへ記録しない．

Claude Code GitHub Actionに必要なApp authorizationがBOVisualizerへ適用されていることも確認する．

## Review policy

Claude Codeはroot `CLAUDE.md` → `AGENTS.md` を入口とし，レビュー時は特に以下を確認する．

- `agent/PROJECT_CONTEXT.md`
- `agent/SYSTEM_SPEC.md`
- `agent/QUALITY_RULES.md`
- `agent/TESTING_RULES.md`
- `agent/SECURITY_RULES.md`
- `agent/DEPENDENCY_RULES.md`
- `agent/REVIEW_RULES.md`
- `agent/DEFINITION_OF_DONE.md`

Claudeのレビュー結果は補助レビューであり，仕様変更を自動承認するものではない．

## 動作確認

1. 本branchからPRを作成し，`Claude Code Review` workflowが起動することを確認する．
2. IssueまたはPRで `@claude この変更をAGENTS.mdとagent/SYSTEM_SPEC.mdに照らしてレビューしてください` のようにコメントし，`Claude Code` workflowが起動することを確認する．
3. 失敗時はOAuth token，App authorization，Actions permissions，workflow YAML，Claude Action本体を切り分ける．
