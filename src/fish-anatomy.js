import * as THREE from 'three';

// Side silhouettes and fin landmarks interpreted from the references in
// docs/fish-references.md. These are reference-guided models, not scans.
export const FISH_ANATOMY={
  baijia:{scientific:'Onychostoma sima',back:'#45585d',side:'#b9c8c4',belly:'#e5e3d3',fin:'#9f8470',height:.121,width:.064,eye:.0125,scales:43,
    knots:[[0,.008,.011,.010],[.055,.034,.034,.032],[.15,.077,.072,.051],[.28,.111,.093,.064],[.42,.121,.094,.063],[.58,.089,.075,.050],[.75,.045,.044,.028],[.9,.024,.026,.014],[1,.025,.025,.009]],dorsal:[-.18,-.105,.085,.252],anal:[.10,.18,.24,-.157]},
  qingbo:{scientific:'Spinibarbus sinensis',back:'#3d5149',side:'#b6c3ad',belly:'#dfdfc9',fin:'#677c74',height:.114,width:.059,eye:.014,scales:32,
    knots:[[0,.009,.012,.009],[.065,.040,.029,.027],[.16,.076,.061,.048],[.31,.114,.079,.059],[.47,.109,.077,.055],[.62,.074,.062,.043],[.78,.037,.035,.022],[.92,.024,.025,.012],[1,.026,.025,.009]],dorsal:[-.12,-.045,.095,.234],anal:[.115,.18,.24,-.138]},
  makou:{scientific:'Opsariichthys bidens',back:'#355760',side:'#b6caca',belly:'#e4e6d6',fin:'#a38f7b',height:.081,width:.038,eye:.0145,scales:46,
    knots:[[0,.014,.012,.010],[.055,.024,.030,.023],[.16,.041,.054,.034],[.30,.073,.061,.038],[.47,.081,.058,.037],[.63,.063,.048,.028],[.80,.030,.027,.017],[.94,.020,.020,.010],[1,.022,.022,.008]],dorsal:[-.065,.00,.115,.18],anal:[.05,.15,.245,-.17]}
};
export function fishSection(t,sp){
  const k=FISH_ANATOMY[sp].knots;t=THREE.MathUtils.clamp(t,0,1);
  for(let i=1;i<k.length;i++)if(t<=k[i][0]){
    const a=k[i-1],b=k[i],u=(t-a[0])/(b[0]-a[0]);
    // Monotone Hermite interpolation avoids the lumpy zero-slope-at-each-knot
    // silhouette of the previous smoothstep implementation.
    return [1,2,3].map(j=>{
      const slope=(v,w)=>(w[j]-v[j])/(w[0]-v[0]);
      const d=slope(a,b),prev=i>1?slope(k[i-2],a):d,next=i+1<k.length?slope(b,k[i+1]):d;
      const m0=prev*d<=0?0:2*prev*d/(prev+d),m1=next*d<=0?0:2*next*d/(next+d),h=b[0]-a[0];
      return (2*u**3-3*u*u+1)*a[j]+(u**3-2*u*u+u)*h*m0+(-2*u**3+3*u*u)*b[j]+(u**3-u*u)*h*m1;
    });
  }
  return k.at(-1).slice(1);
}
export function fishSurface(x,y,sp){
  const [up,down,w]=fishSection((x+.5)/.8,sp),h=y>=0?up:down;
  return w*Math.sqrt(Math.max(0,1-(y/h)**2));
}
export function createFishBodyGeometry(sp){
  const pos=[],uv=[],idx=[],nx=96,nr=48;
  for(let i=0;i<=nx;i++){
    const t=i/nx,[up,down,w]=fishSection(t,sp);
    for(let j=0;j<=nr;j++){
      const angle=j/nr*Math.PI*2,s=Math.sin(angle);
      pos.push(-.5+t*.8,s*(s>0?up:down),Math.cos(angle)*w);uv.push(t,j/nr);
    }
  }
  for(let i=0;i<nx;i++)for(let j=0;j<nr;j++){const a=i*(nr+1)+j,b=a+nr+1;idx.push(a,b,a+1,b,b+1,a+1);}
  for(const [ring,x,reverse] of [[0,-.5,true],[nx*(nr+1),.3,false]]){
    const c=pos.length/3;pos.push(x,0,0);uv.push(x<0?0:1,.5);
    for(let j=0;j<nr;j++)idx.push(...(reverse?[c,ring+j,ring+j+1]:[c,ring+j+1,ring+j]));
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();geo.computeBoundingBox();return geo;
}

// A flexible fin membrane. Each radial ray grows from an attached root line
// to an authored outline; intermediate vertices allow real fin curvature.
export function createFinGeometry(roots,tips){
  const pos=[],uv=[],idx=[],steps=5;
  for(let i=0;i<tips.length;i++)for(let j=0;j<=steps;j++){
    const v=j/steps,root=new THREE.Vector3(...roots[i]),tip=new THREE.Vector3(...tips[i]),p=root.lerp(tip,v);
    p.z+=Math.sin(v*Math.PI)*.003;pos.push(...p.toArray());uv.push(i/(tips.length-1),v);
  }
  for(let i=0;i<tips.length-1;i++)for(let j=0;j<steps;j++){const a=i*(steps+1)+j,b=a+steps+1;idx.push(a,b,a+1,b,b+1,a+1);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();return geo;
}
