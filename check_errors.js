const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

app.use(express.static(__dirname));
const server = app.listen(3000, async () => {
    console.log('Server started on port 3000');
    
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    
    console.log('Done checking.');
    await browser.close();
    server.close();
    process.exit(0);
});
