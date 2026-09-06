import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const url=process.env.TEST_URL||'http://localhost:5173';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-first-run']});
const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});
const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>requests.push({url:r.url(),error:r.failure()?.errorText}));
async function checkLiveReadout(){
  const r=await page.evaluate(()=>({state:window.__river.getState(),depth:document.querySelector('#hudDepth').dataset.value,flow:document.querySelector('#hudFlow').dataset.value,gauge:document.querySelector('#gDepth').textContent,speed:document.querySelector('#kSpeed').textContent}));
  assert.equal(r.depth,r.state.current.depth.toFixed(2));assert.equal(r.flow,r.state.current.flow.toFixed(2));
  assert.equal(r.gauge,`此处水深 ${r.depth} m`);assert.equal(r.speed.split(' / ')[1],`${r.flow} m/s`);
  return r;
}
await fs.mkdir('artifacts',{recursive:true});
try{
  await page.goto(url,{waitUntil:'networkidle',timeout:90000});
  await page.waitForFunction(()=>window.__river?.getState().assets,{timeout:45000});
  await page.waitForFunction(()=>window.__river.getState().time>2,{timeout:45000});
  const liveBefore=await checkLiveReadout();
  await page.waitForFunction(({d,f})=>{const s=window.__river.getState().current;return s.depth.toFixed(2)!==d&&s.flow.toFixed(2)!==f;},{d:liveBefore.depth,f:liveBefore.flow},{timeout:15000});
  await checkLiveReadout();
  await page.locator('#quickPause').click();
  await page.waitForTimeout(100);const frozen=await checkLiveReadout();await page.waitForTimeout(350);const stillFrozen=await checkLiveReadout();
  assert.deepEqual(stillFrozen.state.current,frozen.state.current,'Paused telemetry must stay still');
  assert.equal((await page.locator('#toggleSettings').innerText()).replace('↗','').trim(),'设置');
  assert.equal(await page.locator('#switchSimple').getAttribute('href'),'/simple/');
  const modeBox=await page.locator('#title').boundingBox();assert(modeBox.y>480,'Mode/status must be in bottom controls');
  await page.screenshot({path:'artifacts/bank.png'});
  const states=[await page.evaluate(()=>window.__river.getState())];
  for(const view of ['landscape','underwater','overhead']){
    await page.locator(`[data-view="${view}"]`).click();
    await page.waitForTimeout(650);await page.screenshot({path:`artifacts/${view}.png`});
    states.push(await page.evaluate(()=>window.__river.getState()));
  }
  await page.locator('#mEU').click();await page.locator('[data-view="underwater"]').click();
  await checkLiveReadout();
  await page.locator('#quickPause').click();await page.waitForTimeout(2500);await page.locator('#quickPause').click();
  await page.screenshot({path:'artifacts/euro.png'});
  await checkLiveReadout();
  await page.locator('#toggleSettings').click();
  for(const bottom of ['sand','cobble','boulder','rubble','mixed']){
    await page.locator('#bedType').selectOption(bottom);await page.waitForTimeout(120);
    const s=await page.evaluate(()=>window.__river.getState());assert(s.nodes.every(n=>n.p.every(Number.isFinite)),`NaN in ${bottom}`);
  }
  for(const depth of ['.8','3.2','1.5']){
    await page.locator('#depth').evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},depth);
    const s=await page.evaluate(()=>window.__river.getState());assert.equal(s.depth,Number(depth));assert(s.nodes.every(n=>n.p.every(Number.isFinite)));
    await page.waitForTimeout(100);await checkLiveReadout();
  }
  await page.locator('#bShowFish').click();await page.waitForTimeout(300);
  await page.locator('#bShowFish').click();
  await page.locator('#mCP').click();
  await page.locator('#bDiy').click();await page.locator('#mClose').click();
  await page.locator('#mEU').click();
  await page.locator('#bTeaching').click();await page.locator('#bNatural').click();
  await page.screenshot({path:'artifacts/settings.png'});
  await page.locator('#toggleSettings').click();await page.locator('#toggleTelemetry').click();
  await page.screenshot({path:'artifacts/telemetry.png'});await page.locator('#toggleTelemetry').click();
  await page.locator('#quality').selectOption('high');await page.locator('#quality').selectOption('balanced');
  await page.setViewportSize({width:390,height:844});await page.locator('[data-view="bank"]').click();await page.waitForTimeout(650);await page.screenshot({path:'artifacts/mobile.png'});
  await page.locator('#toggleSettings').click();await page.screenshot({path:'artifacts/mobile-settings.png'});
  states.push(await page.evaluate(()=>window.__river.getState()));
  await page.locator('#toggleSettings').click();
  for(const width of [320,390,760,1024]){
    await page.setViewportSize({width,height:844});
    const boxes=await page.evaluate(()=>['#title','.view-dock','.top-actions'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return {s,x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
    assert(boxes.every(r=>r.x>=0&&r.right<=width&&r.y>=0&&r.bottom<=844),`UI outside ${width}px viewport: ${JSON.stringify(boxes)}`);
    assert(boxes[0].bottom<=boxes[1].y,'Mode bar overlaps view dock');
    assert.equal(await page.locator('.wordmark').count(),0,'Top-left branding must be removed');
  }
  await page.setViewportSize({width:1440,height:960});
  await page.locator('#switchSimple').click();
  await page.waitForURL('**/simple/');await page.waitForFunction(()=>document.querySelector('canvas')?.width>0);
  await page.locator('#mEU').click();assert.match(await page.locator('#titleH').innerText(),/Euro/);
  await page.locator('#mCP').click();assert.match(await page.locator('#titleH').innerText(),/Centerpin/);
  await page.screenshot({path:'artifacts/simple.png'});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/simple-mobile.png'});
  const simpleBar=await page.locator('#switchRealistic').boundingBox(),simpleSettings=await page.locator('#ctl').boundingBox();assert(simpleBar.y+simpleBar.height<=simpleSettings.y);
  await page.locator('#switchRealistic').click();await page.waitForURL(new URL('/',url).href);
  await page.waitForFunction(()=>window.__river?.getState().assets,{timeout:45000});
  const report={url,states:states.map(s=>({...s,nodes:s.nodes.length})),errors,requests};await fs.writeFile('artifacts/browser-report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  assert.equal(errors.length,0,'Browser or shader errors');assert.equal(requests.length,0,'Asset requests failed');
  assert(states.every(s=>s.renderer.programErrors===0));
  console.log('PASS: live/paused HUD matches local physics and gauge; real assets; four views; CP/Euro; all bed rebuilds; natural/teaching; panels; resize; version switching.');
}finally{await browser.close();}
