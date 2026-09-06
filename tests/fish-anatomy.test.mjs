import test from 'node:test';
import assert from 'node:assert/strict';
import { FISH_ANATOMY,fishSection,createFishBodyGeometry } from '../src/fish-anatomy.js';
test('three species have finite, smooth, distinct anatomical meshes with outward flank normals',()=>{
  const widths=[];
  for(const sp of Object.keys(FISH_ANATOMY)){
    const g=createFishBodyGeometry(sp),p=g.attributes.position,n=g.attributes.normal;
    assert(p.count>4600);assert([...p.array,...n.array].every(Number.isFinite));
    for(let i=0;i<=1000;i++)assert(fishSection(i/1000,sp).every(v=>Number.isFinite(v)&&v>0));
    // Ring at t=.5, azimuth=0 faces +Z.
    assert(n.getZ(48*49)>.7);widths.push(g.boundingBox.max.y-g.boundingBox.min.y);g.dispose();
  }
  assert(widths[0]>widths[1]);assert(widths[1]>widths[2]*1.2);
});
