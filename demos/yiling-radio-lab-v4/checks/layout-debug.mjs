import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
await page.goto('http://127.0.0.1:8953/?qa=1');await page.locator('#begin').click();
console.log(await page.locator('.radio-console').count());console.log(await page.locator('section').evaluate(e=>[e.className,e.clientHeight,getComputedStyle(e).display,getComputedStyle(e).gridTemplateColumns]));
console.log(await page.locator('link[rel=stylesheet]').evaluateAll(es=>es.map(e=>({href:e.href,rules:e.sheet?[...e.sheet.cssRules].slice(0,5).map(x=>x.cssText):[]}))));
await browser.close();
