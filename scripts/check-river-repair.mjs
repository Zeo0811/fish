import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));
const input=async(id,v)=>{await page.locator(id).evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},String(v));await page.waitForTimeout(350);};
async function validateGauge(label){
  await page.waitForTimeout(150);
  const first=await page.evaluate(()=>window.__river.auditGauge());
  assert(first.length>0);assert(first.every(g=>g.index>=0),label+': stale nodes');
  assert(first.every(g=>Math.abs(g.clearance-g.displayed)<.000002),label+': values not tied to solver');
  await page.waitForTimeout(550);
  const next=await page.evaluate(()=>window.__river.auditGauge());
  assert(next.some((g,i)=>Math.abs(g.clearance-first[i].clearance)>.0001),label+': values frozen');
  // Airborne nodes legitimately clamp to the water surface in this instrument.
  const interior=next.filter(g=>parseFloat(g.top)>-1&&parseFloat(g.top)<279);
  if(interior.length)assert(next.some((g,i)=>g.top!==first[i].top),label+': markers frozen');
  checks.push(label);
}
try{
  await fs.mkdir('artifacts',{recursive:true});await page.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__river?.getState().assets);
  await page.locator('#toggleSettings').click();await page.locator('#bFish').click();
  await page.locator('#bCast').click();await validateGauge('CP initial');
  for(const depth of [2.2,1.1,1.5]){await input('#depth',depth);await validateGauge('CP depth '+depth);}
  for(let i=0;i<3;i++){await page.locator('#bCast').click();await validateGauge('CP recast '+i);}
  await page.locator('#bHere').click();await validateGauge('CP recast here');
  await page.locator('#bDiy').click();
  for(const preset of ['grad','none','double']){await page.locator(`[data-p="${preset}"]`).click();await validateGauge('CP DIY '+preset);}
  await page.locator('#mClose').click();
  await page.locator('#mEU').click();await validateGauge('Euro switch');
  for(const topo of ['heavyTag','heavyBottom']){
    await page.locator(`[data-t="${topo}"]`).click();await validateGauge('Euro '+topo);
    await page.locator('#bCast').click();await validateGauge('Euro recast '+topo);
    await input('#depth',2);await validateGauge('Euro depth '+topo);
    await input('#ll',300);await validateGauge('Euro leader '+topo);
  }
  await page.locator('#mCP').click();await validateGauge('return CP');assert.equal(await page.locator('#mkF').evaluate(el=>el.style.display),'');
  await page.locator('#bPause').click();await page.waitForTimeout(100);const freeze=await page.evaluate(()=>window.__river.auditGauge());await page.waitForTimeout(300);assert.deepEqual(await page.evaluate(()=>window.__river.auditGauge()),freeze);checks.push('pause freezes gauge');
  const beds=[];
  for(const type of ['sand','gravel','cobble','boulder','bedrock','rubble','mixed']){
    await page.locator('#bedType').selectOption(type);await page.waitForTimeout(250);
    const data=await page.evaluate(()=>window.__river.auditBed());
    const key=p=>[p.x,p.y,p.z,p.r].join('|'),drawn=new Set(data.placements.filter(p=>p.collision).map(key));
    assert(data.physics.every(p=>drawn.has(key(p))),type+': invisible collision');
    assert.equal(data.physics.length,drawn.size,type+': collision count differs');
    assert(data.big.every(b=>b.visible&&Math.abs(b.visible.y-b.expected)<.015),type+': large structure height differs');
    if(type==='sand')assert.equal(data.placements.length,0,'Sand contains invented stones');
    await page.evaluate(()=>window.__river.inspectAt(7.8));await page.waitForTimeout(250);await page.screenshot({path:`artifacts/repair-bed-${type}.png`});
    beds.push({type,colliders:data.physics.length,rendered:data.placements.length,boulders:data.big.length,maxTopError:Math.max(0,...data.big.map(b=>Math.abs(b.visible.y-b.expected)))});
  }
  await page.locator('#toggleSettings').click();await page.locator('#toggleTelemetry').click();await page.screenshot({path:'artifacts/repair-depth-gauge.png'});
  assert.equal(errors.length,0,errors.join('\n'));assert.equal((await page.evaluate(()=>window.__river.getState().renderer)).programErrors,0);
  await fs.writeFile('artifacts/repair-report.json',JSON.stringify({checks,beds,errors},null,2));console.log(JSON.stringify({checks,beds,errors},null,2));
}finally{await browser.close();}
