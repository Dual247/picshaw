import test from 'node:test';
import assert from 'node:assert/strict';
import {installEngagementTracker} from './engagement.js';
function fixture(opts={}) {
 const events={}, sent=[];
 const w={navigator:{},location:{hostname:'www.picshaw.com',pathname:'/previews/andy-kusumo-dds/',search:''}};
 const d={visibilityState:'visible',prerendering:false,addEventListener:(n,f)=>events[n]=f,removeEventListener:n=>delete events[n]};
 const config={window:w,document:d,emit:(...args)=>sent.push(args),slug:'andy-kusumo-dds',path:'/previews/andy-kusumo-dds/',expiresAt:Date.now()+60000,...opts};
 installEngagementTracker(config);
 const anchor={tagName:'A',getAttribute:n=>n==='href'?'mailto:secret@example.com':null,closest:()=>null};
 const click=(trusted=true)=>events.click({isTrusted:trusted,target:{closest:()=>anchor}});
 return {w,d,events,sent,click};
}
test('no page load/prefetch event, trusted CTA only, dedup, minimal payload',()=>{
 const f=fixture();assert.equal(f.sent.length,0);f.click(false);assert.equal(f.sent.length,0);
 f.click();f.click();assert.deepEqual(f.sent,[['picshaw_preview_engaged',{company:'andy-kusumo-dds',path:'/previews/andy-kusumo-dds/',action:'cta'}]]);
});
test('privacy, background, automated, noncanonical and test traffic excluded',()=>{
 for(const mutate of [f=>f.w.navigator.globalPrivacyControl=true,f=>f.w.navigator.doNotTrack='1',f=>f.w.doNotTrack='1',f=>f.d.visibilityState='hidden',f=>f.d.prerendering=true,f=>f.w.navigator.webdriver=true,f=>f.w.location.hostname='localhost',f=>f.w.location.search='?picshaw_qa=1',f=>f.w.location.search='?picshaw_no_track=1',f=>f.w.location.pathname='/']){const f=fixture();mutate(f);f.click();assert.equal(f.sent.length,0);}
});
test('expiry and invalid configuration fail closed',()=>{
 const f=fixture({expiresAt:0});f.click();assert.equal(f.sent.length,0);
 assert.throws(()=>fixture({path:'/wrong/'}));
});
test('QA is explicitly separate and still honors privacy',()=>{
 const f=fixture({qa:true});f.w.location.search='?picshaw_qa=1';f.click();assert.equal(f.sent[0][0],'picshaw_preview_qa');
 const g=fixture({qa:true});g.w.navigator.globalPrivacyControl=true;g.click();assert.equal(g.sent.length,0);
});
