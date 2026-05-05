# Claude Code 向け作業指示書

## このファイルの読み方

このファイルは Claude Code が**上から順番に**実行する手順書です。各 Phase ごとに：

1. **目的** — なぜやるか
2. **作業** — 何をやるか（具体的なコマンド・コード）
3. **確認** — 完了したか確認する方法
4. **次のステップ** — ユーザー（とみぃさん）に何を依頼するか

ユーザーの手作業が必要な箇所（GMO管理画面の設定、GitHub認証等）は **`▶ ユーザー作業`** と明示して止まること。

---

## プロジェクト全体の方針

- **接続方式**: GMO-PG リンクタイプPlus（キー型）
- **API**: `GetLinkplusUrlPayment.json` をGASから呼び出してLinkUrl取得
- **環境**: テスト = `pt01.mul-pay.jp` / 本番 = `p01.mul-pay.jp`
- **GitHub アカウント**: TOKYOFLOWER (既存)
- **対象事業**: 銀座東京フラワー (tokyoflower.jp)
- **決済手段**: GMO管理画面で契約済みの全決済（クレカ/コンビニ/PayPay/楽天ペイ等）

---

## Phase 0: GMO-PG 契約・管理画面初期設定

### 目的
リンクタイプPlus の API を叩くために必要なクレデンシャル（ShopID, ShopPass, ConfigID）を取得する。

### 作業

▶ **ユーザー作業**: `SETUP_GMO.md` を開いて、上から順に GMO 管理画面で設定を行う。

完了したら、以下の情報をユーザーから受け取り、**メモのみで保持**（コードに直接書き込まない）：

- [ ] テスト環境 ShopID (`tshop00000000` 形式)
- [ ] テスト環境 ShopPass
- [ ] 本番環境 ShopID (`shop00000000` 形式)
- [ ] 本番環境 ShopPass
- [ ] テスト用 ConfigID
- [ ] 本番用 ConfigID
- [ ] GMO仕様書ログイン用 ID/PW（管理画面の「サポート」から取得）

### 確認
- [ ] テスト環境の管理画面 (https://stg.mul-pay.jp) にログインできる
- [ ] 本番環境の管理画面 (https://mul-pay.jp) にログインできる
- [ ] 仕様書サイト (https://docs.mul-pay.jp/linkplus/overview) にログインできる

### 次のステップ
Phase 1 へ進む。

---

## Phase 1: Google Sheets スプレッドシート作成

### 目的
注文ログを記録する Sheets を作る。GAS からアクセスする ID を取得する。

### 作業

▶ **ユーザー作業**: 
1. Google ドライブで新規スプレッドシートを作成
2. 名前を `GMO決済URL発行管理` にする
3. URL から ID を抽出 (`https://docs.google.com/spreadsheets/d/【ここがID】/edit`)
4. 以下のシート構成を作る（`SHEETS_SCHEMA.md` を参照）

**シート1: `Orders` (注文ログ)**

ヘッダ行（A1から右へ）:
```
発行ID | 発行日時 | 環境 | スタッフ名 | お客様名 | お客様メール | 金額 | 自由項目1 | 自由項目2 | メモ | OrderID | LinkUrl | 有効期限 | 決済ステータス | 決済日時 | TranID | AccessID | エラーコード | 備考
```

**シート2: `ProductMaster` (商品マスタ・任意)**

ヘッダ行:
```
商品コード | 商品名 | 単価 | 有効
```

**シート3: `Settings` (設定値)**

ヘッダ行:
```
キー | 値 | 説明
```

初期データ:
```
DEFAULT_EXPIRY_HOURS | 168 | デフォルトの決済URL有効期限（時間）。168=7日
SHOP_DISPLAY_NAME | 銀座東京フラワー | お客様向けの店舗表示名
NOTIFY_CHATWORK_ROOM | (空欄) | ChatWork通知ルームID（任意）
```

**シート4: `Audit` (監査ログ)**

ヘッダ行:
```
日時 | アクション | 実行者 | IP | UserAgent | 詳細
```

5. ユーザーから **Sheets ID** を受け取る

### 確認
- [ ] スプレッドシートが作成され、4つのシートが存在
- [ ] Sheets ID をユーザーから受領

### 次のステップ
Phase 2 へ進む。

---

## Phase 2: GAS プロジェクト作成・clasp 連携

### 目的
ローカル(`X:\projects\gmopg\gas-src`)で GAS のソースコードを管理し、`clasp push` でデプロイできる状態を作る。

### 作業

#### 2-1. clasp の準備

```bash
# Claude Code は以下を実行
cd X:\projects\gmopg
npm install -g @google/clasp
clasp login
# ユーザーがブラウザでGoogleログインを行う
```

▶ **ユーザー作業**: ブラウザが開いたら Google アカウント (TOKYOFLOWER 用 GAS を作るなら tokyoflower 系の Google アカウント) でログイン。

#### 2-2. Apps Script API を有効化

▶ **ユーザー作業**: https://script.google.com/home/usersettings にアクセスし、「Apps Script API」を **オン** にする。

#### 2-3. 新規 GAS プロジェクト作成

```bash
cd X:\projects\gmopg\gas-src
clasp create --type standalone --title "GMO決済URL発行システム"
```

→ `.clasp.json` が生成される。これは `.gitignore` で除外する。

#### 2-4. GAS 側でも Sheets ID と Properties を結びつけ

▶ **ユーザー作業**: 生成された GAS プロジェクトを Web で開き、`プロジェクトの設定` → `スクリプト プロパティ` で以下を設定。

| プロパティ名 | 値 | 備考 |
|---|---|---|
| `ENV` | `test` | 'test' または 'prod' |
| `SHEETS_ID` | (Phase 1 で取得した値) | スプレッドシートID |
| `GMO_TEST_SHOP_ID` | (Phase 0 で取得) | テスト ShopID |
| `GMO_TEST_SHOP_PASS` | (Phase 0 で取得) | テスト ShopPass |
| `GMO_TEST_CONFIG_ID` | (Phase 0 で取得) | テスト ConfigID |
| `GMO_PROD_SHOP_ID` | (Phase 0 で取得) | 本番 ShopID |
| `GMO_PROD_SHOP_PASS` | (Phase 0 で取得) | 本番 ShopPass |
| `GMO_PROD_CONFIG_ID` | (Phase 0 で取得) | 本番 ConfigID |
| `INTERNAL_SHARED_SECRET` | (ランダム32文字) | `openssl rand -hex 16` 等で生成 |
| `RETURN_URL_SUCCESS` | `https://tokyoflower.github.io/gmopg/return/` | お客様決済完了後の戻り先 |
| `RETURN_URL_ERROR` | `https://tokyoflower.github.io/gmopg/error/` | エラー戻り先 |
| `CHATWORK_TOKEN` | (任意) | ChatWork通知用 |
| `CHATWORK_ROOM_ID` | (任意) | ChatWork通知ルーム |

### 確認
- [ ] `.clasp.json` がローカルに生成されている
- [ ] スクリプトプロパティに上記の値がすべて入っている

### 次のステップ
Phase 3 へ進む。

---

## Phase 3: GAS 実装

### 目的
GAS のソースコード一式を `gas-src/` に作成し、`clasp push` でデプロイ。

### 作業

#### 3-1. ファイル一式は既に `gas-src/` 配下に作成済み

以下のファイルを確認・必要に応じてカスタマイズ：

- `appsscript.json` — マニフェスト
- `Constants.gs` — 共通定数
- `Code.gs` — エントリポイント・ルーティング
- `Issue.gs` — 決済URL発行ロジック
- `Notify.gs` — 結果通知受信ロジック
- `GmoApi.gs` — GMO API クライアント
- `Sheets.gs` — Sheets ヘルパー
- `Auth.gs` — 社内認証
- `Notify_ChatWork.gs` — ChatWork通知（任意）

#### 3-2. clasp push でデプロイ

```bash
cd X:\projects\gmopg\gas-src
clasp push
```

#### 3-3. WebApp として公開

▶ **ユーザー作業**: GAS エディタを開き、右上「デプロイ」→「新しいデプロイ」→「種類の選択：ウェブアプリ」

設定値:
- 説明: `決済URL発行 v1`
- 次のユーザーとして実行: **自分**
- アクセスできるユーザー: **全員**

「デプロイ」を押すと WebApp の URL が発行される（`https://script.google.com/macros/s/AKfyc...XXX/exec`）。

このURLは2つのエンドポイントを兼ねる：
- `?action=issue` … 社内ページからの発行リクエスト
- `?action=notify` … GMOからの結果通知（後ほどGMO管理画面に登録）

WebApp の URL をユーザーから受け取り、メモする。

### 確認

#### テスト疎通
GAS エディタ上で `Code.gs` の `testIssue()` 関数を実行：

```javascript
function testIssue() {
  const result = issuePayment_({
    customerName: 'テスト太郎',
    customerEmail: '',
    amount: 100,
    free1: 'テスト発行',
    free2: '',
    memo: 'GAS疎通テスト',
    expiryHours: 24,
    staffName: 'システム'
  });
  console.log(JSON.stringify(result, null, 2));
}
```

→ 正常に LinkUrl が返り、Sheets の Orders シートに1行追加されていれば成功。

### 次のステップ
Phase 4 へ進む。

---

## Phase 4: GitHub Pages デプロイ

### 目的
社内発行ページ、決済完了戻りページ、エラーページを GitHub Pages で公開する。

### 作業

#### 4-1. GitHub リポジトリ準備

▶ **ユーザー作業**: TOKYOFLOWER アカウントで `gmopg` リポジトリを新規作成（Public）。

```bash
cd X:\projects\gmopg
git init
git remote add origin https://github.com/TOKYOFLOWER/gmopg.git
```

#### 4-2. `.gitignore` の確認

`.gitignore` には以下が含まれていること:
```
.clasp.json
gas-src/.clasp.json
node_modules/
.env
*.local
```

#### 4-3. `docs/internal/index.html` の GAS_ENDPOINT を更新

`docs/internal/index.html` 内の `const GAS_ENDPOINT = 'https://script.google.com/macros/s/PLACEHOLDER/exec';` を、Phase 3 で取得したWebApp URLに書き換える。

`INTERNAL_SHARED_SECRET` も Phase 2 で生成したものに合わせる（フロント側はそのまま、ヘッダで送る）。

#### 4-4. コミット・プッシュ

```bash
git add .
git commit -m "Initial commit: GMO-PG リンクタイプPlus 決済URL発行システム"
git branch -M main
git push -u origin main
```

#### 4-5. GitHub Pages 有効化

▶ **ユーザー作業**: 
1. リポジトリの `Settings` → `Pages`
2. Source: `Deploy from a branch`
3. Branch: `main` / `/docs`
4. `Save`

数分後、`https://tokyoflower.github.io/gmopg/internal/` でアクセス可能になる。

### 確認
- [ ] `https://tokyoflower.github.io/gmopg/internal/` が表示される
- [ ] `https://tokyoflower.github.io/gmopg/return/` が表示される
- [ ] `https://tokyoflower.github.io/gmopg/error/` が表示される

### 次のステップ
Phase 5 へ進む。

---

## Phase 5: テスト環境でのEnd-to-End テスト

### 目的
本番に切り替える前に、テスト環境（pt01）で全フローを検証する。

### 作業

#### 5-1. GMO 管理画面で結果通知URLを設定

▶ **ユーザー作業**: GMO **テスト** 管理画面（stg.mul-pay.jp）にログイン。

「ショップ管理」→「リンクタイプPlus設定」→「結果通知URL」に Phase 3 のWebApp URL +`?action=notify` を設定:
```
https://script.google.com/macros/s/AKfyc...XXX/exec?action=notify
```

#### 5-2. 社内発行ページで決済URL発行

1. `https://tokyoflower.github.io/gmopg/internal/` にアクセス
2. 共有シークレットを入力（初回のみ、ブラウザに保存）
3. 金額: 100円、自由項目1: 「テスト発注」と入力して発行
4. LinkUrl がフォーム下部に表示される

#### 5-3. テストカードで決済

GMOテスト用カード番号:
- `4111111111111111` (VISA, 3DS非対応)
- `4000000000000002` (VISA, 3DS2.0対応)
- 有効期限: 任意の未来月、CVC: 任意3桁

決済完了 → 戻りページに遷移、Sheets の決済ステータスが `CAPTURE` に更新されることを確認。

#### 5-4. エラーケースの確認

- カード番号 `4111111111111119` → 限度額超過エラー
- 金額0円 → バリデーションエラー
- 有効期限切れ後にURL開く → 期限切れ表示

### 確認
- [ ] 決済URL発行成功
- [ ] テストカードで決済完了
- [ ] Sheets が正しく更新された
- [ ] 結果通知が GAS に届いている (Audit シートに記録される)
- [ ] エラーケースが想定通り

### 次のステップ
Phase 6 へ進む。

---

## Phase 6: 本番環境切替

### 作業

#### 6-1. GAS スクリプトプロパティを切替

▶ **ユーザー作業**: GAS の スクリプトプロパティで `ENV` を `test` → `prod` に変更。

#### 6-2. GMO 本番管理画面で結果通知URLを設定

▶ **ユーザー作業**: GMO **本番** 管理画面（mul-pay.jp）でも結果通知URLを設定（Phase 5-1 と同じURL）。

#### 6-3. WebApp の新バージョンをデプロイ

GAS エディタで「デプロイを管理」→「編集」→「新しいバージョン」でアップデート。

#### 6-4. 本番テスト

少額（100円〜500円）で実カード決済テスト。即キャンセル処理。

### 確認
- [ ] 本番カードで決済完了
- [ ] 即時キャンセル処理が成功
- [ ] Sheets の本番環境タグ（`prod`）で記録

---

## Phase 7: 社内運用マニュアル展開

▶ **ユーザー作業**: `OPERATION.md` をスタッフに共有。

---

## トラブルシュート

| 症状 | 原因と対処 |
|---|---|
| `403 Forbidden` (GAS) | スクリプトプロパティの `INTERNAL_SHARED_SECRET` 不一致 |
| GMO API `100` エラー | ShopPassが間違っている |
| GMO API `M01000010` | 必須パラメータ不足。`Issue.gs` のリクエスト内容ログを確認 |
| 結果通知が届かない | GMO管理画面の通知URL設定漏れ。WebAppが「全員アクセス可」になっているか |
| Sheets書き込み失敗 | スクリプトプロパティの `SHEETS_ID` 不一致、または GAS の権限不足（初回実行時に承認必要） |

---

## ファイル一覧（参照）

- `gas-src/Code.gs` — doGet/doPost ルーティング
- `gas-src/Issue.gs` — 発行ロジック
- `gas-src/Notify.gs` — 結果通知受信
- `gas-src/GmoApi.gs` — GMO API クライアント
- `gas-src/Sheets.gs` — Sheets ヘルパー
- `gas-src/Auth.gs` — 認証
- `gas-src/Constants.gs` — 共通定数
- `docs/internal/index.html` — 社内発行ページ
- `docs/return/index.html` — 戻りページ
- `docs/error/index.html` — エラーページ
