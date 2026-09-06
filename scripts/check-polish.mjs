import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});const errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));
const shot=async name=>{await page.waitForTimeout(300);return page.screenshot({path:`artifacts/polish-${name}.png`});};
const input=async(id,value)=>{await page.locator(id).evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},String(value));await page.waitForTimeout(250);};
async function fits(id){const r=await page.locator(id).evaluate(el=>{const a=el.getBoundingClientRect();return {x:a.x,right:a.right,y:a.y,bottom:a.bottom,w:innerWidth,h:innerHeight,overflow:el.scrollWidth>el.clientWidth+1};});assert(r.x>=0&&r.right<=r.w&&r.y>=0&&r.bottom<=r.h,JSON.stringify(r));assert(!r.overflow,`${id} horizontal overflow`);}
await fs.mkdir('artifacts',{recursive:true});
try{
 await page.goto('http://localhost:5173',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__river?.getState().assets);await page.waitForTimeout(800);
 await page.locator('#quickPause').click();await page.locator('#toggleSettings').click();
 await input('#flow',.3);await page.locator('#toggleSettings').click();await shot('calm');const calm=await page.evaluate(()=>window.__river.getState().renderer.water);
 await page.locator('#toggleSettings').click();await input('#flow',2.5);await page.locator('#toggleSettings').click();await shot('rapids');const rapid=await page.evaluate(()=>window.__river.getState().renderer.water);assert(rapid.energy>calm.energy);assert(rapid.waveAmplitude>calm.waveAmplitude*10);assert.equal(rapid.travel,calm.travel);
 await page.locator('#toggleSettings').click();await input('#flow',1);await page.locator('#bShowFish').click();await page.locator('#toggleSettings').click();await page.locator('[data-view="underwater"]').click();await page.waitForTimeout(300);await shot('fish');
 const paused=await page.evaluate(()=>window.__river.fishPoses());await page.waitForTimeout(300);assert.deepEqual(await page.evaluate(()=>window.__river.fishPoses()),paused);
 await page.locator('#quickPause').click();await page.waitForTimeout(350);const swimming=await page.evaluate(()=>window.__river.fishPoses());assert(swimming.some((f,i)=>f.phase!==paused[i].phase));assert(swimming.every(f=>[...f.position,f.phase,f.yaw].every(Number.isFinite)));
 await page.locator('#quickPause').click();
 for(const sp of ['baijia','qingbo','makou']){
   await page.evaluate(sp=>window.__river.previewCatch(sp),sp);await page.locator('#biteWrap').waitFor({state:'visible'});await page.waitForTimeout(300);await shot(`catch-${sp}`);await fits('.catch-dialog');
   assert.equal(await page.locator('#shell').evaluate(el=>el.inert),true);await page.locator('#biteBody summary').click();await page.locator('#biteSnap summary').click();await shot(`details-${sp}`);
   const download=page.waitForEvent('download');await page.locator('#biteSave').click();assert.match((await download).suggestedFilename(),/快照/);
   await page.keyboard.press('Escape');await page.locator('#biteWrap').waitFor({state:'hidden'});assert.equal(await page.locator('#shell').evaluate(el=>el.inert),false);
 }
 await page.locator('#toggleSettings').click();await page.locator('#bDiy').click();await fits('#modal');await shot('rig');await page.locator('[data-p="grad"]').click();await page.locator('#mClose').click();await page.locator('#toggleSettings').click();
 await page.locator('#mEU').click();await page.evaluate(()=>window.__river.previewCatch('qingbo'));await page.locator('#biteWrap').waitFor({state:'visible'});await shot('catch-euro');await page.locator('#biteClose').click();assert.equal(await page.locator('#biteWrap').isVisible(),false);
 await page.evaluate(()=>window.__river.previewDriftEnd());await page.locator('#driftEndWrap').waitFor({state:'visible'});await fits('.drift-dialog');await shot('drift');await page.locator('#driftStop').click();
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});await page.evaluate(()=>window.__river.previewCatch('baijia'));await page.locator('#biteWrap').waitFor({state:'visible'});await fits('.catch-dialog');await shot(`catch-${width}`);
  await page.locator('#biteBody summary').click();await page.locator('#biteSnap summary').click();await fits('.catch-dialog');await shot(`details-${width}`);await page.keyboard.press('Escape');
  await page.locator('#mCP').click();await page.locator('#toggleSettings').click();await page.locator('#bDiy').click();await fits('#modal');await shot(`rig-${width}`);await page.keyboard.press('Escape');await page.locator('#toggleSettings').click();
  await page.locator('#mEU').click();await page.evaluate(()=>window.__river.previewDriftEnd());await page.locator('#driftEndWrap').waitFor({state:'visible'});await fits('.drift-dialog');await shot(`drift-${width}`);await page.keyboard.press('Escape');
 }
 assert.equal(errors.length,0,errors.join('\n'));assert.equal((await page.evaluate(()=>window.__river.getState().renderer)).programErrors,0);
 await fs.writeFile('artifacts/polish-report.json',JSON.stringify({calm,rapid,errors,checks:'3 fish portraits, CP/Euro catch, analysis, download, DIY, drift end, keyboard focus, 320/390 mobile, calm/rapids, swim/pause'},null,2));console.log('PASS: overlays, fish and current-driven water.');
}catch(error){console.error('Browser errors:',errors);throw error;}finally{await browser.close();}
