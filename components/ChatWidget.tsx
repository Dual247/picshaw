'use client'

import dynamic from 'next/dynamic'
import { useRef, useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import styles from './ChatWidget.module.css'

// The answer library and form load only when a visitor opens the widget.
const ChatPanel = dynamic(() => import('./ChatPanel'), { ssr: false, loading: () => <p className={styles.loading} role="status">Opening Picshaw chat…</p> })
export function ChatWidget() {
  const [opened, setOpened] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const launcher = useRef<HTMLButtonElement>(null)
  function close() { setOpened(false); requestAnimationFrame(() => launcher.current?.focus()) }
  return <div className={styles.chatRoot} data-picshaw-chat>
    {loaded && <div hidden={!opened} className={styles.panelWrap}><ChatPanel open={opened} onClose={close} /></div>}
    <button ref={launcher} type="button" className={styles.launcher} aria-label={opened ? 'Close Picshaw chat' : 'Ask Picshaw a question'} aria-expanded={opened} aria-controls={loaded ? 'picshaw-chat-dialog' : undefined} onClick={() => { if (opened) close(); else { setLoaded(true); setOpened(true) } }}>
      {opened ? <X size={22} aria-hidden="true" /> : <><MessageCircle size={23} aria-hidden="true" /><span>Ask Picshaw</span></>}
    </button>
  </div>
}
