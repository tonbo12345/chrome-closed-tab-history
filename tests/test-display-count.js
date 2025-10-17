// Test to verify display count setting works correctly
const { chromium } = require('playwright');
const path = require('path');

async function testDisplayCount() {
  console.log('=== 表示件数設定のテスト ===\n');

  const pathToExtension = path.join(__dirname, '..');
  const userDataDir = path.join(__dirname, '.test-profile-count');

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

    // 30個のタブを作成して閉じる
    console.log('30個のタブを作成中...\n');

    for (let i = 1; i <= 30; i++) {
      const newTab = await context.newPage();
      await newTab.goto(`https://example.com/?tab=${i}`);
      await newTab.waitForLoadState('domcontentloaded');
      console.log(`  ${i}/30 タブを作成・閉鎖中...`);
      await newTab.waitForTimeout(500);
      await newTab.close();
      await page.waitForTimeout(200);
    }

    console.log('\n✓ 30個のタブを閉じました\n');
    console.log('【テスト手順】');
    console.log('1. 拡張機能のアイコンをクリックしてポップアップを開く');
    console.log('2. 表示されているタブの数を数える（デフォルト20個のはず）');
    console.log('3. 設定を開いて表示件数を10に変更');
    console.log('4. 表示が10個に減ることを確認');
    console.log('5. 表示件数を30に変更');
    console.log('6. 表示が30個に増えることを確認\n');

    console.log('【確認方法】');
    console.log('- ポップアップで右クリック → 検証 → Console で以下を実行:');
    console.log('  document.querySelectorAll(".history-item").length\n');

    console.log('ブラウザは60秒間開いたままにします...\n');
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await context.close();
  }
}

testDisplayCount().catch(console.error);
