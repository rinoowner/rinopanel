import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

export async function fetchKeyPhantom(duration) {
  const PANEL_URL = 'https://phantomserver.xyz';
  const USERNAME = 'Phantomvip';
  const PASSWORD = 'rino123';

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    // 🔐 Login to panel
    await page.goto(`${PANEL_URL}/login`, { waitUntil: 'networkidle2' });
    await page.type('input[name="username"]', USERNAME, { delay: 50 });
    await page.type('input[name="password"]', PASSWORD, { delay: 50 });

    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    // 🧭 Navigate to key generation page
    await page.goto(`${PANEL_URL}/keys/generate`, { waitUntil: 'networkidle2' });

    // 🎮 Select "PUBG Mobile" game
    await page.select('select[name="game"]', "PUBG Mobile");

    // 🔢 Set Max Devices = 1
    await page.waitForSelector('input[name="max_devices"]');
    const maxDevicesInput = await page.$('input[name="max_devices"]');
    await maxDevicesInput.click({ clickCount: 3 });
    await maxDevicesInput.type('1');

    // ⏳ Select duration
    await page.select('select[name="duration"]', duration);

    // ✅ Click Generate
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    // 🔑 Wait for and get key
    await page.waitForSelector('strong.key-sensi', { timeout: 5000 });
    const key = await page.$eval('strong.key-sensi', el => el.textContent.trim());

    if (!key) throw new Error("❌ Key not found after generation!");

    await browser.close();
    return key;

  } catch (err) {
    await browser.close();
    throw new Error("❌ Phantom Fetch Error: " + err.message);
  }
}