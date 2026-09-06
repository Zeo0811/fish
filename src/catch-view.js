const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderCatchReport(rec,{species,baits,zone,time,portrait}){
  const eu=rec.mode==='euro',fish=species[rec.f.sp],kg=(rec.f.size**3*1.6e-5).toFixed(2);
  const bait=baits[rec.b.bt].name+(rec.b.bt==='tung'?` ${rec.b.w} g`:''),cm=(rec.off*100).toFixed(0);
  const metric=(label,value,unit)=>`<div><span>${label}</span><b>${value}<small>${unit}</small></b></div>`;
  const scores=Object.entries(rec.sub).map(([key,value])=>{const pct=Math.round(Math.max(0,Math.min(1,value))*100);return `<div class="catch-score"><div><span>${esc(eu&&key==='压线'?'竿尖引导':key)}</span><b>${pct}<small>/100</small></b></div><i><em style="width:${pct}%"></em></i></div>`;}).join('');
  document.getElementById('biteBody').innerHTML=`
    <section class="catch-hero"><div class="catch-portrait"><img src="${portrait}" alt="${esc(fish.name)}的三维示意模型"><span>RIVER SPECIMEN · 三维示意</span></div>
      <div class="catch-identity"><span class="catch-tag">${eu?'EURO NYMPH':'CENTERPIN'}</span><h3>${esc(fish.name)}</h3><p><b>${rec.f.size.toFixed(0)}</b> cm <span>约 ${kg} kg · 模型估算</span></p><div class="catch-location">${esc(zone)}<br>抛投后 ${time.toFixed(1)} 秒 · ${esc(bait)}</div></div></section>
    <div class="catch-metrics">${metric('咬口离底',cm,'cm')}${metric(eu?'蝇速':'饵速',rec.bv.toFixed(2),'m/s')}${metric('所在层水速',rec.ws.toFixed(2),'m/s')}${metric('呈现评分',Math.round(rec.q*100),'/100')}</div>
    <details class="studio-details"><summary>这次咬口发生了什么 <span>呈现分析</span></summary><p class="details-note">模型的呈现指标，不是现实中鱼概率。${eu?'竿尖':'鱼饵'}${rec.lead>=0?'领先':'落后'}${eu?'蝇':'浮漂'} ${Math.abs(rec.lead*100).toFixed(0)} cm。</p><div class="catch-scores">${scores}</div></details>`;
  const name=n=>n.type==='float'?'浮漂':n.type==='shot'?`铅 ${n.w} g`:n.type==='swivel'?'转环':n.type==='bait'?(baits[n.bt]?.name||'鱼饵'):n.type;
  const rows=rec.snap.filter(n=>eu?n.type==='bait':n.type!=='line').map(n=>`<tr><td>${esc(name(n))}</td><td>${n.type==='float'?(n.y>.02?'空中':n.y<-.1?'被压沉':'水面'):`${(n.off*100).toFixed(0)} cm${n.contact?' · 触底':''}`}</td><td>${n.vx.toFixed(2)}</td><td>${n.type==='float'?'—':n.ws.toFixed(2)}</td><td>${n.x-rec.refX>=0?'+':''}${((n.x-rec.refX)*100).toFixed(0)} cm</td></tr>`).join('');
  document.getElementById('biteSnap').innerHTML=`<details class="studio-details"><summary>回看中鱼瞬间 <span>快照与线组数据</span></summary>${rec.img?`<img class="catch-snapshot" src="${rec.img}" alt="本次模拟中鱼瞬间的场景快照">`:''}<div class="catch-table-scroll" tabindex="0" role="region" aria-label="中鱼瞬间线组数据，可横向滚动"><table><thead><tr><th>元件</th><th>离底</th><th>速度 m/s</th><th>该层水速</th><th>${eu?'相对竿尖':'相对浮漂'}</th></tr></thead><tbody>${rows}</tbody></table></div><p class="details-note">${eu?`竿尖引导 ${rec.leadRate.toFixed(2)}× · leader belly ${(rec.belly*100).toFixed(0)} cm`:`holding back ${Math.round(rec.hb*100)}% · 浮漂倾角 ${Math.abs(rec.tilt).toFixed(1)}°`}</p></details>`;
  document.getElementById('biteSave').disabled=!rec.img;
}
