import * as THREE from 'three';
import {channelWaves} from './channel-surface.js';

// Small persistent surface flecks expose convergence, shear and return flow.
// CPU advection follows the channel field; GPU height follows the water mesh.
export function makeChannelFoam(channel,waterUniforms){
  const count=1000,positions=new Float32Array(count*3),alpha=new Float32Array(count),ages=new Float32Array(count),sizes=new Float32Array(count);
  let seed=713,lastTime=0,lastX=Infinity;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('aAlpha',new THREE.BufferAttribute(alpha,1));geo.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{...waterUniforms,uPixelHeight:{value:960}},
    vertexShader:`attribute float aAlpha,aSize;varying float vAlpha;uniform float uPixelHeight;${channelWaves}void main(){vec3 p=position;p.y=waveHeight(p.xz)+.012;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*uPixelHeight*projectionMatrix[1][1]/max(.1,-mv.z),1.,16.);vAlpha=aAlpha;}`,
    fragmentShader:`varying float vAlpha;void main(){vec2 p=(gl_PointCoord-.5)*2.;float d=dot(p,p);if(d>1.)discard;gl_FragColor=vec4(.88,.92,.83,vAlpha*(1.-smoothstep(.1,1.,d)));}`});
  const mesh=new THREE.Points(geo,material);mesh.frustumCulled=false;mesh.renderOrder=2;
  function spawn(i,cx){const x=cx-30+random()*60,s=channel.section(x),z=s.center+(random()*2-1)*s.halfWidth*.9,c=channel.column(x,z);
    positions[i*3]=x;positions[i*3+1]=0;positions[i*3+2]=z;ages[i]=random()*9;sizes[i]=.013+random()*.025;
    alpha[i]=(c.energy>.12||c.x<0)?.38:random()<.05?.16:0;
  }
  function update(time,cx,visible,pixelHeight){
    const reset=time<lastTime||Math.abs(cx-lastX)>20,dt=Math.min(.06,Math.max(0,time-lastTime));lastTime=time;lastX=cx;
    material.uniforms.uPixelHeight.value=pixelHeight;mesh.visible=visible;
    for(let i=0;i<count;i++){
      if(reset||ages[i]>11||Math.abs(positions[i*3]-cx)>32||channel.bed(positions[i*3],positions[i*3+2])>-.035){spawn(i,cx);continue;}
      if(!dt)continue;
      const v=channel.velocity(positions[i*3],-.015,positions[i*3+2],time);
      positions[i*3]+=v.x*dt;positions[i*3+2]+=v.z*dt;ages[i]+=dt;alpha[i]*=Math.exp(-dt*.04);
    }
    for(const a of Object.values(geo.attributes))a.needsUpdate=true;
  }
  return {mesh,update};
}
