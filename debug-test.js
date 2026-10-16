const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console logs
  page.on('console', msg => {
    if (msg.text().startsWith('[DEBUG FRAME')) {
      console.log(msg.text());
    }
  });

  await page.goto('http://localhost:5173?debug');
  // Wait a bit for the app to load
  await page.waitForTimeout(3000);

  // We need to click on frames to trigger selection.
  // Let's assume we can click on the first few frames.
  // We'll try to click on frames by index using canvas? Not trivial.
  // Instead, we can simulate keyboard arrow keys to navigate and select.
  // The app uses left/right arrows to focus step.
  // We'll send arrow right 5 times to cycle through frames.

  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(800); // wait for selection to settle
  }

  await browser.close();
})();