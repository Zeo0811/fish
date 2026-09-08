// Parameterised, quasi-steady reach. Metres, seconds, +X downstream.
// y=0 remains the mean water datum used by the fishing solver. This is not CFD.
export const REACH_LENGTH=62;
export const CHANNEL_STATIONS=[
  {x:-8,width:11.6,depth:1.04,name:'宽河缓流'},
  {x:0,width:10.8,depth:1,name:'宽河主流'},
  {x:5,width:7.4,depth:.82,name:'收窄入口'},
  {x:9,width:5.2,depth:.78,name:'收窄急流'},
  {x:12,width:5.2,depth:.73,name:'急流出口'},
  {x:18,width:10.4,depth:1.72,name:'冲刷潭头'},
  {x:25,width:13,depth:1.98,name:'深槽 · 宽潭'},
  {x:32,width:11.2,depth:1.45,name:'深潭下段'},
  {x:39,width:8.8,depth:.72,name:'潭尾 · tailout'},
  {x:44,width:6.6,depth:.57,name:'卵石浅急滩'},
  {x:49,width:9.6,depth:.87,name:'浅滩后顺流'},
  {x:54,width:11.6,depth:1.04,name:'宽河缓流'},
];
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const wrap=x=>((x+8)%REACH_LENGTH+REACH_LENGTH)%REACH_LENGTH-8;
const gauss=(x,s)=>Math.exp(-((x/s)**2));
const STEP=.125,COUNT=REACH_LENGTH/STEP;

export function createChannel(P,options=()=>({}),zoneAt=()=>({t:1})){
  let key='',integrals=[];
  function section(x){
    const {flat=false}=options(),m=wrap(x),phase=(m+8)/REACH_LENGTH*Math.PI*2;
    if(flat)return {x:m,center:0,halfWidth:4.5,depth:P.depth,thalweg:0,name:'等深对照河段',flat:true};
    let i=0;while(i<CHANNEL_STATIONS.length-2&&m>=CHANNEL_STATIONS[i+1].x)i++;
    const a=CHANNEL_STATIONS[i],b=CHANNEL_STATIONS[i+1],t=smooth(a.x,b.x,m);
    return {x:m,center:.48*Math.sin(phase),halfWidth:mix(a.width,b.width,t)*.5,depth:P.depth*mix(a.depth,b.depth,t),thalweg:.27*Math.sin(phase-1),name:t<.5?a.name:b.name,flat:false};
  }
  function bed(x,z){
    const s=section(x),eta=(z-s.center)/s.halfWidth,a=Math.abs(eta);
    if(a>=1)return .14*(a-1)*s.halfWidth;
    const edge=1-smooth(.57,1,a);
    if(s.flat)return -P.depth*edge;
    // Migrating thalweg, depositional bar on the opposite side, sloping margins.
    const trench=1+.24*gauss(eta-s.thalweg,.21)-.22*gauss(eta+s.thalweg*1.8,.23)*smooth(.1,.4,Math.abs(s.thalweg));
    const phase=(wrap(x)+8)*Math.PI*2/REACH_LENGTH,t=zoneAt(x).t;
    const noise=Math.sin(phase*17+z*2.3)*Math.cos(phase*6-z*1.1)+.5*Math.sin(phase*41+z*3.7);
    const rough=(t===0?.009:t===1?.017:t===4?.027:.035)*noise;
    return (-s.depth*trench+rough)*edge;
  }
  function weight(s,z){const eta=(z-s.center)/s.halfWidth;return Math.max(0,1-eta*eta)**.65*(1+.23*gauss(eta-s.thalweg,.3));}
  function integrate(x){const s=section(x);let area=0,weighted=0;const n=64,dz=2*s.halfWidth/n;
    for(let j=0;j<n;j++){const z=s.center-s.halfWidth+(j+.5)*dz,h=-bed(x,z);area+=h*dz;weighted+=h*weight(s,z)*dz;}
    return {area,weighted};
  }
  function ensure(){const next=[P.depth,options().flat,options().substrate].join('|');if(next===key)return;key=next;
    integrals=Array.from({length:COUNT+1},(_,i)=>integrate(-8+i*STEP));
  }
  function areaAt(x){ensure();const p=(wrap(x)+8)/STEP,i=Math.floor(p),t=p-i,a=integrals[i],b=integrals[i+1];return {area:mix(a.area,b.area,t),weighted:mix(a.weighted,b.weighted,t)};}
  // Flow setting is the upstream cross-section mean, not every point's speed.
  function discharge(){return Math.max(0,P.flow)*areaAt(0).area;}
  function eddyPsi(x,z){const s=section(x);if(s.flat)return 0;const e=(z-s.center)/s.halfWidth;if(Math.abs(e)>=1)return 0;
    const m=wrap(x),head=gauss(m-17,4.4),tail=gauss(m-47,2.5)*.32;
    return areaAt(0).area*.32*(head+tail)*(gauss(e-.72,.21)-gauss(e+.72,.21))*(1-e*e)**3;
  }
  function column(x,z){
    const s=section(x),h=-bed(x,z);if(h<=.002)return {x:0,z:0,depth:Math.max(0,h),froude:0,energy:0};
    const ref=areaAt(0).area,base=ref/areaAt(x).weighted*weight(s,z),e=.025;
    const before=section(x-e),after=section(x+e),eta=(z-s.center)/s.halfWidth;
    let u=base+(eddyPsi(x,z+e)-eddyPsi(x,z-e))/(2*e*h);
    let v=base*((after.center-before.center)/(2*e)+eta*(after.halfWidth-before.halfWidth)/(2*e))-(eddyPsi(x+e,z)-eddyPsi(x-e,z))/(2*e*h);
    // Eddy streamfunction vanishes on the banks; its cross-section flux is zero.
    const fr=Math.abs(u)*Math.max(0,P.flow)/Math.sqrt(9.81*h);
    const energy=smooth(.38,1.12,fr)*(1-smooth(.85,1,Math.abs(eta)));
    return {x:u,z:v,depth:h,froude:fr,energy};
  }
  function velocity(x,y,z,t=0){
    const b=bed(x,z),h=-b;if(P.flow<=0||h<=.002||y<=b||y>.05)return {x:0,y:0,z:0};
    const c=column(x,z),sigma=clamp((y-b)/h),type=zoneAt(x).t,k=type===0?.006:type>=2?.03:.015;
    const floor=type===0?.13:type>=2?.27:.2,L=Math.log(1+1/k),mean=floor+(1-floor)*((1+k)*L-1)/L;
    const f=(floor+(1-floor)*Math.log(1+sigma/k)/L)/mean,flow=Math.max(0,P.flow);
    const u=c.x*flow*f,v=c.z*flow*f,eps=.035;
    const by=(bed(x+eps,z)-bed(x-eps,z))/(2*eps),bz=(bed(x,z+eps)-bed(x,z-eps))/(2*eps);
    const lift=(1-sigma)*(u*by+v*bz);
    const flutter=.025*flow*c.energy*Math.sin(x*3.1+t*2.2)*Math.sin(Math.PI*sigma);
    return {x:u,y:clamp(lift+flutter,-1.2,1.2),z:v};
  }
  return {section,bed,areaAt,discharge,column,velocity,bank:(x,side)=>{const s=section(x);return s.center+side*s.halfWidth;},wrap};
}
