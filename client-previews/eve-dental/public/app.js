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
