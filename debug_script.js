const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  page.on('console', msg => {
    console.log('BROWSER LOG:', msg.text());
  });
  
  page.on('pageerror', err => {
    console.log('BROWSER ERROR:', err.toString());
  });

  console.log('Carregando script...');
  await page.goto('http://localhost:8080/index.html', { waitUntil: 'networkidle2' });
  
  await page.type('#cpf', '987654321');
  await page.type('#senha', '987654');
  await page.click('button[type="submit"]');

  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(e => console.log("Navigation timeout/freeze"));
  
  console.log("Fechando navegador.");
  await browser.close();
})();
