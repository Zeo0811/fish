import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { collisionRockPlacements,makeBedGeometry,makeCollisionRockGeometry } from '../src/riverbed-visuals.js';
test('every collision-sized pebble and large structure has its exact centre and radius rendered',()=>{
  const items=[{x:1,y:-1.49,z:0,r:.03,tint:.9},{x:2,y:-1.48,z:0,r:.046,tint:1}];
  const big=[{x:4.5,z:.6,r:.55},{x:7.8,z:-.5,r:.85},{x:27,z:.2,r:1}];
  const placements=collisionRockPlacements(items,big,()=>-1.5,()=>({t:3}));
  assert.equal(placements.length,5);assert(placements.every(p=>p.collision));
  for(let i=0;i<2;i++){assert.equal(placements[i].r,items[i].r*.92);assert.equal(placements[i].y,items[i].y);}
  for(let i=0;i<big.length;i++){const p=placements[2+i];assert.equal(p.y,-1.5+big[i].r*.35);assert.equal(p.r,big[i].r);}
  const mesh=new THREE.Mesh(makeCollisionRockGeometry(true),new THREE.MeshBasicMaterial());
  for(const p of placements.filter(p=>p.big)){
    mesh.position.set(p.x,p.y,p.z);mesh.scale.setScalar(p.r);mesh.updateMatrixWorld(true);
    const hit=new THREE.Raycaster(new THREE.Vector3(p.x,5,p.z),new THREE.Vector3(0,-1,0)).intersectObject(mesh)[0];
    assert(hit);assert(Math.abs(hit.point.y-(p.y+p.r))<.001);
  }
});
test('bed vertices sample the physical height and use categorical material weights',()=>{
  const bed=(x,z)=>-1.5+.012*Math.sin(x*14+z*2),g=makeBedGeometry(bed,x=>({t:x<0?0:4})),a=g.attributes.position;
  for(let i=0;i<a.count;i+=97){assert(Math.abs(a.getY(i)-bed(a.getX(i),a.getZ(i)))<.00003);const w=g.attributes.bedA,b=g.attributes.bedB;assert.equal(w.getX(i)+w.getY(i)+w.getZ(i)+b.getX(i)+b.getY(i),1);}
  assert(g.parameters.widthSegments>1700);g.dispose();
});
