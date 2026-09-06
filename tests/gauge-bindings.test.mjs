import test from 'node:test';
import assert from 'node:assert/strict';
import { sameGaugeBinding } from '../src/gauge-bindings.js';
test('identical rig settings must rebind newly allocated nodes after a recast',()=>{
  const first=[{type:'shot'},{type:'bait'}],recast=first.map(n=>({...n}));
  for(const mode of ['cp','euro']){
    assert.equal(sameGaugeBinding(first,first,mode,mode),true);
    assert.equal(sameGaugeBinding(first,recast,mode,mode),false);
    assert.equal(sameGaugeBinding(first,first,mode,mode+'-other-topology'),false);
  }
});
