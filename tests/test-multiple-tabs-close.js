// Test multiple tabs closing simultaneously
const { chromium } = require('playwright');
const path = require('path');

async function testMultipleTabsClose() {
  console.log('=== 複数タブ同時閉鎖のテスト ===\n');

  const pathToExtension = path.join(__dirname, '..');
  const userDataDir = path.join(__dirname, '.test-profile-multiple');

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

    console.log('【テスト1】5つのタブを開いて、右クリック→「右側のタブを閉じる」');
    console.log('期待: 4つのタブすべてが履歴に記録される\n');

    // 5つのタブを作成
    const tabs = [];
    for (let i = 1; i <= 5; i++) {
      const newTab = await context.newPage();
      await newTab.goto(`https://example.com/?tab=${i}`);
      await newTab.waitForLoadState('domcontentloaded');
      tabs.push(newTab);
      console.log(`  タブ${i}を作成: https://example.com/?tab=${i}`);
      await page.waitForTimeout(500);
    }

    console.log('\n手動操作:');
    console.log('1. 左から2番目のタブを右クリック');
    console.log('2. 「右側のタブを閉じる」を選択');
    console.log('3. 拡張機能アイコンをクリックして履歴を確認');
    console.log('4. 4つのタブ（tab=2,3,4,5）が記録されているか確認\n');

    console.log('60秒後に自動で全タブを閉じるテストを実行します...\n');
    await page.waitForTimeout(60000);

    console.log('【テスト2】プログラムで複数タブを一度に閉じる');

    // 新しく5つのタブを作成
    const newTabs = [];
    for (let i = 6; i <= 10; i++) {
      const newTab = await context.newPage();
      await newTab.goto(`https://example.com/?auto=${i}`);
      await newTab.waitForLoadState('domcontentloaded');
      newTabs.push(newTab);
      console.log(`  タブ${i}を作成: https://example.com/?auto=${i}`);
      await page.waitForTimeout(300);
    }

    console.log('\n一度に全タブを閉じます...');
    await Promise.all(newTabs.map(tab => tab.close()));

    console.log('✓ 5つのタブを同時に閉じました');
    console.log('\n拡張機能アイコンをクリックして確認:');
    console.log('- 5つのタブ（auto=6,7,8,9,10）がすべて記録されているか\n');

    console.log('確認のため30秒間ブラウザを開いたままにします...\n');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await context.close();
  }
}

testMultipleTabsClose().catch(console.error);
