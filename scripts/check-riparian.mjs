import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>errors.push(r.url()));
try{
  await fs.mkdir('artifacts',{recursive:true});await page.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__river?.auditShore);
  const audit=await page.evaluate(()=>window.__river.auditShore());assert(audit.grass>10000);assert(audit.shrubs>=200);assert(audit.maxRootError<.0001);assert(audit.minMargin>=0);checks.push(audit);
  for(const [x,v] of [[1.2,'bank'],[15,'landscape'],[9,'bank'],[25,'overhead'],[38,'bank']]){
    await page.evaluate(([x,v])=>window.__river.inspectReach(x,v),[x,v]);await page.waitForTimeout(300);await page.screenshot({path:`artifacts/bank-rebuild-${x}-${v}.png`});
  }
  await page.locator('#toggleSettings').click();
  for(const d of [.8,3.2,1.5]){await page.locator('#depth').evaluate((el,d)=>{el.value=d;el.dispatchEvent(new Event('input',{bubbles:true}));},String(d));await page.waitForTimeout(150);const a=await page.evaluate(()=>window.__river.auditShore());assert(a.maxRootError<.0001);checks.push(a);}
  await page.locator('#bFlat').click();await page.waitForTimeout(150);const flat=await page.evaluate(()=>window.__river.auditShore());assert(flat.maxRootError<.0001);checks.push(flat);await page.locator('#bFlat').click();
  const state=await page.evaluate(()=>window.__river.getState());assert.equal(state.renderer.programErrors,0);assert.deepEqual(errors,[]);
  await fs.writeFile('artifacts/riparian-report.json',JSON.stringify({checks,errors,renderer:state.renderer},null,2));console.log(JSON.stringify({checks,errors,renderer:state.renderer},null,2));
}finally{await browser.close();}
