const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('Starting promotional screenshot capture...');

  // Launch browser with extension
  const extensionPath = path.join(__dirname, '..');
  const userDataDir = path.join(__dirname, '.test-profile-screenshots');

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-first-run',
      '--no-default-browser-check'
    ]
  });

  const page = await context.newPage();

  // Create and close some test tabs to populate history
  console.log('Creating test tabs...');

  const testUrls = [
    'https://www.github.com',
    'https://stackoverflow.com',
    'https://www.wikipedia.org',
    'https://www.reddit.com',
    'https://news.ycombinator.com',
    'https://www.npmjs.com',
    'https://developer.mozilla.org',
    'https://www.youtube.com'
  ];

  for (const url of testUrls) {
    const testPage = await context.newPage();
    await testPage.goto(url);
    await testPage.waitForTimeout(1000);
    await testPage.close();
    console.log('Closed tab:', url);
  }

  await page.waitForTimeout(2000);
  console.log('Test tabs created and closed');

  // Get extension ID
  await page.waitForTimeout(2000);

  const serviceWorkers = context.serviceWorkers();
  let extensionId = null;

  for (const sw of serviceWorkers) {
    const url = sw.url();
    const match = url.match(/chrome-extension:\/\/([a-z]+)/);
    if (match) {
      extensionId = match[1];
      console.log('Extension ID:', extensionId);
      break;
    }
  }

  if (!extensionId) {
    const bgPages = context.backgroundPages();
    if (bgPages.length > 0) {
      const url = bgPages[0].url();
      const match = url.match(/chrome-extension:\/\/([a-z]+)/);
      if (match) {
        extensionId = match[1];
      }
    }
  }

  if (!extensionId) {
    console.error('Could not find extension ID');
    await context.close();
    return;
  }

  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  console.log('Opening popup:', popupUrl);

  // Screenshot 1: Main view with tabs
  console.log('\n📸 Capturing Screenshot 1: Main View');
  const popup1 = await context.newPage();
  await popup1.goto(popupUrl);
  await popup1.waitForTimeout(2000);
  await popup1.setViewportSize({ width: 1280, height: 800 });

  await popup1.screenshot({
    path: path.join(__dirname, '..', 'screenshots', 'screenshot-1-main.png'),
    type: 'png'
  });
  console.log('✅ Saved: screenshot-1-main.png');
  await popup1.close();

  // Screenshot 2: Search functionality
  console.log('\n📸 Capturing Screenshot 2: Search Feature');
  const popup2 = await context.newPage();
  await popup2.goto(popupUrl);
  await popup2.waitForTimeout(2000);
  await popup2.setViewportSize({ width: 1280, height: 800 });

  // Type search query
  await popup2.fill('#searchInput', 'github');
  await popup2.waitForTimeout(500);

  await popup2.screenshot({
    path: path.join(__dirname, '..', 'screenshots', 'screenshot-2-search.png'),
    type: 'png'
  });
  console.log('✅ Saved: screenshot-2-search.png');
  await popup2.close();

  // Screenshot 3: Settings view
  console.log('\n📸 Capturing Screenshot 3: Settings');
  const popup3 = await context.newPage();
  await popup3.goto(popupUrl);
  await popup3.waitForTimeout(2000);
  await popup3.setViewportSize({ width: 1280, height: 800 });

  // Open settings by clicking the details summary
  await popup3.evaluate(() => {
    document.querySelector('.settings-section details').open = true;
  });
  await popup3.waitForTimeout(500);

  await popup3.screenshot({
    path: path.join(__dirname, '..', 'screenshots', 'screenshot-3-settings.png'),
    type: 'png'
  });
  console.log('✅ Saved: screenshot-3-settings.png');
  await popup3.close();

  console.log('\n✨ All screenshots captured successfully!');
  console.log('📁 Location: screenshots/');
  console.log('   - screenshot-1-main.png (1280x800)');
  console.log('   - screenshot-2-search.png (1280x800)');
  console.log('   - screenshot-3-settings.png (1280x800)');
  console.log('\n🎯 Ready to upload to Chrome Web Store!');

  await page.waitForTimeout(3000);
  await context.close();
  console.log('Done!');
})();
