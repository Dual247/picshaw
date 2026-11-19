// Versioned compatibility adapter based on the publicly inspectable Vercel
// collector protocol, NOT a documented browser SDK API. Verify ingestion before
// rollout. Never load the SDK: it can append identity from existing storage.
export function createVercelSink({fetchImpl, slug, path=`/previews/${slug}/`, qa=false}) {
  if(!/^[a-z0-9-]+$/.test(slug)) throw Error('Invalid slug');
  if(!new RegExp('^/previews/(?:[a-z0-9-]+/)?'+slug+'/$').test(path)) throw Error('Invalid canonical path');
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
