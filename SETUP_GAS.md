# GAS（Google Apps Script）セットアップ手順

`gas-src/` 配下のソースコードを GAS に反映するための手順。
clasp（Googleの公式 GAS CLI）を使う。

---

## 1. clasp のインストール

すでにインストール済みなら飛ばしてOK。

```bash
npm install -g @google/clasp
```

確認:
```bash
clasp -v
```

---

## 2. clasp ログイン

GAS を作成・編集する Google アカウントでログイン。

```bash
clasp login
```

ブラウザが開くので Google ログイン → 権限承認。

▶ **重要**: tokyoflower 系の Google アカウント（GASのオーナーにしたいアカウント）でログインすること。

---

## 3. Apps Script API を有効化

1. https://script.google.com/home/usersettings にアクセス
2. 「Apps Script API」を **オン**

---

## 4. 新規 GAS プロジェクト作成

```bash
cd X:\projects\gmopg\gas-src
clasp create --type standalone --title "GMO決済URL発行システム"
```

→ `.clasp.json` がカレントディレクトリに生成される（`scriptId` を含む）。
→ `appsscript.json` も生成されるが、**プロジェクトに既存のものがあるので上書きされない**ことを確認。

不安な場合:
```bash
git status  # appsscript.json に変更がないか確認
```

---

## 5. ソースコードをアップロード

```bash
clasp push
```

→ `gas-src/` 配下の `.gs` `.html` `.json` ファイルが GAS にアップロードされる。

---

## 6. スクリプトプロパティの設定

GAS エディタを開く:
```bash
clasp open
```

エディタ左の歯車アイコン →「プロジェクトの設定」→ 一番下の「スクリプトプロパティ」→「スクリプトプロパティを追加」

以下を **すべて** 設定する：

| キー | 値の例 | 説明 |
|---|---|---|
| `ENV` | `test` | 'test' または 'prod' |
| `SHEETS_ID` | `1abc...XYZ` | スプレッドシートID |
| `GMO_TEST_SHOP_ID` | `tshop00000000` | テスト ShopID |
| `GMO_TEST_SHOP_PASS` | `(GMO発行のパスワード)` | テスト ShopPass |
| `GMO_TEST_CONFIG_ID` | `default01` | テスト ConfigID |
| `GMO_PROD_SHOP_ID` | `shop00000000` | 本番 ShopID |
| `GMO_PROD_SHOP_PASS` | `(GMO発行のパスワード)` | 本番 ShopPass |
| `GMO_PROD_CONFIG_ID` | `default01` | 本番 ConfigID |
| `INTERNAL_SHARED_SECRET` | `(ランダム32文字)` | 内部発行ページの認証用 |
| `RETURN_URL_SUCCESS` | `https://tokyoflower.github.io/gmopg/return/` | 決済完了戻り先 |
| `RETURN_URL_ERROR` | `https://tokyoflower.github.io/gmopg/error/` | エラー戻り先 |
| `CHATWORK_TOKEN` | `(任意)` | ChatWork通知 |
| `CHATWORK_ROOM_ID` | `(任意)` | ChatWork通知 |

### `INTERNAL_SHARED_SECRET` の生成方法

ターミナルで（Mac/Linux）:
```bash
openssl rand -hex 16
```

Windows PowerShell:
```powershell
[System.Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(16))
```

または Node.js:
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

---

## 7. WebApp としてデプロイ

GASエディタ右上の「デプロイ」→「新しいデプロイ」

設定:
- 種類: **ウェブアプリ**
- 説明: `決済URL発行 v1.0.0`
- 次のユーザーとして実行: **自分（オーナー）**
- アクセスできるユーザー: **全員**

「デプロイ」を押すと、WebApp の URL が表示される:
```
https://script.google.com/macros/s/AKfyc.................XXX/exec
```

▶ この URL を全部コピーして、安全な場所にメモ（後で何度も使う）。

---

## 8. 初回権限承認

`testIssue()` を実行する前に、初回はGoogleの権限承認が必要。

GAS エディタで関数選択ドロップダウンから `testIssue` を選んで「実行」

→ 「許可を確認」ダイアログが出る → 自分のアカウントを選択 → 「詳細」→「(プロジェクト名) に移動 (安全ではないページ)」→「許可」

これで以下の権限が承認される:
- スプレッドシートへのアクセス
- 外部URLへのアクセス（GMO API）
- スクリプトプロパティの読取

---

## 9. テスト実行

### 9-1. ヘルスチェック

ブラウザで以下にアクセス（`?action=health` を末尾に付ける）:
```
https://script.google.com/macros/s/AKfyc...XXX/exec?action=health
```

レスポンス例:
```json
{
  "ok": true,
  "service": "GMO-PG リンクタイプPlus 決済URL発行システム",
  "env": "test",
  "time": "2026-05-05T12:34:56.789Z"
}
```

### 9-2. 発行テスト（GASエディタから）

`Code.gs` の `testIssue` を実行 → ログを確認

成功時のログ:
```
{
  "ok": true,
  "issueId": "...",
  "orderId": "20260505123456-1234",
  "linkUrl": "https://pt01.mul-pay.jp/...",
  "expiry": "2026-05-06 12:34",
  "mailTemplate": "..."
}
```

### 9-3. Sheets を確認

スプレッドシートの `Orders` シートに1行追加されていることを確認。

---

## 10. デプロイの更新方法

ソースコードを変更した後:

```bash
cd X:\projects\gmopg\gas-src
clasp push
```

→ 既存のWebAppデプロイは**自動では更新されない**。
→ GASエディタで「デプロイを管理」→ 該当デプロイの編集アイコン →「バージョン: 新しいバージョン」を選んでデプロイ

または、毎回新しいURLを発行したくない場合は、CLI で:
```bash
clasp deploy -i <デプロイID> -d "v1.0.1"
```

---

## トラブルシュート

| 症状 | 対処 |
|---|---|
| `clasp push` で `Push failed. Errors:` | `appsscript.json` の構文エラーを確認 |
| `testIssue` で `Cannot read properties of null` | スクリプトプロパティ未設定 → `showProperties()` で確認 |
| `403 Forbidden` (フロントから) | `INTERNAL_SHARED_SECRET` がフロントとGASで一致しているか確認 |
| GMO API でタイムアウト | UrlFetch のクォータを確認（GASは1日20,000回まで） |
| Sheets書き込みエラー | スクリプトオーナーがSheetsの編集権限を持っているか確認 |

---

## 関連コマンドまとめ

```bash
clasp login              # ログイン
clasp create             # 新規プロジェクト作成
clasp push               # ローカル → GAS にアップロード
clasp pull               # GAS → ローカルにダウンロード
clasp open               # ブラウザでGASエディタを開く
clasp logs               # 実行ログを表示
clasp deployments        # デプロイ一覧
clasp deploy             # 新規デプロイ
```
