# GitHub Actions 版 セットアップ（完全無料・カード不要・機器不要）

GitHubの無料の定期実行(Actions)で、毎時ヘッドレスに既読スイープを回す。
サーバーもnoVNCも要らない。

## 仕組み
```
[GitHub Actions] 毎時0分に起動
   → Secret「LW_STATE」からログインセッション復元
   → ヘッドレスで既読スイープ（メンション以外の未読グループを既読化）
   → 更新後セッションを Secret に保存（次回へ引き継ぎ＝延命）
   → 切れていたら Slack に「再ログインしてSecret更新」を通知
```

## 前提
- GitHubアカウント（無料・**カード不要**）
- Slack Incoming Webhook URL（作成済み）
- セッション作成のため、一度だけ手元PCで `node login.js` を実行（Node必要）
  ※ この作成作業は数分で終わり、常時起動は不要。

---

## 手順

### 1. セッションファイルを作る（ローカルで1回だけ）
Nodeが入っている環境で:
```bash
cd lineworks-auto-read
npm install
npx playwright install chromium
node login.js
```
→ ブラウザが開くので **LINE WORKS にログイン（ID/PW/2FA）**。
→ トーク一覧が出ると自動で `state.json` を保存し、貼り付け用の **base64文字列** を表示。
→ その1行をコピー（Macなら `base64 -i state.json | pbcopy` でコピー）。

> Nodeが無い/ターミナルが不安な場合は、この作成を代わりに用意することもできます（相談してください）。

### 2. GitHubリポジトリを作る
1. https://github.com/new → **Private** で作成（名前は例 `lineworks-auto-read`）
2. このフォルダ一式をアップロード
   - Web画面の **Add file → Upload files** に、フォルダ内のファイルをドラッグ
   - `.github/workflows/auto-read.yml` も必要。うまく上がらなければ **Add file → Create new file** で
     ファイル名に `.github/workflows/auto-read.yml` と入力し、中身を貼り付け

### 3. Secrets を登録
リポジトリの **Settings → Secrets and variables → Actions → New repository secret** で3つ登録:

| 名前 | 値 |
|---|---|
| `LW_STATE` | 手順1でコピーしたbase64文字列 |
| `LW_ALERT_WEBHOOK` | SlackのWebhook URL |
| `GH_PAT` | （任意・推奨）セッション延命用トークン。下記参照 |

**GH_PAT（任意だが推奨）**: セッションを毎回更新して長持ちさせるためのトークン。
- https://github.com/settings/tokens?type=beta → **Generate new token (Fine-grained)**
- Repository access: このリポジトリのみ
- Permissions → Repository permissions → **Secrets: Read and write**
- 発行された `github_pat_...` を `GH_PAT` に登録
- ※ 未設定でも動くが、その場合セッションが早めに切れやすい（切れたらSlack通知→再ログイン）

### 4. 動作テスト
1. リポジトリの **Actions** タブ → 初回は「ワークフローを有効化」を許可
2. 「LINE WORKS auto-read」→ **Run workflow**（手動実行）
3. ログが緑（成功）ならOK。LINE WORKSで未読が減っているか確認
4. 以降は毎時0分に自動実行

---

## 再ログイン（セッションが切れたら）
Slackに「⚠️ セッションが切れました」と届いたら:
1. 手元PCで再度 `node login.js` → ログイン → base64をコピー
2. GitHubの Secret `LW_STATE` を新しい値に更新（Settings → Secrets → LW_STATE → Update）

`GH_PAT` を設定していれば毎回セッションが更新されるため、切れる頻度は下がる。

## 注意・制約
- **セッション切れの頻度は読めない**: 常駐サーバーと違いブラウザを開きっぱなしにできないため、
  LINE WORKS側の判定次第で切れやすい可能性がある。切れたらSlack→再ログインで対応。
- **実行IP**: GitHubのデータセンターIPから動くため、不審ログイン扱いで再認証を求められることがある。
- **無料枠**: Privateリポジトリは毎月2000分まで無料。毎時（キャッシュ有で1回1〜2分）なら概ね収まる。
  超える場合は稼働時間を絞る（cronを `0 8-22 * * *` 等）か、Publicリポジトリ（Actions無制限）にする。
- **スケジュール遅延**: GitHubのcronは混雑時に数分〜遅れることがある。またリポジトリが60日間無活動だと
  スケジュールが自動停止する（たまに手動実行かコミットで回避）。
- 既読化は不可逆。まず `.github/workflows/auto-read.yml` の `EXCLUDE_KEYWORDS` 等で守りを固めてから。
