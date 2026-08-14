# GIT_WORKFLOW

- `main`へ直接大きな変更を積まず，作業branchを利用する．
- branch名は目的が分かる短い名前にする．AI作業では `agent/<description>` を基本とする．
- unrelated changesを同じcommitへ混ぜない．
- commit messageは変更目的を簡潔に表す．
- force pushやhistory rewriteはユーザーの明示指示なしに行わない．
- PRには変更内容，理由，影響，実行した検証を記載する．
- deploy対象はGitHub Pagesの静的成果物とし，cloud provider用branchや環境設定を追加しない．
