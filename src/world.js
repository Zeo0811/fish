import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { Refractor } from 'three/addons/objects/Refractor.js';
import { loadProgress } from './shell.js';
import { waterAppearance } from './water-effects.js';
import { makeHydraulicTexture, makeTravelTexture, channelWaves as surfaceWaves } from './channel-surface.js';
import { makeChannelFoam } from './channel-foam.js';
import { bankHabitat, bankElevation, makeTussockGeometry, makeFoliageBillboardGeometry, makeBankMaterial } from './riparian.js';
import { collisionRockPlacements, makeBedGeometry, makeBedMaterial, makeCollisionRockGeometry } from './riverbed-visuals.js';

const A='/assets/';
const riverLight=`
float rhash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float rnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(rhash(i),rhash(i+vec2(1,0)),f.x),mix(rhash(i+vec2(0,1)),rhash(i+vec2(1,1)),f.x),f.y);}
float rcaustic(vec2 p,float t){p=p*3.8+vec2(t*.15,-t*.08);p+=vec2(sin(p.y*1.4+t*.6),cos(p.x*1.2-t*.45))*.35;vec2 g=floor(p),f=fract(p);float a=8.,b=8.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y));vec2 h=vec2(rhash(g+o),rhash(g+o+23.4));vec2 r=o+.5+.32*sin(t*.65+6.283*h)-f;float d=dot(r,r);if(d<a){b=a;a=d;}else b=min(b,d);}return pow(1.-smoothstep(.012,.16,b-a),2.);}
float rpath(vec3 p,vec3 eye){float l=length(eye-p);if(p.y<0.&&eye.y<0.)return l;if(p.y>=0.&&eye.y>=0.)return 0.;return l*clamp(-min(p.y,eye.y)/max(.001,abs(eye.y-p.y)),0.,1.);}
`;
function seeded(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}

export async function createRiverWorld({host,P,bed,zoneAt,channel}){
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
  const modelIds=['rock_moss_set_01','rock_09','fern_02','shrub_01-riparian-lod','tree_small_02-riparian-lod','grass_bermuda_01'];
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
      if(separate){geometry.computeBoundingBox();const b=geometry.boundingBox,c=b.getCenter(new THREE.Vector3()),s=b.getSize(new THREE.Vector3()),f=1/(height?s.y:Math.max(s.x,s.y,s.z));geometry.translate(-c.x,-b.min.y,-c.z);geometry.scale(f,f,f);}else{geometry.translate(-center.x,-box.min.y,-center.z);geometry.scale(scale,scale,scale);}
      const material=obj.material.clone();material.envMapIntensity=.75;material.roughness=Math.max(.55,material.roughness);material.side=THREE.DoubleSide;submerge(material);materialSet.add(material);geometrySet.add(geometry);parts.push({geometry,material});
    });return parts;
  }
  const assets={rock:normalizedParts(models[0].scene,{separate:true}),stone:normalizedParts(models[1].scene),fern:normalizedParts(models[2].scene,{height:true,separate:true}),shrub:normalizedParts(models[3].scene,{height:true}),tree:normalizedParts(models[4].scene,{height:true}),grass:normalizedParts(models[5].scene,{separate:true})};
  const landscape=new THREE.Group();scene.add(landscape);
  function instances(parts,placements,parent=landscape,{shadows=true}={}){
    const chunks=new Map();for(const p of placements){const key=Math.floor(p.x/20);if(!chunks.has(key))chunks.set(key,[]);chunks.get(key).push(p);}
    return [...chunks.values()].flatMap(rows=>parts.map(({geometry,material})=>{const mesh=new THREE.InstancedMesh(geometry,material,rows.length),dummy=new THREE.Object3D();rows.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(p.rx||0,p.rot||0,p.rz||0);dummy.scale.set(p.sx||p.s,p.sy||p.s,p.sz||p.s);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(p.color!==undefined)mesh.setColorAt(i,new THREE.Color(p.color));});if(parent===landscape)mesh.userData.shoreRows=rows.map(p=>{const side=Math.sign(p.z-channel.section(p.x).center);return {x:p.x,side,margin:Math.abs(p.z-channel.bank(p.x,side)),offset:p.y-shoreHeight(p.x,p.z)};});mesh.castShadow=mesh.receiveShadow=shadows;mesh.computeBoundingSphere();parent.add(mesh);return mesh;}));
  }
  function shoreZ(x,z){return channel.bank(x,Math.sign(z))+Math.sign(z)*(Math.abs(z)-5.5);}
  function shoreHeight(x,z){return bankElevation(channel,bed,x,z);}
  const terrainParts=[];
  function makeBanks(){
    for(const side of [-1,1]){
      const geo=new THREE.PlaneGeometry(232,55,928,56);geo.rotateX(-Math.PI/2);const a=geo.attributes.position,uv=geo.attributes.uv;
      const habitat=[],margins=[];for(let i=0;i<a.count;i++){const x=a.getX(i)+78,margin=a.getZ(i)+27.38,z=channel.bank(x,side)+side*margin,y=shoreHeight(x,z);margins.push(margin);a.setXYZ(i,x,y,z);uv.setXY(i,x*.85,z*.85);habitat.push(margin,bankHabitat(x,side).bar);}if(side<0){const idx=geo.index.array;for(let i=0;i<idx.length;i+=3){const k=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=k;}}geo.setAttribute('bankData',new THREE.Float32BufferAttribute(habitat,2));geo.computeVertexNormals();const m=makeBankMaterial(textures,submerge);materialSet.add(m);const mesh=new THREE.Mesh(geo,m);mesh.userData={margins,side};mesh.receiveShadow=true;landscape.add(mesh);terrainParts.push(mesh);
    }
  }
  makeBanks();
  const rnd=seeded(18237),rockRows=assets.rock.map(()=>[]);
  for(let i=0;i<660;i++){const x=-25+rnd()*218,side=i%2?1:-1,h=bankHabitat(x,side),z=channel.bank(x,side)+side*(.05+rnd()*(h.bar+1)),s=.16+Math.pow(rnd(),3)*1.6;rockRows[i%rockRows.length].push({x,y:shoreHeight(x,z)-s*.26,z,s,rot:rnd()*Math.PI*2,color:0xb9c1a1});}
  rockRows.forEach((rows,i)=>instances([assets.rock[i]],rows));
  // Flood-stranded woody fragments sit beyond the wet edge, not in the fishing lane.
  const woodGeo=new THREE.CylinderGeometry(.055,.085,1,9,3);woodGeo.rotateZ(Math.PI/2);woodGeo.translate(0,.04,0);geometrySet.add(woodGeo);
  const woodMat=pbr('soil',{color:0x625541,normalScale:new THREE.Vector2(.4,.8),roughness:1}),woodRows=[];
  for(let i=0;i<32;i++){const x=-20+rnd()*210,side=i%2?1:-1,h=bankHabitat(x,side),z=channel.bank(x,side)+side*(h.bar+.6+rnd()*1.4);woodRows.push({x,y:shoreHeight(x,z)-.035,z,s:1,sx:1.1+rnd()*2.5,sy:.5+rnd()*.8,sz:.5+rnd()*.8,rot:(rnd()-.5)*1.0});}
  instances([{geometry:woodGeo,material:woodMat}],woodRows);
  const fernRows=[],bushRows=[],treeRows=[];
  const grassRows=[[],[],[]],grassMat=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.95});submerge(grassMat);materialSet.add(grassMat);
  for(let i=0;i<19000;i++){
    const x=-26+rnd()*218,side=i%2?1:-1,h=bankHabitat(x,side),margin=h.bar+.05+Math.pow(rnd(),1.6)*10.5,z=channel.bank(x,side)+side*margin,hab=bankHabitat(x,side,margin);
    if(rnd()>hab.cover||rnd()<hab.forest*.24)continue;
    const s=(.45+rnd()*.68)*(1-hab.forest*.32),eps=.15;
    grassRows[i%3].push({x,y:shoreHeight(x,z)-.045,z,s,rot:rnd()*6.28,rx:-Math.atan((shoreHeight(x,z+eps)-shoreHeight(x,z-eps))/(2*eps)),rz:Math.atan((shoreHeight(x+eps,z)-shoreHeight(x-eps,z))/(2*eps))});
  }
  const grassMeshes=grassRows.flatMap((rows,i)=>{const geometry=makeTussockGeometry(731+i*41),low=makeTussockGeometry(731+i*41,8);geometrySet.add(geometry);geometrySet.add(low);const meshes=instances([{geometry,material:grassMat}],rows,landscape,{shadows:false});for(const mesh of meshes){mesh.userData.nearGeometry=geometry;mesh.userData.farGeometry=low;}return meshes;});
  for(let i=0;i<480;i++){const x=-23+rnd()*214,side=i%2?1:-1,h=bankHabitat(x,side),margin=h.bar+.5+rnd()*6;if(h.patch<.3&&rnd()<.7)continue;const z=channel.bank(x,side)+side*margin;fernRows.push({x,y:shoreHeight(x,z)-.06,z,s:.3+rnd()*.42,rot:rnd()*6.28,color:0xb2c88a});}assets.fern.forEach((p,i)=>instances([p],fernRows.filter((_,j)=>j%assets.fern.length===i)));
  for(let i=0;i<240;i++){const center=-22+Math.floor(rnd()*36)*6,x=center+(rnd()-.5)*4.8,side=i%2?1:-1,h=bankHabitat(x,side),z=channel.bank(x,side)+side*(h.bar+1.3+rnd()*6.8),s=.9+rnd()*1.35;bushRows.push({x,y:shoreHeight(x,z)-.1,z,s,sx:s*(1+rnd()*.45),sz:s*(1+rnd()*.3),rot:rnd()*6.28,color:new THREE.Color().setHSL(.22+rnd()*.045,.22,.62)});}instances(assets.shrub,bushRows);
  for(let i=0;i<90;i++){const x=-24+rnd()*218,side=i%2?1:-1,h=bankHabitat(x,side),z=channel.bank(x,side)+side*(h.bar+4.5+rnd()*12),s=5+rnd()*5.5;treeRows.push({x,y:shoreHeight(x,z)-.1,z,s,sx:s*(1.15+rnd()*.35),sz:s*(1.05+rnd()*.3),rot:rnd()*6.28,rz:(rnd()-.5)*.10,color:0xbec8a5});}const treeMeshes=instances(assets.tree,treeRows);
  // Distant vegetation uses a one-time render of the same 3D model as a low-cost impostor.
  function bakeFoliage(parts){const off=new THREE.Scene();off.environment=env;off.environmentIntensity=.8;off.add(new THREE.HemisphereLight(0xdbe8d1,0x4c573a,1));const l=new THREE.DirectionalLight(0xfff0d6,2.5);l.position.set(-3,6,5);off.add(l);for(const p of parts)off.add(new THREE.Mesh(p.geometry,p.material));const c=new THREE.OrthographicCamera(-.65,.65,.6,-.6,.01,10);c.position.set(0,.5,3);c.lookAt(0,.5,0);const rt=new THREE.WebGLRenderTarget(768,768,{generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});const alpha=renderer.getClearAlpha(),color=renderer.getClearColor(new THREE.Color());renderer.setClearColor(0x000000,0);renderer.setRenderTarget(rt);renderer.render(off,c);renderer.setRenderTarget(null);renderer.setClearColor(color,alpha);return rt;}
  const treeSprite=bakeFoliage(assets.tree),bushSprite=bakeFoliage(assets.shrub);
  function distant(tex,count,isTree){const geo=makeFoliageBillboardGeometry();const material=new THREE.MeshBasicMaterial({map:tex,transparent:false,alphaTest:.45,side:THREE.DoubleSide,fog:true,color:isTree?0xb0bda0:0xc1cbaa});const rows=[];
    for(let i=0;i<count;i++){const x=-40+rnd()*240,z=shoreZ(x,(i%2?1:-1)*(isTree?18+rnd()*35:9+rnd()*12));rows.push({x,y:shoreHeight(x,z),z,s:isTree?7+rnd()*8:1+rnd()*2,rot:(rnd()-.5)*.6});}return instances([{geometry:geo,material}],rows,landscape,{shadows:false});}
  distant(treeSprite.texture,620,true);distant(bushSprite.texture,780,false);
  const bedGroup=new THREE.Group();scene.add(bedGroup);let terrainMesh=null,bedGeometries=[];
  const bedMat=makeBedMaterial(textures,submerge);materialSet.add(bedMat);
  const pebbleGeo=makeCollisionRockGeometry(),boulderGeo=makeCollisionRockGeometry(true);
  const pebbleMat=pbr('stone',{color:0xbcb9a8,roughness:.86,normalScale:new THREE.Vector2(.38,.38)});
  const rubbleMat=pbr('stone',{color:0xb5bdb6,flatShading:true,roughness:.94,normalScale:new THREE.Vector2(.3,.3)});
  for(const material of [pebbleMat,rubbleMat]){
    const prior=material.onBeforeCompile;
    material.onBeforeCompile=sh=>{prior(sh);sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',`vec4 mineral=texture2D(map,vMapUv);float grey=dot(mineral.rgb,vec3(.2126,.7152,.0722));mineral.rgb=mix(vec3(grey),mineral.rgb,.42);diffuseColor*=mineral;`);};
    material.customProgramCacheKey=()=> 'river-mineral-v2';
  }
  let surfaceBoulders=[],bedPlacements=[];
  function buildBed(items,boulders){
    surfaceBoulders=boulders.map(b=>({...b,top:bed(b.x,b.z)+b.r*1.35}));
    bedGroup.traverse(o=>{if(o.isInstancedMesh)o.dispose();});bedGroup.clear();bedGeometries.forEach(g=>g.dispose());bedGeometries=[];
    const geo=makeBedGeometry(bed,zoneAt,channel);terrainMesh=new THREE.Mesh(geo,bedMat);terrainMesh.receiveShadow=true;bedGroup.add(terrainMesh);bedGeometries.push(geo);
    bedPlacements=collisionRockPlacements(items,boulders,bed,zoneAt);
    for(const kind of ['pebbles','rubble','boulders']){
      const big=kind==='boulders',angular=kind==='rubble';
      const rows=bedPlacements.filter(p=>p.big===big&&(big||(p.t===5)===angular)).map(p=>({...p,s:p.r,color:new THREE.Color().setHSL(.07+.045*Math.sin(p.x*17),.08+.13*(.5+.5*Math.sin(p.z*29)),.63+.14*Math.sin(p.x*13+p.z))}));
      const meshes=instances([{geometry:big?boulderGeo:pebbleGeo,material:angular?rubbleMat:pebbleMat}],rows,bedGroup,{shadows:big});
      meshes.forEach(m=>{m.name=big?'collision-boulders':'collision-pebbles';});
    }
    for(const mesh of terrainParts){const a=mesh.geometry.attributes.position;for(let i=0;i<a.count;i++){const x=a.getX(i),z=channel.bank(x,mesh.userData.side)+mesh.userData.side*mesh.userData.margins[i];a.setXYZ(i,x,shoreHeight(x,z),z);}a.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();}
    const mat=new THREE.Matrix4();landscape.traverse(mesh=>{if(!mesh.userData.shoreRows)return;mesh.userData.shoreRows.forEach((p,i)=>{const z=channel.bank(p.x,p.side)+p.side*p.margin;mesh.getMatrixAt(i,mat);mat.elements[13]=shoreHeight(p.x,z)+p.offset;mat.elements[14]=z;mesh.setMatrixAt(i,mat);});mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();});
    const wa=waterGeometry.attributes.position;for(let i=0;i<wa.count;i++){const x=wa.getX(i),s=channel.section(x);wa.setZ(i,s.center+waterLateral[i]*s.halfWidth);}wa.needsUpdate=true;waterGeometry.computeBoundingSphere();
    waterMat.uniforms.uHydraulics.value?.dispose();waterMat.uniforms.uHydraulics.value=makeHydraulicTexture(channel);
    waterMat.uniforms.uReach.value?.dispose();waterMat.uniforms.uReach.value=makeTravelTexture(channel);
    renderer.shadowMap.needsUpdate=true;
  }
  // Planar reflection/refraction use the actual shore scene, not an invented sky reflection.
  const waterGeometry=new THREE.PlaneGeometry(222,11,888,48);waterGeometry.rotateX(-Math.PI/2);waterGeometry.translate(83,0,0);
  const waterLateral=Array.from({length:waterGeometry.attributes.position.count},(_,i)=>waterGeometry.attributes.position.getZ(i)/5.5);
  // Reflector and Refractor expect their local plane normal to point along +Z.
  const captureGeometry=new THREE.PlaneGeometry(222,18);
  const reflection=new Reflector(captureGeometry,{textureWidth:768,textureHeight:768,clipBias:.003});
  const refraction=new Refractor(captureGeometry,{textureWidth:768,textureHeight:768,clipBias:.003});
  reflection.rotation.x=refraction.rotation.x=-Math.PI/2;reflection.position.x=refraction.position.x=83;reflection.updateMatrixWorld();refraction.updateMatrixWorld();
  const textureMatrix=new THREE.Matrix4(),sunDir=new THREE.Vector3(-18,26,18).normalize();
  const obstacleUniform={value:Array.from({length:12},()=>new THREE.Vector4(0,0,0,0))};
  const waterMat=new THREE.ShaderMaterial({side:THREE.DoubleSide,transparent:true,depthWrite:false,uniforms:{uHydraulics:{value:null},uReach:{value:null},uReflection:{value:reflection.getRenderTarget().texture},uRefraction:{value:refraction.getRenderTarget().texture},uTime:timeUniform,uNature:nature,uFlow:{value:1},uTravel:{value:0},uEnergy:{value:0},uWaveAmplitude:{value:.002},uObstacles:obstacleUniform,uEye:eyeUniform,uSun:{value:sunDir},uTextureMatrix:{value:textureMatrix}},
    vertexShader:`uniform mat4 uTextureMatrix;uniform float uNature;varying vec4 vCoord;varying vec3 vWorld;${surfaceWaves}void main(){vec3 pos=position;pos.y+=waveHeight(pos.xz)*mix(.25,1.,uNature);vec4 w=modelMatrix*vec4(pos,1.);vWorld=w.xyz;vCoord=uTextureMatrix*w;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`uniform sampler2D uReflection,uRefraction;uniform float uTime,uNature;uniform vec4 uObstacles[12];uniform vec3 uEye,uSun;varying vec4 vCoord;varying vec3 vWorld;${riverLight}${surfaceWaves}
    void main(){vec2 p=vWorld.xz;vec4 hydro=hydraulic(p);float energy=localEnergy(hydro);vec2 q=vec2(travelCoordinate(p)-uTravel,p.y);vec3 n=waveNormal(p);n.x+=.007*sin(q.x*29.+q.y*9.);n.z+=.007*cos(q.y*27.-q.x*12.);n=normalize(n);vec3 v=normalize(uEye-vWorld);if(v.y<0.)n=-n;float theta=max(0.,dot(v,n));float fresnel=.022+.978*pow(1.-theta,5.);if(uEye.y<0.)fresnel=max(fresnel,1.-smoothstep(.64,.73,theta));vec2 uv=vCoord.xy/vCoord.w;vec2 duv=n.xz*(.009+.008*energy);vec3 refr=texture2D(uRefraction,clamp(uv+duv,vec2(.002),vec2(.998))).rgb;vec3 refl=texture2D(uReflection,clamp(vec2(1.-uv.x-duv.x,uv.y+duv.y),vec2(.002),vec2(.998))).rgb;float f=fresnel*mix(.15,1.,uNature);vec3 col=mix(refr,refl,f);float sun=pow(max(0.,dot(n,normalize(uSun+v))),mix(450.,110.,energy))*.6;col+=vec3(1.,.92,.76)*sun;
      float grain=rnoise(vec2(q.x*9.,q.y*26.));float streak=rnoise(vec2(q.x*1.3,q.y*15.));
      float crest=pow(max(0.,sin(p.x*3.8+sin(p.y*1.6)+.55*sin(p.x*1.1+p.y*1.9))),5.)*smoothstep(.30,.69,grain);
      float wake=0.;for(int i=0;i<12;i++){vec4 b=uObstacles[i];if(b.z<.01)continue;float dx=p.x-b.x;float width=b.z*.55+max(0.,dx)*.12;float band=exp(-pow((p.y-b.y+.08*sin(dx*6.-uTravel*2.))/max(.03,width),2.));float tail=smoothstep(-b.z*.3,b.z*.5,dx)*(1.-smoothstep(b.z*1.2,b.z*7.,dx));wake=max(wake,band*tail*b.w);}
      float aerated=smoothstep(.48,.75,rnoise(vec2(q.x*2.5,q.y*6.))+.1*grain);
      float foam=clamp(energy*(crest*.94+pow(streak,5.)*.36)+energy*energy*aerated*.38+wake*smoothstep(.34,.68,grain)*smoothstep(.45,1.8,abs(hydro.x)*uFlow)*.8,0.,.86);
      foam*=1.-smoothstep(.86,1.,hydro.w);foam*=mix(.18,1.,uNature);if(uEye.y<0.)foam*=.45;
      col=mix(col,vec3(.76,.83,.77),foam);gl_FragColor=vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`});
  const water=new THREE.Mesh(waterGeometry,waterMat);scene.add(water);
  water.renderOrder=1;
  const surfaceFoam=makeChannelFoam(channel,waterMat.uniforms);scene.add(surfaceFoam.mesh);
  const sprayCount=144,sprayPositions=new Float32Array(sprayCount*3),sprayGeo=new THREE.BufferGeometry();sprayGeo.setAttribute('position',new THREE.BufferAttribute(sprayPositions,3));
  const sprayMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uOpacity:{value:0}},vertexShader:`void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(16./max(1.,-mv.z),1.,4.);}`,fragmentShader:`uniform float uOpacity;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(.88,.94,.87,(1.-smoothstep(.15,1.,r))*uOpacity);}`});
  const spray=new THREE.Points(sprayGeo,sprayMat);spray.frustumCulled=false;scene.add(spray);
  let frameCount=0,quality='balanced',lastWaterTime=0,waterTravel=0,appearance=waterAppearance(1);const underwaterBackground=new THREE.Color(0x214a40);
  function update({time,flow,x,dt}){timeUniform.value=time;waterMat.uniforms.uFlow.value=flow;
    for(const mesh of grassMeshes)mesh.geometry=camera.position.distanceTo(mesh.boundingSphere.center)>(quality==='high'?48:30)?mesh.userData.farGeometry:mesh.userData.nearGeometry;
    if(time<lastWaterTime)waterTravel=0;else waterTravel+=Math.max(0,time-lastWaterTime)*flow*.9;lastWaterTime=time;
    appearance=waterAppearance(flow);waterMat.uniforms.uTravel.value=waterTravel;waterMat.uniforms.uEnergy.value=appearance.energy;waterMat.uniforms.uWaveAmplitude.value=appearance.waveAmplitude;
    surfaceFoam.update(time,x,camera.position.y>.02&&nature.value>.5,renderer.domElement.height);
    const nearby=surfaceBoulders.filter(b=>Math.abs(b.x-x)<35).sort((a,b)=>Math.abs(a.x-x)-Math.abs(b.x-x)).slice(0,12);
    obstacleUniform.value.forEach((v,i)=>{const b=nearby[i];if(b)v.set(b.x,b.z,b.r,Math.exp(-Math.max(0,-b.top)*1.5));else v.set(0,0,0,0);});
    const breaking=nearby.filter(b=>b.top>-.35&&channel.column(b.x,b.z).energy>.25);
    spray.visible=camera.position.y>.02&&nature.value>.5&&breaking.length>0;
    if(spray.visible){sprayMat.uniforms.uOpacity.value=.5;
      for(let i=0;i<sprayCount;i++){const b=breaking[i%breaking.length],phase=(waterTravel*1.2+i*.6180339)%1,spread=Math.sin(i*31.7),e=channel.column(b.x,b.z).energy;sprayPositions[i*3]=b.x+b.r*.7+phase*b.r*2.2;sprayPositions[i*3+1]=.018+Math.sin(phase*Math.PI)*.14*e*Math.exp(-Math.max(0,-b.top));sprayPositions[i*3+2]=b.z+spread*b.r*.65;}
      sprayGeo.attributes.position.needsUpdate=true;
    }
    eyeUniform.value.copy(camera.position);sun.position.set(x-18,26,18);sun.target.position.set(x,0,0);sun.target.updateMatrixWorld();renderer.shadowMap.needsUpdate=frameCount%3===0;
    const underwater=camera.position.y<-.03;scene.background=underwater?underwaterBackground:env;scene.fog.color.set(underwater?0x35665e:0xa4b3a1);scene.fog.density=underwater?.035:.012;
  }
  function render(){
    camera.updateMatrixWorld();textureMatrix.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1).multiply(camera.projectionMatrix).multiply(camera.matrixWorldInverse);
    const under=camera.position.y<0;
    water.visible=false;const foamVisible=surfaceFoam.mesh.visible;surfaceFoam.mesh.visible=false;
    reflection.rotation.x=refraction.rotation.x=under?Math.PI/2:-Math.PI/2;
    reflection.updateMatrixWorld();refraction.updateMatrixWorld();
    reflection.onBeforeRender(renderer,scene,camera);refraction.onBeforeRender(renderer,scene,camera);water.visible=true;surfaceFoam.mesh.visible=foamVisible;
    renderer.setRenderTarget(null);renderer.render(scene,camera);frameCount++;
  }
  function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}
  function setQuality(q){quality=q;renderer.setPixelRatio(Math.min(devicePixelRatio,q==='high'?2:1.5));const n=q==='high'?1024:768;reflection.getRenderTarget().setSize(n,n);refraction.getRenderTarget().setSize(n,n);resize();}
  function stats(){return{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,quality,frames:frameCount,water:{...appearance,travel:waterTravel,local:channel.column(camera.position.x,0),discharge:channel.discharge()},programErrors:renderer.info.programs.filter(p=>p.diagnostics?.runnable===false).length};}
  function inspectBed(){return {placements:bedPlacements,geometryVertices:terrainMesh.geometry.attributes.position.count};}
  function probeBed(x,z){scene.updateMatrixWorld(true);const ray=new THREE.Raycaster(new THREE.Vector3(x,8,z),new THREE.Vector3(0,-1,0));return ray.intersectObject(bedGroup,true).map(h=>({y:h.point.y,name:h.object.name||'terrain'}));}
  function inspectShore(){let count=0,maxRootError=0,minMargin=Infinity;const matrix=new THREE.Matrix4();landscape.traverse(mesh=>{for(const [i,p] of (mesh.userData.shoreRows||[]).entries()){mesh.getMatrixAt(i,matrix);const z=channel.bank(p.x,p.side)+p.side*p.margin;maxRootError=Math.max(maxRootError,Math.abs(matrix.elements[13]-shoreHeight(p.x,z)-p.offset),Math.abs(matrix.elements[14]-z));minMargin=Math.min(minMargin,p.margin);count++;}});return {count,maxRootError,minMargin,grass:grassRows.reduce((n,r)=>n+r.length,0),shrubs:bushRows.length,trees:treeRows.length,ferns:fernRows.length};}
  return {scene,camera,renderer,nature,buildBed,submerge,update,render,resize,setQuality,stats,inspectBed,probeBed,inspectShore,assetsReady:true};
}
