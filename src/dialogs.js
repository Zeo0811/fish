// Keep keyboard focus inside the currently visible overlay, restore it on close.
export function setupDialogFocus(){
  const overlays=[...document.querySelectorAll('.studio-overlay')];let active=null,previous=null,saved=[];
  const visible=el=>getComputedStyle(el).display!=='none';
  function sync(){
    const next=overlays.filter(visible).at(-1)||null;if(next===active)return;
    if(active){saved.forEach(([el,inert])=>el.inert=inert);saved=[];}
    if(next){if(!active)previous=document.activeElement;active=next;
      for(const el of document.body.children){if(el!==active&&el.tagName!=='SCRIPT'){saved.push([el,el.inert]);el.inert=true;}}
      active.inert=false;requestAnimationFrame(()=>active?.querySelector('button:not(:disabled)')?.focus());
    }else{active=null;if(previous?.isConnected&&!previous.closest('[inert]'))previous.focus();previous=null;}
  }
  const observer=new MutationObserver(sync);overlays.forEach(el=>observer.observe(el,{attributes:true,attributeFilter:['style']}));
  document.addEventListener('keydown',e=>{
    if(!active)return;
    if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();const id={biteWrap:'biteX',modalWrap:'mClose',driftEndWrap:'driftStop'}[active.id];document.getElementById(id)?.click();return;}
    if(e.key==='Tab'){const nodes=[...active.querySelectorAll('button:not(:disabled),[href],input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]')].filter(el=>el.getClientRects().length);
      const first=nodes[0],last=nodes.at(-1);if(!first){e.preventDefault();return;}
      if(e.shiftKey&&(document.activeElement===first||!active.contains(document.activeElement))){last.focus();e.preventDefault();}else if(!e.shiftKey&&(document.activeElement===last||!active.contains(document.activeElement))){first.focus();e.preventDefault();}
    }
  },true);
}
