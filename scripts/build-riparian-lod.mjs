// Offline derivative build; originals stay untouched. No new external assets.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {weld,simplifyPrimitive,prune} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),dir=new URL('../public/assets/',import.meta.url);
await MeshoptSimplifier.ready;
const manifest=JSON.parse(await fs.readFile(new URL('credits.json',dir)));
for(const id of ['tree_small_02','shrub_01']){
  const doc=await io.read(new URL(id+'.glb',dir).pathname),name=id+'-riparian-lod.glb';
  await doc.transform(weld());
  for(const mesh of doc.getRoot().listMeshes())for(const primitive of mesh.listPrimitives()){
    const material=primitive.getMaterial()?.getName()||'';
    if(material.endsWith('_trunk'))continue;
    simplifyPrimitive(primitive,{simplifier:MeshoptSimplifier,ratio:material.endsWith('_branches')?.65:.18,error:.03,lockBorder:false});
  }
  await doc.transform(prune());
  await io.write(new URL(name,dir).pathname,doc);
  const data=await fs.readFile(new URL(name,dir));
  manifest.files[name]={bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};
  manifest.assets=manifest.assets.filter(a=>a.file!==name);
  manifest.assets.push({id,type:'model',source:`https://polyhaven.com/a/${id}`,license:'CC0-1.0',file:name,derivative:'Reduced geometry for clustered riparian vegetation; original model retained.'});
  console.log(name,data.length,doc.getRoot().listMeshes().reduce((s,m)=>s+m.listPrimitives().reduce((t,p)=>t+p.getIndices().getCount()/3,0),0));
}
await fs.writeFile(new URL('credits.json',dir),JSON.stringify(manifest,null,2));
