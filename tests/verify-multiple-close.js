// Verify multiple tabs close - automated test with screenshots
const { chromium } = require('playwright');
const path = require('path');

async function verifyMultipleClose() {
  console.log('=== 複数タブ閉鎖の自動検証 ===\n');

  const pathToExtension = path.join(__dirname, '..');
  const userDataDir = path.join(__dirname, '.test-profile-verify');

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

    console.log('【ステップ1】5つのタブを作成');
    const tabs = [];
    for (let i = 1; i <= 5; i++) {
      const newTab = await context.newPage();
      await newTab.goto(`https://example.com/?test=${i}`);
      await newTab.waitForLoadState('domcontentloaded');
      tabs.push(newTab);
      console.log(`  タブ${i}: https://example.com/?test=${i}`);
      await page.waitForTimeout(1000); // 確実にonCreatedとonUpdatedが発火するまで待つ
    }

    console.log('\n【ステップ2】5つのタブを同時に閉じる');
    const closeStart = Date.now();
    await Promise.all(tabs.map(tab => tab.close()));
    const closeEnd = Date.now();
    console.log(`  閉鎖完了（${closeEnd - closeStart}ms）`);

    console.log('\n【ステップ3】ストレージに保存されるまで待機（3秒）');
    await page.waitForTimeout(3000);

    console.log('\n【ステップ4】Service Worker経由でストレージを確認');

    // Service Workerページを取得（background scriptのコンテキスト）
    const serviceWorkers = context.serviceWorkers();
    console.log(`  Service Worker数: ${serviceWorkers.length}`);

    // 代わりに、chrome://extensions から確認
    const extPage = await context.newPage();
    await extPage.goto('chrome://extensions/');
    await extPage.waitForTimeout(2000);

    console.log('\n  ※ ストレージの内容は手動で確認が必要です:');
    console.log('  1. chrome://extensions/ を開く');
    console.log('  2. "Service Worker" をクリック');
    console.log('  3. Console で実行: chrome.storage.local.get(["closedTabs"], r => console.log(r.closedTabs.length, r.closedTabs))');
    console.log('\n  この結果のスクリーンショットを撮ってください。');

    // スクリーンショット撮影
    console.log('\n【ステップ5】スクリーンショット撮影');
    await extPage.screenshot({ path: path.join(__dirname, 'verify-extensions.png'), fullPage: true });
    console.log('  ✓ verify-extensions.png を保存');

    console.log('\n【ステップ6】ポップアップをテスト');
    // 拡張機能IDを取得する必要があるため、手動確認用の指示を出す
    console.log('\n次の手動確認をお願いします:');
    console.log('1. ツールバーの拡張機能アイコンをクリック');
    console.log('2. ポップアップが開いて5件表示されることを確認');
    console.log('3. スクリーンショットを撮影してください');

    console.log('\n30秒後に終了します...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('❌ エラー:', error);
    console.error(error.stack);
  } finally {
    await context.close();
  }
}

verifyMultipleClose().catch(console.error);
