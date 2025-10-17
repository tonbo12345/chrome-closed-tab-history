// Debug script to check storage and popup state
const { chromium } = require('playwright');
const path = require('path');

async function debugStorage() {
  console.log('=== ストレージとポップアップのデバッグ ===\n');

  const pathToExtension = path.join(__dirname, '..');
  const userDataDir = path.join(__dirname, '.test-profile-debug');

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--no-first-run',
      '--no-default-browser-check'
    ]
  });

  try {
    const page = context.pages()[0] || await context.newPage();

    // 25個のタブを作成して閉じる
    console.log('25個のテストタブを作成中...\n');
    for (let i = 1; i <= 25; i++) {
      const newTab = await context.newPage();
      await newTab.goto(`https://example.com/?test=${i}`);
      await newTab.waitForLoadState('domcontentloaded');
      await newTab.waitForTimeout(300);
      console.log(`  ${i}/25 タブを閉鎖...`);
      await newTab.close();
      await page.waitForTimeout(100);
    }

    console.log('\n✓ 25個のタブを閉じました\n');
    console.log('5秒待機してからストレージを確認します...\n');
    await page.waitForTimeout(5000);

    // バックグラウンドスクリプトのコンソールにアクセスするため、
    // Service Workerページを取得
    console.log('拡張機能のService Workerを確認中...\n');

    // 新しいタブで拡張機能のポップアップHTMLを直接開く
    const extensionPage = await context.newPage();

    // まずchrome://extensionsを開いて拡張機能IDを取得
    await extensionPage.goto('chrome://extensions/');
    await extensionPage.waitForTimeout(2000);

    console.log('【手動確認手順】');
    console.log('1. ツールバーの拡張機能アイコンをクリック');
    console.log('2. ポップアップで右クリック → 検証');
    console.log('3. Consoleタブで以下を実行:\n');
    console.log('   chrome.storage.local.get([\'closedTabs\'], (r) => console.log(\'Total:\', r.closedTabs?.length, r.closedTabs))');
    console.log('   console.log(\'allClosedTabs:\', allClosedTabs.length)');
    console.log('   console.log(\'filteredTabs:\', filteredTabs.length)');
    console.log('   console.log(\'currentPage:\', currentPage)');
    console.log('   console.log(\'settings:\', settings)');
    console.log('   document.querySelectorAll(\'.history-item\').length\n');

    console.log('4. Service Worker (background.js) を確認:');
    console.log('   chrome://extensions/ → "Service Worker" リンクをクリック');
    console.log('   Consoleで: chrome.storage.local.get([\'closedTabs\'], (r) => console.log(r.closedTabs?.length, r.closedTabs))\n');

    console.log('ブラウザは90秒間開いたままにします...\n');
    await page.waitForTimeout(90000);

  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await context.close();
  }
}

debugStorage().catch(console.error);
