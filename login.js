/**
 * login.js — セッション作成（ローカルで1回だけ実行）
 * ------------------------------------------------------------
 * ブラウザが開くので LINE WORKS にログイン（ID/PW/2FA）。
 * トーク一覧が表示されたら自動でセッションを state.json に保存する。
 * その後、表示される base64 を GitHub の Secret「LW_STATE」に貼り付ける。
 *
 * 使い方:
 *   npm install
 *   npx playwright install chromium
 *   node login.js
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ locale: 'ja-JP', timezoneId: 'Asia/Tokyo', viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('https://talk.worksmobile.com/#/');

  console.log('\n=== 開いたブラウザで LINE WORKS にログインしてください（2段階認証まで）===');
  console.log('トーク一覧が表示されると自動で保存します...\n');

  // トーク一覧が出るまで待つ（最大5分）
  try {
    await page.waitForSelector('li[data-role="channel-item"]', { timeout: 300000 });
  } catch (_) {
    console.error('タイムアウト: トーク一覧が確認できませんでした。もう一度試してください。');
    await browser.close();
    process.exit(1);
  }
  await page.waitForTimeout(2000);
  await ctx.storageState({ path: 'state.json' });

  // GitHub Secretの上限(48KB)に収めるため、認証に必要なCookieだけに絞る
  const fs = require('fs');
  const s = JSON.parse(fs.readFileSync('state.json'));
  const trimmed = JSON.stringify({ cookies: s.cookies, origins: [] });
  fs.writeFileSync('state_cookies.json', trimmed);
  const b64 = Buffer.from(trimmed).toString('base64');
  console.log('\n✅ 保存しました: state_cookies.json（' + b64.length + '文字）');
  console.log('\n=== 下の1行をコピーして GitHub Secret「LW_STATE」に貼り付けてください ===\n');
  console.log(b64);
  console.log('\n（Macなら次でクリップボードにコピー: base64 -i state_cookies.json | pbcopy ）\n');

  await browser.close();
})();
