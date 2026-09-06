// Reproducible CC0 source download + browser-sized model/texture conversion.
// This is a maintainer command; deployments use the committed local assets.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, textureCompress } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
const root=path.resolve(import.meta.dirname,'..'),cache=path.join(root,'.asset-cache'),out=path.join(root,'public/assets');
await fs.mkdir(out,{recursive:true});await fs.mkdir(cache,{recursive:true});
const credits=[];
async function get(url,dest){
  try{await fs.access(dest);return;}catch{}
  const r=await fetch(url,{signal:AbortSignal.timeout(180000)});if(!r.ok)throw new Error(`${r.status} ${url}`);
  await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,Buffer.from(await r.arrayBuffer()));
}
async function metadata(id){const p=path.join(cache,`${id}.json`);await get(`https://api.polyhaven.com/files/${id}`,p);return JSON.parse(await fs.readFile(p));}
async function model(id,ratio){
  const ready=path.join(out,`${id}.glb`);
  try{await fs.access(ready);credits.push({id,type:'model',source:`https://polyhaven.com/a/${id}`,license:'CC0-1.0',file:`${id}.glb`});return;}catch{}
  const m=await metadata(id),g=m.gltf['1k'].gltf,folder=path.join(cache,id);
  console.log(`Downloading model ${id}`);await get(g.url,path.join(folder,`${id}.gltf`));
  const files=Object.entries(g.include);for(let i=0;i<files.length;i+=3)await Promise.all(files.slice(i,i+3).map(([p,v])=>get(v.url,path.join(folder,p))));
  const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);const doc=await io.read(path.join(folder,`${id}.gltf`));
  await MeshoptSimplifier.ready;await doc.transform(dedup(),weld(),simplify({simplifier:MeshoptSimplifier,ratio,error:.005,lockBorder:false}),prune(),textureCompress({encoder:sharp,targetFormat:'webp',resize:[1024,1024],quality:83}));
  const dst=path.join(out,`${id}.glb`);await io.write(dst,doc);console.log(id,(await fs.stat(dst)).size);
  credits.push({id,type:'model',source:`https://polyhaven.com/a/${id}`,license:'CC0-1.0',file:`${id}.glb`});
}
async function texture(id,label){const m=await metadata(id);for(const [key,suffix] of [['Diffuse','color'],['nor_gl','normal'],['Rough','rough']]){const file=m[key]?.['1k']?.jpg;if(!file)continue;const p=path.join(cache,`${id}-${suffix}.jpg`);await get(file.url,p);await sharp(p).webp({quality:suffix==='normal'?92:86}).toFile(path.join(out,`${label}-${suffix}.webp`));}
  credits.push({id,type:'texture',source:`https://polyhaven.com/a/${id}`,license:'CC0-1.0',file:`${label}-*.webp`});}
await Promise.all([texture('river_small_rocks','pebbles'),texture('forest_ground_04','soil'),texture('rock_pitted_mossy','stone'),texture('damp_beach_sand_02','sand')]);
for(const [id,ratio] of [['rock_moss_set_01',.8],['rock_09',.8],['fern_02',.8],['shrub_01',.22],['tree_small_02',.065],['grass_bermuda_01',1]])await model(id,ratio);
const grassMeta=await metadata('grass_bermuda_01');await get(grassMeta.Alpha['1k'].png.url,path.join(out,'grass-alpha.png'));
const envId='kloofendal_48d_partly_cloudy_puresky',env=await metadata(envId);
await get(env.hdri['1k'].hdr.url,path.join(out,'daylight.hdr'));
credits.push({id:envId,type:'environment',source:`https://polyhaven.com/a/${envId}`,license:'CC0-1.0',file:'daylight.hdr'});
const list=(await fs.readdir(out)).filter(x=>x!== 'credits.json');
const hashes={};for(const f of list){const data=await fs.readFile(path.join(out,f));hashes[f]={bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};}
await fs.writeFile(path.join(out,'credits.json'),JSON.stringify({license:'https://polyhaven.com/license',assets:credits,files:hashes},null,2));
console.log('Asset manifest complete.');
