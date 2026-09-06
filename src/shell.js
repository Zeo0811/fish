const loading=document.createElement('div');
loading.id='loading';loading.setAttribute('role','status');
loading.innerHTML='<div class="load-word">溪流<span>RIVER STUDIO</span></div><div class="load-rule"><i id="loadProgress"></i></div><p id="loadMessage">正在走进溪流</p>';
document.body.append(loading);
let finished=false;
export function loadProgress(done,total){const p=document.getElementById('loadProgress');if(p)p.style.width=`${Math.max(8,done/Math.max(1,total)*100)}%`;}
export function finishLoading(){finished=true;loading.classList.add('loaded');setTimeout(()=>loading.remove(),700);}
export function reportError(error){
  if(document.getElementById('sceneError'))return;
  const box=document.createElement('div');box.id='sceneError';box.setAttribute('role','alert');
  box.innerHTML='<strong>场景加载遇到问题</strong><p>请使用支持 WebGL 2 的浏览器，或刷新后重试。</p><button type="button">重新加载</button>';
  box.querySelector('button').onclick=()=>location.reload();document.body.append(box);
  if(!finished)loading.classList.add('loaded');
}
window.addEventListener('error',e=>reportError(e.error));
window.addEventListener('unhandledrejection',e=>reportError(e.reason));
export function setupShell(actions){
  const shell=document.createElement('div');shell.id='shell';
  shell.innerHTML=`
    <header class="masthead">
    <div class="top-actions"><label class="quality-label">画质<select id="quality" aria-label="画质"><option value="balanced">均衡</option><option value="high">精细</option></select></label><button id="toggleTelemetry" aria-expanded="false">深度仪</button><button id="toggleSettings" aria-expanded="false">设置 <span aria-hidden="true">↗</span></button><a id="switchSimple" href="/simple/" aria-label="切换到简易版">简易版 <span aria-hidden="true">⇄</span></a></div></header>
    <div class="scene-caption"><span class="eyebrow">THE RIVER, OBSERVED.</span><h2>看见水下<br>发生的事。</h2><p>从岸边，到河床。<br>让每一次漂流都有迹可循。</p></div>
    <div class="live-readout" title="当前位置的实际水深与表层水速；Centerpin 跟随浮漂，Euro 跟随末蝇"><span class="live-dot"></span><span>溪流实况</span><b id="hudDepth" title="此处水深">— <small>m</small></b><i></i><b id="hudFlow" title="此处表层水速">— <small>m/s</small></b></div>
    <nav class="view-dock" aria-label="观察视角"><span class="dock-label">视角</span><button data-view="bank" class="active" aria-pressed="true">岸边</button><button data-view="underwater" aria-pressed="false">水下</button><button data-view="overhead" aria-pressed="false">俯瞰</button><button data-view="landscape" aria-pressed="false">全景</button><span class="dock-divider"></span><button id="quickCast">重新抛投 ↗</button><button id="quickPause" aria-label="暂停模拟">Ⅱ</button></nav>
    <div class="scene-help">拖动环顾 · 滚轮缩放 <span>01 / 清溪</span></div>
    <a class="asset-credit" href="/assets/credits.json" target="_blank" rel="noopener">自然素材 · Poly Haven ↗</a>`;
  document.body.append(shell);
  // Move the original controls, retaining their IDs, listeners and live status updates.
  const modeBar=document.getElementById('title');
  modeBar.setAttribute('aria-label','钓法与漂流状态');
  shell.append(modeBar);
  const settings=document.getElementById('ctl'),gauge=document.getElementById('gauge');
  settings.setAttribute('aria-label','钓组与河流设置');gauge.setAttribute('aria-label','深度仪');
  const toggle=(id,cls,panel)=>document.getElementById(id).onclick=()=>{const on=document.body.classList.toggle(cls);document.getElementById(id).setAttribute('aria-expanded',String(on));panel.inert=!on;if(on&&innerWidth<700){const other=cls==='settings-open'?'telemetry-open':'settings-open';document.body.classList.remove(other);const oid=cls==='settings-open'?'toggleTelemetry':'toggleSettings';document.getElementById(oid).setAttribute('aria-expanded','false');(cls==='settings-open'?gauge:settings).inert=true;}};
  settings.inert=gauge.inert=true;toggle('toggleSettings','settings-open',settings);toggle('toggleTelemetry','telemetry-open',gauge);
  document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{actions.setView(button.dataset.view);document.querySelectorAll('[data-view]').forEach(b=>{const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});document.body.classList.toggle('underwater',button.dataset.view==='underwater');});
  document.getElementById('quickCast').onclick=actions.cast;
  document.getElementById('quickPause').onclick=actions.pause;
  document.getElementById('quality').onchange=e=>actions.setQuality(e.target.value);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.body.classList.remove('settings-open','telemetry-open');settings.inert=gauge.inert=true;document.getElementById('toggleSettings').setAttribute('aria-expanded','false');document.getElementById('toggleTelemetry').setAttribute('aria-expanded','false');}});
}
export function updateHud({depth,flow}){
  const d=document.getElementById('hudDepth');if(!d)return;
  // Sample every rendered frame; only touch the DOM when displayed values change.
  for(const [el,value,unit] of [[d,depth,'m'],[document.getElementById('hudFlow'),flow,'m/s']]){
    const text=value.toFixed(2);
    if(el.dataset.value!==text){el.dataset.value=text;el.innerHTML=`${text} <small>${unit}</small>`;}
  }
  document.getElementById('quickPause').textContent=document.getElementById('bPause').textContent==='继续'?'▷':'Ⅱ';
}
