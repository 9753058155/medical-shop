import React, { useState } from 'react'
import { signInToShop, SHOP_PIN } from '../firebase'

export default function PinLogin({ onSuccess }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function tryLogin(enteredPin) {
    if (enteredPin !== SHOP_PIN) { setError('Wrong PIN! Try again.'); setPin(''); return }
    setLoading(true); setError('')
    try {
      await signInToShop()
      localStorage.setItem('ms_last_active', Date.now().toString())
      onSuccess()
    } catch (err) { setError('Login failed: ' + err.message); setPin('') }
    finally { setLoading(false) }
  }

  function pressKey(key) {
    if (loading) return
    if (key === 'del') { setPin(p => p.slice(0,-1)); setError(''); return }
    if (pin.length >= 4) return
    const newPin = pin + key
    setPin(newPin); setError('')
    if (newPin.length === 4) setTimeout(() => tryLogin(newPin), 150)
  }

  const keys = ['1','2','3','4','5','6','7','8','9','','0','del']

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex flex-col items-center justify-center px-6">
      <div className="text-6xl mb-4">💊</div>
      <h1 className="text-white text-2xl font-extrabold mb-1">MedShop Manager</h1>
      <p className="text-blue-200 text-sm mb-10">मेडिकल शॉप मैनेजर</p>
      <div className="bg-white/10 backdrop-blur rounded-3xl p-8 w-full max-w-xs">
        <p className="text-white/70 text-center text-sm font-semibold mb-6 uppercase tracking-widest">Enter Shop PIN</p>
        <div className="flex justify-center gap-4 mb-6">
          {[0,1,2,3].map(i => (
            <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${i < pin.length ? 'bg-white border-white scale-110' : 'bg-transparent border-white/40'}`} />
          ))}
        </div>
        {error && <p className="text-red-300 text-center text-sm font-semibold mb-4 bg-red-500/10 py-2 px-3 rounded-xl">{error}</p>}
        {loading && <p className="text-white/70 text-center text-sm mb-4 animate-pulse">Logging in...</p>}
        <div className="grid grid-cols-3 gap-3">
          {keys.map((key, i) => key === '' ? <div key={i} /> : (
            <button key={i} type="button" onClick={() => pressKey(key)} disabled={loading}
              className={`h-14 rounded-2xl font-bold text-lg transition-all active:scale-95 disabled:opacity-50 select-none ${key === 'del' ? 'bg-white/10 text-white/70' : 'bg-white/20 text-white hover:bg-white/30'}`}>
              {key === 'del' ? '⌫' : key}
            </button>
          ))}
        </div>
      </div>
      <p className="text-blue-300/50 text-xs mt-8 text-center">Ask your shop owner for the PIN</p>
    </div>
  )
}
