'use client'

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, Check, Send, RotateCcw, X } from 'lucide-react'
import { chatInterests, getChatAnswer, interestFor, starterQuestions, type ChatAnswer, type ChatTopic } from '@/lib/chatbot'
import { sendLeadConversion } from '@/lib/google-conversions'
import styles from './ChatWidget.module.css'

type Turn = { id: number; question: string; answer: ChatAnswer }
const emptyLead = { name: '', email: '', business: '', website: '', message: '', interest: 'ai-visibility', fax: '' }
export default function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [question, setQuestion] = useState('')
  const [mode, setMode] = useState<'chat' | 'lead' | 'success'>('chat')
  const [lead, setLead] = useState(emptyLead)
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle')
  const [error, setError] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const serial = useRef(0)
  const submitting = useRef(false)
  const previous = useRef<ChatTopic | undefined>(undefined)
  const heading = useRef<HTMLHeadingElement>(null)
  const email = useRef<HTMLInputElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const body = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => (mode === 'lead' ? email.current : heading.current)?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [open, mode])
  useEffect(() => { if (body.current && mode === 'chat') body.current.scrollTop = body.current.scrollHeight }, [turns, mode])
  function ask(text: string) {
    const trimmed = text.trim().slice(0, 1200)
    if (!trimmed) return
    const reply = getChatAnswer(trimmed, previous.current)
    previous.current = reply.topic
    const turn = { id: ++serial.current, question: trimmed, answer: reply }
    setTurns(items => [...items.slice(-11), turn])
    setQuestion('')
    setAnnouncement(reply.text)
    input.current?.focus({ preventScroll: true })
  }
  function clear() {
    if (submitting.current) return
    setTurns([]); setQuestion(''); setLead(emptyLead); setStatus('idle'); setError(''); setMode('chat'); previous.current = undefined
    setAnnouncement('Conversation cleared. No chat history is stored on this website.')
    heading.current?.focus({ preventScroll: true })
  }
  function request() {
    const last = turns.at(-1)
    setLead(current => ({ ...current, interest: current.message ? current.interest : interestFor(last?.answer.topic || 'overview'), message: current.message || (last?.question ?? '') }))
    setStatus('idle'); setError(''); setMode('lead')
  }
  function keyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') { event.stopPropagation(); onClose() }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setStatus('sending'); setError('')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)
    const selected = chatInterests.find(([value]) => value === lead.interest)?.[1] ?? 'Specific request'
    try {
      const response = await fetch('/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ name: lead.name, email: lead.email, business: lead.business, website: lead.website, service_interest: 'chatbot', honeypot: lead.fax, message: `Interested in: ${selected}\n\n${lead.message.trim()}` }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || result?.success !== true) throw new Error('Enquiry not confirmed')
      sendLeadConversion()
      setLead(emptyLead); setTurns([]); previous.current = undefined; setMode('success'); setStatus('idle')
      setAnnouncement('Your request was accepted. Picshaw will review it and reply by email. No appointment or paid work has been started.')
    } catch {
      setStatus('error')
      setError('We could not confirm your request was sent. Your details are still here. Please try again or email hello@picshaw.com.')
    } finally { clearTimeout(timer); submitting.current = false }
  }
  const last = turns.at(-1)?.answer
  const suggestions = last?.suggestions || starterQuestions
  return <section id="picshaw-chat-dialog" role="dialog" aria-modal="false" aria-labelledby="picshaw-chat-title" className={styles.panel} onKeyDown={keyDown}>
    <header className={styles.top}>
      <div className={styles.identity}><span className={styles.monogram} aria-hidden="true">P</span><div><h2 id="picshaw-chat-title" ref={heading} tabIndex={-1}>Ask Picshaw</h2><p>Automated answers. A clearer next step.</p></div></div>
      <div className={styles.controls}><button type="button" onClick={clear} disabled={status === 'sending'} aria-label="Clear Picshaw conversation"><RotateCcw size={16} aria-hidden="true" /></button><button type="button" onClick={onClose} aria-label="Minimise chat"><X size={19} aria-hidden="true" /></button></div>
    </header>
    <p role="status" className={styles.srOnly}>{announcement}</p>
    {mode === 'chat' ? <>
      <div className={styles.body} ref={body}>
        <div className={styles.welcome}><p className={styles.eyebrow}>A useful place to start</p><h3>What would you like<br />to improve?</h3><p>Ask about AI visibility, websites, pricing or the receptionist pilot. Get an answer before sharing any contact details.</p></div>
        <div role="log" aria-live="off" aria-label="Picshaw conversation" className={styles.messages}>{turns.map(turn => <div key={turn.id} className={styles.turn}>
          <p className={styles.userMessage}><span className={styles.srOnly}>You: </span>{turn.question}</p>
          <div className={styles.answer}><p><span className={styles.srOnly}>Picshaw assistant: </span>{turn.answer.text}</p>{turn.answer.links.length > 0 && <div className={styles.sources}>{turn.answer.links.map(link => <Link key={link.href} href={link.href} onClick={onClose}>{link.label}<ArrowUpRight size={13} aria-hidden="true" /></Link>)}</div>}</div>
        </div>)}</div>
        <div className={styles.suggestions} aria-label="Suggested questions">{suggestions.map(text => <button key={text} type="button" onClick={() => ask(text)}>{text}<ArrowUpRight size={13} aria-hidden="true" /></button>)}</div>
      </div>
      <div className={styles.composer}>
        <button type="button" onClick={request} className={styles.requestButton}>Send a request to Ash<ArrowUpRight size={15} aria-hidden="true" /></button>
        <form onSubmit={event => { event.preventDefault(); ask(question) }} className={styles.askForm}>
          <label htmlFor="picshaw-chat-question" className={styles.srOnly}>Your question for Picshaw</label>
          <textarea id="picshaw-chat-question" ref={input} rows={2} maxLength={1200} placeholder="Ask your question…" value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); ask(question) } }} />
          <button type="submit" disabled={!question.trim()} aria-label="Send question"><Send size={18} aria-hidden="true" /></button>
        </form>
        <p className={styles.finePrint}>Published information, not a live agent. Chat stays in this tab. <Link href="/privacy-policy#chat-assistant" onClick={onClose}>Privacy</Link></p>
      </div>
    </> : mode === 'lead' ? <div className={styles.body}>
      <button type="button" className={styles.back} onClick={() => setMode('chat')} disabled={status === 'sending'}><ArrowLeft size={14} aria-hidden="true" />Back to answers</button>
      <h3 className={styles.leadTitle}>A recommendation for<br />your business.</h3>
      <p className={styles.intro}>Review your request below. Ash will have the details he needs to discuss the next step.</p>
      <form className={styles.leadForm} onSubmit={submit} aria-busy={status === 'sending'} data-enquiry-type="chatbot">
        <fieldset disabled={status === 'sending'}><legend className={styles.srOnly}>Your request to Picshaw</legend>
          <label htmlFor="chat-lead-name">Name <span>(optional)</span><input id="chat-lead-name" autoComplete="name" maxLength={150} value={lead.name} onChange={e => setLead({ ...lead, name: e.target.value })} /></label>
          <label htmlFor="chat-lead-email">Reply email <span>(required)</span><input id="chat-lead-email" ref={email} type="email" autoComplete="email" required maxLength={254} value={lead.email} onChange={e => setLead({ ...lead, email: e.target.value })} /></label>
          <label htmlFor="chat-lead-business">Business <span>(optional)</span><input id="chat-lead-business" autoComplete="organization" maxLength={200} value={lead.business} onChange={e => setLead({ ...lead, business: e.target.value })} /></label>
          <label htmlFor="chat-lead-website">Website <span>(optional)</span><input id="chat-lead-website" type="text" autoComplete="url" inputMode="url" placeholder="yourbusiness.com" maxLength={2048} value={lead.website} onChange={e => setLead({ ...lead, website: e.target.value })} /></label>
          <label htmlFor="chat-lead-interest">Interested in<select id="chat-lead-interest" value={lead.interest} onChange={e => setLead({ ...lead, interest: e.target.value })}>{chatInterests.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label htmlFor="chat-lead-message">Your question or goal <span>(required)</span><textarea id="chat-lead-message" rows={3} required maxLength={1200} value={lead.message} onChange={e => setLead({ ...lead, message: e.target.value })} placeholder="What you do, where you work, and what you need help with." /></label>
          <div hidden aria-hidden="true"><label htmlFor="chat-lead-fax">Leave empty<input id="chat-lead-fax" tabIndex={-1} autoComplete="off" value={lead.fax} onChange={e => setLead({ ...lead, fax: e.target.value })} /></label></div>
          <p className={styles.finePrint}>Only these form details are sent, not the full chat. Enquiring is free; no newsletter signup, payment or reservation. <Link href="/privacy-policy#chat-assistant" onClick={onClose}>Privacy Policy</Link>.</p>
          <button className={styles.submitLead} type="submit">{status === 'sending' ? 'Sending request…' : 'Send my request'}<ArrowUpRight size={17} aria-hidden="true" /></button>
        </fieldset>
        {status === 'error' && <p role="alert" className={styles.error}>{error} <a href="mailto:hello@picshaw.com">Email Picshaw</a></p>}
      </form>
    </div> : <div className={`${styles.body} ${styles.success}`}><Check size={32} aria-hidden="true" /><h3>Your request is with Picshaw.</h3><p>It has been accepted for delivery. Ash will review it and reply by email. No appointment, founding place or paid work has been confirmed.</p><button type="button" className={styles.requestButton} onClick={clear}>Back to quick answers<ArrowUpRight size={15} aria-hidden="true" /></button></div>}
  </section>
}
