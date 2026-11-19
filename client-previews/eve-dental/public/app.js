const menu = document.querySelector('.menu-toggle');
const nav = document.querySelector('.navlinks');
menu?.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', String(open)); nav.classList.toggle('open', open); menu.textContent = open ? 'Close' : 'Menu'; });
nav?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { menu.setAttribute('aria-expanded','false'); nav.classList.remove('open'); menu.textContent='Menu'; }));
const tabs = [...document.querySelectorAll('[role="tab"]')];
function selectTab(t, focus=false){ tabs.forEach(b => { const active=b===t; b.setAttribute('aria-selected',String(active)); b.tabIndex=active?0:-1; document.getElementById(b.getAttribute('aria-controls')).hidden=!active; }); if(focus)t.focus(); }
tabs.forEach((t,i)=>{t.addEventListener('click',()=>selectTab(t));t.addEventListener('keydown',e=>{let n=i;if(e.key==='ArrowRight')n=(i+1)%tabs.length;else if(e.key==='ArrowLeft')n=(i-1+tabs.length)%tabs.length;else if(e.key==='Home')n=0;else if(e.key==='End')n=tabs.length-1;else return;e.preventDefault();selectTab(tabs[n],true);});});
const form=document.querySelector('#demo-form');
document.querySelectorAll('[data-interest]').forEach(a=>a.addEventListener('click',()=>{const s=form?.querySelector('[name=interest]');if(s)s.value=a.dataset.interest;}));
if(form){const result=document.querySelector('#form-result');form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;form.reset();result.hidden=false;result.textContent='Demo complete. No request was sent and your entries have been cleared. A live website would pass appointment requests to the practice for confirmation. Please call the office for a real appointment.';result.focus();});form.querySelector('button[type=submit]').disabled=false;window.addEventListener('pagehide',()=>{form.reset();result.hidden=true;});}

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

const slug="eve-dental";
const qa=location.hostname==='www.picshaw.com' && location.pathname==="/previews/eve-dental/" && new URLSearchParams(location.search).get('picshaw_qa')==='1';
installEngagementTracker({window,document,slug,path:"/previews/eve-dental/",expiresAt:1795651263000,qa,emit:createVercelSink({fetchImpl:window.fetch.bind(window),slug,qa})});
})();
