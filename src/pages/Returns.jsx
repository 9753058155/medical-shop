/*
  Returns.jsx — Customer return / refund tracking
  
  Customer returns medicine:
  - Select original sale (or enter manually)
  - Select which items returned + qty
  - Stock automatically restored
  - Refund amount calculated
  - Return recorded in history
*/

import React, { useState, useEffect } from 'react'
import { useApp, useToast }            from '../App'
import { db }                          from '../firebase'
import { collection, addDoc,
         serverTimestamp, writeBatch,
         doc, getDoc, onSnapshot,
         query, orderBy }              from 'firebase/firestore'

export default function Returns() {
  const { products, todaySales } = useApp()
  const showToast = useToast()

  const [mode,         setMode]         = useState('sale')    // 'sale' | 'manual'
  const [selectedSale, setSelectedSale] = useState(null)
  const [returnItems,  setReturnItems]  = useState([])
  const [customer,     setCustomer]     = useState('')
  const [notes,        setNotes]        = useState('')
  const [saving,       setSaving]       = useState(false)
  const [history,      setHistory]      = useState([])

  // Load return history
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'returns'), orderBy('createdAt', 'desc')),
      snap => setHistory(snap.docs.map(d => ({ id:d.id, ...d.data() })).slice(0, 20))
    )
    return () => unsub()
  }, [])

  // When a sale is selected, pre-fill return items
  function selectSale(sale) {
    setSelectedSale(sale)
    setCustomer(sale.customer || '')
    setReturnItems(sale.items.map(item => ({
      ...item,
      returnQty: 0,    // how many they're returning
      maxQty: item.qty // can't return more than was sold
    })))
  }

  // Calculate refund total
  const refundTotal = returnItems.reduce((sum, item) => {
    const qty = parseFloat(item.returnQty || 0)
    return sum + (qty * (item.price || 0))
  }, 0)

  async function handleReturn() {
    const validItems = returnItems.filter(i => parseFloat(i.returnQty) > 0)
    if (validItems.length === 0) { showToast('Enter return quantity', 'warning'); return }

    // Validate qty
    for (const item of validItems) {
      if (parseFloat(item.returnQty) > item.maxQty) {
        showToast(`Can't return more than ${item.maxQty} for ${item.name}`, 'error')
        return
      }
    }

    setSaving(true)
    try {
      const batch = writeBatch(db)

      // Restore stock for returned items
      for (const item of validItems) {
        const pRef  = doc(db, 'products', item.productId)
        const pSnap = await getDoc(pRef)
        if (pSnap.exists()) {
          batch.update(pRef, { stock: pSnap.data().stock + parseFloat(item.returnQty) })
        }
      }
      await batch.commit()

      // Save return record
      await addDoc(collection(db, 'returns'), {
        saleId:       selectedSale?.id || '',
        customer:     customer.trim() || 'Customer',
        items:        validItems.map(i => ({
          productId: i.productId,
          name:      i.name,
          returnQty: parseFloat(i.returnQty),
          price:     i.price,
          refund:    parseFloat(i.returnQty) * i.price
        })),
        refundTotal:  refundTotal.toFixed(2),
        notes:        notes.trim(),
        date:         new Date().toISOString(),
        createdAt:    serverTimestamp(),
      })

      showToast(`✅ Return recorded! Refund: ₹${refundTotal.toFixed(0)}`)
      setSelectedSale(null)
      setReturnItems([])
      setCustomer('')
      setNotes('')
    } catch (err) {
      showToast('Error: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-enter">
      <div className="bg-gradient-to-br from-rose-900 to-rose-600 text-white px-5 pt-12 pb-6">
        <h1 className="text-2xl font-extrabold">Returns / Refunds 🔄</h1>
        <p className="text-rose-200 text-sm mt-1">Customer returned medicine</p>
      </div>

      <div className="px-4 pt-4 space-y-4">

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">

          {/* Customer name */}
          <div>
            <label className="field-label">Customer Name</label>
            <input value={customer} onChange={e => setCustomer(e.target.value)}
              placeholder="e.g. Ramesh ji" className="field-input"/>
          </div>

          {/* Select from today's sales */}
          <div>
            <label className="field-label">Select from Today's Sales (optional)</label>
            <select onChange={e => {
              const sale = todaySales.find(s => s.id === e.target.value)
              if (sale) selectSale(sale)
              else { setSelectedSale(null); setReturnItems([]) }
            }} className="field-input">
              <option value="">-- Pick a sale to return from --</option>
              {todaySales.map(s => (
                <option key={s.id} value={s.id}>
                  {s.customer} — ₹{s.total} — {(s.items||[]).map(i=>i.name).join(', ')}
                </option>
              ))}
            </select>
          </div>

          {/* Return items */}
          {returnItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Items to Return
              </p>
              {returnItems.map((item, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-sm text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-400">
                        Sold: {item.maxQty} · ₹{item.price}/unit
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-500">Return qty:</label>
                      <input
                        type="number"
                        value={item.returnQty}
                        onChange={e => setReturnItems(prev =>
                          prev.map((x,i) => i===idx ? {...x, returnQty: e.target.value} : x)
                        )}
                        min="0" max={item.maxQty}
                        className="w-16 text-center border border-slate-200 rounded-lg
                                   py-1.5 px-2 text-sm outline-none focus:border-rose-400"
                      />
                    </div>
                  </div>
                  {parseFloat(item.returnQty) > 0 && (
                    <p className="text-xs text-rose-600 font-medium mt-1">
                      Refund: ₹{(parseFloat(item.returnQty) * item.price).toFixed(0)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Manual return if no sale selected */}
          {returnItems.length === 0 && (
            <div className="bg-slate-50 rounded-xl p-4 text-center text-slate-400">
              <p className="text-sm">Select a sale above to return items from it</p>
              <p className="text-xs mt-1">or stock will be added back manually below</p>
            </div>
          )}

          <div>
            <label className="field-label">Notes / कारण</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Wrong medicine, expired..." className="field-input"/>
          </div>

          {refundTotal > 0 && (
            <div className="bg-rose-50 rounded-xl p-3 flex justify-between items-center">
              <span className="font-bold text-rose-700">Total Refund</span>
              <span className="text-xl font-extrabold text-rose-600">₹{refundTotal.toFixed(0)}</span>
            </div>
          )}

          <button onClick={handleReturn} disabled={saving || returnItems.length === 0}
            className="w-full bg-rose-500 text-white font-bold py-3.5 rounded-xl
                       disabled:opacity-50 active:scale-[0.98] transition-all
                       shadow-lg shadow-rose-200">
            {saving ? '⏳ Processing...' : '🔄 Record Return & Restore Stock'}
          </button>
        </div>

        {/* Return history */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="font-bold text-sm text-slate-800">Return History</p>
          </div>
          {history.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p className="text-sm">No returns recorded yet</p>
            </div>
          ) : history.map(r => {
            const date = r.createdAt?.toDate?.() || new Date(r.date)
            return (
              <div key={r.id} className="px-4 py-3 border-b border-slate-50 last:border-0">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-sm text-slate-800">{r.customer}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {(r.items||[]).map(i => `${i.name} ×${i.returnQty}`).join(', ')}
                    </p>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {date.toLocaleDateString('en-IN')}
                      {r.notes && ` · ${r.notes}`}
                    </p>
                  </div>
                  <p className="font-bold text-rose-600">₹{parseFloat(r.refundTotal).toFixed(0)}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <style>{`
        .field-label { display:block; font-size:0.72rem; font-weight:700; color:#64748b; margin-bottom:4px; }
        .field-input { width:100%; padding:10px 12px; border:1.5px solid #e2e8f0; border-radius:10px; font-size:0.875rem; outline:none; }
        .field-input:focus { border-color:#f43f5e; box-shadow:0 0 0 3px #ffe4e6; }
      `}</style>
    </div>
  )
}
