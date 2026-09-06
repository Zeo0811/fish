import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { Refractor } from 'three/addons/objects/Refractor.js';
import { loadProgress } from './shell.js';
import { waterAppearance, surfaceWaves } from './water-effects.js';

const A='/assets/';
const riverLight=`
float rhash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float rnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(rhash(i),rhash(i+vec2(1,0)),f.x),mix(rhash(i+vec2(0,1)),rhash(i+vec2(1,1)),f.x),f.y);}
float rcaustic(vec2 p,float t){p=p*3.8+vec2(t*.15,-t*.08);p+=vec2(sin(p.y*1.4+t*.6),cos(p.x*1.2-t*.45))*.35;vec2 g=floor(p),f=fract(p);float a=8.,b=8.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y));vec2 h=vec2(rhash(g+o),rhash(g+o+23.4));vec2 r=o+.5+.32*sin(t*.65+6.283*h)-f;float d=dot(r,r);if(d<a){b=a;a=d;}else b=min(b,d);}return pow(1.-smoothstep(.012,.16,b-a),2.);}
float rpath(vec3 p,vec3 eye){float l=length(eye-p);if(p.y<0.&&eye.y<0.)return l;if(p.y>=0.&&eye.y>=0.)return 0.;return l*clamp(-min(p.y,eye.y)/max(.001,abs(eye.y-p.y)),0.,1.);}
`;
function seeded(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}

export async function createRiverWorld({host,P,bed,zoneAt}){
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
  renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
  host.append(renderer.domElement);
  const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0xa4b3a1,.012);
  const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.025,250);
  const nature={value:1},timeUniform={value:0},eyeUniform={value:new THREE.Vector3()};
  const manager=new THREE.LoadingManager();manager.onProgress=(_,done,total)=>loadProgress(done,total);
  const loader=new THREE.TextureLoader(manager),gltf=new GLTFLoader(manager);
  const textures={};
  const textureJobs=['pebbles','soil','stone','sand'].flatMap(id=>['color','normal','rough'].map(async type=>{
    const t=await loader.loadAsync(`${A}${id}-${type}.webp`);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());if(type==='color')t.colorSpace=THREE.SRGBColorSpace;textures[`${id}-${type}`]=t;
  }));
  textureJobs.push(loader.loadAsync(A+'grass-alpha.png').then(t=>{t.flipY=false;textures.grassAlpha=t;}));
  const modelIds=['rock_moss_set_01','rock_09','fern_02','shrub_01','tree_small_02','grass_bermuda_01'];
  const [env,...models]=await Promise.all([new RGBELoader(manager).loadAsync(A+'daylight.hdr'),...modelIds.map(id=>gltf.loadAsync(A+id+'.glb')),...textureJobs]);
  env.mapping=THREE.EquirectangularReflectionMapping;scene.environment=env;scene.background=env;scene.environmentIntensity=.64;scene.backgroundIntensity=.72;
  scene.backgroundRotation.y=.6;scene.environmentRotation.y=.6;
  const hemi=new THREE.HemisphereLight(0xc6dce7,0x52503a,.55);scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffead1,3.1);sun.position.set(-18,26,18);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-20,right:20,top:20,bottom:-20,near:.5,far:85});sun.shadow.bias=-.00018;sun.shadow.normalBias=.035;scene.add(sun,sun.target);
  const geometrySet=new Set(),materialSet=new Set();
  function submerge(mat){
    if(mat.userData.riverFog)return;mat.userData.riverFog=true;
    const previous=mat.onBeforeCompile;
    mat.onBeforeCompile=sh=>{
      previous?.(sh,renderer);sh.uniforms.uRiverTime=timeUniform;sh.uniforms.uNature=nature;sh.uniforms.uEye=eyeUniform;
      sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vRiverWorld;').replace('#include <project_vertex>',`vec4 rw=vec4(transformed,1.);
        #ifdef USE_INSTANCING
        rw=instanceMatrix*rw;
        #endif
        vRiverWorld=(modelMatrix*rw).xyz;
        #include <project_vertex>`);
      sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vRiverWorld;uniform vec3 uEye;uniform float uRiverTime,uNature;\n'+riverLight)
        .replace('#include <tonemapping_fragment>',`float depth=max(0.,-vRiverWorld.y);float wet=1.-smoothstep(-.06,.05,vRiverWorld.y);
          float cau=rcaustic(vRiverWorld.xz,uRiverTime)*exp(-depth*.6);
          gl_FragColor.rgb*=1.+cau*.48*uNature*wet;
          float waterLength=rpath(vRiverWorld,uEye);vec3 trans=exp(-vec3(.29,.13,.10)*waterLength*mix(.10,.85,uNature));
          gl_FragColor.rgb=gl_FragColor.rgb*trans+vec3(.025,.084,.065)*(1.-trans);
          #include <tonemapping_fragment>`);
    };
    mat.customProgramCacheKey=()=>`river-lit-v1-${mat.type}`;
  }
  function pbr(id,extra={}){const m=new THREE.MeshStandardMaterial({map:textures[id+'-color'],normalMap:textures[id+'-normal'],roughnessMap:textures[id+'-rough'],roughness:1,normalScale:new THREE.Vector2(.7,.7),...extra});submerge(m);materialSet.add(m);return m;}
  function normalizedParts(root,{height=false,separate=false}={}){
    root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());const scale=1/(height?size.y:Math.max(size.x,size.y,size.z));const parts=[];
    root.traverse(obj=>{if(!obj.isMesh)return;const geometry=obj.geometry.clone().applyMatrix4(obj.matrixWorld);
      if(separate){geometry.computeBoundingBox();const b=geometry.boundingBox,c=b.getCenter(new THREE.Vector3()),s=b.getSize(new THREE.Vector3()),f=1/Math.max(s.x,s.y,s.z);geometry.translate(-c.x,-b.min.y,-c.z);geometry.scale(f,f,f);}else{geometry.translate(-center.x,-box.min.y,-center.z);geometry.scale(scale,scale,scale);}
      const material=obj.material.clone();material.envMapIntensity=.75;material.roughness=Math.max(.55,material.roughness);material.side=THREE.DoubleSide;submerge(material);materialSet.add(material);geometrySet.add(geometry);parts.push({geometry,material});
    });return parts;
  }
  const assets={rock:normalizedParts(models[0].scene,{separate:true}),stone:normalizedParts(models[1].scene),fern:normalizedParts(models[2].scene,{height:true}),shrub:normalizedParts(models[3].scene,{height:true}),tree:normalizedParts(models[4].scene,{height:true}),grass:normalizedParts(models[5].scene,{separate:true})};
  const landscape=new THREE.Group();scene.add(landscape);
  function instances(parts,placements,parent=landscape,{shadows=true}={}){
    const chunks=new Map();for(const p of placements){const key=Math.floor(p.x/20);if(!chunks.has(key))chunks.set(key,[]);chunks.get(key).push(p);}
    return [...chunks.values()].flatMap(rows=>parts.map(({geometry,material})=>{const mesh=new THREE.InstancedMesh(geometry,material,rows.length),dummy=new THREE.Object3D();rows.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(p.rx||0,p.rot||0,p.rz||0);dummy.scale.set(p.sx||p.s,p.sy||p.s,p.sz||p.s);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});if(parent===landscape)mesh.userData.shoreRows=rows.map(p=>({x:p.x,z:p.z,offset:p.y-shoreHeight(p.x,p.z)}));mesh.castShadow=mesh.receiveShadow=shadows;mesh.computeBoundingSphere();parent.add(mesh);return mesh;}));
  }
  function shoreHeight(x,z){const side=Math.sign(z),d=Math.max(0,Math.abs(z)-4.6),width=2.6+.35*Math.sin(x*.22+side)+.17*Math.sin(x*.81);
    const waterBed=bed(x,z)-.025;const rise=THREE.MathUtils.smoothstep(d,0,width);return THREE.MathUtils.lerp(waterBed,.3+Math.max(0,d-width)*.14,rise)+Math.max(0,rise-.5)*(.3*Math.sin(x*.21+z*.37)+.13*Math.sin(x*.82-z*.54));}
  const terrainParts=[];
  function makeBanks(){
    for(const side of [-1,1]){
      const geo=new THREE.PlaneGeometry(232,55,240,56);geo.rotateX(-Math.PI/2);const a=geo.attributes.position,uv=geo.attributes.uv;
      const colors=[];for(let i=0;i<a.count;i++){const x=a.getX(i)+78,z=side*(a.getZ(i)+31.85),y=shoreHeight(x,z);a.setXYZ(i,x,y,z);uv.setXY(i,x*.34,z*.34);const near=THREE.MathUtils.smoothstep(Math.abs(z),5,12);const c=new THREE.Color().setRGB(1-near*.24,1-near*.16,1-near*.30);colors.push(c.r,c.g,c.b);}if(side<0){const idx=geo.index.array;for(let i=0;i<idx.length;i+=3){const k=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=k;}}geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();const m=pbr('soil',{vertexColors:true,normalScale:new THREE.Vector2(1,1)});const mesh=new THREE.Mesh(geo,m);mesh.receiveShadow=true;landscape.add(mesh);terrainParts.push(mesh);
    }
  }
  makeBanks();
  const rnd=seeded(18237),rockRows=assets.rock.map(()=>[]);
  for(let i=0;i<190;i++){const x=-25+rnd()*218,side=i%2?1:-1,z=side*(4.9+rnd()*4),s=.3+Math.pow(rnd(),2)*1.9;rockRows[i%rockRows.length].push({x,y:shoreHeight(x,z)-s*.15,z,s,rot:rnd()*Math.PI*2});}
  rockRows.forEach((rows,i)=>instances([assets.rock[i]],rows));
  const fernRows=[],bushRows=[],treeRows=[];
  const grassRows=assets.grass.map(()=>[]);
  for(let i=0;i<3400;i++){const x=-26+rnd()*208,z=(i%2?1:-1)*(7+rnd()*9);if(Math.sin(x*.35+z*.8)+Math.sin(z*1.4)<-.5)continue;grassRows[i%grassRows.length].push({x,y:shoreHeight(x,z)-.025,z,s:.25+rnd()*.45,rot:rnd()*6.28});}
  grassRows.forEach((rows,i)=>{assets.grass[i].material.alphaTest=.4;assets.grass[i].material.alphaMap=textures.grassAlpha;assets.grass[i].material.transparent=false;instances([assets.grass[i]],rows,landscape,{shadows:false});});
  for(let i=0;i<44;i++){const x=-18+rnd()*125,z=(i%2?1:-1)*(6.5+rnd()*5);fernRows.push({x,y:shoreHeight(x,z)-.03,z,s:.35+rnd()*.8,rot:rnd()*6.28});}instances(assets.fern,fernRows);
  for(let i=0;i<10;i++){const x=-12+rnd()*70,z=(i%2?1:-1)*(8+rnd()*5);bushRows.push({x,y:shoreHeight(x,z),z,s:.9+rnd()*.9,rot:rnd()*6.28});}instances(assets.shrub,bushRows);
  for(let i=0;i<10;i++){const x=-16+i*8+rnd()*4,z=(i%2?1:-1)*(10+rnd()*6);treeRows.push({x,y:shoreHeight(x,z),z,s:5+rnd()*4,rot:rnd()*6.28});}const treeMeshes=instances(assets.tree,treeRows);
  // Distant vegetation uses a one-time render of the same 3D model as a low-cost impostor.
  function bakeFoliage(parts){const off=new THREE.Scene();off.environment=env;off.environmentIntensity=.8;off.add(new THREE.HemisphereLight(0xdbe8d1,0x4c573a,1));const l=new THREE.DirectionalLight(0xfff0d6,2.5);l.position.set(-3,6,5);off.add(l);for(const p of parts)off.add(new THREE.Mesh(p.geometry,p.material));const c=new THREE.OrthographicCamera(-.65,.65,.6,-.6,.01,10);c.position.set(0,.5,3);c.lookAt(0,.5,0);const rt=new THREE.WebGLRenderTarget(768,768,{generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});const alpha=renderer.getClearAlpha(),color=renderer.getClearColor(new THREE.Color());renderer.setClearColor(0x000000,0);renderer.setRenderTarget(rt);renderer.render(off,c);renderer.setRenderTarget(null);renderer.setClearColor(color,alpha);return rt;}
  const treeSprite=bakeFoliage(assets.tree),bushSprite=bakeFoliage(assets.shrub);
  function distant(tex,count,isTree){const geo=new THREE.PlaneGeometry(1.3,1.2);geo.translate(0,.55,0);const material=new THREE.MeshBasicMaterial({map:tex,transparent:false,alphaTest:.45,side:THREE.DoubleSide,fog:true,color:isTree?0xd2d9bd:0xe1e5c8});const rows=[];
    for(let i=0;i<count;i++){const x=-40+rnd()*240,z=(i%2?1:-1)*(isTree?18+rnd()*35:9+rnd()*12);rows.push({x,y:shoreHeight(x,z),z,s:isTree?7+rnd()*8:1+rnd()*2,rot:(rnd()-.5)*.6});}return instances([{geometry:geo,material}],rows,landscape,{shadows:false});}
  distant(treeSprite.texture,300,true);distant(bushSprite.texture,180,false);
  const bedGroup=new THREE.Group();scene.add(bedGroup);let terrainMesh=null,bedGeometries=[];
  const bedMat=pbr('pebbles',{normalScale:new THREE.Vector2(.9,.9),color:0xb9bc9f});
  const bedBase=bedMat.onBeforeCompile;bedMat.onBeforeCompile=sh=>{bedBase(sh);sh.uniforms.uSandMap={value:textures['sand-color']};sh.uniforms.uStoneMap={value:textures['stone-color']};sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float bedType;varying float vBedType;').replace('#include <begin_vertex>','#include <begin_vertex>\nvBedType=bedType;');sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vBedType;uniform sampler2D uSandMap,uStoneMap;').replace('#include <map_fragment>',`vec4 c=texture2D(map,vMapUv);float sandMix=1.-smoothstep(.1,.8,vBedType);float stoneMix=smoothstep(3.5,3.9,vBedType)*(1.-smoothstep(4.1,4.5,vBedType));c=mix(c,texture2D(uSandMap,vMapUv),sandMix);c=mix(c,texture2D(uStoneMap,vMapUv*.55),stoneMix);diffuseColor*=c;`);};bedMat.customProgramCacheKey=()=> 'river-bed-v1';
  const pebbleGeo=new THREE.IcosahedronGeometry(1,1);pebbleGeo.scale(1,.60,1);const pebbleMat=pbr('stone',{color:0xc8c5b2,roughness:.83});
  let surfaceBoulders=[];
  function buildBed(items,boulders){
    surfaceBoulders=boulders.map(b=>({...b,top:bed(b.x,b.z)+b.r*1.35}));
    bedGroup.traverse(o=>{if(o.isInstancedMesh)o.dispose();});bedGroup.clear();bedGeometries.forEach(g=>g.dispose());bedGeometries=[];
    const geo=new THREE.PlaneGeometry(260,9,650,40);geo.rotateX(-Math.PI/2);const a=geo.attributes.position,uv=geo.attributes.uv,type=[];
    for(let i=0;i<a.count;i++){const x=a.getX(i)+78,z=a.getZ(i);a.setXYZ(i,x,bed(x,z),z);uv.setXY(i,x*.85,z*.85);type.push(zoneAt(x).t);}geo.setAttribute('bedType',new THREE.Float32BufferAttribute(type,1));geo.computeVertexNormals();terrainMesh=new THREE.Mesh(geo,bedMat);terrainMesh.receiveShadow=true;bedGroup.add(terrainMesh);bedGeometries.push(geo);
    const rows=items.filter(it=>it.r>.047).map(it=>({x:it.x,y:it.y,z:it.z,sx:it.r*it.sx,sy:it.r,sz:it.r*it.sz,rot:it.rot}));instances([{geometry:pebbleGeo,material:pebbleMat}],rows,bedGroup,{shadows:false});
    const bigRows=boulders.map(B=>({x:B.x,y:bed(B.x,B.z)-B.r*.37,z:B.z,s:B.r*2,rot:Math.sin(B.x)*3}));instances(assets.stone,bigRows,bedGroup);
    for(const mesh of terrainParts){const a=mesh.geometry.attributes.position;for(let i=0;i<a.count;i++)a.setY(i,shoreHeight(a.getX(i),a.getZ(i)));a.needsUpdate=true;mesh.geometry.computeVertexNormals();}
    const mat=new THREE.Matrix4();landscape.traverse(mesh=>{if(!mesh.userData.shoreRows)return;mesh.userData.shoreRows.forEach((p,i)=>{mesh.getMatrixAt(i,mat);mat.elements[13]=shoreHeight(p.x,p.z)+p.offset;mesh.setMatrixAt(i,mat);});mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();});
    renderer.shadowMap.needsUpdate=true;
  }
  // Planar reflection/refraction use the actual shore scene, not an invented sky reflection.
  const waterGeometry=new THREE.PlaneGeometry(222,11,888,48);waterGeometry.rotateX(-Math.PI/2);waterGeometry.translate(83,0,0);
  // Reflector and Refractor expect their local plane normal to point along +Z.
  const captureGeometry=new THREE.PlaneGeometry(222,11);
  const reflection=new Reflector(captureGeometry,{textureWidth:768,textureHeight:768,clipBias:.003});
  const refraction=new Refractor(captureGeometry,{textureWidth:768,textureHeight:768,clipBias:.003});
  reflection.rotation.x=refraction.rotation.x=-Math.PI/2;reflection.position.x=refraction.position.x=83;reflection.updateMatrixWorld();refraction.updateMatrixWorld();
  const textureMatrix=new THREE.Matrix4(),sunDir=new THREE.Vector3(-18,26,18).normalize();
  const obstacleUniform={value:Array.from({length:12},()=>new THREE.Vector4(0,0,0,0))};
  const waterMat=new THREE.ShaderMaterial({side:THREE.DoubleSide,transparent:true,depthWrite:false,uniforms:{uReflection:{value:reflection.getRenderTarget().texture},uRefraction:{value:refraction.getRenderTarget().texture},uTime:timeUniform,uNature:nature,uFlow:{value:1},uTravel:{value:0},uEnergy:{value:0},uWaveAmplitude:{value:.002},uObstacles:obstacleUniform,uEye:eyeUniform,uSun:{value:sunDir},uTextureMatrix:{value:textureMatrix}},
    vertexShader:`uniform mat4 uTextureMatrix;uniform float uNature;varying vec4 vCoord;varying vec3 vWorld;${surfaceWaves}void main(){vec3 pos=position;pos.y+=waveHeight(pos.xz)*mix(.25,1.,uNature);vec4 w=modelMatrix*vec4(pos,1.);vWorld=w.xyz;vCoord=uTextureMatrix*w;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`uniform sampler2D uReflection,uRefraction;uniform float uTime,uNature,uFlow;uniform vec4 uObstacles[12];uniform vec3 uEye,uSun;varying vec4 vCoord;varying vec3 vWorld;${riverLight}${surfaceWaves}
    void main(){vec2 p=vWorld.xz,q=p-vec2(uTravel,0.);vec3 n=waveNormal(p);n.x+=.013*sin(q.x*29.+q.y*9.);n.z+=.013*cos(q.y*27.-q.x*12.);n=normalize(n);vec3 v=normalize(uEye-vWorld);if(v.y<0.)n=-n;float theta=max(0.,dot(v,n));float fresnel=.022+.978*pow(1.-theta,5.);if(uEye.y<0.)fresnel=max(fresnel,1.-smoothstep(.64,.73,theta));vec2 uv=vCoord.xy/vCoord.w;vec2 duv=n.xz*(.012+.008*uEnergy);vec3 refr=texture2D(uRefraction,clamp(uv+duv,vec2(.002),vec2(.998))).rgb;vec3 refl=texture2D(uReflection,clamp(vec2(1.-uv.x-duv.x,uv.y+duv.y),vec2(.002),vec2(.998))).rgb;float f=fresnel*mix(.15,1.,uNature);vec3 col=mix(refr,refl,f);float sun=pow(max(0.,dot(n,normalize(uSun+v))),mix(450.,110.,uEnergy))*.6;col+=vec3(1.,.92,.76)*sun;
      float grain=rnoise(vec2(q.x*9.,q.y*26.));float streak=rnoise(vec2(q.x*1.3,q.y*15.));
      float crest=pow(max(0.,sin(q.x*7.+sin(q.y*2.8))),14.)*smoothstep(.40,.7,grain);
      float wake=0.;for(int i=0;i<12;i++){vec4 b=uObstacles[i];if(b.z<.01)continue;float dx=p.x-b.x;float width=b.z*.55+max(0.,dx)*.12;float band=exp(-pow((p.y-b.y+.08*sin(dx*6.-uTravel*2.))/max(.03,width),2.));float tail=smoothstep(-b.z*.3,b.z*.5,dx)*(1.-smoothstep(b.z*1.2,b.z*7.,dx));wake=max(wake,band*tail*b.w);}
      float foam=clamp(uEnergy*(crest*.62+wake*smoothstep(.34,.68,grain)*.9+pow(streak,9.)*.3),0.,.78);
      foam*=1.-smoothstep(4.1,5.1,abs(p.y));foam*=mix(.18,1.,uNature);if(uEye.y<0.)foam*=.45;
      col=mix(col,vec3(.76,.83,.77),foam);gl_FragColor=vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`});
  const water=new THREE.Mesh(waterGeometry,waterMat);scene.add(water);
  const sprayCount=144,sprayPositions=new Float32Array(sprayCount*3),sprayGeo=new THREE.BufferGeometry();sprayGeo.setAttribute('position',new THREE.BufferAttribute(sprayPositions,3));
  const sprayMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uOpacity:{value:0}},vertexShader:`void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(16./max(1.,-mv.z),1.,4.);}`,fragmentShader:`uniform float uOpacity;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(.88,.94,.87,(1.-smoothstep(.15,1.,r))*uOpacity);}`});
  const spray=new THREE.Points(sprayGeo,sprayMat);spray.frustumCulled=false;scene.add(spray);
  let frameCount=0,quality='balanced',lastWaterTime=0,waterTravel=0,appearance=waterAppearance(1);const underwaterBackground=new THREE.Color(0x214a40);
  function update({time,flow,x,dt}){timeUniform.value=time;waterMat.uniforms.uFlow.value=flow;
    if(time<lastWaterTime)waterTravel=0;else waterTravel+=Math.max(0,time-lastWaterTime)*flow*.9;lastWaterTime=time;
    appearance=waterAppearance(flow);waterMat.uniforms.uTravel.value=waterTravel;waterMat.uniforms.uEnergy.value=appearance.energy;waterMat.uniforms.uWaveAmplitude.value=appearance.waveAmplitude;
    const nearby=surfaceBoulders.filter(b=>Math.abs(b.x-x)<35).sort((a,b)=>Math.abs(a.x-x)-Math.abs(b.x-x)).slice(0,12);
    obstacleUniform.value.forEach((v,i)=>{const b=nearby[i];if(b)v.set(b.x,b.z,b.r,Math.exp(-Math.max(0,-b.top)*1.5));else v.set(0,0,0,0);});
    spray.visible=appearance.energy>.3&&camera.position.y>.02&&nature.value>.5&&nearby.length>0;
    if(spray.visible){sprayMat.uniforms.uOpacity.value=appearance.energy*.65;
      for(let i=0;i<sprayCount;i++){const b=nearby[i%nearby.length],phase=(waterTravel*1.2+i*.6180339)%1,spread=Math.sin(i*31.7);sprayPositions[i*3]=b.x+b.r*.7+phase*b.r*2.2;sprayPositions[i*3+1]=.018+Math.sin(phase*Math.PI)*.14*appearance.energy*Math.exp(-Math.max(0,-b.top));sprayPositions[i*3+2]=b.z+spread*b.r*.65;}
      sprayGeo.attributes.position.needsUpdate=true;
    }
    eyeUniform.value.copy(camera.position);sun.position.set(x-18,26,18);sun.target.position.set(x,0,0);sun.target.updateMatrixWorld();renderer.shadowMap.needsUpdate=frameCount%3===0;
    const underwater=camera.position.y<-.03;scene.background=underwater?underwaterBackground:env;scene.fog.color.set(underwater?0x35665e:0xa4b3a1);scene.fog.density=underwater?.035:.012;
  }
  function render(){
    camera.updateMatrixWorld();textureMatrix.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1).multiply(camera.projectionMatrix).multiply(camera.matrixWorldInverse);
    const under=camera.position.y<0;
    water.visible=false;
    reflection.rotation.x=refraction.rotation.x=under?Math.PI/2:-Math.PI/2;
    reflection.updateMatrixWorld();refraction.updateMatrixWorld();
    reflection.onBeforeRender(renderer,scene,camera);refraction.onBeforeRender(renderer,scene,camera);water.visible=true;
    renderer.setRenderTarget(null);renderer.render(scene,camera);frameCount++;
  }
  function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}
  function setQuality(q){quality=q;renderer.setPixelRatio(Math.min(devicePixelRatio,q==='high'?2:1.5));const n=q==='high'?1024:768;reflection.getRenderTarget().setSize(n,n);refraction.getRenderTarget().setSize(n,n);resize();}
  function stats(){return{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,quality,frames:frameCount,water:{...appearance,travel:waterTravel},programErrors:renderer.info.programs.filter(p=>p.diagnostics?.runnable===false).length};}
  return {scene,camera,renderer,nature,buildBed,submerge,update,render,resize,setQuality,stats,assetsReady:true};
}
