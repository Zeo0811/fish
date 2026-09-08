import * as THREE from 'three';

// The collision record is the authority for submerged structure placement.
// Never shrink it to fit the unrelated aspect ratio of a scanned rock.
export function collisionRockPlacements(items, boulders, bed, zoneAt) {
  return [
    ...items.map(it=>({x:it.x,y:it.y,z:it.z,r:it.r*.92,t:zoneAt(it.x).t,tint:it.tint,big:false,collision:it.r>=.03&&Math.abs(it.z)<1.3})),
    ...boulders.map(b=>({x:b.x,y:bed(b.x,b.z)+b.r*.35,z:b.z,r:b.r,t:3,tint:.9,big:true,collision:true}))
  ];
}

export function makeBedGeometry(bed,zoneAt,channel){
  const geo=new THREE.PlaneGeometry(260,9,1734,60);geo.rotateX(-Math.PI/2);
  const a=geo.attributes.position,uv=geo.attributes.uv,weightsA=[],weightsB=[];
  for(let i=0;i<a.count;i++){
    const x=a.getX(i)+78,s=channel?.section(x),z=s?s.center+a.getZ(i)/4.5*s.halfWidth:a.getZ(i),t=zoneAt(x).t;
    a.setXYZ(i,x,bed(x,z),z);uv.setXY(i,x,z);
    if(channel){
      // Offset and soften substrate boundaries so they are not straight painted
      // stripes across a natural cross-section. Uniform substrate remains uniform.
      const weights=[0,0,0,0,0,0],shift=.55*Math.sin(z*1.8)+.35*Math.sin(x*.8+z);
      for(let j=-3;j<=3;j++){const type=zoneAt(x+shift+j*.35).t;weights[type]+=1/7;}
      weightsA.push(weights[0],weights[1],weights[2]+weights[3]);weightsB.push(weights[4],weights[5],0);
    }else{
      weightsA.push(t===0?1:0,t===1?1:0,t===2||t===3?1:0);
      weightsB.push(t===4?1:0,t===5?1:0,0);
    }
  }
  geo.setAttribute('bedA',new THREE.Float32BufferAttribute(weightsA,3));
  geo.setAttribute('bedB',new THREE.Float32BufferAttribute(weightsB,3));
  geo.computeVertexNormals();geo.computeBoundingSphere();return geo;
}

// Albedo, normal AND roughness change together. Sand must not inherit the
// gravel normal map; each texture's scale is authored in river metres.
export function makeBedMaterial(textures,submerge){
  const m=new THREE.MeshStandardMaterial({map:textures['sand-color'],normalMap:textures['sand-normal'],roughnessMap:textures['sand-rough'],roughness:.96,normalScale:new THREE.Vector2(.55,.55)});
  submerge(m);const previous=m.onBeforeCompile;
  m.onBeforeCompile=sh=>{
    previous(sh);
    for(const id of ['sand','pebbles','stone'])for(const kind of ['color','normal','rough'])sh.uniforms[`bed_${id}_${kind}`]={value:textures[`${id}-${kind}`]};
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 bedA,bedB;varying vec3 vBedA,vBedB;').replace('#include <begin_vertex>','#include <begin_vertex>\nvBedA=bedA;vBedB=bedB;');
    sh.fragmentShader=sh.fragmentShader.replace('varying vec3 vRiverWorld;',`varying vec3 vRiverWorld;
      varying vec3 vBedA,vBedB;
      uniform sampler2D bed_sand_color,bed_sand_normal,bed_sand_rough,bed_pebbles_color,bed_pebbles_normal,bed_pebbles_rough,bed_stone_color,bed_stone_normal,bed_stone_rough;
      vec3 bedWeights(){float s=vBedA.x+vBedA.z*.62+vBedB.y*.35;float g=vBedA.y+vBedA.z*.38+vBedB.y*.65;return vec3(s,g,vBedB.x);}
      vec2 sandUV(){return vRiverWorld.xz*1.5;}
      vec2 gravelUV(){return vRiverWorld.xz*(2.8+vBedB.y*1.6);}
      vec2 stoneUV(){return vRiverWorld.xz*.42;}
    `).replace('#include <map_fragment>',`
      vec3 bw=bedWeights();
      vec3 sand=mix(texture2D(bed_sand_color,sandUV()).rgb,vec3(.31,.265,.19),.24);
      vec3 gravel=texture2D(bed_pebbles_color,gravelUV()).rgb;
      vec3 rock=texture2D(bed_stone_color,stoneUV()).rgb;
      float macro=rnoise(vRiverWorld.xz*.31);
      float silt=rnoise(vRiverWorld.xz*1.13+7.);
      vec3 bedColor=sand*bw.x+gravel*bw.y+rock*bw.z;
      bedColor*=mix(vec3(.75,.78,.74),vec3(1.04,1.02,.97),macro);
      bedColor=mix(bedColor,bedColor*vec3(.76,.8,.67),vBedB.x*smoothstep(.55,.8,silt)*.32);
      diffuseColor.rgb*=bedColor;
    `).replace('#include <normal_fragment_maps>',`
      vec3 nw=bedWeights();
      vec3 ns=texture2D(bed_sand_normal,sandUV()).xyz*2.-1.;
      vec3 ng=texture2D(bed_pebbles_normal,gravelUV()).xyz*2.-1.;
      vec3 nr=texture2D(bed_stone_normal,stoneUV()).xyz*2.-1.;
      ns.xy*=.14;ng.xy*=.65;nr.xy*=.72;
      vec3 mapN=normalize(ns*nw.x+ng*nw.y+nr*nw.z);
      normal=normalize(tbn*mapN);
    `).replace('#include <roughnessmap_fragment>',`
      float roughnessFactor=roughness;
      vec3 rw=bedWeights();
      roughnessFactor*=clamp(texture2D(bed_sand_rough,sandUV()).g*rw.x+texture2D(bed_pebbles_rough,gravelUV()).g*rw.y+texture2D(bed_stone_rough,stoneUV()).g*rw.z,.62,1.);
    `);
  };
  m.customProgramCacheKey=()=> 'river-bed-v3-complete-pbr';return m;
}

export function makeCollisionRockGeometry(big=false){
  // Unit radius and centre agree with the solver. Tessellation error is under
  // 1% on large structures, rather than the old scan's missing upper half.
  const g=big?new THREE.SphereGeometry(1,40,28):new THREE.IcosahedronGeometry(1,1);
  g.computeBoundingBox();return g;
}
