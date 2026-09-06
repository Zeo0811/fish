import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text()+' '+m.location().url);});page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));
async function input(id,v){await page.locator(id).evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},String(v));}
async function inspect(label){
 await page.waitForTimeout(350);const b=await page.evaluate(()=>window.__river.auditBaits());assert(b.length);assert(b.every(x=>x.index>=0&&x.anchor<1e-8),label+': anchor detached');assert(b.every(x=>x.parts.includes('hook-eye')&&Number.isFinite(x.angle)),label);checks.push(label);return b;
}
try{
 await page.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__river?.getState().assets);
 await page.locator('#toggleSettings').click();await page.locator('#bFish').click();await page.locator('[data-view="underwater"]').click();
 for(const kind of ['tung','bare','moss','grass']){
   await page.locator('#bDiy').click();await page.locator('#baitRows select').last().selectOption(kind);await page.locator('#mClose').click();await page.locator('#bCast').click();await inspect('CP '+kind);
   for(const scale of [1,4]){await input('#vscale',scale);const b=await inspect(kind+' scale '+scale);assert(b.every(x=>x.scale===scale));}
   await page.locator('#bPause').click();const frozen=await inspect(kind+' paused');await page.waitForTimeout(300);assert.deepEqual(await page.evaluate(()=>window.__river.auditBaits()),frozen);
   await page.screenshot({path:`artifacts/bait-underwater-${kind}.png`});await page.locator('#bPause').click();
 }
 await page.locator('#mEU').click();
 for(const topo of ['heavyBottom','heavyTag']){await page.locator(`[data-t="${topo}"]`).click();await inspect('Euro '+topo);await input('#hw',.8);await inspect('Euro weight '+topo);await page.locator('#bCast').click();await inspect('Euro recast '+topo);}
 await page.locator('#mCP').click();await inspect('return CP');assert.equal((await page.evaluate(()=>window.__river.getState().renderer)).programErrors,0);
 // Start the isolated QA renderer on a text route, with no app loop to disturb.
 // The text-only QA route has no page favicon (the real app uses an inline SVG).
 await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
 await page.goto('http://127.0.0.1:5173/simple/vendor/LICENSE-three.txt');await page.setViewportSize({width:1200,height:800});
 const gallery=await page.evaluate(async()=>{const m=await import('/scripts/bait-preview-module.mjs');return m.preview();});
 await page.screenshot({path:'artifacts/bait-gallery.png'});assert.equal(gallery.programErrors,0);assert.equal(errors.length,0,errors.join('\n'));
 await fs.writeFile('artifacts/bait-report.json',JSON.stringify({checks,gallery,errors},null,2));console.log(JSON.stringify({checks,gallery,errors},null,2));
}finally{await browser.close();}
