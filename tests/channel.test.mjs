import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createChannel,CHANNEL_STATIONS} from '../src/channel.js';
import {makeBedGeometry} from '../src/riverbed-visuals.js';
import {makeHydraulicTexture} from '../src/channel-surface.js';

test('continuous variable banks, deep thalweg, tailout, and periodic seam',()=>{
  const c=createChannel({depth:1.5,flow:1});
  assert(c.section(25).halfWidth>2*c.section(9).halfWidth);
  assert(-c.bed(25,0)>3);assert(-c.bed(39,0)<1.3);
  for(const {x} of CHANNEL_STATIONS){for(const z of [-1,0,1])assert(Math.abs(c.bed(x-1e-5,z)-c.bed(x+1e-5,z))<1e-4);}
  for(let x=-8;x<54;x+=.17){const s=c.section(x);for(const side of [-1,1])assert(Math.abs(c.bed(x,c.bank(x,side)))<.0011);assert.equal(c.velocity(x,.1,0).x,0);assert.equal(c.velocity(x,-9,0).x,0);assert.equal(c.column(x,s.center+s.halfWidth+1).x,0);}
  assert(Math.abs(c.bed(54-1e-6,0)-c.bed(-8+1e-6,0))<1e-5);
});

test('cross-section discharge conserved, including recirculation and vertical drag profile',()=>{
  const p={depth:1.5,flow:1},c=createChannel(p);let reversed=false;
  for(const depth of [.8,1.5,3.2])for(const flow of [0,.3,1,2.5]){
    p.depth=depth;p.flow=flow;
    for(const x of [0,5,9,12,17,25,39,44,49]){
      const s=c.section(x);let q=0;
      for(let j=0;j<256;j++){
        const z=s.center+(2*(j+.5)/256-1)*s.halfWidth,col=c.column(x,z);if(col.x<-.05)reversed=true;
        assert(Object.values(col).every(Number.isFinite));
        q+=col.x*flow*col.depth*2*s.halfWidth/256;
      }
      assert(Math.abs(q-c.discharge())<Math.max(.003,c.discharge()*.006),`Q mismatch at ${x}, depth ${depth}, flow ${flow}`);
    }
  }
  assert(reversed,'expansion margins should have return flow');
  p.depth=1.5;p.flow=1;const b=c.bed(0,0),h=-b;let mean=0;
  for(let i=0;i<200;i++)mean+=c.velocity(0,b+h*(i+.5)/200,0).x/200;
  assert(Math.abs(mean-c.column(0,0).x)<.002);
  assert(c.velocity(0,b+.05,0).x<c.velocity(0,-.01,0).x);
});

test('whitewater responds to local Froude, not narrowing alone or a global fast-water toggle',()=>{
  const p={depth:1.5,flow:1},c=createChannel(p);
  assert(c.column(9,0).x>c.column(0,0).x*2);
  assert(c.column(9,0).energy>.7);assert.equal(c.column(25,0).energy,0);
  p.flow=.3;assert(c.column(9,0).energy<.1);
  p.flow=1;p.depth=3.2;assert(c.column(9,0).energy<.8);
  p.flow=0;assert.deepEqual(c.velocity(9,-.2,0),{x:0,y:0,z:0});
});

test('variable-width bed geometry and GPU texture sample the same physical field',()=>{
  const c=createChannel({depth:1.5,flow:1}),g=makeBedGeometry(c.bed,()=>({t:1}),c),a=g.attributes.position;
  for(let i=0;i<a.count;i+=61){assert(Math.abs(a.getY(i)-c.bed(a.getX(i),a.getZ(i)))<.0001);const s=c.section(a.getX(i));assert(Math.abs(a.getZ(i)-s.center)<=s.halfWidth+.0001);}
  const tex=makeHydraulicTexture(c),{width,height,data}=tex.image;
  for(let j=10;j<height-10;j+=13)for(let i=2;i<width;i+=27){const x=-8+(i+.5)/width*62,z=-8+(j+.5)/height*16,v=c.column(x,z),k=(j*width+i)*4;
    [v.x,v.z,v.depth].forEach((n,ch)=>assert(Math.abs(THREE.DataUtils.fromHalfFloat(data[k+ch])-n)<.01));
  }
  g.dispose();tex.dispose();
});

test('depth and flat changes invalidate hydraulic areas and zero-flow is finite',()=>{
  const p={depth:1.5,flow:1};let flat=false;const c=createChannel(p,()=>({flat})),q=c.discharge();
  p.depth=3;assert(c.discharge()>q*1.9);
  flat=true;assert.equal(c.section(0).halfWidth,c.section(25).halfWidth);assert.equal(c.bed(0,0),c.bed(25,0));
  p.flow=0;assert.equal(c.discharge(),0);assert(Object.values(c.velocity(12,-.2,0)).every(Number.isFinite));
});
