// Diagnose background.js behavior
const { chromium } = require('playwright');
const path = require('path');

async function diagnoseBackground() {
  console.log('=== background.js 動作診断 ===\n');

  const pathToExtension = path.join(__dirname, '..');
  const userDataDir = path.join(__dirname, '.test-profile-diagnose');

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

    console.log('【手順】');
    console.log('1. chrome://extensions/ を開く');
    console.log('2. "Service Worker" をクリックして DevTools を開く');
    console.log('3. Console で以下を確認:\n');

    // chrome://extensions を開く
    const extPage = await context.newPage();
    await extPage.goto('chrome://extensions/');
    await extPage.waitForTimeout(2000);
    await extPage.screenshot({ path: path.join(__dirname, 'diagnose-step1.png') });
    console.log('✓ diagnose-step1.png 保存\n');

    console.log('Service Worker Console で以下のコマンドを実行して、スクリーンショットを撮ってください:\n');
    console.log('// recentTabsの状態を確認');
    console.log('console.log("recentTabs size:", recentTabs.size);');
    console.log('console.log("recentTabs:", Array.from(recentTabs.entries()));\n');

    console.log('【テスト1】タブを1つ作成して閉じる');
    const tab1 = await context.newPage();
    await tab1.goto('https://example.com/?diagnose=1');
    await tab1.waitForLoadState('domcontentloaded');
    console.log('  タブ作成: https://example.com/?diagnose=1');
    await page.waitForTimeout(2000);

    console.log('\nService Worker Console で確認:');
    console.log('console.log("作成後 recentTabs:", Array.from(recentTabs.entries()));\n');

    await tab1.close();
    console.log('  タブ閉鎖');
    await page.waitForTimeout(2000);

    console.log('\nService Worker Console で確認:');
    console.log('console.log("閉鎖後 recentTabs:", Array.from(recentTabs.entries()));');
    console.log('chrome.storage.local.get(["closedTabs"], r => console.log("Storage:", r.closedTabs));\n');

    console.log('【テスト2】3つのタブを作成');
    const tabs = [];
    for (let i = 2; i <= 4; i++) {
      const tab = await context.newPage();
      await tab.goto(`https://example.com/?diagnose=${i}`);
      await tab.waitForLoadState('domcontentloaded');
      tabs.push(tab);
      console.log(`  タブ${i}作成`);
      await page.waitForTimeout(1000);
    }

    console.log('\nService Worker Console で確認:');
    console.log('console.log("3つ作成後 recentTabs size:", recentTabs.size);\n');

    console.log('【テスト3】3つのタブを同時に閉じる');
    await Promise.all(tabs.map(t => t.close()));
    console.log('  同時閉鎖完了');
    await page.waitForTimeout(3000);

    console.log('\nService Worker Console で確認:');
    console.log('chrome.storage.local.get(["closedTabs"], r => {');
    console.log('  console.log("保存件数:", r.closedTabs.length);');
    console.log('  console.log("詳細:", r.closedTabs);');
    console.log('});\n');

    console.log('========================================');
    console.log('上記のコマンド結果をすべてスクリーンショットで撮影してください！');
    console.log('特に以下を確認:');
    console.log('1. recentTabs にタブ情報が入っているか？');
    console.log('2. onRemoved が呼ばれているか？（console.logがあるか確認）');
    console.log('3. Storage に保存されているか？');
    console.log('========================================\n');

    console.log('60秒間ブラウザを開いたままにします...\n');
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await context.close();
  }
}

diagnoseBackground().catch(console.error);
