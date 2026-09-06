import * as THREE from 'three';

// Render-only fish: one continuous local coordinate system for body and fins.
// World position and bite decisions remain owned by the original simulation.
const palette={
  baijia:{back:'#414d45',side:'#aeb8a5',belly:'#e1ded0',fin:'#999b79',height:.115,width:.057},
  qingbo:{back:'#3f4a37',side:'#a7ac87',belly:'#d8d3b8',fin:'#a38c65',height:.13,width:.065},
  makou:{back:'#344b50',side:'#abbec1',belly:'#e1e0d1',fin:'#b18b72',height:.097,width:.041}
};
const geometryCache=new Map(),textureCache=new Map();
const smooth=(a,b,t)=>a+(b-a)*(t*t*(3-2*t));
function profile(t,sp){
  const p=palette[sp],knots=[[0,.015,.009],[.07,.05,.029],[.2,p.height*.83,p.width*.87],[.36,p.height,p.width],[.52,p.height*.87,p.width*.9],[.73,p.height*.5,p.width*.51],[.91,.023,.012],[1,.02,.008]];
  for(let i=1;i<knots.length;i++)if(t<=knots[i][0]){const a=knots[i-1],b=knots[i],u=(t-a[0])/(b[0]-a[0]);return [smooth(a[1],b[1],u),smooth(a[2],b[2],u)];}
  return [.02,.008];
}
function bodyGeometry(sp){
  const key=sp+'body';if(geometryCache.has(key))return geometryCache.get(key);
  const pos=[],uv=[],idx=[],nx=56,nr=32;
  for(let i=0;i<=nx;i++){const t=i/nx,[h,w]=profile(t,sp);
    for(let j=0;j<=nr;j++){const a=j/nr*Math.PI*2;pos.push(-.5+t*.8,Math.sin(a)*h+(t<.18?-.006*(1-t/.18):0),Math.cos(a)*w);uv.push(t,j/nr);}}
  for(let i=0;i<nx;i++)for(let j=0;j<nr;j++){const a=i*(nr+1)+j,b=a+nr+1;idx.push(a,b,a+1,b,b+1,a+1);}
  // Close nose and peduncle so the model is solid from every angle.
  for(const [ring,x,reverse] of [[0,-.5,true],[nx*(nr+1),.3,false]]){
    const c=pos.length/3;pos.push(x,x<0?-.006:0,0);uv.push(x<0?0:1,.5);
    for(let j=0;j<nr;j++)idx.push(...(reverse?[c,ring+j,ring+j+1]:[c,ring+j+1,ring+j]));
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();geometryCache.set(key,geo);return geo;
}
function skin(sp){
  if(textureCache.has(sp))return textureCache.get(sp);
  const p=palette[sp],canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;const ctx=canvas.getContext('2d');
  const side=new THREE.Color(p.side),back=new THREE.Color(p.back),belly=new THREE.Color(p.belly);
  for(let y=0;y<512;y++){const a=y/512*Math.PI*2,s=Math.sin(a),c=side.clone().lerp(s>0?back:belly,Math.pow(Math.abs(s),s>0?1.7:.65));ctx.fillStyle='#'+c.getHexString();ctx.fillRect(0,y,1024,1);}
  // Low-contrast, staggered scales; leave the head unscaled.
  for(let row=0;row<32;row++)for(let col=0;col<47;col++){
    const x=220+col*18+(row%2)*9,y=row*16;
    ctx.lineWidth=.8;ctx.strokeStyle='rgba(33,44,31,.17)';ctx.beginPath();ctx.ellipse(x,y,10,7,0,-1.2,1.2);ctx.stroke();
    ctx.strokeStyle='rgba(241,245,220,.24)';ctx.beginPath();ctx.ellipse(x-1,y-1,9,6,0,-1.1,1.1);ctx.stroke();
  }
  // Lateral line and operculum on both flanks (v=0 and v=.5).
  ctx.strokeStyle='rgba(47,62,43,.22)';ctx.lineWidth=1.4;
  for(const y of [10,256,502]){ctx.beginPath();ctx.moveTo(200,y);ctx.quadraticCurveTo(600,y+6,1018,y+2);ctx.stroke();}
  ctx.strokeStyle='rgba(34,42,32,.36)';ctx.lineWidth=2;
  for(const y of [-18,238,494]){ctx.beginPath();ctx.ellipse(197,y,25,96,0,-1.15,1.15);ctx.stroke();}
  if(sp==='makou')for(let i=0;i<7;i++){ctx.fillStyle='rgba(58,94,107,.15)';ctx.fillRect(290+i*87,220,13,80);}
  const tex=new THREE.CanvasTexture(canvas);tex.flipY=false;tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;textureCache.set(sp,tex);return tex;
}
function finGeometry(points,key){
  if(geometryCache.has(key))return geometryCache.get(key);
  const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(p[0],p[1]))),geo=new THREE.ShapeGeometry(shape);
  const uv=geo.attributes.uv;geo.computeBoundingBox();const box=geo.boundingBox;
  for(let i=0;i<uv.count;i++)uv.setXY(i,(geo.attributes.position.getX(i)-box.min.x)/Math.max(.001,box.max.x-box.min.x),(geo.attributes.position.getY(i)-box.min.y)/Math.max(.001,box.max.y-box.min.y));
  geometryCache.set(key,geo);return geo;
}
function finTexture(){
  if(textureCache.has('fin'))return textureCache.get('fin');
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');
  ctx.fillStyle='rgba(224,223,199,.66)';ctx.fillRect(0,0,128,128);ctx.strokeStyle='rgba(102,102,72,.55)';ctx.lineWidth=1;
  for(let i=0;i<18;i++){ctx.beginPath();ctx.moveTo(0,64);ctx.quadraticCurveTo(70,64+(i-9)*5,128,i*8);ctx.stroke();}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;textureCache.set('fin',t);return t;
}
function animateMaterial(material,uniforms,submerge){
  submerge?.(material);const previous=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{
    previous?.(shader);Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      uniform float fishPhase,fishAmplitude;
      float fishOffset(float x){float t=clamp((x+.5),0.,1.);float a=smoothstep(.18,1.,t);return fishAmplitude*a*a*sin(fishPhase-t*5.4);}
      float fishSlope(float x){return (fishOffset(x+.001)-fishOffset(x-.001))/.002;}`)
      .replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal.x-=fishSlope(position.x)*objectNormal.z;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.z+=fishOffset(position.x);');
  };
  material.customProgramCacheKey=()=>`river-fish-continuous-v3-${Boolean(submerge)}-${material.type}`;
}
export function makeRiverFish(sp,sizeCm,{submerge,seed=0}={}){
  const p=palette[sp]||palette.baijia,g=new THREE.Group(),uniforms={fishPhase:{value:seed},fishAmplitude:{value:.028}};
  g.scale.setScalar(sizeCm/100);const materials=[];
  const bodyMat=new THREE.MeshStandardMaterial({map:skin(sp),roughness:.43,metalness:.18,envMapIntensity:.75});
  const finMat=new THREE.MeshStandardMaterial({color:p.fin,map:finTexture(),transparent:true,opacity:.92,side:THREE.DoubleSide,depthWrite:false,roughness:.65});
  for(const m of [bodyMat,finMat]){animateMaterial(m,uniforms,submerge);materials.push(m);}
  const body=new THREE.Mesh(bodyGeometry(sp),bodyMat);body.castShadow=body.receiveShadow=true;g.add(body);
  const fin=(pts,name)=>{const mesh=new THREE.Mesh(finGeometry(pts,sp+name),finMat);g.add(mesh);return mesh;};
  const h=p.height,H=x=>profile((x+.5)/.8,sp)[0];
  fin([[-.245,H(-.245)*.96],[-.17,h*1.7],[-.105,h*1.55],[.04,H(.04)*.96]],'dorsal');
  fin([[.045,-H(.045)*.94],[.105,-h*1.15],[.16,-h*.82],[.145,-H(.145)*.94]],'anal');
  fin([[.285,.021],[.48,.125],[.46,.075],[.394,0],[.46,-.075],[.48,-.125],[.285,-.021]],'tail');
  // Paired fins are authored in body coordinates so the travelling wave stays continuous.
  for(const s of [-1,1]){
    const pec=fin([[-.31,-.026],[-.155,-.072],[-.19,-.083],[-.3,-.04]],'pectoral'+s);pec.geometry=pec.geometry.clone();
    const a=pec.geometry.attributes.position;for(let i=0;i<a.count;i++)a.setZ(i,s*(p.width*.7+Math.max(0,a.getX(i)+.31)*.5));pec.geometry.computeVertexNormals();pec.userData.privateGeometry=true;
    const pelvic=fin([[-.035,-h*.87],[.065,-h*1.12],[.09,-h*.97],[.005,-h*.73]],'pelvic'+s);pelvic.position.z=s*p.width*.55;
  }
  const eyeGeometry=new THREE.SphereGeometry(.014,12,10),pupilGeometry=new THREE.SphereGeometry(.0085,10,8);
  const irisMat=new THREE.MeshStandardMaterial({color:0x938c56,roughness:.33,metalness:.22});
  const pupilMat=new THREE.MeshStandardMaterial({color:0x111711,roughness:.16});
  for(const m of [irisMat,pupilMat]){submerge?.(m);materials.push(m);}
  for(const s of [-1,1]){const eye=new THREE.Mesh(eyeGeometry,irisMat);eye.scale.z=.45;eye.position.set(-.405,.021,s*.028);g.add(eye);const pupil=new THREE.Mesh(pupilGeometry,pupilMat);pupil.scale.z=.35;pupil.position.set(-.408,.022,s*.034);g.add(pupil);}
  const mouthGeo=new THREE.TorusGeometry(.013,.0025,5,16,Math.PI*1.3),mouth=new THREE.Mesh(mouthGeo,irisMat);mouth.rotation.y=Math.PI/2;mouth.position.set(-.498,-.008,0);g.add(mouth);
  g.userData={uniforms,phase:seed,heading:0,lastX:null,materials,privateGeometry:[eyeGeometry,pupilGeometry,mouthGeo]};
  return g;
}
export function updateRiverFish(g,f,{time,dt,paused,waterSpeed,bed}){
  const u=g.userData,step=paused?0:Math.min(dt,.05),dx=u.lastX===null?0:f.x-u.lastX;u.lastX=f.x;
  const moving=step>0?Math.abs(dx)/step:0,burst=f.dart>0&&moving>.25;
  // Integrate phase: changing speed never snaps the tail into a different pose.
  u.phase+=step*(3.8+Math.min(2,Math.abs(waterSpeed))*4+(burst?8:0));
  u.uniforms.fishPhase.value=u.phase;
  const targetAmp=burst?.075:.022+Math.min(1.5,Math.abs(waterSpeed))*.013;
  if(step>0)u.uniforms.fishAmplitude.value+=(targetAmp-u.uniforms.fishAmplitude.value)*(1-Math.exp(-step*6));
  const targetYaw=burst&&dx>0?Math.PI:Math.sin(time*.42+f.seed)*.055;
  if(step>0){const delta=Math.atan2(Math.sin(targetYaw-u.heading),Math.cos(targetYaw-u.heading));u.heading+=delta*(1-Math.exp(-step*5));}
  g.rotation.y=u.heading;
  // The original encounter point is preserved. Only a bounded breathing motion is visual.
  const minY=bed(f.x,f.z)+(palette[f.sp].height*f.size/100)+.012;
  g.position.set(f.x,Math.max(minY,Math.min(-.04,f.y+Math.sin(time*.9+f.seed)*.003)),f.z);
}
export function disposeRiverFish(g){
  g.userData.materials.forEach(m=>m.dispose());g.userData.privateGeometry.forEach(geo=>geo.dispose());
  g.traverse(o=>{if(o.userData.privateGeometry===true)o.geometry.dispose();});
}
const portraits=new Map();
export function fishPortrait(renderer,environment,sp){
  if(portraits.has(sp))return portraits.get(sp);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#e3e6d7');scene.environment=environment;scene.environmentIntensity=.7;
  scene.add(new THREE.HemisphereLight(0xfaffeb,0x61624f,1.3));const light=new THREE.DirectionalLight(0xfff9df,1.8);light.position.set(-1,3,4);scene.add(light);
  const fish=makeRiverFish(sp,100);fish.rotation.y=-.14;scene.add(fish);
  const camera=new THREE.OrthographicCamera(-.62,.62,.24,-.24,.1,10);camera.position.set(-.12,.14,2);camera.lookAt(0,0,0);
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
