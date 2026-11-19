'use strict';
const menuButton=document.querySelector('.menu-toggle');
const navigation=document.getElementById('main-nav');
function closeMenu(){navigation.classList.remove('open');menuButton.setAttribute('aria-expanded','false');document.body.classList.remove('menu-open');}
menuButton.addEventListener('click',()=>{const open=menuButton.getAttribute('aria-expanded')!=='true';menuButton.setAttribute('aria-expanded',String(open));navigation.classList.toggle('open',open);document.body.classList.toggle('menu-open',open);});
navigation.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeMenu));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&navigation.classList.contains('open')){closeMenu();menuButton.focus();}});
window.addEventListener('resize',()=>{if(window.innerWidth>760)closeMenu();});
const tabs=[...document.querySelectorAll('.care-tab')];
function activateTab(tab,focus=false){tabs.forEach(item=>{const active=item===tab;item.setAttribute('aria-selected',String(active));item.tabIndex=active?0:-1;document.getElementById(item.getAttribute('aria-controls')).hidden=!active;});if(focus)tab.focus();}
tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>activateTab(tab));tab.addEventListener('keydown',event=>{let next;if(event.key==='ArrowDown'||event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowUp'||event.key==='ArrowLeft')next=(index-1+tabs.length)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;if(next!==undefined){event.preventDefault();activateTab(tabs[next],true);}});});
const form=document.getElementById('appointment-form');
const success=document.getElementById('form-success');
const submit=document.getElementById('demo-submit');
const reset=document.getElementById('reset-demo');
form.addEventListener('submit',event=>{event.preventDefault();if(!form.reportValidity())return;form.reset();form.hidden=true;success.hidden=false;reset.focus();});
reset.addEventListener('click',()=>{success.hidden=true;form.hidden=false;form.reset();document.getElementById('first-name').focus();});
window.addEventListener('pagehide',()=>{form.reset();success.hidden=true;form.hidden=false;closeMenu();});
submit.disabled=false;

;(()=>{
/* Transport-neutral pilot. No network is performed until an audited sink is supplied.
 * Intentional engagement is not proof of prospect identity or buying intent.
 */
function installEngagementTracker({window: w, document: d, emit, slug,
  path, expiresAt, productionHost = 'www.picshaw.com', qa = false}) {
  const allowed = new Set(['cta', 'navigation', 'service_tab', 'demo_submit']);
  const endpointPath = `/previews/${slug}/`;
  if (!/^[a-z0-9-]+$/.test(slug) || path !== endpointPath || !Number.isFinite(expiresAt)) throw Error('Invalid tracker configuration');
  const seen = new Set();
  const off = [];
  const permitted = () => !w.navigator.globalPrivacyControl &&
    !['1','yes'].includes(w.navigator.doNotTrack) && w.doNotTrack !== '1' &&
    d.visibilityState === 'visible' && !d.prerendering && Date.now() < expiresAt &&
    w.location.hostname === productionHost && w.location.pathname === path &&
    !new URLSearchParams(w.location.search).has('picshaw_no_track') &&
    (qa ? new URLSearchParams(w.location.search).get('picshaw_qa') === '1' :
      (!w.navigator.webdriver && !new URLSearchParams(w.location.search).has('picshaw_qa')));
  const report = (event, action) => {
    if (event.isTrusted !== true || !allowed.has(action) || !permitted() || seen.has(action)) return;
    seen.add(action);
    // Never transmit text, href, target IDs, form values, query strings or identity.
    emit(qa ? 'picshaw_preview_qa' : 'picshaw_preview_engaged', {company:slug,path,action});
  };
  const on = (name, handler) => {d.addEventListener(name,handler);off.push(()=>d.removeEventListener(name,handler));};
  on('click', event => {
    const el = event.target?.closest?.('a,button');
    if (!el || el.closest('form')) return; // A form button is not a completed demo.
    if (el.getAttribute('role') === 'tab') return report(event,'service_tab');
    if (el.tagName !== 'A') return;
    const href=el.getAttribute('href') || '';
    if (el.matches?.('.skip') || ['#main','#home','#top','#',''].includes(href)) return;
    if (href.startsWith('#')) report(event,'navigation');
    else if (/^(https?:|tel:|sms:|mailto:)/.test(href)) report(event,'cta');
  });
  on('keydown', event => {
    if (event.target?.getAttribute?.('role') === 'tab' && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) report(event,'service_tab');
  });
  on('submit', event => {if(event.target?.matches?.('.demo-form, [data-demo-form], #demo-form, #appointment-form')) report(event,'demo_submit');});
  return () => off.forEach(fn=>fn());
}

// Versioned compatibility adapter based on the publicly inspectable Vercel
// collector protocol, NOT a documented browser SDK API. Verify ingestion before
// rollout. Never load the SDK: it can append identity from existing storage.
function createVercelSink({fetchImpl, slug, qa=false}) {
  if(!/^[a-z0-9-]+$/.test(slug)) throw Error('Invalid slug');
  const path=`/previews/${slug}/`;
  const expected=qa?'picshaw_preview_qa':'picshaw_preview_engaged';
  const actions=new Set(['cta','navigation','service_tab','demo_submit']);
  return (name,data) => {
    if(name!==expected || data?.company!==slug || data?.path!==path || !actions.has(data?.action)) return;
    const body={o:`https://www.picshaw.com${path}`,ts:Date.now(),sdkn:'picshaw-preview',sdkv:'1.0.0',r:'',en:expected,ed:{company:slug,path,action:data.action}};
    // Only explicit fields are copied; ignore any unexpected caller properties.
    return fetchImpl('https://www.picshaw.com/_vercel/insights/event', {
      method:'POST',credentials:'omit',referrerPolicy:'no-referrer',keepalive:true,
      headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
    }).then(response=>({ok:response.ok,status:response.status})).catch(()=>({ok:false}));
  };
}

const slug="stephen-giovanisci";
const qa=location.hostname==='www.picshaw.com' && location.pathname==="/previews/stephen-giovanisci/" && new URLSearchParams(location.search).get('picshaw_qa')==='1';
installEngagementTracker({window,document,slug,path:"/previews/stephen-giovanisci/",expiresAt:1795651263000,qa,emit:createVercelSink({fetchImpl:window.fetch.bind(window),slug,qa})});
})();
