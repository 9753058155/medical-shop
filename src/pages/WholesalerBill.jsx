/*
  WholesalerBill.jsx — Enter wholesaler bill
  
  FEATURES:
  1. Enter bill details: wholesaler, invoice number, date, total amount
  2. Add medicines from the bill (name, qty, strips, buy price)
  3. Auto-adds new products OR auto-updates stock of existing ones
  4. Saves full bill record for reference
  5. Real-time sync across all devices
*/

import React, { useState, useEffect } from 'react'
import { useApp, useToast }            from '../App'
import { addProduct, updateProduct, db } from '../firebase'
import { collection, addDoc, onSnapshot,
         query, orderBy, serverTimestamp,
         writeBatch, doc, getDoc }     from 'firebase/firestore'
import Modal                           from '../components/Modal'

// One empty bill item row
const emptyItem = () => ({
  id:         Date.now() + Math.random(),
  name:       '',
  category:   'Tablet / गोली',
  unit:       'tablet',
  perStrip:   10,
  strips:     1,
  buyPrice:   '',
  sellPrice:  '',
  isNew:      true,    // true = add as new product, false = update existing
  productId:  '',      // if updating existing
})

export default function WholesalerBill() {
  const { products, wholesalers } = useApp()
  const showToast = useToast()

  // Bill header fields
  const [wholesalerId,  setWholesalerId]  = useState('')
  const [invoiceNo,     setInvoiceNo]     = useState('')
  const [billDate,      setBillDate]      = useState(new Date().toISOString().split('T')[0])
  const [billAmount,    setBillAmount]    = useState('')
  const [notes,         setNotes]         = useState('')

  // Bill items
  const [items,         setItems]         = useState([emptyItem()])
  const [saving,        setSaving]        = useState(false)

  // Bill history
  const [history,       setHistory]       = useState([])
  const [showHistory,   setShowHistory]   = useState(false)
  const [selectedBill,  setSelectedBill]  = useState(null)

  // Load bill history
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'wholesalerBills'), orderBy('createdAt', 'desc')),
      snap => setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return () => unsub()
  }, [])

  // Item row helpers
  const addItem    = ()  => setItems(i => [...i, emptyItem()])
  const removeItem = (id) => setItems(i => i.filter(x => x.id !== id))
  const updateItem = (id, field, val) =>
    setItems(i => i.map(x => x.id === id ? { ...x, [field]: val } : x))

  // Total cost of all bill items
  const totalCost = items.reduce((sum, item) => {
    const isTab  = item.unit === 'tablet' || item.unit === 'capsule'
    const qty    = isTab
      ? Math.round(parseFloat(item.strips || 0) * parseInt(item.perStrip || 1))
      : parseFloat(item.strips || 0)
    return sum + (qty * parseFloat(item.buyPrice || 0) / (isTab ? parseInt(item.perStrip||1) : 1))
  }, 0)

  // Save the complete bill
  async function handleSaveBill() {
    if (!wholesalerId)        { showToast('Select wholesaler', 'warning'); return }
    if (!billDate)            { showToast('Enter bill date', 'warning');   return }
    const validItems = items.filter(i => i.name.trim())
    if (validItems.length === 0) { showToast('Add at least one medicine', 'warning'); return }

    setSaving(true)
    try {
      const w     = wholesalers.find(x => x.id === wholesalerId)
      const batch = writeBatch(db)
      const savedItems = []

      for (const item of validItems) {
        const isTab    = item.unit === 'tablet' || item.unit === 'capsule'
        const perStrip = parseInt(item.perStrip) || 1
        const addQty   = isTab
          ? Math.round(parseFloat(item.strips || 0) * perStrip)
          : parseFloat(item.strips || 0)

        if (item.isNew || !item.productId) {
          // ── ADD AS NEW PRODUCT ──
          const newProd = {
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
            expiryDate:     item.expiryDate || '',
            createdAt:      serverTimestamp(),
          }
          const ref = doc(collection(db, 'products'))
          batch.set(ref, newProd)
          savedItems.push({ ...item, addQty, newProductId: ref.id, action: 'added' })
        } else {
          // ── UPDATE EXISTING PRODUCT STOCK ──
          const existing = products.find(p => p.id === item.productId)
          if (existing) {
            batch.update(doc(db, 'products', item.productId), {
              stock:    (existing.stock || 0) + addQty,
              buyPrice: parseFloat(item.buyPrice) || existing.buyPrice || 0,
            })
            savedItems.push({ ...item, addQty, action: 'updated' })
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
        billAmount:     parseFloat(billAmount) || totalCost,
        notes:          notes.trim(),
        items:          savedItems.map(i => ({
          name:      i.name,
          category:  i.category,
          unit:      i.unit,
          strips:    i.strips,
          perStrip:  i.perStrip,
          addQty:    i.addQty,
          buyPrice:  i.buyPrice,
          sellPrice: i.sellPrice,
          action:    i.action,
        })),
        createdAt: serverTimestamp(),
      })

      const newCount     = savedItems.filter(i => i.action === 'added').length
      const updatedCount = savedItems.filter(i => i.action === 'updated').length
      showToast(`✅ Bill saved! ${newCount} new, ${updatedCount} updated`)

      // Reset form
      setItems([emptyItem()])
      setInvoiceNo('')
      setBillAmount('')
      setNotes('')
      setWholesalerId('')

    } catch (e) {
      console.error(e)
      showToast('Error: ' + e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-enter">

      {/* HEADER */}
      <div className="bg-gradient-to-br from-teal-900 to-teal-600 text-white px-5 pt-12 pb-6">
        <h1 className="text-2xl font-extrabold">Wholesaler Bill 📋</h1>
        <p className="text-teal-200 text-sm mt-1">Enter bill → stock updates automatically</p>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* View history button */}
        <button onClick={() => setShowHistory(true)}
          className="w-full bg-white border border-slate-200 text-slate-600 font-bold py-3 rounded-2xl text-sm flex items-center justify-center gap-2">
          📜 View Bill History ({history.length})
        </button>

        {/* BILL HEADER CARD */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Bill Details</p>

          {/* Wholesaler */}
          <div>
            <label className="field-label">Wholesaler *</label>
            <select value={wholesalerId} onChange={e => setWholesalerId(e.target.value)} className="field-input">
              <option value="">-- Select Wholesaler --</option>
              {wholesalers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Invoice number */}
            <div>
              <label className="field-label">Invoice No. / बिल नं.</label>
              <input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)}
                placeholder="e.g. INV-001" className="field-input" />
            </div>
            {/* Bill date */}
            <div>
              <label className="field-label">Bill Date *</label>
              <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)}
                className="field-input" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Total Bill Amount ₹</label>
              <input type="number" value={billAmount} onChange={e => setBillAmount(e.target.value)}
                placeholder={totalCost.toFixed(0)} className="field-input" />
            </div>
            <div>
              <label className="field-label">Notes / नोट्स</label>
              <input value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Any notes..." className="field-input" />
            </div>
          </div>
        </div>

        {/* MEDICINES FROM BILL */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Medicines in Bill</p>
            <button onClick={addItem}
              className="text-xs font-bold text-teal-600 bg-teal-50 px-3 py-1.5 rounded-lg">
              ➕ Add Medicine
            </button>
          </div>

          {items.map((item, idx) => (
            <BillItemRow
              key={item.id}
              item={item}
              index={idx}
              products={products}
              onUpdate={updateItem}
              onRemove={() => removeItem(item.id)}
              canRemove={items.length > 1}
            />
          ))}

          {/* Calculated total */}
          <div className="bg-teal-50 rounded-xl p-3 flex justify-between items-center">
            <span className="font-bold text-teal-700 text-sm">Calculated Total</span>
            <span className="text-xl font-extrabold text-teal-700">₹{totalCost.toFixed(0)}</span>
          </div>
        </div>

        {/* SAVE BUTTON */}
        <button onClick={handleSaveBill} disabled={saving}
          className="w-full bg-teal-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-teal-200 disabled:opacity-50 active:scale-[0.98] transition-all text-lg">
          {saving ? '⏳ Saving & Updating Stock...' : '💾 Save Bill & Update Stock'}
        </button>

        <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4">
          <p className="text-xs text-teal-700 font-semibold">
            ✅ New medicines → automatically added to Products<br/>
            ✅ Existing medicines → stock automatically increased<br/>
            ✅ Full bill record saved for reference
          </p>
        </div>
      </div>

      {/* BILL HISTORY MODAL */}
      <Modal isOpen={showHistory} onClose={() => setShowHistory(false)} title="📜 Bill History">
        <div className="space-y-3 pb-4 max-h-96 overflow-y-auto">
          {history.length === 0 ? (
            <p className="text-center text-slate-400 py-8">No bills recorded yet</p>
          ) : history.map(bill => (
            <div key={bill.id}
              className="bg-slate-50 rounded-xl p-4 cursor-pointer hover:bg-slate-100"
              onClick={() => { setSelectedBill(bill); setShowHistory(false) }}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-sm text-slate-800">{bill.wholesalerName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    📅 {bill.billDate}
                    {bill.invoiceNo ? ` · #${bill.invoiceNo}` : ''}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {(bill.items||[]).length} medicines
                  </p>
                </div>
                <p className="font-extrabold text-teal-600">₹{parseFloat(bill.billAmount||0).toFixed(0)}</p>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* BILL DETAIL MODAL */}
      <Modal isOpen={!!selectedBill} onClose={() => setSelectedBill(null)}
        title={`📋 Bill — ${selectedBill?.wholesalerName}`}>
        <div className="space-y-3 pb-4">
          <div className="bg-slate-50 rounded-xl p-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Date</span>
              <span className="font-semibold">{selectedBill?.billDate}</span>
            </div>
            {selectedBill?.invoiceNo && (
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice</span>
                <span className="font-semibold">#{selectedBill.invoiceNo}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Total</span>
              <span className="font-extrabold text-teal-600">₹{parseFloat(selectedBill?.billAmount||0).toFixed(0)}</span>
            </div>
            {selectedBill?.notes && (
              <div className="flex justify-between">
                <span className="text-slate-500">Notes</span>
                <span className="font-semibold">{selectedBill.notes}</span>
              </div>
            )}
          </div>

          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Medicines</p>
          {(selectedBill?.items||[]).map((item, i) => (
            <div key={i} className="flex justify-between items-center bg-white border border-slate-100 rounded-xl p-3">
              <div>
                <p className="font-semibold text-sm text-slate-800">{item.name}</p>
                <p className="text-xs text-slate-400">
                  {item.strips} strips · {item.addQty} {item.unit}s added
                </p>
              </div>
              <div className="text-right">
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${item.action==='added' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                  {item.action==='added' ? '🆕 New' : '📈 Updated'}
                </span>
                <p className="text-xs text-slate-400 mt-1">₹{item.buyPrice}/strip</p>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <style>{`
        .field-label{display:block;font-size:.72rem;font-weight:700;color:#64748b;margin-bottom:4px}
        .field-input{width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:.875rem;outline:none;background:white}
        .field-input:focus{border-color:#0d9488;box-shadow:0 0 0 3px #ccfbf1}
      `}</style>
    </div>
  )
}

// ── Individual bill item row ──
function BillItemRow({ item, index, products, onUpdate, onRemove, canRemove }) {
  const isTab = item.unit === 'tablet' || item.unit === 'capsule'

  // When user types a name, check if product already exists
  function handleNameChange(val) {
    onUpdate(item.id, 'name', val)
    if (val.trim().length > 2) {
      const match = products.find(p => p.name.toLowerCase().includes(val.toLowerCase()))
      if (match) {
        onUpdate(item.id, 'productId',  match.id)
        onUpdate(item.id, 'category',   match.category)
        onUpdate(item.id, 'unit',       match.unit)
        onUpdate(item.id, 'perStrip',   match.perStrip || 10)
        onUpdate(item.id, 'sellPrice',  match.sellPrice || '')
        onUpdate(item.id, 'isNew',      false)
      } else {
        onUpdate(item.id, 'isNew',      true)
        onUpdate(item.id, 'productId',  '')
      }
    }
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">

      {/* Row header */}
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold text-slate-500">Medicine {index + 1}</span>
        <div className="flex items-center gap-2">
          {/* New vs existing toggle */}
          <div className="flex bg-slate-200 rounded-lg p-0.5">
            <button onClick={() => onUpdate(item.id, 'isNew', true)}
              className={`px-2 py-1 rounded-md text-xs font-bold transition-all ${item.isNew ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>
              🆕 New
            </button>
            <button onClick={() => onUpdate(item.id, 'isNew', false)}
              className={`px-2 py-1 rounded-md text-xs font-bold transition-all ${!item.isNew ? 'bg-green-600 text-white' : 'text-slate-500'}`}>
              📈 Existing
            </button>
          </div>
          {canRemove && (
            <button onClick={onRemove}
              className="w-7 h-7 bg-red-50 text-red-500 rounded-lg flex items-center justify-center text-xs font-bold">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Medicine name — if existing, show dropdown; if new, show input */}
      {item.isNew ? (
        <div>
          <label className="field-label">Medicine Name *</label>
          <input value={item.name} onChange={e => handleNameChange(e.target.value)}
            placeholder="e.g. Paracetamol 500mg" className="field-input" />
          {item.name.trim().length > 2 && (
            <p className="text-xs mt-1 font-medium text-blue-600">🆕 Will be added as new product</p>
          )}
        </div>
      ) : (
        <div>
          <label className="field-label">Select Existing Medicine *</label>
          <select value={item.productId}
            onChange={e => {
              const p = products.find(x => x.id === e.target.value)
              if (p) {
                onUpdate(item.id, 'productId', p.id)
                onUpdate(item.id, 'name',      p.name)
                onUpdate(item.id, 'category',  p.category)
                onUpdate(item.id, 'unit',      p.unit)
                onUpdate(item.id, 'perStrip',  p.perStrip || 10)
                onUpdate(item.id, 'sellPrice', p.sellPrice || '')
              }
            }}
            className="field-input">
            <option value="">-- Select Medicine --</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name} (stock: {p.stock})</option>)}
          </select>
          {item.productId && (
            <p className="text-xs mt-1 font-medium text-green-600">📈 Stock will be increased</p>
          )}
        </div>
      )}

      {/* Category + Unit (for new only) */}
      {item.isNew && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="field-label">Category</label>
            <select value={item.category} onChange={e => onUpdate(item.id, 'category', e.target.value)} className="field-input">
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
            <label className="field-label">Unit</label>
            <select value={item.unit} onChange={e => onUpdate(item.id, 'unit', e.target.value)} className="field-input">
              <option value="tablet">Tablet</option>
              <option value="capsule">Capsule</option>
              <option value="bottle">Bottle</option>
              <option value="piece">Piece</option>
              <option value="pack">Pack</option>
            </select>
          </div>
        </div>
      )}

      {/* Strips per box + qty */}
      <div className="grid grid-cols-2 gap-2">
        {isTab && (
          <div>
            <label className="field-label">Tablets/Strip</label>
            <input type="number" value={item.perStrip}
              onChange={e => onUpdate(item.id, 'perStrip', e.target.value)}
              placeholder="10" className="field-input" />
          </div>
        )}
        <div>
          <label className="field-label">{isTab ? 'Strips Received' : 'Qty Received'}</label>
          <input type="number" value={item.strips}
            onChange={e => onUpdate(item.id, 'strips', e.target.value)}
            placeholder="e.g. 10" className="field-input" />
        </div>
      </div>

      {isTab && item.strips && item.perStrip && (
        <p className="text-xs text-teal-600 font-medium bg-teal-50 px-3 py-1.5 rounded-lg">
          = {Math.round(parseFloat(item.strips) * parseInt(item.perStrip))} tablets
        </p>
      )}

      {/* Buy price + sell price */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="field-label">Buy Price ₹/strip</label>
          <input type="number" value={item.buyPrice}
            onChange={e => onUpdate(item.id, 'buyPrice', e.target.value)}
            placeholder="25" className="field-input" />
        </div>
        <div>
          <label className="field-label">Sell Price ₹/unit</label>
          <input type="number" value={item.sellPrice}
            onChange={e => onUpdate(item.id, 'sellPrice', e.target.value)}
            placeholder="2.5" className="field-input" />
        </div>
      </div>

      {/* Expiry date */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="field-label">Expiry Month</label>
          <select value={item.expiryMonth||''}
            onChange={e => onUpdate(item.id, 'expiryDate', `${e.target.value}/${item.expiryYear||''}`)}
            className="field-input">
            <option value="">Month</option>
            {['01 Jan','02 Feb','03 Mar','04 Apr','05 May','06 Jun','07 Jul','08 Aug','09 Sep','10 Oct','11 Nov','12 Dec'].map(m => (
              <option key={m} value={m.slice(0,2)}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Expiry Year</label>
          <input type="number" value={item.expiryYear||''}
            onChange={e => onUpdate(item.id, 'expiryYear', e.target.value.slice(0,4))}
            placeholder="2026" inputMode="numeric" className="field-input" />
        </div>
      </div>
    </div>
  )
}
