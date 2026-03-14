import React, { useState, useEffect, useRef, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { listenProducts, listenWholesalers, listenTodaySales, listenUdhaar,
         listenUdhaar, onAuthChange, signOut } from './firebase'

import PinLogin    from './components/PinLogin'
import Dashboard   from './pages/Dashboard'
import Products    from './pages/Products'
import Sell        from './pages/Sell'
import Wholesalers from './pages/Wholesalers'
import Reports     from './pages/Reports'
import Udhaar      from './pages/Udhaar'

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
  const [udhaarList,  setUdhaarList]  = useState([])  // ← shared udhaar data
  const [loading,     setLoading]     = useState(true)
  const [toast,       setToast]       = useState({ show:false, msg:'', type:'success' })
  const inactivityTimer = useRef(null)

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
    const handle = () => {
      localStorage.setItem(STORAGE_KEY, Date.now().toString())
      resetInactivityTimer()
    }
    events.forEach(e => window.addEventListener(e, handle, { passive:true }))
    return () => events.forEach(e => window.removeEventListener(e, handle))
  }, [authed])

  function resetInactivityTimer() {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    inactivityTimer.current = setTimeout(async () => {
      await signOut(); localStorage.removeItem(STORAGE_KEY); setAuthed(false)
      showToast('Auto logged out after 8 hours', 'warning')
    }, INACTIVITY_LIMIT)
  }

  useEffect(() => {
    if (!authed) return
    const u1 = listenProducts(data => { setProducts(data); setLoading(false) })
    const u2 = listenWholesalers(data => setWholesalers(data))
    const u3 = listenTodaySales(data => setTodaySales(data))
    const u4 = listenUdhaar(data => setUdhaarList(data))  // ← listen to udhaar
    return () => { u1(); u2(); u3(); u4() }
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
    // Pass udhaarList in context so Dashboard and other pages can use it
    <AppContext.Provider value={{ products, wholesalers, todaySales, udhaarList, loading }}>
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
                  <Route path="/reports"     element={<Reports />} />
                </Routes>
              )}
            </main>

            {!loading && <BottomNav />}

            {toast.show && (
              <div className={`
                fixed bottom-24 left-1/2 z-50 toast-show
                px-5 py-3 rounded-2xl shadow-xl text-white text-sm font-semibold
                whitespace-nowrap pointer-events-none
                ${toast.type==='success' ? 'bg-slate-900'
                : toast.type==='error'   ? 'bg-red-600' : 'bg-amber-600'}`}>
                {toast.msg}
              </div>
            )}
          </div>
        </BrowserRouter>
      </ToastContext.Provider>
    </AppContext.Provider>
  )
}

function BottomNav() {
  const tabs = [
    { to:'/',            icon:'📊', label:'Home'     },
    { to:'/products',    icon:'📦', label:'Products' },
    { to:'/sell',        icon:'🛒', label:'Sell',    special:true },
    { to:'/udhaar',      icon:'💸', label:'Udhaar'  },
    { to:'/reports',     icon:'📈', label:'Reports' },
  ]
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl
                    bg-white border-t border-slate-200 z-40 flex items-end
                    shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
         style={{ paddingBottom:'env(safe-area-inset-bottom)' }}>
      {tabs.map(tab => (
        <NavLink key={tab.to} to={tab.to} end={tab.to==='/'}
          className={({ isActive }) => `
            flex-1 flex flex-col items-center justify-end pb-2 pt-1
            text-[0.6rem] font-semibold transition-colors cursor-pointer
            ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
          {tab.special ? (
            <>
              <span className="flex items-center justify-center w-12 h-12 rounded-full
                               bg-blue-600 text-white text-xl shadow-lg shadow-blue-200
                               -mt-5 active:scale-95 transition-transform">
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
    </nav>
  )
}
