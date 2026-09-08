import * as THREE from 'three';
import { REACH_LENGTH } from './channel.js';

// The GPU samples the same depth-averaged field as CPU drag and depth gauges.
// Half floats have linear filtering in WebGL2 without float-linear extensions.
export function makeHydraulicTexture(channel){
  const width=512,height=96,data=new Uint16Array(width*height*4);
  for(let j=0;j<height;j++)for(let i=0;i<width;i++){
    const x=-8+(i+.5)/width*REACH_LENGTH,z=-8+(j+.5)/height*16,c=channel.column(x,z),s=channel.section(x),k=(j*width+i)*4;
    [c.x,c.z,c.depth,Math.abs((z-s.center)/s.halfWidth)].forEach((v,n)=>data[k+n]=THREE.DataUtils.toHalfFloat(v));
  }
  const tex=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.HalfFloatType);
  tex.wrapS=THREE.RepeatWrapping;tex.wrapT=THREE.ClampToEdgeWrapping;tex.minFilter=tex.magFilter=THREE.LinearFilter;tex.needsUpdate=true;
  return tex;
}

export function makeTravelTexture(channel){
  const width=1041,data=new Float32Array(width*4);let travel=0;
  for(let i=0;i<width;i++){
    const x=-52+i*.25,s=channel.section(x);if(i)travel+=.25/Math.max(.2,channel.column(x-.125,0).x);
    [s.center,s.halfWidth,travel,0].forEach((v,j)=>data[i*4+j]=v);
  }
  const tex=new THREE.DataTexture(data,width,1,THREE.RGBAFormat,THREE.FloatType);
  tex.minFilter=tex.magFilter=THREE.NearestFilter;tex.needsUpdate=true;return tex;
}

export const channelWaves=`
uniform sampler2D uHydraulics,uReach;
uniform float uFlow,uTravel,uEnergy,uWaveAmplitude;
vec4 hydraulic(vec2 p){return texture2D(uHydraulics,vec2((p.x+8.)/62.,(p.y+8.)/16.));}
float travelCoordinate(vec2 p){float a=clamp((p.x+52.)*4.,0.,1039.999),i=floor(a);return mix(texture2D(uReach,vec2((i+.5)/1041.,.5)).z,texture2D(uReach,vec2((i+1.5)/1041.,.5)).z,fract(a));}
float localEnergy(vec4 h){float fr=length(h.xy)*uFlow/sqrt(9.81*max(.025,h.z));return smoothstep(.38,1.12,fr)*(1.-smoothstep(.84,1.,h.w));}
float waveHeight(vec2 p){
  vec4 h=hydraulic(p);float e=localEnergy(h),edge=smoothstep(.025,.28,h.z);
  float x=travelCoordinate(p)-uTravel;
  float micro=.0025*(.7*sin(x*5.1+p.y*3.2)+.3*sin(x*11.-p.y*5.));
  // Standing train fixed to the bed; smaller ripples and foam advect through it.
  float standing=sin(p.x*3.8+sin(p.y*1.6)+.55*sin(p.x*1.1+p.y*1.9))+.24*sin(p.x*5.4-p.y*2.4);
  float broken=.25*sin(x*7.+p.y*8.)+.12*sin(x*14.-p.y*11.);
  return edge*(micro+min(.085,h.z*.11)*e*(standing+broken));
}
vec3 waveNormal(vec2 p){float h=waveHeight(p),e=.028;return normalize(vec3(-(waveHeight(p+vec2(e,0.))-h)/e,1.,-(waveHeight(p+vec2(0.,e))-h)/e));}
`;
