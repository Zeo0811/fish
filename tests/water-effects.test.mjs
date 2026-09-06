import test from 'node:test';
import assert from 'node:assert/strict';
import {waterAppearance} from '../src/water-effects.js';
test('water visibly and continuously responds to flow without moving the physical surface',()=>{
  const calm=waterAppearance(.3),fast=waterAppearance(1.6),rapid=waterAppearance(2.5);
  assert.equal(calm.foamStrength,0);assert(rapid.foamStrength>fast.foamStrength);assert(rapid.waveAmplitude>calm.waveAmplitude*10);
  let previous=calm;for(let f=.3;f<=2.5;f+=.01){const next=waterAppearance(f);assert(next.energy>=previous.energy);assert(next.waveAmplitude<.05);assert(Object.values(next).every(Number.isFinite));previous=next;}
});
