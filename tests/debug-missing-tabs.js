/**
 * デバッグツール: タブ取りこぼしの原因を特定
 * 様々なパターンでタブを開閉して、どのケースで失敗するか調査
 */

const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const extensionPath = path.resolve(__dirname, '..');

  console.log('=== タブ取りこぼし診断ツール ===\n');
  console.log('拡張機能パス:', extensionPath);

  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  const page = await browser.pages()[0];

  // Service Worker のコンソールログを監視
  const serviceWorkerLogs = [];
  browser.on('console', msg => {
    const text = msg.text();
    serviceWorkerLogs.push({ time: Date.now(), text });
    console.log('[SW]', text);
  });

  console.log('\n初期状態を確認中...\n');
  await page.waitForTimeout(2000);

  // テストケース1: 通常の操作（5秒待機）
  console.log('\n【テスト1】通常のタブ操作（5秒待機）');
  console.log('1. タブを開く');
  const tab1 = await browser.newPage();
  await tab1.goto('https://example.com');
  await tab1.waitForLoadState('networkidle');
  console.log('2. 5秒待機...');
  await page.waitForTimeout(5000);
  console.log('3. タブを閉じる');
  await tab1.close();
  await page.waitForTimeout(1000);
  console.log('✓ 完了\n');

  // テストケース2: 中程度の待機（2秒）
  console.log('【テスト2】中程度の待機（2秒）');
  console.log('1. タブを開く');
  const tab2 = await browser.newPage();
  await tab2.goto('https://example.org');
  await tab2.waitForLoadState('domcontentloaded');
  console.log('2. 2秒待機...');
  await page.waitForTimeout(2000);
  console.log('3. タブを閉じる');
  await tab2.close();
  await page.waitForTimeout(1000);
  console.log('✓ 完了\n');

  // テストケース3: 短い待機（500ms）
  console.log('【テスト3】短い待機（500ms）');
  console.log('1. タブを開く');
  const tab3 = await browser.newPage();
  await tab3.goto('https://example.net');
  console.log('2. 500ms待機...');
  await page.waitForTimeout(500);
  console.log('3. タブを閉じる');
  await tab3.close();
  await page.waitForTimeout(1000);
  console.log('✓ 完了\n');

  // テストケース4: バックグラウンドタブ
  console.log('【テスト4】バックグラウンドタブ（アクティブにしない）');
  console.log('1. バックグラウンドでタブを開く');
  const tab4 = await browser.newPage();
  await tab4.goto('https://www.wikipedia.org');
  await tab4.waitForLoadState('networkidle');
  // アクティブにせず、メインページに戻る
  await page.bringToFront();
  console.log('2. 3秒待機...');
  await page.waitForTimeout(3000);
  console.log('3. バックグラウンドのまま閉じる');
  await tab4.close();
  await page.waitForTimeout(1000);
  console.log('✓ 完了\n');

  // テストケース5: 複数タブを異なるタイミングで閉じる
  console.log('【テスト5】複数タブを時間差で閉じる');
  console.log('1. 3つのタブを開く');
  const tab5a = await browser.newPage();
  await tab5a.goto('https://github.com');
  await page.waitForTimeout(500);

  const tab5b = await browser.newPage();
  await tab5b.goto('https://stackoverflow.com');
  await page.waitForTimeout(500);

  const tab5c = await browser.newPage();
  await tab5c.goto('https://developer.mozilla.org');

  console.log('2. 全てのタブが読み込まれるまで待機...');
  await Promise.all([
    tab5a.waitForLoadState('networkidle'),
    tab5b.waitForLoadState('networkidle'),
    tab5c.waitForLoadState('networkidle')
  ]);

  console.log('3. 3秒待機...');
  await page.waitForTimeout(3000);

  console.log('4. 1秒間隔で閉じる');
  await tab5a.close();
  await page.waitForTimeout(1000);
  await tab5b.close();
  await page.waitForTimeout(1000);
  await tab5c.close();
  await page.waitForTimeout(1000);
  console.log('✓ 完了\n');

  // テストケース6: リダイレクト
  console.log('【テスト6】リダイレクトのあるページ');
  console.log('1. リダイレクトするURLを開く');
  const tab6 = await browser.newPage();
  // bit.ly などの短縮URLを使用（リダイレクト発生）
  await tab6.goto('http://bit.ly/IqT6zt'); // Google へのリダイレクト
  console.log('2. リダイレクト完了まで待機...');
  await tab6.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  console.log('3. タブを閉じる');
  await tab6.close();
  await page.waitForTimeout(1000);
  console.log('✓ 完了\n');

  // ストレージの内容を確認
  console.log('\n=== 最終確認: 保存された履歴 ===\n');
  await page.evaluate(async () => {
    const result = await chrome.storage.local.get(['closedTabs']);
    console.log('保存されたタブ数:', result.closedTabs?.length || 0);
    console.log('\n履歴内容:');
    (result.closedTabs || []).forEach((tab, i) => {
      console.log(`${i + 1}. ${tab.title || '(タイトルなし)'}`);
      console.log(`   URL: ${tab.url}`);
      console.log(`   閉じた時刻: ${new Date(tab.closedAt).toLocaleTimeString()}`);
    });
  });

  // Service Worker の recentTabs キャッシュを確認
  console.log('\n=== recentTabs キャッシュの状態 ===\n');
  const pages = browser.pages();
  if (pages.length > 0) {
    try {
      await page.evaluate(() => {
        // Service Worker に問い合わせ
        console.log('現在のrecentTabsサイズを確認中...');
      });
    } catch (err) {
      console.log('キャッシュ確認エラー:', err.message);
    }
  }

  console.log('\n=== 診断完了 ===');
  console.log('期待: 6つのタブが保存されているはず');
  console.log('実際の結果を上記で確認してください。');
  console.log('\n60秒後にブラウザを閉じます...');

  await page.waitForTimeout(60000);
  await browser.close();
})();
