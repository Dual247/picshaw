import Link from 'next/link'
import { PortalHeader } from '@/components/platform/portal-header'
import { DataForSeoEvidence } from '@/components/platform/dataforseo-panel'
import type { MentionEvidence } from '@/lib/platform/dataforseo-types'
const evidence: MentionEvidence = {
  source:'dataforseo-llm-mentions',domain:'willow-dental.example',platform:'google',locationCode:2840,languageCode:'en',retrievedAt:'2026-11-12T09:00:00Z',providerTaskId:'fictional-preview-only',actualCostUsd:0,totalMatches:6,sampledRows:6,
  limitations:['Entirely fictional demonstration. No provider or search engine was contacted.','This sample demonstrates the explorer controls, not actual visibility or market share.'],
  items:[
    {question:'What should I look for when choosing a family dentist?',model:'Example model A',observedAt:'2026-11-10T12:00:00Z',citations:[{title:'Family dentistry guide',url:'https://willow-dental.example/family-dentistry'},{title:'Choosing dental care',url:'https://dental-guide.example/choosing-care'}]},
    {question:'How can I prepare for an emergency dental appointment?',model:'Example model A',observedAt:'2026-11-09T12:00:00Z',citations:[{title:'Emergency care',url:'https://willow-dental.example/emergency'},{title:'Urgent dental appointments',url:'https://care-directory.example/urgent-care'}]},
    {question:'What are the different teeth whitening options?',model:'Example model B',observedAt:'2026-11-08T12:00:00Z',citations:[{title:'Whitening options',url:'https://dental-guide.example/whitening'},{title:'Whitening treatment',url:'https://willow-dental.example/whitening'}]},
    {question:'What happens at a first dental consultation?',model:'Example model B',observedAt:'2026-11-07T12:00:00Z',citations:[{title:'Your first visit',url:'https://willow-dental.example/first-visit'},{title:'Dental checkup information',url:'https://dental-guide.example/checkups'}]},
    {question:'How often should children have a dental checkup?',model:'Example model A',observedAt:null,citations:[{title:'Children’s oral health',url:'https://care-directory.example/children'},{title:'Family care',url:'https://willow-dental.example/family-dentistry'}]},
    {question:'Which questions should I ask about dental implants?',model:null,observedAt:'2026-11-05T12:00:00Z',citations:[{title:'Implant consultation',url:'https://willow-dental.example/implants'},{title:'Understanding implants',url:'https://dental-guide.example/implants'}]},
  ],
}
export default function EvidencePreviewPage() {
 return <><PortalHeader sample/><div className="portal-sample-banner"><strong>FICTIONAL INTERACTIVE PREVIEW</strong><span>Every question, source and count below is invented. No accounts connected.</span></div><main id="main-content" className="portal-container portal-command-center"><Link href="/platform" prefetch={false} className="portal-text-link">Back to your private workspace</Link><h1 className="sr-only">Citation explorer preview</h1><DataForSeoEvidence evidence={evidence} sample/></main></>
}
