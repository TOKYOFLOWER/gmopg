# GMO-PG リンクタイプPlus 決済URL発行システム

旧 `card.php?amount=XXX&jiyu1=YYY` 方式の置換。
社内スタッフが金額・自由項目を入力 → 決済URLを発行 → お客様にメール/LINEで送信 → お客様が決済画面で支払い完了、までを自動化する。

## アーキテクチャ

```
┌──────────────────┐       ┌─────────────────────┐       ┌─────────────────┐
│ 社内スタッフ          │       │ GitHub Pages          │       │ GAS WebApp        │
│ (PC/Mobile)      │──①──▶│ (TOKYOFLOWER配下)     │──②──▶│ doPost(発行)        │
│                  │       │ /docs/internal/       │       │                 │
└──────────────────┘       └─────────────────────┘       └────────┬────────┘
                                                                   │
                                                                   ③ ShopPass取得
                                                                   ④ OrderID採番
                                                                   ⑤ Sheets記録
                                                                   ⑥ GMO API呼出
                                                                   │
                                                          ┌────────▼────────┐
                                                          │ GMO-PG リンクタイプPlus│
                                                          │ pt01.mul-pay.jp │
                                                          └────────┬────────┘
                                                                   │
                                                                   ⑦ LinkUrl返却
                                                                   │
┌──────────────────┐       ┌─────────────────────┐       ┌────────▼────────┐
│ お客様(購入者)        │       │ GMO決済画面           │       │ GAS から          │
│                  │◀─⑧──┤ pt01.mul-pay.jp     │◀──────┤ LinkUrlを返す      │
│                  │       │ (4パターン×8色)       │       │                 │
└────────┬─────────┘       └──────────┬──────────┘       └─────────────────┘
         │                            │
         ⑨ カード入力                 ⑩ 結果通知(プッシュ)
         │                            │
         ▼                            ▼
   決済完了画面                  ┌──────────────────┐
   (GitHub Pages)               │ GAS WebApp        │
                                │ doPost(通知受信)    │
                                │                  │
                                │ ・Sheets更新        │
                                │ ・ChatWork通知      │
                                └──────────────────┘
```

## ディレクトリ構成

```
gmopg/
├── README.md                       # このファイル
├── TASK.md                         # Claude Code向け作業指示書（メイン）
├── SETUP_GMO.md                    # GMO-PG契約・管理画面セットアップ手順
├── SETUP_GAS.md                    # GAS環境セットアップ手順
├── SETUP_GITHUB.md                 # GitHub Pages デプロイ手順
├── OPERATION.md                    # 社内運用マニュアル
├── SHEETS_SCHEMA.md                # Google Sheets スキーマ定義
├── docs/                           # GitHub Pages公開ディレクトリ
│   ├── internal/index.html         # 社内決済URL発行ページ
│   ├── return/index.html           # 決済完了後の戻りページ
│   └── error/index.html            # エラーページ
├── gas-src/                        # Google Apps Script ソース (clasp管理)
│   ├── appsscript.json
│   ├── Code.gs                     # メインエントリ・ルーティング
│   ├── Issue.gs                    # 決済URL発行
│   ├── Notify.gs                   # 結果通知受信
│   ├── GmoApi.gs                   # GMO API クライアント
│   ├── Sheets.gs                   # Sheets操作
│   ├── Auth.gs                     # 社内認証
│   ├── Notify_ChatWork.gs          # 通知送信(任意)
│   └── Constants.gs                # 共通定数
└── scripts/
    └── deploy.md                   # デプロイ手順メモ
```

## 利用技術

- **GMO-PG リンクタイプPlus（キー型）**: `GetLinkplusUrlPayment.json` API
- **Google Apps Script**: WebApp として2つ公開（発行用・結果通知用）
- **Google Sheets**: 注文ログ・決済ステータス管理
- **GitHub Pages**: 社内発行ページ・お客様戻りページの静的ホスティング
- **clasp**: GAS のローカル開発・デプロイ

## セキュリティ設計の核心

1. **ShopPassは GAS の PropertiesService にのみ格納**。GitHub Pages 側には絶対に置かない
2. **金額のサーバー側検証**: フロントから来た金額をそのまま使わず、Sheetsに事前登録した商品マスタとの整合チェック（カスタム金額の場合は社内認証で担保）
3. **社内ページの保護**: 共有シークレット + Origin チェック + IP制限（任意）
4. **OrderIDの一意性**: `yyyyMMddHHmmss + ランダム4桁` で採番、Sheets重複チェック
5. **結果通知の検証**: ShopID一致・Amount一致・Status=CAPTURE/AUTH を全部確認してから「決済済」更新
6. **3DS2.0必須**: TdFlag=2, Tds2Type=1
7. **クレデンシャルは絶対にコミットしない**: `.env` も `.clasp.json` も `.gitignore`

## 進行状況の追跡

[ ] Phase 0: GMO-PG契約・管理画面初期設定 (SETUP_GMO.md)
[ ] Phase 1: Google Sheets スプレッドシート作成 (SHEETS_SCHEMA.md)
[ ] Phase 2: GAS プロジェクト作成・clasp連携 (SETUP_GAS.md)
[ ] Phase 3: GAS実装・テスト環境（pt01）で疎通確認
[ ] Phase 4: GitHub Pages デプロイ
[ ] Phase 5: テスト環境でEnd-to-End テスト
[ ] Phase 6: 本番環境切替
[ ] Phase 7: 社内運用マニュアル展開・スタッフ研修
