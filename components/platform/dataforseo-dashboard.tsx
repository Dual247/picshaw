'use client'
import Link from 'next/link'
import {useEffect,useRef,useState} from 'react'
import {DataForSeoPanel,type DataForSeoTransport} from './dataforseo-panel'
import type {PublicDataForSeoJob as DataForSeoJob} from '../../lib/platform/dataforseo-types'
const transport:DataForSeoTransport={
  submit:input=>post('submit',input),
  read:jobId=>post('read',{jobId}),
  latest:platform=>postLatest(platform),
}
async function post(action:'submit'|'read',body:unknown):Promise<DataForSeoJob>{
  const response=await fetch(`/api/platform/ai-visibility/${action}`,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
  if(!response.ok){const error=new Error('AI evidence unavailable') as Error&{status:number};error.status=response.status;throw error}
  const data=await response.json()
  if(!data||data.enabled!==true||!data.job)throw Error('AI evidence unavailable')
  return data.job
}
async function postLatest(platform:'google'|'chat_gpt'):Promise<DataForSeoJob|null>{
  const response=await fetch('/api/platform/ai-visibility/latest',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({platform})})
  if(!response.ok){const error=new Error('Saved AI evidence unavailable') as Error&{status:number};error.status=response.status;throw error}
  const data=await response.json();if(!data||data.enabled!==true||!Object.hasOwn(data,'job'))throw Error('Saved evidence unavailable');return data.job
}
export function DataForSeoDashboard(){
  const [workspace,setWorkspace]=useState<{domain:string;scope:string}|null>(null)
  const [message,setMessage]=useState('Checking private workspace access. No external lookup is started.')
  const [busy,setBusy]=useState(false)
  const guard=useRef({alive:false,epoch:0,busy:false,controller:null as AbortController|null})
  function clear(){guard.current.epoch++;guard.current.controller?.abort();guard.current.busy=false;setBusy(false);setWorkspace(null)}
  async function check(){
    const g=guard.current;if(!g.alive||g.busy)return
    clear();const epoch=++g.epoch;g.busy=true;setBusy(true);g.controller=new AbortController()
    try{
      const r=await fetch('/api/platform/workspaces/current',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:'{}',signal:g.controller.signal})
      const value=await r.json();if(!g.alive||g.epoch!==epoch)return
      if(!r.ok){setMessage(r.status===401||r.status===403?'Sign in with your approved pilot account to continue.':'Workspace access is unavailable. No provider request was sent.');return}
      const site=value?.workspace?.site,id=value?.workspace?.id
      if(typeof site!=='string'||typeof id!=='string'||!/^([a-z0-9-]+\.)+[a-z]{2,63}$/.test(site)){setMessage('Create your workspace before requesting AI visibility evidence.');return}
      setWorkspace({domain:site.toLowerCase().replace(/^www\./,''),scope:crypto.randomUUID()});setMessage('Private workspace verified. A provider lookup starts only after your explicit consent.')
    }catch{if(g.alive&&g.epoch===epoch)setMessage('Workspace access could not be confirmed. No previous evidence remains visible.')}
    finally{if(g.alive&&g.epoch===epoch){g.busy=false;setBusy(false)}}
  }
  useEffect(()=>{
    const lifecycle=guard.current; lifecycle.alive=true;let active=true
    const revoke=()=>{clear();setMessage('Private evidence cleared. Check access or sign in again.')}
    let channel:BroadcastChannel|null=null
    try{if(typeof BroadcastChannel!=='undefined')channel=new BroadcastChannel('picshaw-portal-auth')}catch{/* Server access checks remain required. */}
    if(channel)channel.onmessage=e=>{if(e.data==='signed-out')revoke()}
    window.addEventListener('pagehide',revoke);window.addEventListener('picshaw:session-cleared',revoke)
    void Promise.resolve().then(()=>{if(active)void check()})
    return()=>{active=false;lifecycle.alive=false;lifecycle.epoch++;lifecycle.controller?.abort();channel?.close();window.removeEventListener('pagehide',revoke);window.removeEventListener('picshaw:session-cleared',revoke)}
    // check only uses this stable lifecycle object and React setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])
  return <div className="space-y-5"><p role="status">{message}</p>{workspace?<DataForSeoPanel domain={workspace.domain} sessionScope={workspace.scope} transport={transport}/>:<div className="flex gap-3"><button className="portal-button secondary" disabled={busy} onClick={()=>void check()}>Check private access</button><Link className="portal-button secondary" href="/platform/sign-in">Sign in</Link><Link className="portal-button secondary" href="/platform/onboarding">Set up workspace</Link></div>}</div>
}
