/**
 * ci-run.js — GitHub Actions用（ヘッドレス・1回実行）
 * ------------------------------------------------------------
 * ・Secret LW_STATE(base64のstorageState)からログインセッションを復元
 * ・既読スイープを1回実行
 * ・成功したら更新後セッションを state.new.json に書き出す
 *   （後続ステップが LW_STATE を更新して次回に引き継ぐ＝セッションを長持ちさせる）
 * ・セッション切れなら Slack に「再ログインしてSecret更新」を通知して終了(code=20)
 */
const fs = require('fs');
const { chromium } = require('playwright');
const { loadConfig, runSweep } = require('./sweep');

const STATE_B64 = process.env.LW_STATE || '';
const WEBHOOK = process.env.LW_ALERT_WEBHOOK || '';
const REPO = process.env.GITHUB_REPOSITORY || '';
const SECRETS_URL = REPO ? `https://github.com/${REPO}/settings/secrets/actions` : '(リポジトリのSecrets設定)';

function log(...a) { console.log(`[${new Date().toISOString()}]`, ...a); }
async function slack(msg) {
  log('SLACK:', msg);
  if (!WEBHOOK) return;
  try {
    await fetch(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `[LINE WORKS自動既読] ${msg}` }) });
  } catch (e) { log('slack失敗:', e.message); }
}

(async () => {
  if (!STATE_B64) {
    await slack('セッション未設定です。ローカルで `npm run login` してSecret LW_STATE を設定してください: ' + SECRETS_URL);
    process.exit(1);
  }
  fs.writeFileSync('state.json', Buffer.from(STATE_B64, 'base64'));

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({
    storageState: 'state.json', locale: 'ja-JP', timezoneId: 'Asia/Tokyo',
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();
  const cfg = loadConfig();

  try {
    const res = await runSweep(page, cfg, log);
    if (res.status === 'need_login') {
      await slack(`⚠️ セッションが切れました。ローカルで \`npm run login\` して再ログイン → 新しい LW_STATE を設定してください:\n${SECRETS_URL}`);
      await ctx.close(); await browser.close();
      process.exit(20);
    }
    // 更新後セッションを書き出し（後続ステップがSecretを更新）
    await ctx.storageState({ path: 'state.new.json' });
    log('完了:', JSON.stringify(res.summary || {}));
    await ctx.close(); await browser.close();
  } catch (e) {
    log('ERROR:', e.stack || e.message);
    await slack('実行エラー: ' + e.message);
    try { await ctx.close(); await browser.close(); } catch (_) {}
    process.exit(1);
  }
})();
