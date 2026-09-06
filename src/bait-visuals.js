import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// All dimensions are metres before the existing visual magnification (VS).
// Node mass, radius, drag, topology and bite decisions are never written here.
export function baitDimensions(node){
  const weighted=node.bt==='tung';
  const bead=weighted?THREE.MathUtils.clamp(Math.cbrt(3*Math.max(.05,node.w||.4)/1000/(4*Math.PI*19300)),.0011,.0035):0;
  return {bead,shank:.013,wire:.00034,length:node.bt==='grass'?.040:node.bt==='moss'?.032:.024};
}
function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
const vec=points=>points.map(p=>new THREE.Vector3(...p));
function strand(points,r,segments=14){return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(vec(points)),segments,r,5,false);}
function transformed(geo,position,rotation,scale){
  const m=new THREE.Matrix4(),q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rotation||[0,0,0])));
  return geo.applyMatrix4(m.compose(new THREE.Vector3(...position),q,new THREE.Vector3(...(scale||[1,1,1]))));
}
function flexible(material,uniforms){
  const before=material.onBeforeCompile;
  material.onBeforeCompile=sh=>{
    before?.(sh);Object.assign(sh.uniforms,uniforms);
    sh.vertexShader=sh.vertexShader.replace('#include <common>',`#include <common>
      uniform float baitTime,baitFlow;
      float baitFlex(vec3 p){float t=clamp((-p.y-.007)/.026,0.,1.);return t*t*.0012*min(1.6,abs(baitFlow))*sin(baitTime*6.0+p.y*370.+p.z*810.);}`)
      .replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.z+=baitFlex(position);');
  };
  material.customProgramCacheKey=()=> 'river-bait-fibres-v1';
}
export function makeBaitVisual(node,{submerge,seed=17}={}){
  const g=new THREE.Group(),kind=node.bt,d=baitDimensions(node),rng=random(seed),materials=[],geometries=[];
  const uniforms={baitTime:{value:0},baitFlow:{value:0}};
  function mat(options,soft=false){const m=new THREE.MeshStandardMaterial(options);submerge?.(m);if(soft)flexible(m,uniforms);materials.push(m);return m;}
  const steel=mat({color:0x424c47,metalness:.86,roughness:.26}),gold=mat({color:0xc9a164,metalness:.94,roughness:.23});
  const thread=mat({color:kind==='moss'||kind==='grass'?0x45583a:0x5b422a,roughness:.88});
  const copper=mat({color:0x957052,metalness:.66,roughness:.43});
  const wing=mat({color:0x343d26,metalness:.08,roughness:.68});
  const fibres=mat({color:kind==='moss'?0x64784c:kind==='grass'?0x658148:0x776143,roughness:.96,side:THREE.DoubleSide},true);
  const fibresLight=mat({color:kind==='moss'?0x829268:kind==='grass'?0x8c9d52:0x9a8760,roughness:.94,side:THREE.DoubleSide},true);
  const add=(geo,m,name)=>{geometries.push(geo);const mesh=new THREE.Mesh(geo,m);mesh.name=name;g.add(mesh);return mesh;};
  function batch(parts,m,name){if(!parts.length)return;const merged=mergeGeometries(parts);parts.forEach(p=>p.dispose());return add(merged,m,name);}
  // The leader meets the actual eye at the Node anchor, rather than ending at
  // a featureless cone. A continuous curved wire forms shank, bend and point.
  add(new THREE.TorusGeometry(.00088,d.wire*.7,8,24),steel,'hook-eye');
  add(strand([[0,-.0008,0],[0,-.005,0],[.0002,-.0135,0],[.0028,-.0176,0],[.0062,-.0178,0],[.008,-.0148,0],[.0075,-.0118,0]],d.wire,40),steel,'hook-wire');
  const point=new THREE.ConeGeometry(d.wire*1.04,.002,8);add(transformed(point,[.00725,-.0112,0],[0,0,.3]),steel,'hook-point');
  if(kind==='tung'){
    const pts=[],bore=Math.min(.00052,d.bead*.32),alpha=Math.asin(bore/d.bead);
    for(let i=0;i<=32;i++){const a=Math.PI-alpha-i*(Math.PI-2*alpha)/32;pts.push(new THREE.Vector2(d.bead*Math.sin(a),d.bead*Math.cos(a)));}
    pts.push(new THREE.Vector2(bore,-d.bead*Math.cos(alpha)));pts.push(pts[0].clone());
    const bead=new THREE.LatheGeometry(pts,40);bead.translate(0,-d.bead-.00125,0);add(bead,gold,'drilled-tungsten-bead');
  }
  if(kind==='tung'||kind==='bare'){
    const neck=kind==='tung'?-.00125-d.bead*2:-.0032,end=-.0145;
    const profile=[];for(let i=0;i<=24;i++){const t=i/24;profile.push(new THREE.Vector2(.00055+.00115*Math.pow(t,.78),THREE.MathUtils.lerp(end,neck,t)));}
    const body=new THREE.LatheGeometry(profile,20);add(body,thread,'tapered-abdomen');
    const thorax=new THREE.SphereGeometry(1,20,14);add(transformed(thorax,[0,neck-.001,0],null,[.0019,.0023,.00165]),thread,'dubbing-thorax');
    const back=new THREE.SphereGeometry(1,16,10);add(transformed(back,[0,neck-.0013,.0012],null,[.0014,.0021,.0006]),wing,'wing-case');
    const rib=[];for(let i=0;i<=160;i++){const t=i/160,a=t*Math.PI*2*6,r=.00063+.00117*Math.pow(t,.78);rib.push([Math.cos(a)*r,THREE.MathUtils.lerp(end,neck,t),Math.sin(a)*r]);}add(strand(rib,.000105,120),copper,'copper-rib');
    const tails=[];for(let i=0;i<3;i++)tails.push(strand([[0,end+.0006,(i-1)*.0003],[(i-1)*.00065,end-.003,(i-1)*.0006],[(i-1)*.0013,end-.008,(i-1)*.001]],.00010,10));batch(tails,fibres,'three-tail-fibres');
    const legs=[];for(const s of [-1,1])for(let i=0;i<3;i++){const y=neck-.0006-i*.0007;legs.push(strand([[s*.0009,y,0],[s*.0028,y-.0012,.0007],[s*(.004+i*.0003),y-.003,.0002]],.00013,10));}batch(legs,fibres,'six-soft-legs');
    const fuzz=[];for(let i=0;i<32;i++){const a=rng()*Math.PI*2,y=neck-rng()*.003,r=.0015;fuzz.push(strand([[Math.cos(a)*r,y,Math.sin(a)*r],[Math.cos(a)*r*1.3,y-.001,Math.sin(a)*r*1.3],[Math.cos(a)*r*1.4,y-.0018,Math.sin(a)*r*1.4]],.000065,5));}batch(fuzz,fibresLight,'fine-dubbing');
    const collar=new THREE.TorusGeometry(.00135,.00022,6,20);collar.rotateX(Math.PI/2);collar.translate(0,neck+.0004,0);add(collar,copper,'thread-collar');
  }else if(kind==='moss'){
    const core=new THREE.SphereGeometry(1,16,12);add(transformed(core,[0,-.0055,0],null,[.0022,.004,.002]),thread,'moss-core');
    const dark=[],light=[];
    for(let i=0;i<88;i++){
      const a=rng()*Math.PI*2,r=.0007+rng()*.0017,y=-.003-rng()*.005,l=.010+rng()*.02,spread=.002+rng()*.004;
      const x=Math.cos(a)*r,z=Math.sin(a)*r;
      const geo=strand([[x,y,z],[x+Math.cos(a)*spread,y-l*.3,z+Math.sin(a)*spread],[x+Math.cos(a)*spread*.7,y-l*.7,z+Math.sin(a)*spread*.8],[x*.5+Math.cos(a)*spread*.35,y-l,z*.4]],.00007+rng()*.000045,12);
      (i%3?dark:light).push(geo);
    }
    batch(dark,fibres,'moss-fibres');batch(light,fibresLight,'moss-fibre-highlights');
  }else if(kind==='grass'){
    add(strand([[0,-.001,0],[.0004,-.008,0],[.002,-.018,0],[.006,-.033,0]],.00065,24),thread,'grass-stem');
    const leaves=[],veins=[];
    for(let i=0;i<6;i++){
      const a=i*2.4,rootY=-.004-i*.003,l=.012+rng()*.013,wide=.0016+rng()*.001,positions=[],uv=[],idx=[];
      const cx=Math.cos(a),cz=Math.sin(a);
      for(let j=0;j<=16;j++){
        const t=j/16,width=Math.sin(Math.PI*t)*wide,spread=Math.sin(t*Math.PI*.7)*.0036,x=.001+cx*spread,y=rootY-l*t,z=cz*spread;
        for(const s of [-1,0,1]){positions.push(x+s*width*cz,y+(s===0?.00025*Math.sin(t*Math.PI):0),z-s*width*cx);uv.push((s+1)/2,t);}
        if(j<16)for(let k=0;k<2;k++){const q=j*3+k;idx.push(q,q+3,q+1,q+3,q+4,q+1);}
      }
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();leaves.push(geo);
      veins.push(strand([[.001,rootY,0],[.001+cx*.003,rootY-l*.5,cz*.003],[.001+cx*.003,rootY-l,cz*.003]],.000085,10));
    }
    batch(leaves,fibres,'folded-grass-blades');batch(veins,fibresLight,'leaf-veins');
  }
  g.userData={bait:true,kind,dimensions:d,uniforms,materials,geometries,angle:0};return g;
}
export function updateBaitVisual(g,node,{water,time,dt,paused}){
  const u=g.userData;if(paused)return;
  const slip=water.x-node.v.x,soft=node.bt==='moss'||node.bt==='grass',target=THREE.MathUtils.clamp(Math.atan2(slip*(soft?.85:.28),.65),-.95,.95);
  u.angle+=(target-u.angle)*(1-Math.exp(-Math.min(.05,dt)*7));g.rotation.z=u.angle;
  u.uniforms.baitTime.value=time;u.uniforms.baitFlow.value=slip;
}
export function disposeBaitVisual(g){g.userData.materials.forEach(m=>m.dispose());g.userData.geometries.forEach(geo=>geo.dispose());}
