import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { createApp, buildIsComplete } from '../server.mjs';

test('original v78 solver is preserved byte-for-byte',async()=>{
  const s=await fs.readFile(new URL('../src/simulator.js',import.meta.url),'utf8');
  const core=s.slice(s.indexOf("'use strict';"),s.indexOf('const world=await')).trim();
  assert.equal(crypto.createHash('sha256').update(core).digest('hex'),'23a89fc868ce9b53349c95841307749d5c525a82ae41c21ffe1122d96d15a071');
});
test('all licensed assets are present, unchanged and included in production',async()=>{
  const m=JSON.parse(await fs.readFile(new URL('../public/assets/credits.json',import.meta.url)));
  for(const [name,meta] of Object.entries(m.files)){
    const src=await fs.readFile(new URL('../public/assets/'+name,import.meta.url));
    const built=await fs.readFile(new URL('../dist/assets/'+name,import.meta.url));
    assert.equal(src.length,meta.bytes,name);assert.equal(crypto.createHash('sha256').update(src).digest('hex'),meta.sha256,name);assert.deepEqual(built,src);
  }
});
test('bundled simple version preserves upstream simulation scripts',async()=>{
  const s=await fs.readFile(new URL('../public/simple/index.html',import.meta.url),'utf8');
  const scripts=[...s.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(Boolean).join('\n');
  assert.equal(crypto.createHash('sha256').update(scripts).digest('hex'),'9185979374e2d6e6d1e6df306eb400966a3c0c3f07da5180cca81557f94dcc8a');
  assert(!s.includes('cdnjs.cloudflare.com'));
  assert.match(s,/id="switchRealistic" href="\/"/);
  for(const name of ['index.html','navigation.css','vendor/three.r128.min.js','vendor/LICENSE-three.txt']){
    assert.deepEqual(await fs.readFile(new URL('../public/simple/'+name,import.meta.url)),await fs.readFile(new URL('../dist/simple/'+name,import.meta.url)));
  }
});
test('Railway server serves health, HTML, model ranges, and genuine 404s',async t=>{
  const server=createApp().listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const health=await fetch(base+'/healthz',{headers:{Host:'healthcheck.railway.app'}});assert.equal(health.status,200);assert.equal((await health.json()).status,'ok');
  const index=await fetch(base+'/');assert.equal(index.status,200);assert.match(index.headers.get('content-type'),/text\/html/);assert.equal(index.headers.get('cache-control'),'no-cache');assert.match(await index.text(),/River Studio/);
  const glb=await fetch(base+'/assets/rock_09.glb',{headers:{Range:'bytes=0-19'}});assert.equal(glb.status,206);assert.equal((await glb.arrayBuffer()).byteLength,20);
  const missing=await fetch(base+'/assets/does-not-exist.glb');assert.equal(missing.status,404);assert.doesNotMatch(missing.headers.get('content-type'),/html/);
  const privateFile=await fetch(base+'/server.mjs');assert.equal(privateFile.status,404);
  const simple=await fetch(base+'/simple/');assert.equal(simple.status,200);assert.equal(simple.headers.get('cache-control'),'no-cache');assert.match(await simple.text(),/id="switchRealistic" href="\/"/);
  assert.equal((await fetch(base+'/simple')).url,base+'/simple/');
  assert.equal((await fetch(base+'/simple/vendor/three.r128.min.js')).status,200);
  const config=JSON.parse(await fs.readFile(new URL('../railway.json',import.meta.url)));assert.equal(config.deploy.healthcheckPath,'/healthz');assert.equal(config.build.builder,'DOCKERFILE');
});
test('deployment health requires both versions and complete asset payload',()=>{
  assert.equal(buildIsComplete(new URL('../dist/',import.meta.url).pathname),true);
  assert.equal(buildIsComplete(new URL('../public/',import.meta.url).pathname),false);
  assert.equal(buildIsComplete('/a-deliberately-missing-river-build'),false);
});
