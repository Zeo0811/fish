// Browser-only QA scene. Not imported by the application or production build.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { makeBaitVisual,disposeBaitVisual,updateBaitVisual } from '../src/bait-visuals.js';
export async function preview(){
  document.body.replaceChildren();document.body.style.margin='0';
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,800);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  document.body.append(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#e9eadf');const env=await new RGBELoader().loadAsync('/assets/daylight.hdr');env.mapping=THREE.EquirectangularReflectionMapping;scene.environment=env;scene.environmentIntensity=.9;
  scene.add(new THREE.HemisphereLight(0xffffff,0x647054,1.2));const light=new THREE.DirectionalLight(0xfff5da,2);light.position.set(-2,4,6);scene.add(light);
  const camera=new THREE.OrthographicCamera(-.05,.05,.0333,-.0333,.001,1);camera.position.set(0,0,.2);camera.lookAt(0,0,0);
  const models=[];const labels=['钨头若虫','无钨头若虫','Moss fly','草饵'];
  for(const [i,bt] of ['tung','bare','moss','grass'].entries()){
    const m=makeBaitVisual({bt,w:.4});m.rotation.z=Math.PI/2;m.rotation.y=-.22;m.position.set(i%2?.01:-.04,i<2?.014:-.018,0);models.push(m);scene.add(m);
    const label=document.createElement('div');label.textContent=labels[i];label.style.cssText=`position:absolute;left:${i%2?720:120}px;top:${i<2?315:705}px;color:#364434;font:18px Georgia,serif;letter-spacing:2px`;document.body.append(label);
  }
  renderer.render(scene,camera);
  return {parts:models.map(m=>({kind:m.userData.kind,parts:m.children.map(o=>o.name),triangles:m.children.reduce((a,o)=>a+o.geometry.index.count/3,0)})),programErrors:renderer.info.programs.filter(p=>p.diagnostics?.runnable===false).length};
}
