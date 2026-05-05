# デプロイ手順クイックリファレンス

ソースを変更した後、本番反映するまでの最短手順。

---

## GAS の更新

```bash
cd X:\projects\gmopg\gas-src
clasp push
```

→ コードは GAS 側にアップロードされるが、**WebApp としては自動反映されない**。

GAS エディタで:
1. 右上「デプロイを管理」
2. 該当デプロイの ✏️ アイコン
3. バージョン: **新しいバージョン**
4. 「デプロイ」

→ URL は **変わらない**（同じデプロイIDで上書き）。

---

## GitHub Pages の更新

```bash
cd X:\projects\gmopg
git add docs/
git commit -m "Update: <変更内容>"
git push
```

→ 数分で反映。ハードリロード（Ctrl+Shift+R）でキャッシュクリア。

---

## 環境切替（テスト → 本番）

GAS のスクリプトプロパティで `ENV` を `test` → `prod` に変更。

→ 即時反映。WebAppデプロイの再作成は不要。

→ 戻すときは `prod` → `test`。

---

## ロールバック

GAS:
- 「デプロイを管理」→ 旧バージョンを選択して再デプロイ。

GitHub:
```bash
git revert HEAD
git push
```

---

## 緊急停止

決済URLを発行できないようにしたい場合:

**方法A**: GAS のスクリプトプロパティで `ENV` を空文字 or 不正な値に変更
→ `getEnv_()` がエラー投げる → 発行は全部失敗。

**方法B**: GAS のWebAppデプロイを「アーカイブ」
→ URL自体が無効になる。

→ 復旧手順を OPERATION.md に書いておくこと。
