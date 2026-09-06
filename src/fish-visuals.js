import * as THREE from 'three';
import { FISH_ANATOMY as palette, fishSection, fishSurface, createFishBodyGeometry, createFinGeometry } from './fish-anatomy.js';

const geometryCache=new Map(),textureCache=new Map();
function bodyGeometry(sp){if(!geometryCache.has(sp))geometryCache.set(sp,createFishBodyGeometry(sp));return geometryCache.get(sp);}
function skin(sp){
  if(textureCache.has(sp))return textureCache.get(sp);
  const p=palette[sp],canvas=document.createElement('canvas'),bump=document.createElement('canvas');
  canvas.width=bump.width=2048;canvas.height=bump.height=1024;
  const ctx=canvas.getContext('2d'),bc=bump.getContext('2d');bc.fillStyle='#808080';bc.fillRect(0,0,2048,1024);
  const side=new THREE.Color(p.side),back=new THREE.Color(p.back),belly=new THREE.Color(p.belly);
  for(let y=0;y<1024;y++){const s=Math.sin(y/1024*Math.PI*2),c=side.clone().lerp(s>0?back:belly,Math.pow(Math.abs(s),s>0?1.3:.58));ctx.fillStyle='#'+c.getHexString();ctx.fillRect(0,y,2048,1);}
  // Species-specific overlapping cycloid scales; the head remains bare.
  const dx=1640/p.scales,dy=1024/30;
  for(let row=-1;row<32;row++)for(let col=0;col<p.scales+1;col++){
    const x=380+col*dx+(row%2)*dx*.5,y=row*dy,flank=Math.pow(Math.abs(Math.cos(y/1024*Math.PI*2)),.6);if(x>2048)continue;
    const grad=ctx.createLinearGradient(x-dx*.5,y-dy*.5,x+dx*.5,y+dy*.5);
    grad.addColorStop(0,`rgba(23,38,37,${.10+flank*.15})`);grad.addColorStop(.38,'rgba(223,242,225,.13)');grad.addColorStop(.72,`rgba(236,248,235,${.17+flank*.13})`);grad.addColorStop(1,'rgba(38,54,48,.31)');
    ctx.fillStyle=grad;ctx.beginPath();ctx.ellipse(x,y,dx*.62,dy*.58,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=`rgba(22,38,40,${sp==='qingbo'?.42:.28})`;ctx.lineWidth=1.6;ctx.beginPath();ctx.ellipse(x,y,dx*.62,dy*.58,0,-1.32,1.32);ctx.stroke();
    bc.fillStyle='#9c9c9c';bc.beginPath();bc.ellipse(x,y,dx*.56,dy*.52,0,0,Math.PI*2);bc.fill();bc.strokeStyle='#505050';bc.lineWidth=2;bc.beginPath();bc.ellipse(x,y,dx*.62,dy*.58,0,-1.32,1.32);bc.stroke();
  }
  if(sp==='makou')for(const offset of [-1024,0,512,1024])for(let i=0;i<10;i++){
    const x=455+i*145,g=ctx.createLinearGradient(x-12,0,x+22,0);g.addColorStop(0,'rgba(29,93,112,0)');g.addColorStop(.5,'rgba(29,93,112,.28)');g.addColorStop(1,'rgba(29,93,112,0)');ctx.fillStyle=g;ctx.fillRect(x-12,offset-112,35,226);
  }
  ctx.strokeStyle='rgba(50,76,72,.3)';ctx.lineWidth=1;
  for(const y of [-5,512,1019]){ctx.beginPath();ctx.moveTo(420,y);ctx.bezierCurveTo(800,y+26,1520,y+18,2048,y);ctx.stroke();}
  const map=new THREE.CanvasTexture(canvas),bumpMap=new THREE.CanvasTexture(bump);map.flipY=bumpMap.flipY=false;map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=bumpMap.anisotropy=4;
  const result={map,bumpMap};textureCache.set(sp,result);return result;
}
function finTexture(){
  if(textureCache.has('fin'))return textureCache.get('fin');
  const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d');
  const membrane=ctx.createLinearGradient(0,0,0,256);membrane.addColorStop(0,'rgba(205,215,194,.88)');membrane.addColorStop(.5,'rgba(211,219,200,.7)');membrane.addColorStop(1,'rgba(192,204,192,.42)');ctx.fillStyle=membrane;ctx.fillRect(0,0,512,256);
  for(let i=0;i<=18;i++){const x=i*512/18;ctx.strokeStyle='rgba(56,75,63,.58)';ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,250);ctx.stroke();ctx.strokeStyle='rgba(242,244,218,.52)';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(x+2,0);ctx.lineTo(x+2,245);ctx.stroke();ctx.strokeStyle='rgba(68,82,71,.35)';ctx.beginPath();ctx.moveTo(x,125);ctx.lineTo(x+6,248);ctx.stroke();}
  const t=new THREE.CanvasTexture(c);t.flipY=false;t.colorSpace=THREE.SRGBColorSpace;textureCache.set('fin',t);return t;
}
function animateMaterial(material,uniforms,submerge){
  submerge?.(material);const previous=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{
    previous?.(shader);Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      uniform float fishPhase,fishAmplitude;
      float fishOffset(float x){float t=clamp(x+.5,0.,1.);float a=smoothstep(.24,1.,t);return fishAmplitude*a*a*sin(fishPhase-t*5.4);}
      float fishSlope(float x){return (fishOffset(x+.001)-fishOffset(x-.001))/.002;}`)
      .replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal.x-=fishSlope(position.x)*objectNormal.z;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.z+=fishOffset(position.x);');
  };
  material.customProgramCacheKey=()=>`river-fish-anatomy-v4-${Boolean(submerge)}-${material.type}`;
}
export function makeRiverFish(sp,sizeCm,{submerge,seed=0}={}){
  if(!palette[sp])sp='baijia';
  const p=palette[sp],g=new THREE.Group(),uniforms={fishPhase:{value:seed},fishAmplitude:{value:.028}},materials=[],privateGeometry=[];g.scale.setScalar(sizeCm/100);
  const bodyMat=new THREE.MeshPhysicalMaterial({...skin(sp),bumpScale:.0005,roughness:.46,metalness:.23,clearcoat:.2,clearcoatRoughness:.3,envMapIntensity:.8});
  const finMat=new THREE.MeshStandardMaterial({color:p.fin,map:finTexture(),transparent:true,opacity:.88,side:THREE.DoubleSide,depthWrite:false,roughness:.54});
  const irisMat=new THREE.MeshPhysicalMaterial({color:0xb5b16f,roughness:.25,metalness:.3,clearcoat:.5}),pupilMat=new THREE.MeshPhysicalMaterial({color:0x070f0e,roughness:.1,clearcoat:1}),seamMat=new THREE.MeshStandardMaterial({color:0x43574e,roughness:.55});
  for(const m of [bodyMat,finMat,seamMat]){animateMaterial(m,uniforms,submerge);materials.push(m);}
  // Eyes use local sphere coordinates, not the body-wide deformation frame.
  for(const m of [irisMat,pupilMat]){submerge?.(m);materials.push(m);}
  const body=new THREE.Mesh(bodyGeometry(sp),bodyMat);body.name='anatomical-body';body.castShadow=body.receiveShadow=true;g.add(body);
  function fin(rootAt,outline,name){
    const curve=new THREE.CatmullRomCurve3(outline.map(a=>new THREE.Vector3(...a))),roots=[],tips=[];
    for(let i=0;i<=18;i++){const t=i/18;roots.push(rootAt(t));tips.push(curve.getPoint(t).toArray());}
    const geo=createFinGeometry(roots,tips),mesh=new THREE.Mesh(geo,finMat);mesh.name=name;g.add(mesh);privateGeometry.push(geo);
  }
  const H=x=>fishSection((x+.5)/.8,sp),d=p.dorsal,a=p.anal;
  fin(t=>{const x=THREE.MathUtils.lerp(d[0],d[2],t);return [x,H(x)[0]*.985,0];},[[d[0],H(d[0])[0],0],[d[1],d[3],0],[d[1]+.055,d[3]*.8,0],[d[2]+.018,H(d[2])[0]*1.06,0]],'dorsal');
  fin(t=>{const x=THREE.MathUtils.lerp(a[0],a[2],t);return [x,-H(x)[1]*.97,0];},[[a[0],-H(a[0])[1],0],[a[1],a[3],0],[a[2]+.012,a[3]*.76,0],[a[2],-H(a[2])[1],0]],'anal');
  fin(t=>[.291,THREE.MathUtils.lerp(-.024,.024,t),0],[[.475,-.116,0],[.493,-.106,0],[.436,-.045,0],[.397,0,0],[.436,.045,0],[.493,.11,0],[.475,.122,0]],'caudal');
  for(const sign of [-1,1]){
    const x=-.29,y=-H(x)[1]*.56,z=fishSurface(x,y,sp)*sign;
    fin(t=>[x+t*.038,y-t*.014,z],[[x,y,z],[-.195,y-.064,z+sign*.065],[-.145,y-.058,z+sign*.066],[-.215,y-.015,z+sign*.018]],'pectoral'+sign);
    const px=-.015,py=-H(px)[1]*.91,pz=fishSurface(px,py,sp)*sign;
    fin(t=>[px+t*.043,py,pz],[[px,py,pz],[.037,py-.07,pz+sign*.027],[.103,py-.057,pz+sign*.025],[.09,py,pz]],'pelvic'+sign);
  }
  function tube(points,r,mat=seamMat){const geo=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(a=>new THREE.Vector3(...a))),24,r,5,false);privateGeometry.push(geo);const m=new THREE.Mesh(geo,mat);g.add(m);return m;}
  for(const s of [-1,1]){
    const ex=sp==='makou'?-.405:-.421,ey=sp==='makou'?.018:.023,ez=fishSurface(ex,ey,sp)+.002;
    const irisGeo=new THREE.SphereGeometry(p.eye,24,16),pupilGeo=new THREE.SphereGeometry(p.eye*.60,20,14);privateGeometry.push(irisGeo,pupilGeo);
    const iris=new THREE.Mesh(irisGeo,irisMat);iris.scale.z=.33;iris.position.set(ex,ey,s*ez);g.add(iris);
    const pupil=new THREE.Mesh(pupilGeo,pupilMat);pupil.scale.z=.22;pupil.position.set(ex-.001,ey,s*(ez+p.eye*.27));g.add(pupil);
    const gill=[];for(let i=0;i<=12;i++){const t=i/12,x=-.306+.026*Math.sin(t*Math.PI),y=THREE.MathUtils.lerp(.063,-.062,t);gill.push([x,y,s*(fishSurface(x,y,sp)+.0008)]);}tube(gill,.0010);
    const mouth=sp==='makou'?[[-.5,.010],[-.464,-.008],[-.406,-.027]]:[[-.493,-.012],[-.478,-.027],[-.452,-.033]];
    tube(mouth.map(([x,y])=>[x,y,s*(fishSurface(x,y,sp)+.001)]),.0013);
    if(sp==='qingbo')for(const [x,len] of [[-.464,.04],[-.438,.055]]){const y=-.02,z=s*(fishSurface(x,y,sp)+.001);tube([[x,y,z],[x+.009,y-.015,z+s*.009],[x+len,y-.025,z+s*.013]],.0012,finMat);}
  }
  g.userData={uniforms,phase:seed,heading:0,lastX:null,materials,privateGeometry,species:sp,scientific:p.scientific};return g;
}
export function updateRiverFish(g,f,{time,dt,paused,waterSpeed,bed}){
  const u=g.userData,step=paused?0:Math.min(dt,.05),dx=u.lastX===null?0:f.x-u.lastX;u.lastX=f.x;
  const moving=step>0?Math.abs(dx)/step:0,burst=f.dart>0&&moving>.25;
  u.phase+=step*(3.8+Math.min(2,Math.abs(waterSpeed))*4+(burst?8:0));u.uniforms.fishPhase.value=u.phase;
  const targetAmp=burst?.075:.022+Math.min(1.5,Math.abs(waterSpeed))*.013;
  if(step>0)u.uniforms.fishAmplitude.value+=(targetAmp-u.uniforms.fishAmplitude.value)*(1-Math.exp(-step*6));
  const targetYaw=burst&&dx>0?Math.PI:Math.sin(time*.42+f.seed)*.055;
  if(step>0){const delta=Math.atan2(Math.sin(targetYaw-u.heading),Math.cos(targetYaw-u.heading));u.heading+=delta*(1-Math.exp(-step*5));}
  g.rotation.y=u.heading;
  const minY=bed(f.x,f.z)+(palette[f.sp].height*f.size/100)+.012;
  g.position.set(f.x,Math.max(minY,Math.min(-.04,f.y+Math.sin(time*.9+f.seed)*.003)),f.z);
}
export function disposeRiverFish(g){g.userData.materials.forEach(m=>m.dispose());g.userData.privateGeometry.forEach(geo=>geo.dispose());}
const portraits=new Map();
export function fishPortrait(renderer,environment,sp){
  if(portraits.has(sp))return portraits.get(sp);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#e3e6d7');scene.environment=environment;scene.environmentIntensity=.85;
  scene.add(new THREE.HemisphereLight(0xf5fff4,0x5e6760,1.3));const light=new THREE.DirectionalLight(0xfff9e7,1.8);light.position.set(-1,3,4);scene.add(light);
  const fish=makeRiverFish(sp,100);fish.rotation.y=-.12;scene.add(fish);
  const camera=new THREE.OrthographicCamera(-.62,.62,.265,-.215,.1,10);camera.position.set(-.07,.1,2);camera.lookAt(0,.025,0);
  const target=new THREE.WebGLRenderTarget(960,372);target.texture.colorSpace=THREE.SRGBColorSpace;
  const previous=renderer.getRenderTarget(),viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4()),scissorTest=renderer.getScissorTest();
  try{
    renderer.setRenderTarget(target);renderer.setScissorTest(false);renderer.clear();renderer.render(scene,camera);
    const pixels=new Uint8Array(960*372*4);renderer.readRenderTargetPixels(target,0,0,960,372,pixels);
    const canvas=document.createElement('canvas');canvas.width=960;canvas.height=372;const ctx=canvas.getContext('2d'),im=ctx.createImageData(960,372);
    for(let y=0;y<372;y++)im.data.set(pixels.subarray((371-y)*960*4,(372-y)*960*4),y*960*4);
    ctx.putImageData(im,0,0);const data=canvas.toDataURL('image/png');portraits.set(sp,data);return data;
  }finally{renderer.setRenderTarget(previous);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);target.dispose();disposeRiverFish(fish);}
}
