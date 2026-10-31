# トラブルシューティング＆内部仕様

## よくあるエラー

| 症状 | 原因 | 対処 |
|---|---|---|
| ログに `セッション未設定です` | Secret `LW_STATE` が未登録/空 | セットアップ STEP2〜4 を確認。base64を登録 |
| `browserType.launch: Executable doesn't exist` | `package.json` のplaywrightバージョンと、`auto-read.yml` の `container: mcr.microsoft.com/playwright:vX.Y.Z-jammy` が不一致 | 両者のバージョンを一致させる（既定は 1.47.0） |
| Slackに `⚠️ セッションが切れました` / 実行が `need_login`・exit 20 | ログインセッション失効 | `operations.md`「4. 再ログイン」。`node login.js` → `LW_STATE` 更新 |
| 急に再認証を求められる／切れやすい | GitHubのデータセンターIPから動くため不審ログイン扱いになることがある | 再ログインで対応。`GH_PAT` 設定で延命 |
| base64がSecretに入らない（長すぎ） | 余計なデータまで貼っている | `login.js` はCookieのみ出力（約7千文字）。全体を貼っていないか確認 |
| スケジュールがいつの間にか動かない | リポジトリ60日無操作でcron自動停止 | 手動Run か 何かコミットして再開 |
| 実行時刻が毎時ぴったりでない | GitHub無料cronはベストエフォート（遅延・スキップ） | 正常。厳密さが必要なら外部トリガー（cron-job.org等でworkflow_dispatch）を検討 |

## デバッグの進め方

1. **Actions の最新実行ログ**を最初に見る（`Run sweep` ステップ）。`集計:` と `完了:` の行、
   例外スタックが出ていないか。
2. セッション起因か（need_login）、UI変更起因か（セレクタで0件・例外）を切り分ける。
3. UI変更が疑わしい時は、下記の内部仕様（依存しているDOM）が実際の画面とズレていないかを疑う。

## 依存している内部仕様（talk.worksmobile.com）

このRPAはLINE WORKS Web版トークの**非公式な内部DOM**に依存している。UI変更で下記が変わると動かなくなる。
判定ロジックは `sweep.js` にある。

| 対象 | 判定方法 |
|---|---|
| 各ルーム | `li[data-role="channel-item"]`（`data-key` が channelId） |
| 自分宛メンション有り | その `li` に **`mention_type`** クラス（＝ログイン本人宛。他人宛メンションは判別不可） |
| 未読 | `li` 内の `span.new`（赤バッジ件数） |
| グループ/個人 | `li` 内に `.ico_team`（チームアイコン）があればグループ ※チーム紐付きでないグループは非検出 |
| 既読化する操作 | ルームの `li` をクリック → `span.new` が消える＝既読 |

補足：
- 「他人宛メンション」を名前で残すことは、一覧DOMからは確実にできない（`mention_type` は本人宛のみ）。
  特定の部屋を残したい場合は名前ベースの `EXCLUDE_KEYWORDS` を使う。
- チーム紐付きでないグループは一覧上で1:1個人トークと区別できない。対象に含めたい場合は `INCLUDE_NAMES` で救済。
