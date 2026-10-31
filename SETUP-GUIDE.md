# LINE WORKS 自動既読 セットアップ手順書（同僚向け）

自分がメンションされたグループだけ残して、それ以外の未読グループを**毎時自動で既読化**する仕組み。
**完全無料・カード不要・PC常時起動不要**（GitHubのサーバーが毎時動かす）。

> ⚠️ この仕組みはLINE WORKSの非公式な画面操作（RPA）に依存します。UI変更で動かなくなる可能性、
> 利用規約上のリスクを理解の上でご利用ください。既読化は取り消せません。

---

## 全体像

```
毎時0分：GitHubのサーバーが自動起動
 → 保存した自分のLINE WORKSログイン情報でトークを開く
 → メンションされたグループ・個人トークは残す
 → それ以外の未読グループをクリックして既読化
 → セッション切れならSlackへ通知
```

各自で用意するもの：**自分のLINE WORKSアカウント**／GitHubアカウント（無料）／Slack通知先。
※ 既読化は「その人自身のアカウント」に対して働きます。

---

## 【準備】管理者(前坂)が一度だけやること

同僚がワンクリックで複製できるよう、元リポジトリを**テンプレート化**しておく。

1. `lineworks-auto-read` リポジトリに `login.js` があることを確認（無ければ追加）
2. リポジトリ **Settings → General** → 一番上あたりの **「Template repository」にチェック**
3. これで同僚は「Use this template」で自分用のコピーを作れる

---

## 【同僚の手順】

### STEP 1. 自分用リポジトリを作る（テンプレートから複製）
1. 管理者から共有された `lineworks-auto-read` リポジトリを開く
2. 緑の **「Use this template」→「Create a new repository」**
3. Repository name（例 `lineworks-auto-read`）、**Private** を選んで **Create repository**
   - これで4ファイル＋`login.js`が自分のリポジトリに入る

### STEP 2. LINE WORKSのセッションを作る（ローカルで1回だけ）
ログイン情報(Cookie)を取り出す作業。Node.jsが必要。

**2-1. Node.jsを入れる**
- https://nodejs.org/ja → 「LTS」版をダウンロードしてインストール（画面の指示通りでOK）

**2-2. リポジトリをダウンロード**
- 自分のリポジトリ画面 → 緑の **Code → Download ZIP** → 解凍

**2-3. ターミナル(Mac)／コマンドプロンプト(Win)で実行**
解凍したフォルダに移動して、順に実行：
```bash
npm install
npx playwright install chromium
node login.js
```
- ブラウザが開く → **自分のLINE WORKSにログイン**（ID/パスワード/2段階認証）
- トーク一覧が出ると、`state_cookies.json` が保存され、**貼り付け用のbase64文字列**が表示される
- その1行をコピー（Macは `base64 -i state_cookies.json | pbcopy` でコピーできる）

> ⚠️ このbase64は「自分のログイン情報」なので、他人に渡さないこと。

### STEP 3. Slack通知先を作る（Incoming Webhook）
セッション切れをSlackで受け取るため。
1. https://api.slack.com/apps → **Create New App → From scratch**
2. 名前・ワークスペースを選んで作成
3. 左メニュー **Incoming Webhooks** を **On**
4. **Add New Webhook to Workspace** → 通知したいチャンネルを選ぶ
5. 発行された `https://hooks.slack.com/services/...` を控える
   - （既にチーム共通のWebhookがあるならそれを使ってもOK）

### STEP 4. Secrets（秘密情報）を登録
自分のリポジトリ **Settings → Secrets and variables → Actions → New repository secret** で2つ登録：

| 名前 | 値 |
|---|---|
| `LW_STATE` | STEP2でコピーしたbase64 |
| `LW_ALERT_WEBHOOK` | STEP3のSlack Webhook URL |

（名前は**大文字で正確に**。前後に空白を入れない）

### STEP 5. テスト実行
1. リポジトリ上部の **Actions** タブ → 初回は **「I understand my workflows, go ahead and enable them」** を許可
2. 左の **「LINE WORKS auto-read」** → 右の **Run workflow** → **Run workflow**
3. 1〜2分待って**緑（成功）**になればOK。実行をクリックし `Run sweep` のログに
   `完了: {"read":○,...}` と出ていれば既読化された件数が分かる

以降は**毎時0分に自動実行**。基本は放置でOK。

---

## 運用・メンテナンス

| 項目 | 内容 |
|---|---|
| 実行 | 毎時0分に自動（GitHub Actions） |
| 確認 | リポジトリの **Actions** タブで履歴 |
| 通知 | セッション切れ時に **Slack** に届く |
| 再ログイン | Slack通知が来たら **STEP2 をやり直して** `LW_STATE` を更新（Settings→Secrets→LW_STATE→Update） |
| 注意 | cronは数分遅れることあり／リポジトリが60日間無操作だと自動停止（たまにActionsを覗く/手動Run） |

---

## 動作の調整（任意・`.github/workflows/auto-read.yml` の env）

| 設定 | 既定 | 説明 |
|---|---|---|
| `SKIP_DIRECT_MESSAGES` | `'true'` | `'false'`で1:1個人トークも既読化 |
| `EXCLUDE_KEYWORDS` | `''` | 既読化しない部屋名（部分一致・カンマ区切り）例 `'社長,経営'` |
| `INCLUDE_NAMES` | `''` | チーム紐付きでないグループを対象に含める部屋名 |
| `MENTION_IGNORE_NAMES` | `''` | メンションが付いても既読化してよい部屋名（@全員専用の部屋など） |

---

## よくあるトラブル

- **`セッション未設定` エラー** → `LW_STATE` が未登録/空。STEP2〜4を確認
- **`browserType.launch: Executable doesn't exist`** → `package.json` の playwright バージョンと
  ワークフローの `container: mcr.microsoft.com/playwright:vX.Y.Z-jammy` が**一致**しているか確認
- **`⚠️セッションが切れました`（Slack）** → STEP2をやり直して `LW_STATE` を更新
- **base64が長すぎてSecretに入らない** → `login.js` はCookieのみ出力（約7千文字）。全体を貼っていないか確認
