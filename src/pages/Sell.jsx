/*
  Sell.jsx — Record a sale
  
  UPDATED:
  - Cash / UPI / Udhaar payment method toggle
  - If Udhaar selected → auto-saves to udhaar tracker
  - WhatsApp bill button on every sale
  - Low stock sound + vibration alert
  - Edit / Delete sales with stock restore
  - Daily summary
*/

import React, { useState, useMemo }        from 'react'
import { useApp, useToast }                 from '../App'
import { addSale, addUdhaar, db,
         generateWhatsAppBill }             from '../firebase'
import { doc, getDoc, updateDoc,
         writeBatch, deleteDoc }            from 'firebase/firestore'
import Modal                                from '../components/Modal'
import PhoneInput                           from '../components/PhoneInput'
import { useLanguage, validatePhone }       from '../i18n'

const emptyRow = () => ({ id: Date.now() + Math.random(), productId: '', qty: 1 })

function playLowStockAlert() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5)
  } catch (e) {}
  if (navigator.vibrate) navigator.vibrate([200, 100, 200])
}

// Generate WhatsApp link and open it
function openWhatsAppBill(sale, phone = '') {
  const billText = generateWhatsAppBill(sale)
  const url = phone
    ? `https://wa.me/91${phone}?text=${billText}`
    : `https://wa.me/?text=${billText}`
  window.open(url, '_blank')
}

export default function Sell() {
  const { products, todaySales } = useApp()
  const showToast = useToast()
  const { t, lang } = useLanguage()

  const [workerName,   setWorkerName]   = useState('')
  const [customer,     setCustomer]     = useState('')
  const [customerPhone,setCustomerPhone]= useState('')
  const [rows,         setRows]         = useState([emptyRow()])
  const [discountType, setDiscountType] = useState('pct')
  const [discountVal,  setDiscountVal]  = useState('')
  const [payMethod,    setPayMethod]    = useState('cash') // 'cash'|'upi'|'udhaar'
  const [saving,       setSaving]       = useState(false)

  // Edit modal state
  const [editSale,      setEditSale]      = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editRows,      setEditRows]      = useState([])
  const [editCustomer,  setEditCustomer]  = useState('')
  const [editWorker,    setEditWorker]    = useState('')
  const [editDiscType,  setEditDiscType]  = useState('pct')
  const [editDiscVal,   setEditDiscVal]   = useState('')
  const [editSaving,    setEditSaving]    = useState(false)

  // Summary modal
  const [showSummary, setShowSummary] = useState(false)

  // ── Totals ──
  const subtotal = useMemo(() => rows.reduce((sum, row) => {
    const p = products.find(x => x.id === row.productId)
    return sum + (parseFloat(p?.sellPrice || 0) * parseFloat(row.qty || 0))
  }, 0), [rows, products])

  const discountAmt = useMemo(() => {
    const v = parseFloat(discountVal) || 0
    return discountType === 'pct' ? Math.min(subtotal * v / 100, subtotal) : Math.min(v, subtotal)
  }, [discountVal, discountType, subtotal])

  const total = Math.max(0, subtotal - discountAmt)

  const editSubtotal = useMemo(() => editRows.reduce((sum, row) => {
    const p = products.find(x => x.id === row.productId)
    return sum + (parseFloat(p?.sellPrice || 0) * parseFloat(row.qty || 0))
  }, 0), [editRows, products])

  const editDiscAmt = useMemo(() => {
    const v = parseFloat(editDiscVal) || 0
    return editDiscType === 'pct'
      ? Math.min(editSubtotal * v / 100, editSubtotal)
      : Math.min(v, editSubtotal)
  }, [editDiscVal, editDiscType, editSubtotal])

  const editTotal = Math.max(0, editSubtotal - editDiscAmt)

  const addRow    = ()    => setRows(r => [...r, emptyRow()])
  const removeRow = (id)  => setRows(r => r.filter(x => x.id !== id))
  const updateRow = (id, field, val) =>
    setRows(r => r.map(x => x.id === id ? { ...x, [field]: val } : x))

  // ── Complete sale ──
  async function completeSale() {
    const validRows = rows.filter(r => r.productId && parseFloat(r.qty) > 0)
    if (validRows.length === 0) { showToast('Add at least one item', 'warning'); return }
    if (!workerName.trim()) { showToast('Enter worker name', 'warning'); return }
    const phoneCheck = validatePhone(customerPhone)
    if (customerPhone && !phoneCheck.valid) { showToast('Invalid customer phone number', 'error'); return }

    for (const row of validRows) {
      const p = products.find(x => x.id === row.productId)
      if (p && parseFloat(row.qty) > p.stock) {
        showToast(`Not enough stock: ${p.name}`, 'error'); return
      }
    }

    setSaving(true)
    try {
      const batch = writeBatch(db)
      const items = validRows.map(row => {
        const p = products.find(x => x.id === row.productId)
        batch.update(doc(db, 'products', p.id), { stock: p.stock - parseFloat(row.qty) })
        return { productId: p.id, name: p.name, qty: parseFloat(row.qty),
                 unit: p.unit, price: p.sellPrice || 0,
                 total: parseFloat(row.qty) * (p.sellPrice || 0) }
      })
      await batch.commit()

      const saleRecord = {
        workerName:    workerName.trim(),
        customer:      customer.trim()      || 'Customer',
        customerPhone: customerPhone.trim() || '',
        items,
        subtotal:      subtotal.toFixed(2),
        discountType,
        discountVal:   parseFloat(discountVal) || 0,
        discountAmt:   discountAmt.toFixed(2),
        total:         total.toFixed(0),
        paymentMethod: payMethod,
        date:          new Date().toISOString(),
      }

      await addSale(saleRecord)

      // If udhaar → also save to udhaar tracker
      if (payMethod === 'udhaar') {
        await addUdhaar({
          customerName: customer.trim() || 'Customer',
          phone:        customerPhone.trim(),
          amount:       parseFloat(total.toFixed(0)),
          remaining:    parseFloat(total.toFixed(0)),
          items:        items.map(i => `${i.name} x${i.qty}`).join(', '),
          notes:        `Sale on ${new Date().toLocaleDateString('en-IN')}`,
          date:         new Date().toISOString(),
        })
        showToast(`Udhaar of Rs.${total.toFixed(0)} saved for ${customer || 'Customer'}`)
      } else {
        showToast(`Sale done! Rs.${total.toFixed(0)} (${payMethod.toUpperCase()})`)
      }

      // Low stock check
      const lowItems = validRows.filter(row => {
        const p = products.find(x => x.id === row.productId)
        if (!p) return false
        return (p.stock - parseFloat(row.qty)) <= (p.lowAlert || 10)
      })
      if (lowItems.length > 0) {
        playLowStockAlert()
        setTimeout(() => showToast(`Low stock: ${lowItems.map(r => products.find(x=>x.id===r.productId)?.name).join(', ')}`, 'warning'), 600)
      }

      // Reset form
      setCustomer(''); setCustomerPhone(''); setRows([emptyRow()])
      setDiscountVal(''); setPayMethod('cash')

    } catch (err) {
      showToast('Error: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Edit sale ──
  function openEditSale(sale) {
    setEditSale(sale)
    setEditCustomer(sale.customer || '')
    setEditWorker(sale.workerName || '')
    setEditDiscType(sale.discountType || 'pct')
    setEditDiscVal(sale.discountVal || '')
    setEditRows(sale.items.map(i => ({ id: Math.random(), productId: i.productId, qty: i.qty })))
    setShowEditModal(true)
  }

  async function saveEditedSale() {
    const validRows = editRows.filter(r => r.productId && parseFloat(r.qty) > 0)
    if (validRows.length === 0) { showToast('Add at least one item', 'warning'); return }
    setEditSaving(true)
    try {
      const batch = writeBatch(db)
      for (const oldItem of editSale.items) {
        const pRef  = doc(db, 'products', oldItem.productId)
        const pSnap = await getDoc(pRef)
        if (pSnap.exists()) batch.update(pRef, { stock: pSnap.data().stock + oldItem.qty })
      }
      const newItems = []
      for (const row of validRows) {
        const p = products.find(x => x.id === row.productId)
        if (!p) continue
        batch.update(doc(db, 'products', p.id), {
          stock: p.stock + (editSale.items.find(i => i.productId === p.id)?.qty || 0) - parseFloat(row.qty)
        })
        newItems.push({ productId: p.id, name: p.name, qty: parseFloat(row.qty),
                        unit: p.unit, price: p.sellPrice || 0,
                        total: parseFloat(row.qty) * (p.sellPrice || 0) })
      }
      await batch.commit()
      await updateDoc(doc(db, 'sales', editSale.id), {
        workerName: editWorker.trim(),
        customer:   editCustomer.trim(),
        items:      newItems,
        subtotal:   editSubtotal.toFixed(2),
        discountType: editDiscType,
        discountVal:  parseFloat(editDiscVal) || 0,
        discountAmt:  editDiscAmt.toFixed(2),
        total:        editTotal.toFixed(0),
        editedAt:     new Date().toISOString(),
      })
      showToast('Sale updated!'); setShowEditModal(false)
    } catch (err) {
      showToast('Error: ' + err.message, 'error')
    } finally {
      setEditSaving(false)
    }
  }

  async function deleteSale(sale) {
    if (!confirm('Delete this sale? Stock will be restored.')) return
    try {
      const batch = writeBatch(db)
      for (const item of sale.items) {
        const pRef  = doc(db, 'products', item.productId)
        const pSnap = await getDoc(pRef)
        if (pSnap.exists()) batch.update(pRef, { stock: pSnap.data().stock + item.qty })
      }
      batch.delete(doc(db, 'sales', sale.id))
      await batch.commit()
      showToast('Sale deleted & stock restored!')
    } catch (err) { showToast('Error', 'error') }
  }

  // ── Summary ──
  const summary = useMemo(() => {
    const revenue       = todaySales.reduce((s,x) => s + parseFloat(x.total||0), 0)
    const discountGiven = todaySales.reduce((s,x) => s + parseFloat(x.discountAmt||0), 0)
    const udhaarTotal   = todaySales.filter(x => x.paymentMethod === 'udhaar').reduce((s,x) => s + parseFloat(x.total||0), 0)
    const cashTotal     = todaySales.filter(x => x.paymentMethod === 'cash').reduce((s,x) => s + parseFloat(x.total||0), 0)
    const upiTotal      = todaySales.filter(x => x.paymentMethod === 'upi').reduce((s,x) => s + parseFloat(x.total||0), 0)
    const productCount  = {}
    todaySales.forEach(s => (s.items||[]).forEach(i => {
      productCount[i.name] = (productCount[i.name]||0) + i.qty
    }))
    const topProducts = Object.entries(productCount).sort((a,b)=>b[1]-a[1]).slice(0,5)
    const byWorker    = {}
    todaySales.forEach(s => {
      const w = s.workerName || 'Unknown'
      byWorker[w] = (byWorker[w]||0) + parseFloat(s.total||0)
    })
    return { revenue, discountGiven, udhaarTotal, cashTotal, upiTotal, topProducts, byWorker }
  }, [todaySales])

  return (
    <div className="page-enter">

      <div className="bg-gradient-to-br from-blue-900 to-blue-600 text-white px-5 pt-12 pb-6">
        <h1 className="text-2xl font-extrabold">{t('newSale')}</h1>
        <p className="text-blue-200 text-sm mt-1">{lang === 'hi' ? 'बिक्री दर्ज करें' : 'Record a sale'}</p>
      </div>

      <div className="px-4 pt-4 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">

          {/* Worker name */}
          <div>
            <label className="field-label">Worker Name *</label>
            <input value={workerName} onChange={e => setWorkerName(e.target.value)}
              placeholder="e.g. Ramesh..." className="field-input"/>
          </div>

          {/* Customer */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Customer Name</label>
              <input value={customer} onChange={e => setCustomer(e.target.value)}
                placeholder="Name..." className="field-input"/>
            </div>
            <div>
              <PhoneInput
                value={customerPhone}
                onChange={setCustomerPhone}
                label="Phone (WhatsApp)"
                placeholder="98765..."
              />
            </div>
          </div>

          {/* Items */}
          <div className="flex justify-between items-center">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Items</p>
            <button onClick={addRow}
              className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
              + Add Item
            </button>
          </div>
          <div className="space-y-2">
            {rows.map(row => (
              <SaleRow key={row.id} row={row} products={products}
                onUpdate={updateRow} onRemove={() => removeRow(row.id)}
                canRemove={rows.length > 1}/>
            ))}
          </div>

          {/* Payment method */}
          <div>
            <label className="field-label">Payment Method / भुगतान</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key:'cash',   label:'💵 Cash',   color:'green'  },
                { key:'upi',    label:'📱 UPI',    color:'blue'   },
                { key:'udhaar', label:'💸 Udhaar', color:'orange' },
              ].map(m => (
                <button key={m.key} onClick={() => setPayMethod(m.key)}
                  className={`py-2.5 rounded-xl text-sm font-bold transition-all
                    ${payMethod === m.key
                      ? m.color === 'green'  ? 'bg-green-500 text-white shadow-lg shadow-green-200'
                      : m.color === 'blue'   ? 'bg-blue-500 text-white shadow-lg shadow-blue-200'
                      : 'bg-orange-500 text-white shadow-lg shadow-orange-200'
                      : 'bg-slate-100 text-slate-500'}`}>
                  {m.label}
                </button>
              ))}
            </div>
            {payMethod === 'udhaar' && (
              <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded-lg mt-2">
                This will be saved to Udhaar tracker automatically
              </p>
            )}
          </div>

          {/* Bill summary */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span className="font-semibold">Rs.{subtotal.toFixed(0)}</span>
            </div>
            <div className="flex justify-between items-center text-sm text-slate-600">
              <span>Discount</span>
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-200 rounded-lg p-0.5 gap-0.5">
                  {['pct','flat'].map(t => (
                    <button key={t} onClick={() => setDiscountType(t)}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all
                        ${discountType === t ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>
                      {t === 'pct' ? '%' : 'Rs'}
                    </button>
                  ))}
                </div>
                <input type="number" value={discountVal}
                  onChange={e => setDiscountVal(e.target.value)} placeholder="0"
                  className="w-16 text-center px-2 py-1 border border-slate-200
                             rounded-lg text-sm font-bold outline-none"/>
              </div>
            </div>
            {discountAmt > 0 && (
              <div className="flex justify-between text-sm text-green-600 font-semibold">
                <span>Saving</span><span>- Rs.{discountAmt.toFixed(0)}</span>
              </div>
            )}
            <div className="border-t border-dashed border-slate-200 pt-2">
              <div className="flex justify-between items-center">
                <span className="font-bold">Total</span>
                <span className="text-2xl font-extrabold text-blue-600">Rs.{total.toFixed(0)}</span>
              </div>
            </div>
          </div>

          <button onClick={completeSale} disabled={saving}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl text-lg
                       shadow-lg shadow-blue-200 active:scale-[0.98] disabled:opacity-50 transition-all">
            {saving ? 'Processing...' : `✅ Complete Sale (${payMethod.toUpperCase()})`}
          </button>
        </div>

        {/* Today's log */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
            <div>
              <p className="font-bold text-sm text-slate-800">Today's Sales Log</p>
              <p className="text-xs text-slate-400">{todaySales.length} sales · Rs.{summary.revenue.toFixed(0)}</p>
            </div>
            <button onClick={() => setShowSummary(true)}
              className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
              Summary
            </button>
          </div>

          {todaySales.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <div className="text-3xl mb-2">📋</div>
              <p className="text-sm">No sales yet today</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {todaySales.map(s => (
                <div key={s.id} className="px-4 py-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-slate-800">{s.customer}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {(s.items||[]).map(i => `${i.name} x${i.qty}`).join(', ')}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-blue-400">by {s.workerName}</p>
                        {/* Payment method badge */}
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
                          ${s.paymentMethod === 'cash'   ? 'bg-green-100 text-green-700'  :
                            s.paymentMethod === 'upi'    ? 'bg-blue-100 text-blue-700'    :
                            s.paymentMethod === 'udhaar' ? 'bg-orange-100 text-orange-700':
                            'bg-slate-100 text-slate-500'}`}>
                          {(s.paymentMethod || 'cash').toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="text-right ml-2">
                      <p className="font-bold text-blue-600">Rs.{s.total}</p>
                      {parseFloat(s.discountAmt) > 0 &&
                        <p className="text-xs text-green-600">-Rs.{parseFloat(s.discountAmt).toFixed(0)}</p>}
                    </div>
                  </div>
                  {/* Action buttons */}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {/* WhatsApp bill button */}
                    <button
                      onClick={() => openWhatsAppBill(s, s.customerPhone)}
                    <button
                      onClick={() => openWhatsAppBill(s, s.customerPhone)}
                      className="flex-1 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-bold">
                      📱 WhatsApp Bill
                    </button>
                    <button onClick={() => openEditSale(s)}
                      className="flex-1 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">
                      ✏️ Edit
                    </button>
                    <button onClick={() => deleteSale(s)}
                      className="flex-1 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold">
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Sale">
        <div className="space-y-4 pb-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Worker</label>
              <input value={editWorker} onChange={e => setEditWorker(e.target.value)} className="field-input"/>
            </div>
            <div>
              <label className="field-label">Customer</label>
              <input value={editCustomer} onChange={e => setEditCustomer(e.target.value)} className="field-input"/>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-xs font-bold text-slate-500 uppercase">Items</p>
            <button onClick={() => setEditRows(r => [...r, emptyRow()])}
              className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">+ Add</button>
          </div>
          {editRows.map(row => (
            <SaleRow key={row.id} row={row} products={products}
              onUpdate={(id,field,val) => setEditRows(r => r.map(x => x.id===id ? {...x,[field]:val} : x))}
              onRemove={() => setEditRows(r => r.filter(x => x.id !== row.id))}
              canRemove={editRows.length > 1}/>
          ))}
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">Discount</span>
            <div className="flex gap-2 items-center">
              <div className="flex bg-slate-200 rounded-lg p-0.5">
                {['pct','flat'].map(t => (
                  <button key={t} onClick={() => setEditDiscType(t)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold
                      ${editDiscType===t ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>
                    {t==='pct' ? '%' : 'Rs'}
                  </button>
                ))}
              </div>
              <input type="number" value={editDiscVal} onChange={e => setEditDiscVal(e.target.value)}
                placeholder="0" className="w-16 text-center px-2 py-1 border border-slate-200 rounded-lg text-sm outline-none"/>
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 flex justify-between items-center">
            <span className="font-bold">New Total</span>
            <span className="text-xl font-extrabold text-blue-600">Rs.{editTotal.toFixed(0)}</span>
          </div>
          <button onClick={saveEditedSale} disabled={editSaving}
            className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl disabled:opacity-50">
            {editSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </Modal>

      {/* Summary Modal */}
      <Modal isOpen={showSummary} onClose={() => setShowSummary(false)} title="Daily Summary">
        <div className="space-y-4 pb-6">
          <p className="text-xs text-slate-400 text-center">
            {new Date().toLocaleDateString('en-IN', {weekday:'long',day:'numeric',month:'long',year:'numeric'})}
          </p>
          <div className="bg-slate-900 rounded-2xl p-5 text-center">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Total Revenue</p>
            <p className="text-4xl font-extrabold text-white">Rs.{summary.revenue.toFixed(0)}</p>
            {summary.discountGiven > 0 &&
              <p className="text-green-400 text-xs mt-1">Rs.{summary.discountGiven.toFixed(0)} discount given</p>}
          </div>
          {/* Payment breakdown */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-green-700 font-extrabold">Rs.{summary.cashTotal.toFixed(0)}</p>
              <p className="text-green-500 text-xs mt-0.5">Cash</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-blue-700 font-extrabold">Rs.{summary.upiTotal.toFixed(0)}</p>
              <p className="text-blue-500 text-xs mt-0.5">UPI</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-3 text-center">
              <p className="text-orange-700 font-extrabold">Rs.{summary.udhaarTotal.toFixed(0)}</p>
              <p className="text-orange-500 text-xs mt-0.5">Udhaar</p>
            </div>
          </div>
          {/* Top products */}
          {summary.topProducts.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide px-4 py-3 border-b">Top Products</p>
              {summary.topProducts.map(([name,qty],i) => (
                <div key={name} className="flex justify-between px-4 py-2.5 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-extrabold">{i+1}</span>
                    <span className="text-sm font-semibold">{name}</span>
                  </div>
                  <span className="text-sm text-slate-500 font-bold">{qty} sold</span>
                </div>
              ))}
            </div>
          )}
          {/* By worker */}
          {Object.keys(summary.byWorker).length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide px-4 py-3 border-b">By Worker</p>
              {Object.entries(summary.byWorker).map(([name,amt]) => (
                <div key={name} className="flex justify-between px-4 py-2.5 border-b last:border-0">
                  <span className="text-sm font-semibold">{name}</span>
                  <span className="text-sm font-bold text-blue-600">Rs.{amt.toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <style>{`
        .field-label { display:block; font-size:0.72rem; font-weight:700; color:#64748b; margin-bottom:4px; }
        .field-input { width:100%; padding:10px 12px; border:1.5px solid #e2e8f0; border-radius:10px; font-size:0.875rem; outline:none; transition:border-color 0.2s; }
        .field-input:focus { border-color:#3b82f6; box-shadow:0 0 0 3px #dbeafe; }
      `}</style>
    </div>
  )
}

function SaleRow({ row, products, onUpdate, onRemove, canRemove }) {
  const selected = products.find(p => p.id === row.productId)
  return (
    <div className="flex gap-2 items-center bg-slate-50 border border-slate-200 rounded-xl p-2.5">
      <select value={row.productId} onChange={e => onUpdate(row.id,'productId',e.target.value)}
        className="flex-1 min-w-0 text-sm border border-slate-200 rounded-lg py-2 px-2.5 outline-none bg-white focus:border-blue-400">
        <option value="">-- Select --</option>
        {products.filter(p => p.stock > 0).map(p => (
          <option key={p.id} value={p.id}>{p.name} ({p.stock} {p.unit}s)</option>
        ))}
      </select>
      <input type="number" value={row.qty} onChange={e => onUpdate(row.id,'qty',e.target.value)}
        min="1" max={selected?.stock||9999}
        className="w-16 text-center border border-slate-200 rounded-lg py-2 px-1 text-sm outline-none bg-white focus:border-blue-400"/>
      <span className="text-xs text-slate-400 w-8 text-center flex-shrink-0">
        {selected ? selected.unit.slice(0,3) : ''}
      </span>
      {canRemove && (
        <button onClick={onRemove}
          className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 rounded-lg font-bold flex-shrink-0">
          x
        </button>
      )}
    </div>
  )
}
