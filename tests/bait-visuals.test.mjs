import test from 'node:test';
import assert from 'node:assert/strict';
import { baitDimensions,makeBaitVisual,updateBaitVisual,disposeBaitVisual } from '../src/bait-visuals.js';
test('all four bait models have real hook geometry, finite meshes, and do not mutate physics',()=>{
  for(const bt of ['tung','bare','moss','grass']){
    const n={bt,w:.4,v:{x:.1},r:.003,m:.0004,contact:false},before=JSON.stringify(n),g=makeBaitVisual(n);
    for(const name of ['hook-eye','hook-wire','hook-point'])assert(g.getObjectByName(name),bt+' '+name);
    assert.equal(Boolean(g.getObjectByName('drilled-tungsten-bead')),bt==='tung');
    g.traverse(o=>{if(o.isMesh)assert([...o.geometry.attributes.position.array,...o.geometry.attributes.normal.array].every(Number.isFinite));});
    updateBaitVisual(g,n,{water:{x:1},time:1,dt:.016,paused:false});assert(g.rotation.z>0,'Trailing material must lean downstream');
    const angle=g.rotation.z,time=g.userData.uniforms.baitTime.value;updateBaitVisual(g,n,{water:{x:2},time:2,dt:.05,paused:true});assert.equal(g.rotation.z,angle);assert.equal(g.userData.uniforms.baitTime.value,time);
    assert.equal(JSON.stringify(n),before);let freed=0;g.userData.geometries.forEach(geo=>geo.addEventListener('dispose',()=>freed++));disposeBaitVisual(g);assert.equal(freed,g.userData.geometries.length);
  }
});
test('weighted bead dimensions change with mass without changing the hook or simulation',()=>{
  const small=baitDimensions({bt:'tung',w:.1}),big=baitDimensions({bt:'tung',w:.8});assert(big.bead>small.bead);assert.equal(small.shank,big.shank);assert.equal(baitDimensions({bt:'bare'}).bead,0);
});
