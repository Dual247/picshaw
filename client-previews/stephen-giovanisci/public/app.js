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
