# GitHub Pages セットアップ手順

`docs/` 配下の静的ファイル（社内発行ページ・戻りページ・エラーページ）を GitHub Pages で公開する。

---

## 1. リポジトリの準備

▶ **ユーザー作業**: GitHub の TOKYOFLOWER アカウントで `gmopg` リポジトリを新規作成。

- 公開設定: **Public** （Pages 無料利用のため）
- README: チェックを外す（このプロジェクトの README を使う）
- .gitignore: チェックを外す
- ライセンス: 任意

---

## 2. ローカルからプッシュ

```bash
cd X:\projects\gmopg

# Git 初期化（まだなら）
git init
git branch -M main

# リモート登録
git remote add origin https://github.com/TOKYOFLOWER/gmopg.git

# 初回コミット
git add .
git commit -m "Initial commit: GMO-PG リンクタイプPlus 決済URL発行システム"

# プッシュ
git push -u origin main
```

▶ **認証**: GitHub の PAT（Personal Access Token）または SSH 鍵が必要。
- まだ設定していない場合: https://github.com/settings/tokens で `repo` スコープのトークンを発行 → ターミナルでパスワード代わりに入力。

---

## 3. GitHub Pages 有効化

1. リポジトリページ → `Settings`
2. 左メニュー → `Pages`
3. **Build and deployment** セクション:
   - Source: `Deploy from a branch`
   - Branch: `main` / Folder: `/docs`
4. `Save` をクリック

数分後、以下のURLでアクセス可能になる:

```
https://tokyoflower.github.io/gmopg/                  → トップ（インデックス）
https://tokyoflower.github.io/gmopg/internal/        → 社内発行ページ
https://tokyoflower.github.io/gmopg/return/          → 決済完了戻り
https://tokyoflower.github.io/gmopg/error/           → エラー
```

---

## 4. GAS_ENDPOINT を更新

`docs/internal/index.html` の以下の行を、Phase 3 で取得した WebApp URL に書き換える:

```javascript
const GAS_ENDPOINT = 'https://script.google.com/macros/s/PLACEHOLDER/exec';
```

↓

```javascript
const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfyc...あなたの実URL.../exec';
```

修正後:
```bash
git add docs/internal/index.html
git commit -m "Update GAS endpoint URL"
git push
```

GitHub Pages のキャッシュは数分で更新される。

---

## 5. アクセス確認

### 5-1. トップ
https://tokyoflower.github.io/gmopg/

→ 「銀座東京フラワー / Internal Tools」が表示されればOK。

### 5-2. 社内発行ページ
https://tokyoflower.github.io/gmopg/internal/

→ 認証モーダルが表示される。
→ Phase 2 で設定した `INTERNAL_SHARED_SECRET` を入力。
→ メイン画面に遷移、右上の環境バッジが `TEST ENV` になる。

### 5-3. 戻りページ
https://tokyoflower.github.io/gmopg/return/

### 5-4. エラーページ
https://tokyoflower.github.io/gmopg/error/

---

## 6. 独自ドメインを使う場合（任意）

`internal.tokyoflower.jp` のようなサブドメインで運用したい場合:

1. リポジトリの `Settings` → `Pages` → `Custom domain`
2. ドメイン入力（例: `internal.tokyoflower.jp`）
3. DNS（お名前.com 等の管理画面）で CNAME を追加:
   ```
   internal.tokyoflower.jp → tokyoflower.github.io
   ```
4. GitHub Pages 側で「Enforce HTTPS」をチェック

→ 数十分後に有効になる。

▶ **重要**: 独自ドメインに変更した場合、GAS の `RETURN_URL_SUCCESS` / `RETURN_URL_ERROR` プロパティも更新すること。

---

## 7. 社内 IP 制限（強化したい場合・任意）

GitHub Pages は IP 制限を直接かけられない。共有シークレット認証で十分なケースが多いが、より厳格にしたい場合は以下の選択肢:

### 選択肢A: Cloudflare Workers でリバースプロキシ
GitHub Pages の前に Cloudflare Workers を立てて、Cloudflare Access の Zero Trust で IP 制限。

### 選択肢B: GAS WebApp の doPost 内で IP チェック
GASからは正確なクライアントIP取得が困難なため、現実的ではない。

### 選択肢C: ベーシック認証付きの別ホスティング
Vercel / Netlify などの無料プランで Edge Functions + Basic Auth を組む。

→ **当面は共有シークレット方式で運用、必要になったら強化** を推奨。

---

## 8. GitHub Pages の制約

| 項目 | 制約 |
|---|---|
| 帯域 | ソフト制限 100GB/月 |
| ビルドサイズ | 1GB |
| ビルド時間 | 10分以内 |
| デプロイ間隔 | 1時間あたり10ビルドまで |

→ 静的ファイルの社内ツール用途では一切問題にならない。

---

## トラブルシュート

| 症状 | 対処 |
|---|---|
| 404 が返る | Pages 有効化から数分待つ。ブラウザのハードリロード（Ctrl+Shift+R） |
| `internal/` で空白ページ | `GAS_ENDPOINT` が `PLACEHOLDER` のままでないか確認 |
| 環境バッジが UNKNOWN | GAS WebApp のデプロイが「全員アクセス可」になっているか確認 |
| 認証モーダルから進めない | スクリプトプロパティの `INTERNAL_SHARED_SECRET` と一致しているか |
| CORS エラー | フェッチ時の `Content-Type: text/plain` にする（既に対応済み） |
