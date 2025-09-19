import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';
dotenv.config();

puppeteer.use(StealthPlugin());

export async function fetchKey(loaderId, durationId) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-zygote',
      '--single-process',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu'
    ]
  });

  const page = await browser.newPage();
  await page.goto('https://tenda-mod.ggff.net/index.php', { waitUntil: 'networkidle2' });

  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form && !form.querySelector('input[name="deviceid"]')) {
      const input = document.createElement('input');
      input.name = 'deviceid';
      input.type = 'text';
      form.appendChild(input);
    }
  });

  await page.type('input[name="username"]', process.env.TENDA_USERNAME);
  await page.type('input[name="password"]', process.env.TENDA_PASSWORD);
  await page.type('input[name="deviceid"]', process.env.DEVICE_ID);
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  await page.goto('https://tenda-mod.ggff.net/buykeys.php', { waitUntil: 'networkidle2' });
  await page.select('#name', loaderId);
  await page.select('#duration', durationId);
  await page.click('button[type="submit"]');
  await page.waitForSelector('.alert-success, .alert-danger', { timeout: 5000 });

  let key = await page.$eval('.alert-success', el => el.textContent.trim()).catch(() => null);
  await browser.close();

  if (!key || !key.toLowerCase().includes('key')) {
    throw new Error('❌ Key not found or purchase failed.');
  }

  return key;
}
