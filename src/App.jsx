/*
  App.jsx — Root component
  
  NAV UPDATE:
  - Bottom nav: Home, Products, Sell, Udhaar, ☰ Menu
  - Hamburger menu slides up with: Reorder, Purchase, Returns, Profit, Reports, Wholesalers, Logout
*/

import React, { useState, useEffect, useRef, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { listenProducts, listenWholesalers, listenTodaySales,
         listenUdhaar, listenAllSales, onAuthChange, signOut } from './firebase'

import PinLogin    from './components/PinLogin'
import { LanguageContext, translations } from './i18n'
import Dashboard   from './pages/Dashboard'
import Products    from './pages/Products'
import Sell        from './pages/Sell'
import Wholesalers from './pages/Wholesalers'
import Reports     from './pages/Reports'
import Udhaar      from './pages/Udhaar'
import Reorder     from './pages/Reorder'
import Purchase    from './pages/Purchase'
import Returns     from './pages/Returns'
import Profit      from './pages/Profit'

export const AppContext   = createContext(null)
export const useApp       = () => useContext(AppContext)
export const ToastContext  = createContext(null)
export const useToast     = () => useContext(ToastContext)

const INACTIVITY_LIMIT = 8 * 60 * 60 * 1000
const STORAGE_KEY      = 'ms_last_active'

function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-blue-900 to-blue-700
                    flex flex-col items-center justify-center gap-4">
      <div className="text-6xl animate-bounce">💊</div>
      <div className="flex gap-1.5">
        {[0,150,300].map(d => (
          <div key={d} className="w-2 h-2 bg-white/60 rounded-full animate-bounce"
               style={{animationDelay:`${d}ms`}}/>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const [authed,      setAuthed]      = useState(null)
  const [covering,    setCovering]    = useState(false)
  const [products,    setProducts]    = useState([])
  const [wholesalers, setWholesalers] = useState([])
  const [todaySales,  setTodaySales]  = useState([])
  const [udhaarList,  setUdhaarList]  = useState([])
  const [allSales,    setAllSales]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [toast,       setToast]       = useState({ show:false, msg:'', type:'success' })
  const [lang, setLang] = useState(() => localStorage.getItem('ms_lang') || 'en')
  const inactivityTimer = useRef(null)

  // t() — translate a key to current language
  const t = (key) => translations[lang]?.[key] || translations['en']?.[key] || key

  // Change language and save
  function changeLang(l) {
    setLang(l)
    localStorage.setItem('ms_lang', l)
  }

  useEffect(() => {
    const unsub = onAuthChange(async user => {
      if (user) {
        const lastActive = parseInt(localStorage.getItem(STORAGE_KEY) || '0')
        if (Date.now() - lastActive > INACTIVITY_LIMIT) {
          await signOut(); localStorage.removeItem(STORAGE_KEY); setAuthed(false)
        } else { setAuthed(true); resetInactivityTimer() }
      } else { setAuthed(false) }
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!authed) return
    const events = ['mousedown','mousemove','keypress','touchstart','scroll','click']
    const handle = () => { localStorage.setItem(STORAGE_KEY, Date.now().toString()); resetInactivityTimer() }
    events.forEach(e => window.addEventListener(e, handle, { passive:true }))
    return () => events.forEach(e => window.removeEventListener(e, handle))
  }, [authed])

  // Sign out when app is closed or hidden
  useEffect(() => {
    const onHide = async () => {
      if (document.visibilityState === 'hidden') {
        await signOut(); localStorage.removeItem(STORAGE_KEY)
      }
    }
    const onUnload = async () => { await signOut(); localStorage.removeItem(STORAGE_KEY) }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [])

  function resetInactivityTimer() {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    inactivityTimer.current = setTimeout(async () => {
      await signOut(); localStorage.removeItem(STORAGE_KEY)
      setAuthed(false); showToast('Auto logged out after 8 hours', 'warning')
    }, INACTIVITY_LIMIT)
  }

  useEffect(() => {
    if (!authed) return
    const u1 = listenProducts(data    => { setProducts(data); setLoading(false) })
    const u2 = listenWholesalers(data => setWholesalers(data))
    const u3 = listenTodaySales(data  => setTodaySales(data))
    const u4 = listenUdhaar(data      => setUdhaarList(data))
    const u5 = listenAllSales(data => setAllSales(data))
    return () => { u1(); u2(); u3(); u4(); u5() }
  }, [authed])

  const showToast = (msg, type='success') => {
    setToast({ show:true, msg, type })
    setTimeout(() => setToast(t => ({...t, show:false})), 3000)
  }

  function handlePinSuccess() {
    setCovering(true)
    localStorage.setItem(STORAGE_KEY, Date.now().toString())
    setTimeout(() => { setAuthed(true); setTimeout(() => setCovering(false), 600) }, 100)
  }

  if (covering || authed === null) return <SplashScreen />
  if (!authed) return <PinLogin onSuccess={handlePinSuccess} />

  return (
    <LanguageContext.Provider value={{ lang, t, changeLang }}>
    <AppContext.Provider value={{ products, wholesalers, todaySales, udhaarList, allSales, loading }}>
      <ToastContext.Provider value={showToast}>
        <BrowserRouter future={{ v7_startTransition:true, v7_relativeSplatPath:true }}>
          <div className="min-h-screen bg-slate-50 max-w-2xl mx-auto relative">
            <main className="pb-20">
              {loading ? (
                <div className="flex flex-col items-center justify-center min-h-screen gap-3">
                  <div className="text-5xl animate-bounce">💊</div>
                  <p className="text-slate-500 font-medium">Loading shop data...</p>
                </div>
              ) : (
                <Routes>
                  <Route path="/"            element={<Dashboard />} />
                  <Route path="/products"    element={<Products />} />
                  <Route path="/sell"        element={<Sell />} />
                  <Route path="/wholesalers" element={<Wholesalers />} />
                  <Route path="/udhaar"      element={<Udhaar />} />
                  <Route path="/reorder"     element={<Reorder />} />
                  <Route path="/purchase"    element={<Purchase />} />
                  <Route path="/returns"     element={<Returns />} />
                  <Route path="/profit"      element={<Profit />} />
                  <Route path="/reports"     element={<Reports />} />
                </Routes>
              )}
            </main>
            {!loading && <BottomNav showToast={showToast} setAuthed={setAuthed} lang={lang} changeLang={changeLang} />}
            {toast.show && (
              <div className={`fixed bottom-24 left-1/2 z-50 toast-show px-5 py-3
                rounded-2xl shadow-xl text-white text-sm font-semibold whitespace-nowrap pointer-events-none
                ${toast.type==='success'?'bg-slate-900':toast.type==='error'?'bg-red-600':'bg-amber-600'}`}>
                {toast.msg}
              </div>
            )}
          </div>
        </BrowserRouter>
      </ToastContext.Provider>
    </AppContext.Provider>
    </LanguageContext.Provider>
  )
}

// ── Bottom Navigation with Hamburger Menu ──
function BottomNav({ showToast, setAuthed, lang, changeLang }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const mainTabs = [
    { to:'/',         icon:'📊', label:'Home'    },
    { to:'/products', icon:'📦', label:'Products'},
    { to:'/sell',     icon:'🛒', label:'Sell',   special:true },
    { to:'/udhaar',   icon:'💸', label:'Udhaar' },
  ]

  // Menu items inside hamburger
  const menuItems = [
    { to:'/reorder',     icon:'📋', label:'Reorder List',      desc:'What to order from wholesaler' },
    { to:'/purchase',    icon:'📦', label:'Purchase Entry',     desc:'Record stock received'         },
    { to:'/returns',     icon:'🔄', label:'Returns / Refund',   desc:'Customer returned medicine'    },
    { to:'/profit',      icon:'💰', label:'Profit Report',      desc:'Margin per medicine'           },
    { to:'/reports',     icon:'📈', label:'Sales Reports',      desc:'Daily / monthly summary'       },
    { to:'/wholesalers', icon:'🏪', label:'Wholesalers',        desc:'Manage wholesalers & payments' },
  ]

  async function handleLogout() {
    setMenuOpen(false)
    await signOut()
    localStorage.removeItem('ms_last_active')
    setAuthed(false)
  }

  return (
    <>
      {/* ── Dark overlay when menu open ── */}
      {menuOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
             onClick={() => setMenuOpen(false)}/>
      )}

      {/* ── Hamburger slide-up menu ── */}
      <div className={`fixed left-1/2 -translate-x-1/2 w-full max-w-2xl
                       bg-white rounded-t-3xl z-50 shadow-2xl
                       transition-transform duration-300 ease-out
                       ${menuOpen ? 'translate-y-0' : 'translate-y-full'}`}
           style={{ bottom: 64 }}>

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-200 rounded-full"/>
        </div>

        <div className="px-4 pb-6 pt-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">
            More Features
          </p>

          <div className="grid grid-cols-2 gap-2">
            {menuItems.map(item => (
              <NavLink key={item.to} to={item.to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) => `
                  flex items-center gap-3 p-3 rounded-2xl transition-all
                  ${isActive
                    ? 'bg-blue-50 border border-blue-200'
                    : 'bg-slate-50 hover:bg-slate-100 border border-transparent'}
                `}>
                <span className="text-2xl flex-shrink-0">{item.icon}</span>
                <div className="min-w-0">
                  <p className="font-bold text-sm text-slate-800 leading-tight">{item.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-tight truncate">{item.desc}</p>
                </div>
              </NavLink>
            ))}
          </div>

          {/* Language picker */}
          <div className="mt-3 bg-slate-50 rounded-2xl p-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
              Language / भाषा
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => changeLang('en')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2
                  ${lang === 'en'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                    : 'bg-white text-slate-500 border border-slate-200'}`}>
                🇬🇧 English
              </button>
              <button
                onClick={() => changeLang('hi')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2
                  ${lang === 'hi'
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-200'
                    : 'bg-white text-slate-500 border border-slate-200'}`}>
                🇮🇳 हिंदी
              </button>
            </div>
          </div>

          {/* Logout button */}
          <button onClick={handleLogout}
            className="w-full mt-3 py-3 bg-red-50 hover:bg-red-100
                       text-red-600 rounded-2xl text-sm font-bold
                       flex items-center justify-center gap-2 transition-colors">
            🔒 Lock App / Logout
          </button>
        </div>
      </div>

      {/* ── Bottom tab bar ── */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl
                      bg-white border-t border-slate-200 z-40 flex items-end
                      shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
           style={{ paddingBottom:'env(safe-area-inset-bottom)' }}>

        {mainTabs.map(tab => (
          <NavLink key={tab.to} to={tab.to} end={tab.to==='/'}
            className={({ isActive }) => `
              flex-1 flex flex-col items-center justify-end pb-2 pt-1
              text-[0.6rem] font-semibold transition-colors cursor-pointer
              ${isActive ? 'text-blue-600' : 'text-slate-400'}
            `}>
            {tab.special ? (
              <>
                <span className="flex items-center justify-center w-12 h-12
                                 rounded-full bg-blue-600 text-white text-xl
                                 shadow-lg shadow-blue-200 -mt-5 active:scale-95 transition-transform">
                  {tab.icon}
                </span>
                <span className="mt-1">{tab.label}</span>
              </>
            ) : (
              <>
                <span className="text-2xl mb-0.5">{tab.icon}</span>
                <span>{tab.label}</span>
              </>
            )}
          </NavLink>
        ))}

        {/* Hamburger menu button */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          className={`flex-1 flex flex-col items-center justify-end pb-2 pt-1
                      text-[0.6rem] font-semibold transition-colors
                      ${menuOpen ? 'text-blue-600' : 'text-slate-400'}`}>
          <span className="text-2xl mb-0.5">{menuOpen ? '✕' : '☰'}</span>
          <span>More</span>
        </button>
      </nav>
    </>
  )
}
