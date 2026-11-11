'use client'
import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor } from 'lucide-react'
const subscribe = () => () => {}
export function ThemeToggle() {
 const mounted = useSyncExternalStore(subscribe, () => true, () => false)
 const { theme, setTheme } = useTheme()
 return <div className="portal-theme" role="group" aria-label="Color theme">{([{value:'light',label:'Light theme',Icon:Sun},{value:'dark',label:'Dark theme',Icon:Moon},{value:'system',label:'Use system theme',Icon:Monitor}] as const).map(({value,label,Icon})=><button key={value} type="button" title={label} aria-label={label} aria-pressed={mounted && theme===value} disabled={!mounted} onClick={()=>setTheme(value)}><Icon size={16} aria-hidden="true"/></button>)}</div>
}
