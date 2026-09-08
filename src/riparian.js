import * as THREE from 'three';
export const shoreSmooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function bankHabitat(x,side,margin=0){
  const patch=.5+.27*Math.sin(x*.29+side*2)+.16*Math.sin(x*.83-side);
  const bar=.28+2.7*shoreSmooth(.38,.82,patch);
  const cover=shoreSmooth(bar-.05,bar+1.2,margin)*(.64+.36*shoreSmooth(.1,.8,.5+.5*Math.sin(x*.71+margin*.8+side)));
  return {bar,cover,patch,forest:shoreSmooth(bar+2,bar+7,margin)};
}
export function bankElevation(channel,bed,x,z){
  const s=channel.section(x),d=Math.abs(z-s.center)-s.halfWidth,side=Math.sign(z-s.center),h=bankHabitat(x,side,d);
  if(d<=0)return bed(x,z)-.012;
  const terrace=.35+.35*(1-h.patch),berm=shoreSmooth(h.bar,h.bar+1.7,d)*terrace;
  return d*.07+berm+.19*Math.sin(x*.22+side*1.8)*shoreSmooth(h.bar,h.bar+3,d)
    +.075*Math.sin(x*.93+z*.61)*shoreSmooth(h.bar+.1,h.bar+2,d)+Math.max(0,d-9)*.10;
}
export function makeTussockGeometry(seed=731,blades=28){
  const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const pos=[],colors=[],indices=[];
  for(let blade=0;blade<blades;blade++){
    const angle=rnd()*Math.PI*2,dx=Math.cos(angle),dz=Math.sin(angle),r=Math.sqrt(rnd())*.12,height=.48+rnd()*.60,lean=.25+rnd()*.46,width=.008+rnd()*.012,start=pos.length/3;
    for(let j=0;j<=4;j++){const t=j/4,w=width*(1-t)**.8,x=dx*(r+lean*t*t),z=dz*(r+lean*t*t),y=height*(1.8*t-1.12*t*t);
      for(const side of [-1,1]){pos.push(x+side*dz*w,y,z-side*dx*w);const dry=blade%9===0;colors.push(dry?.13+.12*t:.035+.07*t,dry?.105+.11*t:.09+.16*t,dry?.037+.04*t:.022+.038*t);}
      if(j<4){const a=start+j*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();return g;
}
export function makeFoliageBillboardGeometry(){
  // Bake camera sees y=-0.1..1.1. The model root therefore lies at v=1/12,
  // not the very bottom of the image. Match that interval exactly to the quad.
  const g=new THREE.PlaneGeometry(1.3,1.2);g.translate(0,.5,0);return g;
}
export function makeBankMaterial(textures,submerge){
  const m=new THREE.MeshStandardMaterial({map:textures['soil-color'],normalMap:textures['soil-normal'],roughnessMap:textures['soil-rough'],roughness:1,normalScale:new THREE.Vector2(.65,.65)});
  submerge(m);const previous=m.onBeforeCompile;
  m.onBeforeCompile=sh=>{previous(sh);sh.uniforms.bankGravel={value:textures['pebbles-color']};sh.uniforms.bankGravelNormal={value:textures['pebbles-normal']};
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 bankData;varying vec2 vBankData;').replace('#include <begin_vertex>','#include <begin_vertex>\nvBankData=bankData;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D bankGravel,bankGravelNormal;varying vec2 vBankData;')
      .replace('#include <map_fragment>',`float d=vBankData.x,bar=vBankData.y;float shoreNoise=rnoise(vRiverWorld.xz*.8);float planted=smoothstep(bar-.1,bar+1.15,d+shoreNoise*.45);float bankWet=1.-smoothstep(.1,.8,d);
        vec3 gravel=texture2D(bankGravel,vRiverWorld.xz*2.5).rgb*vec3(.78,.78,.72);
        vec3 loam=texture2D(map,vRiverWorld.xz*.85).rgb*vec3(.49,.54,.34);
        float moss=smoothstep(.2,.78,rnoise(vRiverWorld.xz*1.6))*.65;
        loam=mix(loam,loam*vec3(.48,.83,.37),moss);vec3 ground=mix(gravel,loam,planted);
        ground*=1.-bankWet*.46;ground*=.8+.2*rnoise(vRiverWorld.xz*.17);diffuseColor.rgb*=ground;`)
      .replace('#include <normal_fragment_maps>',`float bmix=smoothstep(vBankData.y-.1,vBankData.y+1.15,vBankData.x);vec3 gravelN=texture2D(bankGravelNormal,vRiverWorld.xz*2.5).xyz*2.-1.;vec3 soilN=texture2D(normalMap,vRiverWorld.xz*.85).xyz*2.-1.;vec3 mapN=mix(gravelN,soilN,bmix);mapN.xy*=.6;normal=normalize(tbn*mapN);`);
  };m.customProgramCacheKey=()=> 'riparian-ground-v1';return m;
}
