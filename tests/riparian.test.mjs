import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createChannel} from '../src/channel.js';
import {bankHabitat,bankElevation,makeTussockGeometry,makeFoliageBillboardGeometry} from '../src/riparian.js';
test('far grass preserves blade positions while reducing geometry',()=>{
  const near=makeTussockGeometry(731),far=makeTussockGeometry(731,8);assert(far.index.count<near.index.count*.3);assert.deepEqual(far.attributes.position.array,near.attributes.position.array.slice(0,far.attributes.position.array.length));near.dispose();far.dispose();
});
test('riparian bands are patchy and asymmetric; waterline remains joined to the channel',()=>{
  const c=createChannel({depth:1.5,flow:1});let asymmetric=0;
  for(let x=-20;x<190;x+=.31)for(const side of [-1,1]){
    const h=bankHabitat(x,side);assert(h.bar>=.28&&h.bar<=2.980001);assert.equal(bankHabitat(x,side,0).cover,0);assert(bankHabitat(x,side,h.bar+3).cover>.5);
    const z=c.bank(x,side),edge=bankElevation(c,c.bed,x,z);assert(Math.abs(edge)<.02);
    assert(Number.isFinite(bankElevation(c,c.bed,x,z+side*15)));if(Math.abs(h.bar-bankHabitat(x,-side).bar)>.8)asymmetric++;
  }assert(asymmetric>100);
});
test('baked tree root maps to ground rather than floating at 5 percent of tree height',()=>{
  const g=makeFoliageBillboardGeometry();g.computeBoundingBox();const b=g.boundingBox;assert(Math.abs(b.min.y+(b.max.y-b.min.y)/12)<1e-6);g.dispose();
});
test('tussocks are complete finite curved blade clusters, not detached alpha cards',()=>{
  const a=makeTussockGeometry(1),b=makeTussockGeometry(2);assert(a.index.count>=28*18);assert(a.attributes.position.count>200);
  for(const g of [a,b]){assert([...g.attributes.position.array,...g.attributes.normal.array].every(Number.isFinite));for(let i=0;i<g.attributes.position.count;i++)assert(g.attributes.position.getY(i)>=0);}
  assert.notDeepEqual(a.attributes.position.array,b.attributes.position.array);a.dispose();b.dispose();
});
test('derived woodland models reduce geometry without replacing original licensed files',async()=>{
  const read=async file=>{const b=await fs.readFile(new URL('../public/assets/'+file,import.meta.url));return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());};
  const tris=j=>j.meshes.reduce((s,m)=>s+m.primitives.reduce((n,p)=>n+j.accessors[p.indices].count/3,0),0);
  for(const id of ['tree_small_02','shrub_01']){const original=await read(id+'.glb'),lod=await read(id+'-riparian-lod.glb');assert(tris(lod)<tris(original)*.25);assert(lod.images.length===original.images.length);}
});
