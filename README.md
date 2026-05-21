# rowing_project Web (Phase 1 Scaffold)

## 起動手順

```bash
cd /home/koki/BOVisualizer
npm install
npm run dev
```

ビルド確認:

```bash
npm run build
```

## データ配置

- CSV: `public/data/samples/sample_*.csv`
- 3Dモデル:
  - `public/data/models/boat/`
  - `public/data/models/left_oar/`
  - `public/data/models/right_oar/`
- マニフェスト: `public/data/manifest.json`

## 既存資産の取り扱い

本scaffoldでは、以下の既存資産を**コピー**して利用しています。コピー元のファイルは改変しません。

- `/home/koki/visualize_system/divided_data/sample_*.csv`
- `/home/koki/visualize_system/3d_data/boat/*`
- `/home/koki/visualize_system/3d_data/left_oar/*`
- `/home/koki/visualize_system/3d_data/right_oar/*`

## 補足

- 本フェーズは基盤構築のみで、画面機能は次フェーズで実装します。
