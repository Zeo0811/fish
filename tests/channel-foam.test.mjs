import test from 'node:test';
import assert from 'node:assert/strict';
import {createChannel} from '../src/channel.js';
import {makeChannelFoam} from '../src/channel-foam.js';
import {makeTravelTexture} from '../src/channel-surface.js';
test('surface flecks advect, stop when paused, and stay finite on a reach reset',()=>{
  const c=createChannel({depth:1.5,flow:1}),f=makeChannelFoam(c,{}),pos=f.mesh.geometry.attributes.position;
  f.update(0,12,true,960);const before=Array.from(pos.array);f.update(.05,12,true,960);const moved=Array.from(pos.array);assert(moved.some((v,i)=>v!==before[i]));
  f.update(.05,12,true,960);assert.deepEqual(Array.from(pos.array),moved);
  f.update(0,145,true,960);assert([...pos.array].every(Number.isFinite));
  f.mesh.geometry.dispose();f.mesh.material.dispose();
});
test('wave travel coordinate is monotonic and remains precise over the entire rendered reach',()=>{
  const c=createChannel({depth:1.5,flow:1}),t=makeTravelTexture(c),d=t.image.data;
  for(let i=4;i<d.length;i+=4)assert(d[i+2]>d[i-2]);
  assert(d instanceof Float32Array);t.dispose();
});
