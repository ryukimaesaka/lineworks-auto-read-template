/**
 * sweep.js — LINE WORKS 自動既読の共通ロジック
 * 一覧の収集 / 分類 / 既読化(クリック) / ログイン状態判定 を提供。
 * auto-read.js(単発) と daemon.js(常駐) の両方から利用する。
 */

const TALK_URL = 'https://talk.worksmobile.com/#/';
const LIST_SEL = 'li[data-role="channel-item"]';

function loadConfig(env = process.env) {
  return {
    TALK_URL,
    SKIP_DIRECT_MESSAGES: env.SKIP_DIRECT_MESSAGES !== 'false', // 既定 true
    EXCLUDE_KEYWORDS: (env.EXCLUDE_KEYWORDS || '').split(',').map(s => s.trim()).filter(Boolean),
    INCLUDE_NAMES: (env.INCLUDE_NAMES || '').split(',').map(s => s.trim()).filter(Boolean),
    // メンションが付いていても既読化してよい部屋（@全員ブロードキャスト中心の部屋を名前で指定・部分一致）
    MENTION_IGNORE_NAMES: (env.MENTION_IGNORE_NAMES || '').split(',').map(s => s.trim()).filter(Boolean),
    CLICK_DELAY_MS: parseInt(env.CLICK_DELAY_MS || '450', 10),
    MAX_ROOMS_PER_RUN: parseInt(env.MAX_ROOMS_PER_RUN || '500', 10),
    DRY_RUN: env.DRY_RUN === '1',
  };
}

// ログイン画面へ飛ばされていないか
function isLoginUrl(url) {
  return /auth\.worksmobile\.com|\/login/.test(url || '');
}

// ページ内評価用: 現在DOMにある全ルームを抽出しつつ、リストを1画面分スクロール
function scrapeAndScroll() {
  const LIST_SEL = 'li[data-role="channel-item"]';
  const nameOf = li => { const s = li.querySelector('strong.name'); return s ? (s.getAttribute('title') || s.textContent || '') : ''; };
  const unreadOf = li => { const n = li.querySelector('span.new'); return n ? (n.textContent || '').trim() : null; };
  const isMention = li => li.classList.contains('mention_type');
  const isGroup = li => !!li.querySelector('.ico_team');

  const rows = [];
  for (const li of document.querySelectorAll(LIST_SEL)) {
    const key = li.dataset.key;
    if (!key) continue;
    rows.push({ key, name: nameOf(li), unread: unreadOf(li), mention: isMention(li), group: isGroup(li) });
  }
  const anyLi = document.querySelector(LIST_SEL);
  const ul = anyLi ? anyLi.closest('ul') : null;
  const scroller = ul ? ul.parentElement : null;
  let atBottom = true;
  if (scroller) {
    const prev = scroller.scrollTop;
    scroller.scrollTop = Math.min(prev + scroller.clientHeight * 0.85, scroller.scrollHeight);
    atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
  }
  return { rows, atBottom };
}

async function collectRooms(page) {
  await page.evaluate(() => {
    const li = document.querySelector('li[data-role="channel-item"]');
    const ul = li ? li.closest('ul') : null;
    const sc = ul ? ul.parentElement : null;
    if (sc) sc.scrollTop = 0;
  });
  await page.waitForTimeout(500);
  const map = new Map();
  for (let pass = 0; pass < 120; pass++) {
    const { rows, atBottom } = await page.evaluate(scrapeAndScroll);
    for (const r of rows) map.set(r.key, r);
    await page.waitForTimeout(350);
    if (atBottom) {
      const again = await page.evaluate(scrapeAndScroll);
      for (const r of again.rows) map.set(r.key, r);
      break;
    }
  }
  return Array.from(map.values());
}

function classify(rooms, cfg) {
  const toRead = [], skipMention = [], skipDirect = [], skipKeyword = [];
  for (const r of rooms) {
    if (!r.unread) continue;
    // メンションありでも、@全員ブロードキャスト指定の部屋名なら既読化対象にする
    const mentionIgnored = cfg.MENTION_IGNORE_NAMES.some(k => r.name.includes(k));
    if (r.mention && !mentionIgnored) { skipMention.push(r); continue; }
    if (cfg.EXCLUDE_KEYWORDS.some(k => r.name.includes(k))) { skipKeyword.push(r); continue; }
    const forced = cfg.INCLUDE_NAMES.some(k => r.name.includes(k));
    if (cfg.SKIP_DIRECT_MESSAGES && !r.group && !forced) { skipDirect.push(r); continue; }
    toRead.push(r);
  }
  return { toRead, skipMention, skipDirect, skipKeyword };
}

async function markRead(page, key) {
  const li = page.locator(`li[data-role="channel-item"][data-key="${key}"]`);
  if (await li.count() === 0) return 'missing';
  await li.first().scrollIntoViewIfNeeded().catch(() => {});
  await li.first().click({ timeout: 5000 }).catch(() => {});
  try {
    await page.waitForFunction(
      (k) => { const el = document.querySelector(`li[data-role="channel-item"][data-key="${k}"]`); return el && !el.querySelector('span.new'); },
      key, { timeout: 4000 }
    );
    return 'read';
  } catch (_) { return 'timeout'; }
}

/**
 * 1回分の既読スイープを実行。
 * @returns {status:'ok'|'need_login', summary?}
 */
async function runSweep(page, cfg, log) {
  await page.goto(cfg.TALK_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  if (isLoginUrl(page.url())) return { status: 'need_login' };

  await page.waitForSelector(LIST_SEL, { timeout: 30000 }).catch(() => {});
  if (isLoginUrl(page.url())) return { status: 'need_login' };
  await page.waitForTimeout(2000);

  const rooms = await collectRooms(page);
  const { toRead, skipMention, skipDirect, skipKeyword } = classify(rooms, cfg);
  log(`集計: 総=${rooms.length} 既読化対象=${toRead.length} 残す(メンション)=${skipMention.length} 残す(個人)=${skipDirect.length} 残す(除外語)=${skipKeyword.length}`);

  if (cfg.DRY_RUN) {
    log('DRY_RUN: ' + toRead.map(r => `${r.name}(${r.unread})`).join(', '));
    return { status: 'ok', summary: { read: 0, dryRun: toRead.length } };
  }

  let read = 0, timeout = 0, missing = 0;
  for (const r of toRead.slice(0, cfg.MAX_ROOMS_PER_RUN)) {
    const res = await markRead(page, r.key);
    if (res === 'read') read++; else if (res === 'timeout') timeout++; else missing++;
    await page.waitForTimeout(cfg.CLICK_DELAY_MS);
  }
  log(`完了: 既読化=${read} タイムアウト=${timeout} 見つからず=${missing}`);
  return { status: 'ok', summary: { read, timeout, missing, skippedMention: skipMention.length } };
}

module.exports = { loadConfig, isLoginUrl, collectRooms, classify, markRead, runSweep, TALK_URL, LIST_SEL };
