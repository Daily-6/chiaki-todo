const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
  const model=await import(pathToFileURL(path.resolve(__dirname,'../src/model.mjs')).href);
  const out=path.resolve(__dirname,'../.qa');await fs.mkdir(out,{recursive:true});
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:930},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(data=>localStorage.setItem('chiaki-todo-v1',JSON.stringify(data)),model.demoState());
  await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>window.__chiakiReady);await page.locator('.art-card img').evaluate(img=>img.decode());
  await page.screenshot({path:path.join(out,'preview-today.png')});
  await page.locator('[data-view="matrix"]').click();await page.screenshot({path:path.join(out,'preview-matrix.png')});
  await page.locator('[data-action="edit-task"]').first().click();await page.screenshot({path:path.join(out,'preview-editor.png')});
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Preview rendered without errors');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
