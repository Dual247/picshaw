import assert from 'node:assert/strict'
import http from 'node:http'
// Local built server with all runtime flags disabled. Never point at a hosted origin.
const port = Number(process.env.PORTAL_TEST_PORT || 4312)
function request(host, path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({hostname:'127.0.0.1',port,path,method,headers:{host,origin:'https://app.picshaw.com','Content-Type':'application/json'}},res=>{
      let body='';res.setEncoding('utf8');res.on('data',chunk=>{body+=chunk});res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}))
    });req.on('error',reject);req.end(method==='POST'?'{}':undefined)
  })
}
const page=await request('app.picshaw.com','/platform/reports')
assert.equal(page.status,200);assert.match(page.headers['cache-control'],/no-store/);assert.match(page.headers['x-robots-tag'],/noindex/);assert.equal(page.headers['referrer-policy'],'no-referrer')
assert.match(page.body,/Your Google Search report/);assert.doesNotMatch(page.body,/googletagmanager\.com|data-picshaw-chat|\/_vercel\/insights/)
for(const op of ['sync','read','status']){
 const disabled=await request('app.picshaw.com',`/api/platform/reports/${op}`,'POST')
 assert.equal(disabled.status,503);assert.equal(JSON.parse(disabled.body).enabled,false);assert.match(disabled.headers['cache-control'],/no-store/);assert.equal(disabled.headers['set-cookie'],undefined)
 const marketing=await request('picshaw.com',`/api/platform/reports/${op}`,'POST');assert.equal(marketing.status,404);assert.equal(marketing.body,'Not found')
 const local=await request(`localhost:${port}`,`/api/platform/reports/${op}`,'POST');assert.equal(local.status,404)
}
console.log('PASS built report shell privacy and disabled APIs; marketing/local API boundaries. Local HTTP only, no browser or live account/provider test.')
