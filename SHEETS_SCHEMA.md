# Google Sheets スキーマ定義

決済URL発行・決済結果を記録する Google Sheets の構造。

## スプレッドシート

- 名前: `GMO決済URL発行管理`
- 共有設定: 編集者 = とみぃさん本人 + 経理担当者程度に絞る（決済情報のため）
- GAS からのアクセス: スクリプトプロパティの `SHEETS_ID` に ID を登録

---

## シート1: `Orders` (注文ログ・本体)

決済URLを発行するたびに1行追加され、決済結果が来たら同じ行を更新する。

| 列 | カラム名 | データ型 | 説明 | 入力タイミング |
|---|---|---|---|---|
| A | 発行ID | string | UUIDv4 | 発行時 |
| B | 発行日時 | datetime | `yyyy-MM-dd HH:mm:ss` | 発行時 |
| C | 環境 | string | `test` or `prod` | 発行時 |
| D | スタッフ名 | string | 発行操作したスタッフ | 発行時 |
| E | お客様名 | string | 任意 | 発行時 |
| F | お客様メール | string | 任意（GMOからメール送付用） | 発行時 |
| G | 金額 | number | 円単位の整数 | 発行時 |
| H | 自由項目1 | string | 旧 jiyu1 相当 | 発行時 |
| I | 自由項目2 | string | 旧 jiyu2 相当 | 発行時 |
| J | メモ | string | 社内メモ | 発行時 |
| K | OrderID | string | GMO向けOrderID `yyyyMMddHHmmss-XXXX` | 発行時 |
| L | LinkUrl | string | GMO発行の決済URL | 発行時 |
| M | 有効期限 | datetime | LinkUrlの期限 | 発行時 |
| N | 決済ステータス | string | `ISSUED` / `AUTH` / `CAPTURE` / `CANCEL` / `EXPIRED` / `ERROR` | 更新 |
| O | 決済日時 | datetime | 結果通知受信日時 | 更新 |
| P | TranID | string | GMOの取引ID | 更新 |
| Q | AccessID | string | GMOのAccessID | 更新 |
| R | エラーコード | string | エラー時のみ | 更新 |
| S | 備考 | string | 手動メモ | 任意 |

### ステータス遷移
```
ISSUED ─┬─▶ AUTH ──▶ CAPTURE ──┐
        ├─▶ CAPTURE (即時売上)   ├─▶ CANCEL（管理画面手動）
        ├─▶ EXPIRED（期限切れ）  │
        └─▶ ERROR              │
```

---

## シート2: `ProductMaster` (商品マスタ・任意)

定型商品を事前登録しておくと、発行時に商品コード入力で自動で金額・商品名を引ける。

| 列 | カラム名 | データ型 | 説明 |
|---|---|---|---|
| A | 商品コード | string | 内部コード（例: `STAR3`） |
| B | 商品名 | string | 表示名（例: `スリースタンド`） |
| C | 単価 | number | 円単位 |
| D | 有効 | boolean | TRUE/FALSE |

例:
```
STAR1 | ワンスター         | 11000 | TRUE
STAR2 | ツースター         | 19000 | TRUE
STAR3 | スリースター       | 27000 | TRUE
WREATH| アレンジメント・大  | 8800  | TRUE
```

カスタム金額（マスタにない金額）も入力できる作りにする。

---

## シート3: `Settings` (設定値)

| 列 | カラム名 | データ型 | 説明 |
|---|---|---|---|
| A | キー | string | 設定キー |
| B | 値 | string/number | 設定値 |
| C | 説明 | string | 用途メモ |

初期値:
```
DEFAULT_EXPIRY_HOURS    | 168      | デフォルトの決済URL有効期限（時間）
SHOP_DISPLAY_NAME       | 銀座東京フラワー | 店舗表示名
SHOP_CONTACT_EMAIL      | info@tokyoflower.jp | 連絡先
SHOP_CONTACT_PHONE      | 03-XXXX-XXXX | 連絡先電話番号
NOTIFY_CHATWORK_ROOM    |          | ChatWork通知ルームID
NOTIFY_LINEWORKS_BOT    |          | LINE Works Bot トークン
EMAIL_TEMPLATE_SUBJECT  | 【銀座東京フラワー】お支払いのご案内 | 自動送信メール件名 |
EMAIL_TEMPLATE_BODY     | (テンプレ文字列) | 自動送信メール本文（後述）|
```

### EMAIL_TEMPLATE_BODY のサンプル

```
{{customerName}} 様

平素より銀座東京フラワーをご愛顧いただき、誠にありがとうございます。

ご注文いただきました内容のお支払いについて、下記URLよりお手続きをお願いいたします。

----------------------------------------
ご注文内容: {{free1}}
お支払金額: {{amount}}円
お支払期限: {{expiry}}
お支払いURL: {{linkUrl}}
----------------------------------------

ご不明な点がございましたら、下記までお問い合わせください。

銀座東京フラワー
TEL: 03-XXXX-XXXX
Email: info@tokyoflower.jp
```

---

## シート4: `Audit` (監査ログ)

セキュリティ・トラブルシュート用。発行・通知受信のすべてのアクションを記録。

| 列 | カラム名 | データ型 | 説明 |
|---|---|---|---|
| A | 日時 | datetime | |
| B | アクション | string | `ISSUE_REQUEST` / `ISSUE_SUCCESS` / `ISSUE_ERROR` / `NOTIFY_RECEIVED` / `NOTIFY_VERIFIED` / `NOTIFY_FAILED` / `AUTH_FAIL` |
| C | 実行者 | string | スタッフ名 or `GMO` |
| D | IP | string | リクエスト元IP |
| E | UserAgent | string | ブラウザ情報 |
| F | 詳細 | string | JSON形式の詳細データ |

ローテーション: 90日経過で月次バックアップ → 削除（GAS定期トリガで実装可能）。

---

## 命名・レイアウト規則

- 文字色: ステータスごとに条件付き書式
  - `ISSUED` = 黄色
  - `CAPTURE` = 緑
  - `ERROR` = 赤
  - `EXPIRED` = グレー
- フリーズ: 1行目をヘッダー固定
- 並び替え: B列（発行日時）の降順がデフォルト
- 列幅: A列=狭め、L列(LinkUrl)=広め

---

## バックアップ

GAS の `Sheets.gs` 内に月次バックアップ関数を実装：
- 毎月1日 03:00 トリガで `Orders` シートを別ファイルにコピー
- バックアップ先 Google ドライブフォルダID は `Settings` シートで管理

---

## アクセス権限

| 役割 | 権限 |
|---|---|
| とみぃさん | オーナー |
| 経理担当 | 編集者 |
| 発行スタッフ | 不要（GitHub Pages の発行画面のみ使う） |
| GAS（プログラム） | スクリプトオーナーの権限で動作 |

スタッフはスプレッドシートを直接見ない設計とする。発行履歴の検索は別途、社内ページに「履歴検索」機能を実装する想定。
