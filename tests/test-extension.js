// Test the Chrome extension with Playwright
const { chromium } = require('playwright');
const path = require('path');

async function testExtension() {
  console.log('Starting Chrome extension test...');
  
  // Launch browser with extension
  const pathToExtension = path.join(__dirname);
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--no-first-run',
      '--no-default-browser-check'
    ]
  });

  try {
    // Get the first page
    const page = context.pages()[0] || await context.newPage();
    
    console.log('Browser launched with extension');
    
    // Navigate to a test page
    await page.goto('https://www.example.com');
    console.log('Navigated to test page');
    
    // Wait a moment for the page to load
    await page.waitForTimeout(2000);
    
    // Open a new tab and close it to create history
    const newTab = await context.newPage();
    await newTab.goto('https://www.google.com');
    await newTab.waitForTimeout(1000);
    await newTab.close();
    console.log('Created and closed a test tab');
    
    // Try to find and click the extension icon
    // Extension icons are usually in the toolbar
    try {
      // Look for extension button - this might need adjustment based on Chrome version
      await page.waitForTimeout(2000);
      
      // Take a screenshot to see the current state
      await page.screenshot({ path: 'extension-test.png', fullPage: true });
      console.log('Screenshot saved as extension-test.png');
      
    } catch (error) {
      console.log('Note: Could not interact with extension icon automatically');
      console.log('The extension should be visible in the browser toolbar');
    }
    
    console.log('Extension test completed. Check the browser window to see the extension.');
    console.log('You can manually click the extension icon to test the popup.');
    
    // Keep browser open for manual testing
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await context.close();
  }
}

testExtension().catch(console.error);