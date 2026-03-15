/*
  WholesalerBill.jsx — Complete wholesaler bill entry
  
  FEATURES:
  - Enter bill: wholesaler, invoice no, date, total
  - Add each medicine with: name, qty (strips), buy price, sell price, expiry
  - Auto stock update when bill saved
  - New medicine → auto added to products
  - Existing medicine → stock increased
  - Individual pricing per item
  - Bill history with full details
*/

import React, { useState, useEffect } from 'react'
import { useApp, useToast }            from '../App'
import { db }                          from '../firebase'
import { collection, addDoc, onSnapshot,
         serverTimestamp, writeBatch,
         doc, query, orderBy }         from 'firebase/firestore'

const emptyItem = () => ({
  id:        Date.now() + Math.random(),
  name:      '',
  category:  'Tablet / गोली',
  unit:      'tablet',
  perStrip:  10,
  strips:    '',
  buyPrice:  '',   // buy price per strip
  sellPrice: '',   // sell price per tablet/unit
  expMonth:  '',
  expYear:   '',
  isNew:     true, // true = new product, false = existing
  productId: '',
})

export default function WholesalerBill() {
  const { products, wholesalers } = useApp()
  const showToast = useToast()

  // Bill header
  const [wholesalerId, setWholesalerId] = useState('')
  const [invoiceNo,    setInvoiceNo]    = useState('')
  const [billDate,     setBillDate]     = useState(new Date().toISOString().split('T')[0])
  const [billNotes,    setBillNotes]    = useState('')

  // Bill items
  const [items,   setItems]   = useState([emptyItem()])
  const [saving,  setSaving]  = useState(false)

  // History
  const [history,      setHistory]      = useState([])
  const [showHistory,  setShowHistory]  = useState(false)
  const [viewBill,     setViewBill]     = useState(null)

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'wholesalerBills'), orderBy('createdAt', 'desc')),
      snap => setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return () => unsub()
  }, [])

  // Helpers
  const addItem    = ()    => setItems(i => [...i, emptyItem()])
  const removeItem = (id)  => setItems(i => i.filter(x => x.id !== id))
  const updateItem = (id, field, val) =>
    setItems(i => i.map(x => x.id === id ? { ...x, [field]: val } : x))

  // Calculated total from items
  const calcTotal = items.reduce((sum, item) => {
    const strips = parseFloat(item.strips || 0)
    const price  = parseFloat(item.buyPrice || 0)
    return sum + (strips * price)
  }, 0)

  // Save bill & update stock
  async function saveBill() {
    if (!wholesalerId)     { showToast('Select wholesaler', 'warning'); return }
    if (!billDate)         { showToast('Enter bill date', 'warning');   return }
    const validItems = items.filter(i => i.name.trim() && parseFloat(i.strips) > 0)
    if (!validItems.length){ showToast('Add at least one medicine with qty', 'warning'); return }

    setSaving(true)
    try {
      const w     = wholesalers.find(x => x.id === wholesalerId)
      const batch = writeBatch(db)
      const savedItems = []

      for (const item of validItems) {
        const isTab    = item.unit === 'tablet' || item.unit === 'capsule'
        const perStrip = parseInt(item.perStrip) || 1
        const addQty   = isTab
          ? Math.round(parseFloat(item.strips) * perStrip)
          : parseFloat(item.strips)
        const expiryDate = item.expMonth && item.expYear
          ? `${item.expMonth}/${item.expYear}` : ''

        if (item.isNew || !item.productId) {
          // CREATE new product
          const ref = doc(collection(db, 'products'))
          batch.set(ref, {
            name:           item.name.trim(),
            category:       item.category,
            unit:           item.unit,
            perStrip:       isTab ? perStrip : 1,
            stock:          addQty,
            lowAlert:       isTab ? 20 : 5,
            buyPrice:       parseFloat(item.buyPrice)  || 0,
            sellPrice:      parseFloat(item.sellPrice) || 0,
            wholesalerId:   wholesalerId,
            wholesalerName: w?.name || '',
            expiryDate,
            createdAt:      serverTimestamp(),
          })
          savedItems.push({ ...item, addQty, expiryDate, action: 'new' })
        } else {
          // UPDATE existing product stock
          const existing = products.find(p => p.id === item.productId)
          if (existing) {
            batch.update(doc(db, 'products', item.productId), {
              stock:          (existing.stock || 0) + addQty,
              buyPrice:       parseFloat(item.buyPrice)  || existing.buyPrice  || 0,
              sellPrice:      parseFloat(item.sellPrice) || existing.sellPrice || 0,
              ...(expiryDate ? { expiryDate } : {}),
            })
            savedItems.push({ ...item, addQty, expiryDate, action: 'updated' })
          }
        }
      }

      await batch.commit()

      // Save bill record
      await addDoc(collection(db, 'wholesalerBills'), {
        wholesalerId,
        wholesalerName: w?.name || '',
        invoiceNo:      invoiceNo.trim(),
        billDate,
        totalAmount:    calcTotal.toFixed(2),
        notes:          billNotes.trim(),
        items:          savedItems.map(i => ({
          name:      i.name,
          category:  i.category,
          unit:      i.unit,
          perStrip:  i.perStrip,
          strips:    i.strips,
          addQty:    i.addQty,
          buyPrice:  i.buyPrice,
          sellPrice: i.sellPrice,
          expiryDate:i.expiryDate,
          action:    i.action,
        })),
        createdAt: serverTimestamp(),
      })

      const newN = savedItems.filter(i => i.action === 'new').length
      const updN = savedItems.filter(i => i.action === 'updated').length
      showToast(`✅ Bill saved! ${newN} new + ${updN} updated`)

      // Reset
      setItems([emptyItem()])
      setInvoiceNo('')
      setBillNotes('')

    } catch (e) {
      if (e.code === 'permission-denied') {
        showToast('❌ Permission denied — update Firestore rules', 'error')
      } else {
        showToast('Error: ' + e.message, 'error')
      }
    } finally { setSaving(false) }
  }

  return (
    <div className="page-enter">

      {/* HEADER */}
      <div className="bg-gradient-to-br from-teal-900 to-teal-600 text-white px-5 pt-12 pb-6">
        <h1 className="text-2xl font-extrabold">Wholesaler Bill 📋</h1>
        <p className="text-teal-200 text-sm mt-1">Enter bill → stock updates automatically</p>
      </div>

      <div className="px-4 pt-4 space-y-4 pb-6">

        {/* History button */}
        <button onClick={() => setShowHistory(!showHistory)}
          className="w-full bg-white border border-slate-200 text-slate-600 font-semibold py-3 rounded-2xl text-sm flex items-center justify-center gap-2">
          📜 {showHistory ? 'Hide' : 'View'} Bill History ({history.length})
        </button>

        {/* HISTORY LIST */}
        {showHistory && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {history.length === 0 ? (
              <p className="text-center text-slate-400 py-8 text-sm">No bills yet</p>
            ) : history.map(bill => (
              <div key={bill.id}
                onClick={() => setViewBill(bill)}
                className="flex justify-between items-start px-4 py-3 border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50 active:bg-slate-100">
                <div>
                  <p className="font-bold text-sm text-slate-800">{bill.wholesalerName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    📅 {bill.billDate}
                    {bill.invoiceNo ? ` · #${bill.invoiceNo}` : ''}
                    {` · ${(bill.items||[]).length} items`}
                  </p>
                </div>
                <p className="font-extrabold text-teal-600">₹{parseFloat(bill.totalAmount||0).toFixed(0)}</p>
              </div>
            ))}
          </div>
        )}

        {/* BILL DETAILS CARD */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Bill Details / बिल जानकारी</p>

          <div>
            <label className="fl">Wholesaler / थोक विक्रेता *</label>
            <select value={wholesalerId} onChange={e => setWholesalerId(e.target.value)} className="fi">
              <option value="">-- Select Wholesaler --</option>
              {wholesalers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="fl">Invoice No. / बिल नं.</label>
              <input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)}
                placeholder="INV-001" className="fi" />
            </div>
            <div>
              <label className="fl">Bill Date *</label>
              <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} className="fi" />
            </div>
          </div>

          <div>
            <label className="fl">Notes / नोट्स</label>
            <input value={billNotes} onChange={e => setBillNotes(e.target.value)}
              placeholder="Any notes..." className="fi" />
          </div>
        </div>

        {/* MEDICINES */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Medicines / दवाइयां ({items.length})
            </p>
            <button onClick={addItem}
              className="text-xs font-bold text-teal-600 bg-teal-50 px-3 py-1.5 rounded-lg active:bg-teal-100">
              ➕ Add Medicine
            </button>
          </div>

          {items.map((item, idx) => (
            <ItemRow
              key={item.id}
              item={item}
              index={idx}
              products={products}
              onUpdate={updateItem}
              onRemove={() => removeItem(item.id)}
              canRemove={items.length > 1}
            />
          ))}

          {/* Total */}
          <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="text-xs font-bold text-teal-600 uppercase tracking-wide">Bill Total</p>
              <p className="text-xs text-teal-500 mt-0.5">{items.filter(i=>i.strips).length} items</p>
            </div>
            <p className="text-2xl font-extrabold text-teal-700">₹{calcTotal.toFixed(0)}</p>
          </div>
        </div>

        {/* SAVE */}
        <button onClick={saveBill} disabled={saving}
          className="w-full bg-teal-600 text-white font-bold py-4 rounded-2xl text-lg shadow-lg shadow-teal-200 disabled:opacity-50 active:scale-[0.98] transition-all">
          {saving ? '⏳ Saving & Updating Stock...' : '💾 Save Bill & Update Stock'}
        </button>

        <div className="bg-teal-50 rounded-2xl p-4 space-y-1">
          <p className="text-xs text-teal-700 font-bold">How it works:</p>
          <p className="text-xs text-teal-600">🆕 New medicine → auto added to Stock</p>
          <p className="text-xs text-teal-600">📈 Existing medicine → stock increased</p>
          <p className="text-xs text-teal-600">💰 Buy/sell prices updated per item</p>
        </div>
      </div>

      {/* VIEW BILL MODAL */}
      {viewBill && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setViewBill(null)}>
          <div className="w-full max-w-2xl bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto pb-8"
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>
            <div className="flex justify-between items-center px-5 py-3 border-b border-slate-100">
              <h2 className="text-lg font-extrabold">📋 {viewBill.wholesalerName}</h2>
              <button onClick={() => setViewBill(null)}
                className="w-8 h-8 bg-slate-100 rounded-full text-sm font-bold flex items-center justify-center">✕</button>
            </div>
            <div className="px-5 pt-4 space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-2 text-sm">
                <div><p className="text-xs text-slate-400">Date</p><p className="font-bold">{viewBill.billDate}</p></div>
                <div><p className="text-xs text-slate-400">Invoice</p><p className="font-bold">{viewBill.invoiceNo || '—'}</p></div>
                <div><p className="text-xs text-slate-400">Total</p><p className="font-bold text-teal-600">₹{parseFloat(viewBill.totalAmount||0).toFixed(0)}</p></div>
                <div><p className="text-xs text-slate-400">Items</p><p className="font-bold">{(viewBill.items||[]).length}</p></div>
                {viewBill.notes && <div className="col-span-2"><p className="text-xs text-slate-400">Notes</p><p className="font-bold">{viewBill.notes}</p></div>}
              </div>

              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Medicines</p>
              {(viewBill.items||[]).map((item, i) => (
                <div key={i} className="bg-white border border-slate-100 rounded-xl p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{item.category}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${item.action==='new' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                      {item.action==='new' ? '🆕 Added' : '📈 Updated'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                    <div className="bg-slate-50 rounded-lg p-2 text-center">
                      <p className="text-slate-400">Strips</p>
                      <p className="font-bold">{item.strips}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2 text-center">
                      <p className="text-slate-400">Buy ₹/strip</p>
                      <p className="font-bold text-red-600">₹{item.buyPrice}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2 text-center">
                      <p className="text-slate-400">Sell ₹/unit</p>
                      <p className="font-bold text-green-600">₹{item.sellPrice}</p>
                    </div>
                  </div>
                  {item.expiryDate && (
                    <p className="text-xs text-amber-600 mt-2 font-medium">⏰ Exp: {item.expiryDate}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .fl{display:block;font-size:.72rem;font-weight:700;color:#64748b;margin-bottom:4px}
        .fi{width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:.875rem;outline:none;background:white;font-family:inherit}
        .fi:focus{border-color:#0d9488;box-shadow:0 0 0 3px #ccfbf1}
      `}</style>
    </div>
  )
}

// ── Individual medicine row in the bill ──
function ItemRow({ item, index, products, onUpdate, onRemove, canRemove }) {
  const isTab = item.unit === 'tablet' || item.unit === 'capsule'

  // Auto-detect existing product when typing name
  function handleName(val) {
    onUpdate(item.id, 'name', val)
    if (val.length > 2) {
      const match = products.find(p => p.name.toLowerCase().includes(val.toLowerCase()))
      if (match) {
        onUpdate(item.id, 'productId',  match.id)
        onUpdate(item.id, 'category',   match.category)
        onUpdate(item.id, 'unit',       match.unit)
        onUpdate(item.id, 'perStrip',   match.perStrip || 10)
        onUpdate(item.id, 'buyPrice',   match.buyPrice  || '')
        onUpdate(item.id, 'sellPrice',  match.sellPrice || '')
        onUpdate(item.id, 'isNew',      false)
      } else {
        onUpdate(item.id, 'isNew',     true)
        onUpdate(item.id, 'productId', '')
      }
    }
  }

  const strips   = parseFloat(item.strips  || 0)
  const buyPrice = parseFloat(item.buyPrice || 0)
  const itemCost = strips * buyPrice

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">

      {/* Item header */}
      <div className={`flex justify-between items-center px-4 py-2.5 ${item.isNew ? 'bg-blue-50' : 'bg-green-50'}`}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold text-slate-500">#{index+1}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.isNew ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
            {item.isNew ? '🆕 New Medicine' : '📈 Existing'}
          </span>
          {/* Toggle */}
          <button onClick={() => { onUpdate(item.id,'isNew',!item.isNew); onUpdate(item.id,'productId','') }}
            className="text-xs text-slate-500 underline">
            switch
          </button>
        </div>
        {canRemove && (
          <button onClick={onRemove}
            className="w-6 h-6 bg-red-100 text-red-500 rounded-full text-xs font-bold flex items-center justify-center">
            ✕
          </button>
        )}
      </div>

      <div className="p-4 space-y-3">

        {/* Medicine name / select */}
        {item.isNew ? (
          <div>
            <label className="fl">Medicine Name *</label>
            <input value={item.name} onChange={e => handleName(e.target.value)}
              placeholder="e.g. Paracetamol 500mg" className="fi" />
            {item.name.length > 2 && !item.productId && (
              <p className="text-xs text-blue-600 mt-1">🆕 Will be added as new product</p>
            )}
          </div>
        ) : (
          <div>
            <label className="fl">Select Existing Medicine *</label>
            <select value={item.productId}
              onChange={e => {
                const p = products.find(x => x.id === e.target.value)
                if (p) {
                  onUpdate(item.id, 'productId', p.id)
                  onUpdate(item.id, 'name',      p.name)
                  onUpdate(item.id, 'category',  p.category)
                  onUpdate(item.id, 'unit',      p.unit)
                  onUpdate(item.id, 'perStrip',  p.perStrip || 10)
                  onUpdate(item.id, 'buyPrice',  p.buyPrice  || '')
                  onUpdate(item.id, 'sellPrice', p.sellPrice || '')
                }
              }}
              className="fi">
              <option value="">-- Select Medicine --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} (stock: {p.stock})</option>
              ))}
            </select>
            {item.productId && <p className="text-xs text-green-600 mt-1">📈 Stock will increase</p>}
          </div>
        )}

        {/* Category + Unit — for new only */}
        {item.isNew && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="fl">Category</label>
              <select value={item.category} onChange={e => onUpdate(item.id,'category',e.target.value)} className="fi">
                <option>Tablet / गोली</option>
                <option>Capsule / कैप्सूल</option>
                <option>Syrup / सिरप</option>
                <option>Injection</option>
                <option>Antibiotic</option>
                <option>Baby Care</option>
                <option>Sanitary</option>
                <option>Other / अन्य</option>
              </select>
            </div>
            <div>
              <label className="fl">Unit</label>
              <select value={item.unit} onChange={e => onUpdate(item.id,'unit',e.target.value)} className="fi">
                <option value="tablet">Tablet</option>
                <option value="capsule">Capsule</option>
                <option value="bottle">Bottle</option>
                <option value="piece">Piece</option>
                <option value="pack">Pack</option>
              </select>
            </div>
          </div>
        )}

        {/* Tablets per strip + strips received */}
        <div className="grid grid-cols-2 gap-2">
          {isTab && (
            <div>
              <label className="fl">Tablets / Strip</label>
              <input type="number" value={item.perStrip}
                onChange={e => onUpdate(item.id,'perStrip',e.target.value)}
                placeholder="10" className="fi" inputMode="numeric" />
            </div>
          )}
          <div>
            <label className="fl">{isTab ? 'Strips Received' : 'Qty Received'}</label>
            <input type="number" value={item.strips}
              onChange={e => onUpdate(item.id,'strips',e.target.value)}
              placeholder="e.g. 10" className="fi" inputMode="numeric" />
          </div>
        </div>

        {isTab && item.strips && item.perStrip && (
          <div className="bg-teal-50 rounded-lg px-3 py-2 text-xs text-teal-700 font-semibold">
            = {Math.round(parseFloat(item.strips) * parseInt(item.perStrip))} tablets will be added
          </div>
        )}

        {/* ── PRICING — individual per item ── */}
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-2">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">💰 Pricing</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="fl">Buy Price ₹ / {isTab ? 'strip' : 'unit'}</label>
              <input type="number" value={item.buyPrice}
                onChange={e => onUpdate(item.id,'buyPrice',e.target.value)}
                placeholder="e.g. 25" className="fi" inputMode="decimal" />
            </div>
            <div>
              <label className="fl">Sell Price ₹ / {isTab ? 'tablet' : 'unit'}</label>
              <input type="number" value={item.sellPrice}
                onChange={e => onUpdate(item.id,'sellPrice',e.target.value)}
                placeholder="e.g. 2.50" className="fi" inputMode="decimal" />
            </div>
          </div>
          {/* Item cost summary */}
          {strips > 0 && buyPrice > 0 && (
            <div className="flex justify-between items-center text-xs font-bold text-amber-800 pt-1">
              <span>{strips} × ₹{buyPrice}</span>
              <span>= ₹{itemCost.toFixed(0)}</span>
            </div>
          )}
          {/* Profit margin */}
          {item.buyPrice && item.sellPrice && isTab && item.perStrip && (
            (() => {
              const buyPerTab  = parseFloat(item.buyPrice) / parseInt(item.perStrip)
              const sell       = parseFloat(item.sellPrice)
              const margin     = ((sell - buyPerTab) / buyPerTab * 100)
              return (
                <p className={`text-xs font-bold ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  Margin: {margin.toFixed(1)}% per tablet
                </p>
              )
            })()
          )}
        </div>

        {/* Expiry date */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="fl">Expiry Month</label>
            <select value={item.expMonth||''}
              onChange={e => onUpdate(item.id,'expMonth',e.target.value)}
              className="fi">
              <option value="">Month</option>
              {['01 Jan','02 Feb','03 Mar','04 Apr','05 May','06 Jun',
                '07 Jul','08 Aug','09 Sep','10 Oct','11 Nov','12 Dec'].map(m => (
                <option key={m} value={m.slice(0,2)}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="fl">Expiry Year</label>
            <input type="number" value={item.expYear||''}
              onChange={e => onUpdate(item.id,'expYear',e.target.value.slice(0,4))}
              placeholder="2026" inputMode="numeric" className="fi" />
          </div>
        </div>

      </div>
    </div>
  )
}
