import { createContext, useContext, useState } from 'react'

const DirectionContext = createContext({ lang: 'en', dir: 'ltr', toggleLanguage: () => {} })

export function DirectionProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      return (
        localStorage.getItem('app-language') ||
        (navigator.language?.startsWith('he') ? 'he' : 'en')
      )
    } catch {
      return 'en'
    }
  })

  const dir = lang === 'he' ? 'rtl' : 'ltr'

  function toggleLanguage() {
    const next = lang === 'he' ? 'en' : 'he'
    try { localStorage.setItem('app-language', next) } catch {}
    setLang(next)
  }

  return (
    <DirectionContext.Provider value={{ lang, dir, toggleLanguage }}>
      {children}
    </DirectionContext.Provider>
  )
}

export function useDirection() {
  return useContext(DirectionContext)
}
