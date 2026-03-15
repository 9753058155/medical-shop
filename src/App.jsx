import React, { useState, useEffect, useRef, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { listenProducts, listenWholesalers, listenTodaySales,
         listenUdhaar, listenAllSales, onAuthChange, signOut } from './firebase'
import { LanguageContext, translations } from './i18n'

import PinLogin    from './components/PinLogin'
import Dashboard   from './pages/Dashboard'
import Products    from './pages/Products'
import Sell        from './pages/Sell'
import Wholesalers from './pages/Wholesalers'
import Reports     from './pages/Reports'
import Udhaar      from './pages/Udhaar'
import Reorder     from './pages/Reorder'
import Purchase    from './pages/Purchase'
import Returns     from './pages/Returns'
import Profit          from './pages/Profit'
import WholesalerBill  from './pages/WholesalerBill'

export const AppContext  = createContext(null)
export const useApp     = () => useContext(AppContext)
export const ToastContext = createContext(null)
export const useToast   = () => useContext(ToastContext)

const INACTIVITY_LIMIT = 8 * 60 * 60 * 1000
const STORAGE_KEY      = 'ms_last_active'

function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-blue-900 to-blue-700 flex flex-col items-center justify-center gap-4">
      <div className="text-6xl animate-bounce">💊</div>
      <div className="flex gap-1.5">
        {[0,150,300].map(d => (
          <div key={d} className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{animationDelay:`${d}ms`}} />
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
  const [lang,        setLang]        = useState(() => localStorage.getItem('ms_lang') || 'en')
  const inactivityTimer = useRef(null)

  const t = (key) => translations[lang]?.[key] || translations['en']?.[key] || key
  function changeLang(l) { setLang(l); localStorage.setItem('ms_lang', l) }

  useEffect(() => {
    const unsub = onAuthChange(async user => {
      if (user) {
        const lastActive = parseInt(localStorage.getItem(STORAGE_KEY) || '0')
        if (lastActive && Date.now() - lastActive > INACTIVITY_LIMIT) {
          // Session expired — sign out and show PIN
          await signOut()
          localStorage.removeItem(STORAGE_KEY)
          setAuthed(false)
        } else {
          // Valid session — show app
          setAuthed(true)
          resetInactivityTimer()
        }
      } else {
        // No user and no valid session — show PIN
        setAuthed(false)
      }
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

  // NOTE: We removed the visibilitychange sign-out because it was causing
  // permission errors — when users switched tabs to check invoice numbers etc,
  // the app signed them out, then Firebase rejected writes.
  // Auto-logout is still handled by the 8-hour inactivity timer.

  function resetInactivityTimer() {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    inactivityTimer.current = setTimeout(async () => {
      await signOut(); localStorage.removeItem(STORAGE_KEY)
      setAuthed(false); showToast('Auto logged out after 8 hours', 'warning')
    }, INACTIVITY_LIMIT)
  }

  useEffect(() => {
    if (!authed) return
    const loadingTimeout = setTimeout(() => setLoading(false), 5000)
    const u1 = listenProducts(data => { setProducts(data); setLoading(false); clearTimeout(loadingTimeout) })
    const u2 = listenWholesalers(data => setWholesalers(data))
    const u3 = listenTodaySales(data  => setTodaySales(data))
    const u4 = listenUdhaar(data      => setUdhaarList(data))
    const u5 = listenAllSales(data    => setAllSales(data))
    return () => { clearTimeout(loadingTimeout); u1(); u2(); u3(); u4(); u5() }
  }, [authed])

  const showToast = (msg, type='success') => {
    setToast({ show:true, msg, type })
    setTimeout(() => setToast(t => ({...t, show:false})), 3000)
  }

  function handlePinSuccess() {
    // Save timestamp FIRST — before anything else
    // This ensures onAuthChange sees a valid session if it fires during transition
    localStorage.setItem(STORAGE_KEY, Date.now().toString())
    setCovering(true)
    setAuthed(true)
    setTimeout(() => setCovering(false), 800)
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
                    <Route path="/reports"        element={<Reports />} />
                    <Route path="/wholesaler-bill" element={<WholesalerBill />} />
                  </Routes>
                )}
              </main>
              {!loading && <BottomNav setAuthed={setAuthed} lang={lang} changeLang={changeLang} />}
              {toast.show && (
                <div
                  className={`fixed z-50 px-5 py-3 rounded-2xl shadow-xl text-white text-sm font-semibold whitespace-nowrap pointer-events-none toast-show`}
                  style={{ bottom:90, left:'50%', transform:'translateX(-50%)',
                    background: toast.type==='success'?'#0f172a': toast.type==='error'?'#dc2626':'#d97706' }}
                >
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

function BottomNav({ setAuthed, lang, changeLang }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const mainTabs = [
    { to:'/',                icon:'📊', label:'Home'    },
    { to:'/products',        icon:'📦', label:'Stock'   },
    { to:'/sell',            icon:'🛒', label:'Sell',   special:true },
    { to:'/wholesaler-bill', icon:'📋', label:'Bill'    },
  ]

  const menuItems = [
    { to:'/reorder',     icon:'📋', label:'Reorder List',    desc:'What to order'          },
    { to:'/purchase',    icon:'📦', label:'Purchase Entry',  desc:'Record stock received'  },
    { to:'/returns',     icon:'🔄', label:'Returns/Refund',  desc:'Customer returned med'  },
    { to:'/profit',      icon:'💰', label:'Profit Report',   desc:'Margin per medicine'    },
    { to:'/reports',     icon:'📈', label:'Sales Reports',   desc:'Daily/monthly summary'  },
    { to:'/wholesaler-bill', icon:'📋', label:'Wholesaler Bill', desc:'Enter bill, auto-add stock' },
    { to:'/wholesalers', icon:'🏪', label:'Wholesalers',         desc:'Manage wholesalers'         },
  ]

  async function handleLogout() {
    setMenuOpen(false)
    await signOut()
    localStorage.removeItem(STORAGE_KEY)
    setAuthed(false)
  }

  return (
    <>
      {/* Dark overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          style={{ backdropFilter:'blur(2px)' }}
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Slide-up menu sheet */}
      <div
        className="fixed left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl"
        style={{
          bottom: 64,
          maxWidth: 672,
          margin: '0 auto',
          maxHeight: '75vh',
          overflowY: 'auto',
          transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
          transform: menuOpen ? 'translateY(0)' : 'translateY(110%)',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        <div className="px-4 pb-6">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
            More Features / अधिक सुविधाएं
          </p>

          {/* Menu grid */}
          <div className="grid grid-cols-2 gap-2">
            {menuItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 p-3 rounded-2xl border transition-all
                  ${isActive ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 hover:bg-slate-100 border-transparent'}`
                }
              >
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
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all
                  ${lang==='en' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
              >
                🇬🇧 English
              </button>
              <button
                onClick={() => changeLang('hi')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all
                  ${lang==='hi' ? 'bg-orange-500 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
              >
                🇮🇳 हिंदी
              </button>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full mt-3 py-3 bg-red-50 text-red-600 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
          >
            🔒 Lock App / Logout
          </button>
        </div>
      </div>

      {/* Bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 flex items-end"
        style={{
          maxWidth: 672,
          margin: '0 auto',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {mainTabs.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to==='/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-end pb-2 pt-1 text-[0.6rem] font-semibold transition-colors
              ${isActive ? 'text-blue-600' : 'text-slate-400'}`
            }
          >
            {tab.special ? (
              <>
                <span className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 text-white text-xl shadow-lg -mt-5 active:scale-95 transition-transform">
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

        {/* ☰ More button */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          className={`flex-1 flex flex-col items-center justify-end pb-2 pt-1 text-[0.6rem] font-semibold transition-colors border-none bg-transparent
            ${menuOpen ? 'text-blue-600' : 'text-slate-400'}`}
        >
          <span className="text-2xl mb-0.5 transition-transform" style={{ display:'block', transform: menuOpen ? 'rotate(90deg)' : 'none' }}>
            {menuOpen ? '✕' : '☰'}
          </span>
          <span>More</span>
        </button>
      </nav>
    </>
  )
}
