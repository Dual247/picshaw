import test from 'node:test';
import assert from 'node:assert/strict';
import {createVercelSink} from './transport.js';
test('fixed payload omits extra PII and credentials/referrer; QA never engagement',async()=>{
 const calls=[];const sink=createVercelSink({slug:'andy-kusumo-dds',qa:true,fetchImpl:async(...a)=>{calls.push(a);return {ok:true,status:200}}});
 const data={company:'andy-kusumo-dds',path:'/previews/andy-kusumo-dds/',action:'cta',email:'secret@example.com',userId:'secret'};
 await sink('picshaw_preview_engaged',data);assert.equal(calls.length,0);
 await sink('picshaw_preview_qa',data);assert.equal(calls.length,1);
 const [url,opts]=calls[0];assert.equal(url,'https://www.picshaw.com/_vercel/insights/event');assert.equal(opts.credentials,'omit');assert.equal(opts.referrerPolicy,'no-referrer');
 assert.doesNotMatch(opts.body,/secret|userId|email/);const b=JSON.parse(opts.body);assert.equal(b.r,'');assert.equal(b.en,'picshaw_preview_qa');
 assert.deepEqual(Object.keys(b).sort(),['ed','en','o','r','sdkn','sdkv','ts']);
});
