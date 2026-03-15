/*
  Purchase.jsx — Record stock received from wholesaler
  
  When you receive medicines from wholesaler:
  - Select wholesaler
  - Add medicines + strips received + price paid
  - Stock automatically increases
  - Full purchase history saved
*/

import React, { useState, useEffect } from 'react'
import { useApp, useToast }            from '../App'
import { db }                           from '../firebase'
import { collection, addDoc,
         serverTimestamp, writeBatch,
         doc, onSnapshot, query,
         orderBy }                     from 'firebase/firestore'

const emptyItem = () => ({ id: Date.now() + Math.random(), productId: '', strips: 1, pricePerStrip: '' })

export default function Purchase() {
  const { products, wholesalers } = useApp()
  const showToast = useToast()

  const [wholesalerId, setWholesalerId] = useState('')
  const [invoiceNo,    setInvoiceNo]    = useState('')
  const [items,        setItems]        = useState([emptyItem()])
  const [saving,       setSaving]       = useState(false)
  const [history,      setHistory]      = useState([])

  // Load purchase history
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'purchases'), orderBy('createdAt', 'desc')),
      snap => setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })).slice(0, 20))
    )
    return () => unsub()
  }, [])

  const addItem    = ()    => setItems(i => [...i, emptyItem()])
  const removeItem = (id)  => setItems(i => i.filter(x => x.id !== id))
  const updateItem = (id, field, val) =>
    setItems(i => i.map(x => x.id === id ? {...x, [field]: val} : x))

  // Calculate total cost
  const totalCost = items.reduce((sum, item) => {
    const p = products.find(x => x.id === item.productId)
    if (!p) return sum
    const perStrip = p.perStrip || 1
    const qty      = parseFloat(item.strips || 0) * perStrip
    return sum + (qty * parseFloat(item.pricePerStrip || 0) / perStrip)
  }, 0)

  async function handleSave() {
    const validItems = items.filter(i => i.productId && parseFloat(i.strips) > 0)
    if (!wholesalerId)          { showToast('Select wholesaler', 'warning'); return }
    if (validItems.length === 0) { showToast('Add at least one item', 'warning'); return }

    setSaving(true)
    try {
      const w     = wholesalers.find(x => x.id === wholesalerId)
      const batch = writeBatch(db)

      // Build purchase items and update stock
      const purchaseItems = validItems.map(item => {
        const p        = products.find(x => x.id === item.productId)
        const perStrip = p.perStrip || 1
        const addQty   = Math.round(parseFloat(item.strips) * perStrip)

        // Increase stock
        batch.update(doc(db, 'products', p.id), {
          stock:    (p.stock || 0) + addQty,
          buyPrice: parseFloat(item.pricePerStrip) || p.buyPrice || 0
        })

        return {
          productId:     p.id,
          name:          p.name,
          strips:        parseFloat(item.strips),
          tabletsAdded:  addQty,
          pricePerStrip: parseFloat(item.pricePerStrip) || 0,
          unit:          p.unit,
        }
      })

      await batch.commit()

      // Save purchase record
      await addDoc(collection(db, 'purchases'), {
        wholesalerId,
        wholesalerName: w?.name || '',
        invoiceNo:      invoiceNo.trim(),
        items:          purchaseItems,
        totalCost:      totalCost.toFixed(2),
        date:           new Date().toISOString(),
        createdAt:      serverTimestamp(),
      })

      showToast(`✅ Stock updated! ${validItems.length} medicines received`)
      setItems([emptyItem()])
      setInvoiceNo('')
      setWholesalerId('')
    } catch (err) {
      showToast('Error: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-enter">
      <div className="bg-gradient-to-br from-indigo-900 to-indigo-600 text-white px-5 pt-12 pb-6">
        <h1 className="text-2xl font-extrabold">Purchase Entry 📦</h1>
        <p className="text-indigo-200 text-sm mt-1">Record stock received from wholesaler</p>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* Purchase form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">

          <div>
            <label className="field-label">Wholesaler *</label>
            <select value={wholesalerId} onChange={e => setWholesalerId(e.target.value)}
              className="field-input">
              <option value="">-- Select Wholesaler --</option>
              {wholesalers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          <div>
            <label className="field-label">Invoice / Bill Number (optional)</label>
            <input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)}
              placeholder="e.g. INV-2024-001" className="field-input"/>
          </div>

          {/* Items */}
          <div className="flex justify-between items-center">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Medicines Received</p>
            <button onClick={addItem}
              className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg">
              + Add
            </button>
          </div>

          <div className="space-y-3">
            {items.map(item => {
              const p = products.find(x => x.id === item.productId)
              return (
                <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                  {/* Medicine select */}
                  <select value={item.productId}
                    onChange={e => updateItem(item.id, 'productId', e.target.value)}
                    className="field-input">
                    <option value="">-- Select Medicine --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (stock: {p.stock})</option>
                    ))}
                  </select>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Strips received */}
                    <div>
                      <label className="field-label">
                        {p?.unit === 'tablet' || p?.unit === 'capsule'
                          ? 'Strips Received'
                          : 'Qty Received'}
                      </label>
                      <input type="number" value={item.strips}
                        onChange={e => updateItem(item.id, 'strips', e.target.value)}
                        placeholder="e.g. 10" min="1" className="field-input"/>
                    </div>
                    {/* Price per strip */}
                    <div>
                      <label className="field-label">Buy Price ₹ / strip</label>
                      <input type="number" value={item.pricePerStrip}
                        onChange={e => updateItem(item.id, 'pricePerStrip', e.target.value)}
                        placeholder="e.g. 25" className="field-input"/>
                    </div>
                  </div>

                  {/* Preview */}
                  {p && item.strips > 0 && (
                    <p className="text-xs text-indigo-600 font-medium bg-indigo-50 p-2 rounded-lg">
                      Adding {Math.round(parseFloat(item.strips) * (p.perStrip || 1))} {p.unit}s
                      to stock (current: {p.stock})
                    </p>
                  )}

                  {items.length > 1 && (
                    <button onClick={() => removeItem(item.id)}
                      className="text-xs text-red-500 font-bold">
                      ✕ Remove
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Total */}
          <div className="bg-slate-50 rounded-xl p-3 flex justify-between items-center">
            <span className="font-bold text-slate-700">Total Cost</span>
            <span className="text-xl font-extrabold text-indigo-600">₹{totalCost.toFixed(0)}</span>
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl
                       disabled:opacity-50 active:scale-[0.98] transition-all
                       shadow-lg shadow-indigo-200">
            {saving ? '⏳ Saving...' : '💾 Save Purchase & Update Stock'}
          </button>
        </div>

        {/* Purchase history */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="font-bold text-sm text-slate-800">Recent Purchases</p>
          </div>
          {history.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p className="text-sm">No purchases recorded yet</p>
            </div>
          ) : history.map(h => {
            const date = h.createdAt?.toDate?.() || new Date(h.date)
            return (
              <div key={h.id} className="px-4 py-3 border-b border-slate-50 last:border-0">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-sm text-slate-800">{h.wholesalerName}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {(h.items||[]).map(i => `${i.name} ×${i.strips}strips`).join(', ')}
                    </p>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {date.toLocaleDateString('en-IN')}
                      {h.invoiceNo && ` · ${h.invoiceNo}`}
                    </p>
                  </div>
                  <p className="font-bold text-indigo-600">₹{parseFloat(h.totalCost).toFixed(0)}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <style>{`
        .field-label { display:block; font-size:0.72rem; font-weight:700; color:#64748b; margin-bottom:4px; }
        .field-input { width:100%; padding:10px 12px; border:1.5px solid #e2e8f0; border-radius:10px; font-size:0.875rem; outline:none; transition:border-color 0.2s; }
        .field-input:focus { border-color:#6366f1; box-shadow:0 0 0 3px #e0e7ff; }
      `}</style>
    </div>
  )
}
