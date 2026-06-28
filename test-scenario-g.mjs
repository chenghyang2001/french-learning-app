/**
 * Scenario G — French Learning App Puppeteer Smoke Test（修正版）
 * 驗證法語學習單字測驗 app 的端對端流程
 *
 * 關鍵修正：
 * - 結果畫面偵測改用 #view-results.active（有 active class = 真正顯示中）
 * - 答題後等選項按鈕恢復 enabled 再繼續，確保同步正確
 */
import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';
import { join } from 'path';

const SCRATCHPAD = 'C:\\Users\\user\\AppData\\Local\\Temp\\claude\\C--Users-user-workspace-kindle-26-claude-code------french-learning-app\\9392d339-1b24-48c9-80fd-ebc930062b3e\\scratchpad';
const BASE_URL = 'http://localhost:3000';

const results = [];

function log(checkpoint, status, detail = '') {
  const line = `[${status}] ${checkpoint}${detail ? ' — ' + detail : ''}`;
  console.log(line);
  results.push({ checkpoint, status, detail });
}

async function screenshot(page, filename) {
  const filepath = join(SCRATCHPAD, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`  截圖已儲存：${filepath}`);
  return filepath;
}

/** 等待結果畫面（#view-results 取得 active class）*/
async function waitForResultsView(page, timeoutMs = 10000) {
  await page.waitForFunction(
    () => document.getElementById('view-results')?.classList.contains('active'),
    { timeout: timeoutMs }
  );
}

/** 等待測驗畫面（#view-quiz 的 active class + option-a 恢復 enabled）*/
async function waitForNextQuestion(page, timeoutMs = 8000) {
  await page.waitForFunction(
    () => {
      const quizActive = document.getElementById('view-quiz')?.classList.contains('active');
      const optA = document.getElementById('option-a');
      return quizActive && optA && !optA.disabled;
    },
    { timeout: timeoutMs }
  );
}

/** 是否已在結果畫面 */
async function isOnResultsView(page) {
  return page.evaluate(
    () => document.getElementById('view-results')?.classList.contains('active') ?? false
  );
}

async function run() {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // ── Checkpoint 1：首頁載入 ──────────────────────────────────────
    console.log('\n=== Checkpoint 1：首頁載入 ===');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
    await screenshot(page, 'screenshot-01-home.png');

    const btnStart = await page.$('#btn-start');
    if (!btnStart) {
      log('CP1 首頁 #btn-start 存在', 'FAIL', '找不到 #btn-start 元素');
      throw new Error('找不到 #btn-start');
    }
    const isDisabled = await page.$eval('#btn-start', el => el.disabled);
    if (isDisabled) {
      log('CP1 #btn-start 非 disabled', 'FAIL', 'btn-start 是 disabled 狀態');
      throw new Error('#btn-start 是 disabled');
    }
    const btnText = await page.$eval('#btn-start', el => el.textContent.trim());
    log('CP1 首頁顯示 Start Quiz 按鈕（非 disabled）', 'PASS', `按鈕文字：「${btnText}」`);

    // ── Checkpoint 2：點擊 Start Quiz，進入第一題 ────────────────────
    console.log('\n=== Checkpoint 2：進入第一題 ===');
    await page.click('#btn-start');

    // 等待 view-quiz 變成 active
    await page.waitForFunction(
      () => document.getElementById('view-quiz')?.classList.contains('active'),
      { timeout: 8000 }
    );
    await page.waitForSelector('#french-word', { timeout: 5000 });
    await screenshot(page, 'screenshot-02-question.png');

    const frenchWord = await page.$eval('#french-word', el => el.textContent.trim());
    log('CP2 #french-word 出現', 'PASS', `第一題法語單字：「${frenchWord}」`);

    // 確認四個選項按鈕都存在
    const optionIds = ['#option-a', '#option-b', '#option-c', '#option-d'];
    let allOptionsOk = true;
    for (const optId of optionIds) {
      const el = await page.$(optId);
      if (!el) {
        log(`CP2 選項按鈕 ${optId}`, 'FAIL', '找不到');
        allOptionsOk = false;
      }
    }
    if (allOptionsOk) {
      log('CP2 四個選項按鈕（#option-a/b/c/d）全部存在', 'PASS');
    }

    // ── Checkpoint 3：回答 10 題 ──────────────────────────────────────
    console.log('\n=== Checkpoint 3：回答 10 題 ===');
    let answeredCount = 0;
    let highlightDetected = false;

    for (let i = 1; i <= 10; i++) {
      // 確認目前在測驗畫面
      if (await isOnResultsView(page)) {
        console.log(`  第 ${i} 題時已進入結果畫面，結束答題迴圈`);
        break;
      }

      const wordBefore = await page.$eval('#french-word', el => el.textContent.trim()).catch(() => '');

      // 點擊 #option-a
      const optA = await page.$('#option-a');
      if (!optA) {
        console.log(`  第 ${i} 題找不到 #option-a`);
        break;
      }
      await optA.click();
      answeredCount++;
      console.log(`  第 ${i} 題已點選 #option-a（法語：「${wordBefore}」）`);

      // 第 1 題時截圖驗證高亮（CP3a）
      if (i === 1) {
        await new Promise(r => setTimeout(r, 300)); // 等高亮出現
        const hasHighlight = await page.evaluate(() => {
          const btns = document.querySelectorAll('.option-btn');
          for (const btn of btns) {
            if (btn.classList.contains('correct') || btn.classList.contains('incorrect')) {
              return true;
            }
          }
          return false;
        });
        if (hasHighlight) {
          highlightDetected = true;
          await screenshot(page, 'screenshot-02b-highlight.png');
          console.log('  第 1 題選項高亮截圖已儲存');
        }
      }

      // 等待：下一題載入（按鈕恢復）或結果畫面出現
      try {
        await Promise.race([
          waitForNextQuestion(page, 5000),
          waitForResultsView(page, 5000),
        ]);
      } catch {
        // 逾時 — 嘗試繼續
        console.log(`  第 ${i} 題等待下一題/結果逾時，繼續...`);
        await new Promise(r => setTimeout(r, 500));
      }
    }

    if (highlightDetected) {
      log('CP3a 選項高亮（答題後顯示 correct/incorrect class）', 'PASS');
    } else {
      log('CP3a 選項高亮', 'FAIL', '未偵測到 correct/incorrect class');
    }
    log(`CP3 回答題目數`, answeredCount >= 1 ? 'PASS' : 'FAIL', `實際回答 ${answeredCount} 題`);

    // 等待結果畫面出現（最長 15 秒）
    console.log('\n=== Checkpoint 4：等待結果畫面 ===');
    if (!(await isOnResultsView(page))) {
      try {
        await waitForResultsView(page, 15000);
      } catch {
        log('CP4 結果畫面出現', 'FAIL', '等待 15 秒仍未進入 view-results.active');
        throw new Error('結果畫面未出現');
      }
    }

    await screenshot(page, 'screenshot-03-results.png');

    // 等待 score-display 有文字（API 非同步填入）
    await page.waitForFunction(
      () => {
        const el = document.getElementById('score-display');
        return el && el.textContent.trim().length > 0;
      },
      { timeout: 8000 }
    ).catch(() => {});

    const scoreText = await page.$eval('#score-display', el => el.textContent.trim());
    if (scoreText && scoreText.length > 0) {
      log('CP4 #score-display 有文字內容', 'PASS', `分數顯示：「${scoreText}」`);
    } else {
      log('CP4 #score-display 有文字內容', 'FAIL', '文字為空（API 未回應或格式不符）');
    }

    // ── Checkpoint 5：#missed-list（若有答錯）──────────────────────
    console.log('\n=== Checkpoint 5：missed-list 檢查 ===');
    const missedEl = await page.$('#missed-list');
    if (missedEl) {
      const missedHidden = await page.$eval('#missed-list', el => el.hidden);
      if (!missedHidden) {
        const missedItems = await page.$$eval('#missed-list li',
          els => els.map(el => el.textContent.trim()).filter(t => t.length > 0)
        );
        log('CP5 #missed-list 顯示（有答錯）', 'PASS', `共 ${missedItems.length} 個詞條`);
      } else {
        log('CP5 #missed-list 狀態', 'PASS', '元素存在但 hidden（可能全部答對）');
      }
    } else {
      log('CP5 #missed-list', 'PASS', '元素不存在（可能全部答對）');
    }

    // ── Checkpoint 6：#btn-again 存在 ────────────────────────────────
    console.log('\n=== Checkpoint 6：#btn-again 按鈕 ===');
    const btnAgain = await page.$('#btn-again');
    if (btnAgain) {
      const btnAgainText = await page.$eval('#btn-again', el => el.textContent.trim());
      log('CP6 #btn-again 按鈕存在', 'PASS', `按鈕文字：「${btnAgainText}」`);
    } else {
      log('CP6 #btn-again 按鈕存在', 'FAIL', '找不到 #btn-again');
    }

    // 最終截圖
    await screenshot(page, 'screenshot-04-final.png');

  } catch (err) {
    log('執行錯誤', 'ERROR', err.message);
  } finally {
    if (browser) await browser.close();
  }

  // ── 彙整報告 ──────────────────────────────────────────────────────
  console.log('\n========================================');
  console.log('Scenario G 驗證報告');
  console.log('========================================');
  let passCount = 0, failCount = 0;
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✓' : r.status === 'FAIL' ? '✗' : '!';
    console.log(`${icon} ${r.checkpoint}: ${r.status}${r.detail ? ' — ' + r.detail : ''}`);
    if (r.status === 'PASS') passCount++;
    else if (r.status === 'FAIL' || r.status === 'ERROR') failCount++;
  }
  console.log('----------------------------------------');
  console.log(`共 ${results.length} 個檢查點：${passCount} PASS / ${failCount} FAIL`);
  const overall = failCount === 0 ? 'PASS' : 'FAIL';
  console.log(`Scenario G 整體判定：${overall}`);
  console.log('========================================');

  // 儲存報告 JSON
  const reportPath = join(SCRATCHPAD, 'scenario-g-report.json');
  writeFileSync(reportPath, JSON.stringify({ results, passCount, failCount, overall }, null, 2), 'utf-8');
  console.log(`\n詳細報告已儲存：${reportPath}`);
}

run().catch(err => {
  console.error('腳本執行失敗：', err);
  process.exit(1);
});
