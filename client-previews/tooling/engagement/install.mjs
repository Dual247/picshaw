import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const dir=path.dirname(fileURLToPath(import.meta.url));
export const CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src https://www.picshaw.com/_vercel/insights/event; form-action 'none'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
const SCRIPT='<script defer src="./picshaw-engagement.js" data-picshaw-engagement="1"></script>';
const NOTICE='<p data-picshaw-engagement-notice="1">Picshaw records interaction categories to improve this concept. Form contents are not sent. <a href="?picshaw_no_track=1">Turn off interaction tracking</a>.</p>';
export function install(root,{check=false}={}) {
  root=fs.realpathSync(root);
  // Read and validate everything before writing. Never alter lifecycle or server gate.
  for(const name of ['public','public/index.html','preview-lifecycle.json','vercel.json','proxy.js','preview-policy.js']) {
    const resolved=fs.realpathSync(path.join(root,name));
    if(!resolved.startsWith(root+path.sep))throw Error('Symlink outside preview: '+name);
  }
  const lifecycleBytes=fs.readFileSync(path.join(root,'preview-lifecycle.json'));
  const p=JSON.parse(lifecycleBytes);
  const first=Date.parse(p.firstPublishedAt), end=Date.parse(p.expiresAt);
  if(!/^[a-z0-9-]+$/.test(p.slug)||!Number.isSafeInteger(first)||!Number.isSafeInteger(end)||
     p.firstPublishedAtEpochMs!==first||p.expiresAtEpochMs!==end||end<=first||end-first>168*3600000||p.maximumLifetimeHours!==168)
    throw Error('Invalid immutable lifecycle');
  if(typeof p.brandedUrl!=='string'||!new RegExp('^https://www\\.picshaw\\.com/previews/(?:[a-z0-9-]+/)?'+p.slug+'/$').test(p.brandedUrl))throw Error('Canonical route/slug mismatch: do not guess mapping');
  const canonicalPath=p.brandedUrl.slice('https://www.picshaw.com'.length);
  const config=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
  if(config.outputDirectory!=='public'||config.proxy?.entrypoint!=='proxy.js')throw Error('Unsupported deployment layout');
  const policies=(config.headers||[]).flatMap(rule=>(rule.headers||[]).filter(h=>h.key.toLowerCase()==='content-security-policy').map(h=>({rule,h})));
  if(policies.length!==1||policies[0].rule.source!=='/(.*)')throw Error('Expected one global CSP');
  if(![CSP,CSP.replace('connect-src https://www.picshaw.com/_vercel/insights/event',"connect-src 'none'")].includes(policies[0].h.value))throw Error('Unexpected CSP; review manually, never widen it');
  const file=path.join(root,'public/picshaw-engagement.js');
  if(fs.existsSync(file)&&fs.lstatSync(file).isSymbolicLink())throw Error('Symlink bundle not permitted');
  let html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  // Refuse old in-app instrumentation; avoid silently double-counting.
  const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
  for(const f of walk(path.join(root,'public')))if(f!==file&&/\.(js|html)$/.test(f)&&/picshaw_preview_engaged|installEngagementTracker|_vercel\/insights\/script/.test(fs.readFileSync(f,'utf8')))throw Error('Existing tracking requires manual reconciliation: '+f);
  if(!html.includes('</body>'))throw Error('Missing closing body');
  if(html.includes('picshaw-engagement.js')&&!html.includes(SCRIPT))throw Error('Unexpected tracker script markup');
  if(!html.includes(SCRIPT))html=html.replace('</body>',SCRIPT+'\n</body>');
  if(!html.includes(NOTICE)) {
    if(html.includes('data-picshaw-engagement-notice'))throw Error('Existing privacy notice requires review');
    html=html.replace('</body>',NOTICE+'\n</body>');
  }
  policies[0].h.value=CSP;
  const temp=fs.mkdtempSync(path.join(root,'.tracker-build-'));
  try {
    const generated=path.join(temp,'bundle.js');
    execFileSync(process.execPath,[path.join(dir,'build-bundle.mjs'),p.slug,canonicalPath,String(end),generated]);
    const bundle=fs.readFileSync(generated);
    if(check) {
      if(!fs.existsSync(file)||!fs.readFileSync(file).equals(bundle)||fs.readFileSync(path.join(root,'public/index.html'),'utf8')!==html||JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8')).headers.flatMap(x=>x.headers||[]).find(x=>x.key.toLowerCase()==='content-security-policy')?.value!==CSP)throw Error('Tracker is absent or out of date; install then inspect diff');
    } else {
      fs.writeFileSync(file,bundle);fs.writeFileSync(path.join(root,'public/index.html'),html);
      fs.writeFileSync(path.join(root,'vercel.json'),JSON.stringify(config,null,2)+'\n');
    }
    if(!fs.readFileSync(path.join(root,'preview-lifecycle.json')).equals(lifecycleBytes))throw Error('Lifecycle changed concurrently: stop');
  } finally {fs.rmSync(temp,{recursive:true,force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const args=process.argv.slice(2), check=args.includes('--check'), root=args.find(x=>x!=='--check');
 if(!root||args.length>(check?2:1))throw Error('Usage: node install.mjs <preview-directory> [--check]');
 install(root,{check});console.log(check?'Tracker verified':'Tracker installed; inspect diff and run expiry + browser QA before deployment');
}
