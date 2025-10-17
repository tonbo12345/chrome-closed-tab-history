const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('Starting promotional screenshot capture...');

  // Launch browser with extension
  const extensionPath = path.join(__dirname, '..');
  const userDataDir = path.join(__dirname, '.test-profile-screenshot');

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
    'https://news.ycombinator.com'
  ];

  for (const url of testUrls) {
    const testPage = await context.newPage();
    await testPage.goto(url);
    await testPage.waitForTimeout(1000);
    await testPage.close();
    console.log('Closed tab:', url);
  }

  await page.waitForTimeout(2000); // Wait for extension to save the tabs
  console.log('Test tabs created and closed');

  // Get extension ID from service worker
  await page.waitForTimeout(2000); // Wait for extension to load

  const serviceWorkers = context.serviceWorkers();
  let extensionId = null;

  for (const sw of serviceWorkers) {
    const url = sw.url();
    console.log('Service Worker URL:', url);
    const match = url.match(/chrome-extension:\/\/([a-z]+)/);
    if (match) {
      extensionId = match[1];
      console.log('Extension ID:', extensionId);
      break;
    }
  }

  if (!extensionId) {
    // Try to find from background pages
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
    console.error('Could not find extension ID. Make sure extension is loaded.');
    console.log('Keeping browser open for manual inspection...');
    await page.waitForTimeout(30000);
    await context.close();
    return;
  }

  // Open extension popup
  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  console.log('Opening popup:', popupUrl);

  const popupPage = await context.newPage();
  await popupPage.goto(popupUrl);
  await popupPage.waitForTimeout(2000); // Wait for popup to fully load

  // Set viewport to extension size
  await popupPage.setViewportSize({ width: 450, height: 600 });

  // Take screenshot
  const screenshotPath = path.join(__dirname, '..', 'screenshots', 'promo-screenshot.png');
  await popupPage.screenshot({
    path: screenshotPath,
    type: 'png'
  });

  console.log('Screenshot saved to:', screenshotPath);
  console.log('\nNext steps:');
  console.log('1. Open tools/resize-screenshot.html');
  console.log('2. Upload screenshots/promo-screenshot.png');
  console.log('3. Download as 1280x800');
  console.log('4. Upload to Chrome Web Store');

  // Keep browser open for 5 seconds so you can see the result
  await popupPage.waitForTimeout(5000);

  await context.close();
  console.log('Done!');
})();
