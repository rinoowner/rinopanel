import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
dotenv.config();

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

  await page.setCookie({
    name: 'device_id',
    value: process.env.DEVICE_ID,
    domain: 'tenda-mod.ggff.net',
    path: '/',
  });

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/115 Safari/537.36"
  );

  await page.goto('https://tenda-mod.ggff.net/index.php', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form && !form.querySelector('input[name="deviceid"]')) {
      const input = document.createElement('input');
      input.name = 'deviceid';
      input.type = 'text';
      input.required = true;
      input.className = 'form-control';
      form.appendChild(input);
    }
  });

  await page.type('input[name="username"]', process.env.TENDA_USERNAME);
  await page.type('input[name="password"]', process.env.TENDA_PASSWORD);
  await page.type('input[name="deviceid"]', process.env.DEVICE_ID);

  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  await page.goto('https://tenda-mod.ggff.net/dashboard.php', { waitUntil: 'networkidle2' });
 await page.screenshot({ path: 'login-debug.png' });
 console.log("📸 Screenshot taken: login-debug.png");

  await page.waitForTimeout(1000);

  const isLoggedIn = await page.evaluate(() => {
    return document.body.innerText.includes("Welcome, Rinomods");
  });

  if (!isLoggedIn) {
    await browser.close();
    throw new Error('❌ Login failed or redirected to login again.');
  }

  await page.goto('https://tenda-mod.ggff.net/buykeys.php', { waitUntil: 'networkidle2' });
  await page.waitForTimeout(1000);

  await page.select('#name', loaderId);
  await page.select('#duration', durationId);

  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  const keyTextarea = await page.$('textarea');
  let finalOutput;

  if (keyTextarea) {
    finalOutput = await page.$eval('textarea', el => el.value.trim());
  } else {
    finalOutput = await page.evaluate(() => document.body.innerText.trim());
  }

  await browser.close();
  return finalOutput;
}




