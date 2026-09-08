import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));
const input=async(id,v)=>{await page.locator(id).evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));},v);await page.waitForTimeout(150);};
try{
  await fs.mkdir('artifacts',{recursive:true});await page.goto(process.env.TEST_URL||'http://127.0.0.1:5173',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__river?.channelAt);
  await page.locator('#toggleSettings').click();await page.locator('#bFish').click();
  for(const mode of ['CP','EU']){
    await page.locator('#m'+mode).click();
    for(const x of [1.2,9,17,25,38,44]){
      await page.locator('#reachJump').selectOption(String(x));await page.waitForTimeout(400);
      const first=await page.evaluate(()=>({g:window.__river.auditGauge(),s:window.__river.getState()}));
      await page.waitForTimeout(450);
      const next=await page.evaluate(()=>({g:window.__river.auditGauge(),s:window.__river.getState()}));
      assert(next.s.nodes.every(n=>n.p.every(v=>Number.isFinite(v)&&Math.abs(v)<500)),`${mode} ${x}: nonfinite nodes`);
      assert(Math.abs(next.s.current.x-x)<10,`${mode} ${x}: incorrect casting section`);
      assert(next.g.every(g=>g.index>=0&&Math.abs(g.clearance-g.displayed)<.000002),`${mode} ${x}: gauge detached`);
      assert(next.g.some((g,i)=>Math.abs(g.clearance-first.g[i].clearance)>.00001),`${mode} ${x}: frozen gauge`);
      checks.push({mode,x,depth:next.s.current.depth,flow:next.s.current.flow});
    }
  }
  await page.locator('#mCP').click();await page.locator('#toggleSettings').click();
  await input('#flow',1);
  await page.evaluate(()=>window.__river.inspectReach(15,'landscape'));await page.waitForTimeout(350);await page.screenshot({path:'artifacts/channel-overview.png'});
  for(const [name,x,view] of [['deep-trench',25,'underwater'],['pool-tail',38,'overhead'],['constriction',9,'overhead']]){
    await page.evaluate(([x,v])=>window.__river.inspectReach(x,v),[x,view]);await page.waitForTimeout(250);await page.screenshot({path:`artifacts/channel-${name}.png`});
  }
  for(const flow of [.3,1,2.5]){
    await input('#flow',flow);await page.evaluate(()=>window.__river.inspectReach(10,'bank'));await page.waitForTimeout(200);await page.screenshot({path:`artifacts/channel-flow-${flow}.png`});
    const report=await page.evaluate(()=>[9,25,38,44].map(x=>window.__river.channelAt(x)));
    checks.push({flow,sections:report});assert(report[1].column.energy<report[0].column.energy||flow===.3);
  }
  const a=await page.evaluate(()=>window.__river.getState());await page.waitForTimeout(400);const b=await page.evaluate(()=>window.__river.getState());assert.equal(a.renderer.water.travel,b.renderer.water.travel);
  assert.equal(b.renderer.programErrors,0);assert.deepEqual(errors,[]);
  await fs.writeFile('artifacts/channel-report.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks:checks.length,errors,programErrors:b.renderer.programErrors}));
}finally{await browser.close();}
