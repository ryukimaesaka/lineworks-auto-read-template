# LINE WORKS 自動既読（各自セットアップ用テンプレート）

自分がメンションされたグループ／個人トークだけ未読で残し、**それ以外の未読グループを毎時自動で既読化**します。
GitHubの無料サーバー(Actions)が動かすので、自分のPCは起動しっぱなしにしなくてOK。**完全無料・カード不要**。

> ⚠️ これはLINE WORKS公式機能ではなく、Web画面を自動操作する**非公式なRPA**です。UI変更で止まる可能性・
> 利用規約上のリスクを理解の上でご利用ください。**既読化は取り消せません**（まずDRY RUNで確認してから本番）。
> 処理は**自分自身のアカウント**にだけ働き、他人のトークには触れません。

---

## セットアップのしかた（2通り）

### A. Claude Code を使う人（おすすめ・いちばん楽）
1. このテンプレートから「**Use this template**」で自分用の**Private**リポジトリを作る
   （GitHubが初めてなら `GitHubアカウント作成ガイド.md`）。
2. そのリポジトリを手元に取得して、**フォルダを Claude Code で開く**。
3. Claudeに「**LINE WORKSの自動既読をセットアップして**」と言うだけ。
   同梱のスキル（`.claude/skills/lineworks-auto-read/`）が、セッション作成・Secrets登録・除外設定・
   テスト実行まで順番に伴走します。
   - ログイン（ID/パスワード/2段階認証）と、自分のセッションのSecret貼り付けだけは**本人が行います**
     （Claudeはあなたの認証情報を入力しません）。

### B. 手動でやる人
`SETUP-GUIDE.md` の手順どおりに進めてください（所要15〜20分）。

---

## 導入後の操作（止める／再開／除外追加／再ログイン）
- Claude Codeなら「自動既読を止めて」「◯◯は既読化しないで」「状況を見て」「再ログインしたい」と言えばOK。
- 手動の要点は `SETUP-GUIDE.md` と `README-GITHUB-ACTIONS.md` に記載。

## 同梱ファイル
- `SETUP-GUIDE.md` … 手動セットアップ手順書（同僚向け）
- `GitHubアカウント作成ガイド.md` … GitHubが初めての人向け
- `README-GITHUB-ACTIONS.md` … 仕組み・GH_PAT・制約の詳細
- `.github/workflows/auto-read.yml` … 毎時実行の定義（`EXCLUDE_KEYWORDS` 等の設定もここ）
- `login.js` / `ci-run.js` / `sweep.js` / `package.json` … 本体
- `.claude/skills/lineworks-auto-read/` … Claude Code用スキル（Aの伴走の中身）
