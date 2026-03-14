/*
  Sell.jsx — Record a sale
  
  FEATURES:
  - Worker name field
  - Add multiple items
  - Discount (% or flat Rs)
  - Edit / Delete today's sales
  - Deleting a sale restores stock automatically
  - Low stock sound + vibration alert after sale
  - Daily sales summary button
*/

import React, { useState, useMemo }        from 'react'
import { useApp, useToast }                 from '../App'
import { addSale, updateProduct, db }       from '../firebase'
import { doc, deleteDoc, updateDoc,
         getDoc, writeBatch }               from 'firebase/firestore'
import Modal                                from '../components/Modal'

const emptyRow = () => ({ id: Date.now() + Math.random(), productId: '', qty: 1 })

// ── Play a beep sound for low stock alert ──
function playLowStockAlert() {
  try {
    // Create a simple beep using Web Audio API (no external files needed)
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880  // high pitch beep
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.5)
  } catch (e) {
    // Audio not supported — silent fail
  }

  // Vibrate on mobile (Android supports this)
  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200]) // vibrate pattern
  }
}

export default function Sell() {
  const { products, todaySales } = useApp()
  const showToast = useToast()

  // Sale form state
  const [workerName,     setWorkerName]     = useState('')
  const [customer,       setCustomer]       = useState('')
  const [rows,           setRows]           = useState([emptyRow()])
  const [discountType,   setDiscountType]   = useState('pct')
  const [discountVal,    setDiscountVal]    = useState('')
  const [saving,         setSaving]         = useState(false)

  // Edit sale modal
  const [editSale,       setEditSale]       = useState(null)  // sale being edited
  const [showEditModal,  setShowEditModal]  = useState(false)
  const [editRows,       setEditRows]       = useState([])
  const [editCustomer,   setEditCustomer]   = useState('')
  const [editWorker,     setEditWorker]     = useState('')
  const [editDiscType,   setEditDiscType]   = useState('pct')
  const [editDiscVal,    setEditDiscVal]    = useState('')
  const [editSaving,     setEditSaving]     = useState(false)

  // Daily summary modal
  const [showSummary,    setShowSummary]    = useState(false)

  // ── Subtotal ──
  const subtotal = useMemo(() => rows.reduce((sum, row) => {
    const p = products.find(x => x.id === row.productId)
    return sum + (parseFloat(p?.sellPrice || 0) * parseFloat(row.qty || 0))
  }, 0), [rows, products])

  const discountAmt = useMemo(() => {
    const v = parseFloat(discountVal) || 0
    return discountType === 'pct'
      ? Math.min(subtotal * v / 100, subtotal)
      : Math.min(v, subtotal)
  }, [discountVal, discountType, subtotal])

  const total = Math.max(0, subtotal - discountAmt)

  // ── Edit modal subtotal ──
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

  // ── Row helpers ──
  const addRow    = ()    => setRows(r => [...r, emptyRow()])
  const removeRow = (id)  => setRows(r => r.filter(x => x.id !== id))
  const updateRow = (id, field, value) =>
    setRows(r => r.map(x => x.id === id ? { ...x, [field]: value } : x))

  // ── Complete sale ──
  async function completeSale() {
    const validRows = rows.filter(r => r.productId && parseFloat(r.qty) > 0)
    if (validRows.length === 0) { showToast('Add at least one item', 'warning'); return }

    // Check stock for each item
    for (const row of validRows) {
      const p   = products.find(x => x.id === row.productId)
      const qty = parseFloat(row.qty)
      if (!p) continue
      if (qty > p.stock) {
        showToast(`Not enough stock: ${p.name} (only ${p.stock} left)`, 'error')
        return
      }
    }

    setSaving(true)
    try {
      // Batch write — deduct stock for all items atomically
      const batch = writeBatch(db)
      const items = validRows.map(row => {
        const p = products.find(x => x.id === row.productId)
        batch.update(doc(db, 'products', p.id), { stock: p.stock - parseFloat(row.qty) })
        return {
          productId: p.id,
          name:      p.name,
          qty:       parseFloat(row.qty),
          unit:      p.unit,
          price:     p.sellPrice || 0,
          total:     parseFloat(row.qty) * (p.sellPrice || 0),
        }
      })
      await batch.commit()

      // Save sale record
      await addSale({
        workerName:   workerName.trim() || 'Unknown',
        customer:     customer.trim()   || 'Customer',
        items,
        subtotal:     subtotal.toFixed(2),
        discountType,
        discountVal:  parseFloat(discountVal) || 0,
        discountAmt:  discountAmt.toFixed(2),
        total:        total.toFixed(0),
        date:         new Date().toISOString(),
      })

      showToast(`Sale done! Rs.${total.toFixed(0)}${discountAmt > 0 ? ` (saved Rs.${discountAmt.toFixed(0)})` : ''}`)

      // Check if any sold item is now low stock → alert!
      const lowItems = validRows.filter(row => {
        const p = products.find(x => x.id === row.productId)
        if (!p) return false
        const newStock = p.stock - parseFloat(row.qty)
        return newStock <= (p.lowAlert || 10) && newStock >= 0
      })

      if (lowItems.length > 0) {
        const names = lowItems.map(r => products.find(x => x.id === r.productId)?.name).join(', ')
        playLowStockAlert()
        setTimeout(() => showToast(`Low stock alert: ${names}`, 'warning'), 500)
      }

      // Reset form
      setCustomer('')
      setRows([emptyRow()])
      setDiscountVal('')

    } catch (err) {
      showToast('Error: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Open edit modal for a sale ──
  function openEditSale(sale) {
    setEditSale(sale)
    setEditCustomer(sale.customer || '')
    setEditWorker(sale.workerName || '')
    setEditDiscType(sale.discountType || 'pct')
    setEditDiscVal(sale.discountVal || '')
    // Convert sale items back to editable rows
    setEditRows(sale.items.map(item => ({
      id:        Math.random(),
      productId: item.productId,
      qty:       item.qty,
    })))
    setShowEditModal(true)
  }

  // ── Save edited sale ──
  async function saveEditedSale() {
    const validRows = editRows.filter(r => r.productId && parseFloat(r.qty) > 0)
    if (validRows.length === 0) { showToast('Add at least one item', 'warning'); return }

    setEditSaving(true)
    try {
      const batch = writeBatch(db)

      // Step 1: Restore stock from OLD sale items
      for (const oldItem of editSale.items) {
        const pRef = doc(db, 'products', oldItem.productId)
        const pSnap = await getDoc(pRef)
        if (pSnap.exists()) {
          batch.update(pRef, { stock: pSnap.data().stock + oldItem.qty })
        }
      }

      // Step 2: Deduct stock for NEW sale items
      const newItems = []
      for (const row of validRows) {
        const p = products.find(x => x.id === row.productId)
        if (!p) continue
        // Get fresh stock value (after restore above)
        batch.update(doc(db, 'products', p.id), {
          stock: p.stock + (editSale.items.find(i => i.productId === p.id)?.qty || 0) - parseFloat(row.qty)
        })
        newItems.push({
          productId: p.id,
          name:      p.name,
          qty:       parseFloat(row.qty),
          unit:      p.unit,
          price:     p.sellPrice || 0,
          total:     parseFloat(row.qty) * (p.sellPrice || 0),
        })
      }

      await batch.commit()

      // Step 3: Update sale record
      await updateDoc(doc(db, 'sales', editSale.id), {
        workerName:  editWorker.trim() || 'Unknown',
        customer:    editCustomer.trim() || 'Customer',
        items:       newItems,
        subtotal:    editSubtotal.toFixed(2),
        discountType: editDiscType,
        discountVal:  parseFloat(editDiscVal) || 0,
        discountAmt:  editDiscAmt.toFixed(2),
        total:        editTotal.toFixed(0),
        editedAt:     new Date().toISOString(),
      })

      showToast('Sale updated!')
      setShowEditModal(false)
    } catch (err) {
      showToast('Error updating: ' + err.message, 'error')
    } finally {
      setEditSaving(false)
    }
  }

  // ── Delete a sale + restore stock ──
  async function deleteSale(sale) {
    if (!confirm(`Delete this sale? Stock will be restored automatically.`)) return
    try {
      const batch = writeBatch(db)

      // Restore stock for each item in the sale
      for (const item of sale.items) {
        const pRef  = doc(db, 'products', item.productId)
        const pSnap = await getDoc(pRef)
        if (pSnap.exists()) {
          // Add back the qty that was sold
          batch.update(pRef, { stock: pSnap.data().stock + item.qty })
        }
      }

      // Delete the sale record
      batch.delete(doc(db, 'sales', sale.id))
      await batch.commit()

      showToast('Sale deleted & stock restored!')
    } catch (err) {
      showToast('Error deleting: ' + err.message, 'error')
    }
  }

  // ── Daily summary data ──
  const summary = useMemo(() => {
    const revenue       = todaySales.reduce((s, x) => s + parseFloat(x.total || 0), 0)
    const discountGiven = todaySales.reduce((s, x) => s + parseFloat(x.discountAmt || 0), 0)
    const itemCount     = todaySales.reduce((s, x) => s + (x.items || []).reduce((a, i) => a + i.qty, 0), 0)
    // Top selling products today
    const productCount  = {}
    todaySales.forEach(sale => {
      (sale.items || []).forEach(item => {
        productCount[item.name] = (productCount[item.name] || 0) + item.qty
      })
    })
    const topProducts = Object.entries(productCount).sort((a,b) => b[1]-a[1]).slice(0,5)
    return { revenue, discountGiven, itemCount, topProducts }
  }, [todaySales])

  return (
    <div className="page-enter">

      {/* ── HEADER ── */}
      <div className="bg-gradient-to-br from-blue-900 to-blue-600 text-white px-5 pt-12 pb-6">
        <h1 className="text-2xl font-extrabold">New Sale</h1>
        <p className="text-blue-200 text-sm mt-1">Record a sale / बिक्री दर्ज करें</p>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* ── SELL CARD ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">

          {/* Worker name — who is making this sale */}
          <div>
            <label className="field-label">
              Worker Name / कर्मचारी का नाम
              <span className="text-slate-300 font-normal ml-1">(required)</span>
            </label>
            <input
              value={workerName}
              onChange={e => setWorkerName(e.target.value)}
              placeholder="e.g. Ramesh, Suresh..."
              className="field-input"
            />
          </div>

          {/* Customer name */}
          <div>
            <label className="field-label">
              Customer Name / ग्राहक का नाम
              <span className="text-slate-300 font-normal ml-1">(optional)</span>
            </label>
            <input
              value={customer}
              onChange={e => setCustomer(e.target.value)}
              placeholder="e.g. Ramesh ji..."
              className="field-input"
            />
          </div>

          {/* Items */}
          <div className="flex justify-between items-center">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Items / सामान</p>
            <button onClick={addRow}
              className="text-xs font-bold text-blue-600 bg-blue-50
                         hover:bg-blue-100 px-3 py-1.5 rounded-lg">
              + Add Item
            </button>
          </div>

          <div className="space-y-2">
            {rows.map(row => (
              <SaleRow
                key={row.id}
                row={row}
                products={products}
                onUpdate={updateRow}
                onRemove={() => removeRow(row.id)}
                canRemove={rows.length > 1}
              />
            ))}
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
                <input
                  type="number" value={discountVal}
                  onChange={e => setDiscountVal(e.target.value)}
                  placeholder="0"
                  className="w-16 text-center px-2 py-1 border border-slate-200
                             rounded-lg text-sm font-bold outline-none
                             focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                />
              </div>
            </div>
            {discountAmt > 0 && (
              <div className="flex justify-between text-sm text-green-600 font-semibold">
                <span>You save</span>
                <span>- Rs.{discountAmt.toFixed(0)}</span>
              </div>
            )}
            <div className="border-t border-dashed border-slate-200 pt-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800">Total</span>
                <span className="text-2xl font-extrabold text-blue-600">Rs.{total.toFixed(0)}</span>
              </div>
            </div>
          </div>

          <button onClick={completeSale} disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                       text-white font-bold py-4 rounded-xl text-lg
                       shadow-lg shadow-blue-200 active:scale-[0.98] transition-all">
            {saving ? 'Processing...' : 'Complete Sale'}
          </button>
        </div>

        {/* ── TODAY'S LOG ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
            <div>
              <p className="font-bold text-sm text-slate-800">Today's Sales Log</p>
              <p className="text-xs text-slate-400">{todaySales.length} sales · Rs.{summary.revenue.toFixed(0)} total</p>
            </div>
            {/* Daily summary button */}
            <button onClick={() => setShowSummary(true)}
              className="text-xs font-bold text-blue-600 bg-blue-50
                         hover:bg-blue-100 px-3 py-1.5 rounded-lg">
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
                      {/* Show which worker made this sale */}
                      <p className="text-xs text-blue-400 mt-0.5">
                        by {s.workerName || 'Unknown'}
                        {s.editedAt && <span className="text-amber-400 ml-1">(edited)</span>}
                      </p>
                    </div>
                    <div className="text-right ml-2">
                      <p className="font-bold text-blue-600">Rs.{s.total}</p>
                      {parseFloat(s.discountAmt) > 0 &&
                        <p className="text-xs text-green-600">-Rs.{parseFloat(s.discountAmt).toFixed(0)}</p>}
                    </div>
                  </div>
                  {/* Edit / Delete buttons */}
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => openEditSale(s)}
                      className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200
                                 text-slate-600 rounded-lg text-xs font-bold">
                      Edit
                    </button>
                    <button onClick={() => deleteSale(s)}
                      className="flex-1 py-1.5 bg-red-50 hover:bg-red-100
                                 text-red-600 rounded-lg text-xs font-bold">
                      Delete + Restore Stock
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── EDIT SALE MODAL ── */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Sale">
        <div className="space-y-4 pb-4">
          <div>
            <label className="field-label">Worker Name</label>
            <input value={editWorker} onChange={e => setEditWorker(e.target.value)}
              className="field-input" placeholder="Worker name"/>
          </div>
          <div>
            <label className="field-label">Customer Name</label>
            <input value={editCustomer} onChange={e => setEditCustomer(e.target.value)}
              className="field-input" placeholder="Customer name"/>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-xs font-bold text-slate-500 uppercase">Items</p>
            <button onClick={() => setEditRows(r => [...r, emptyRow()])}
              className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
              + Add
            </button>
          </div>

          {editRows.map(row => (
            <SaleRow key={row.id} row={row} products={products}
              onUpdate={(id, field, val) =>
                setEditRows(r => r.map(x => x.id === id ? { ...x, [field]: val } : x))}
              onRemove={() => setEditRows(r => r.filter(x => x.id !== row.id))}
              canRemove={editRows.length > 1}
            />
          ))}

          {/* Discount */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">Discount</span>
            <div className="flex gap-2 items-center">
              <div className="flex bg-slate-200 rounded-lg p-0.5">
                {['pct','flat'].map(t => (
                  <button key={t} onClick={() => setEditDiscType(t)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold
                      ${editDiscType === t ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>
                    {t === 'pct' ? '%' : 'Rs'}
                  </button>
                ))}
              </div>
              <input type="number" value={editDiscVal}
                onChange={e => setEditDiscVal(e.target.value)}
                placeholder="0"
                className="w-16 text-center px-2 py-1 border border-slate-200
                           rounded-lg text-sm outline-none"/>
            </div>
          </div>

          {/* Total */}
          <div className="bg-slate-50 rounded-xl p-3 flex justify-between items-center">
            <span className="font-bold">New Total</span>
            <span className="text-xl font-extrabold text-blue-600">Rs.{editTotal.toFixed(0)}</span>
          </div>

          <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl">
            Stock will be automatically recalculated when you save.
          </p>

          <button onClick={saveEditedSale} disabled={editSaving}
            className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl
                       disabled:opacity-50 active:scale-[0.98]">
            {editSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </Modal>

      {/* ── DAILY SUMMARY MODAL ── */}
      <Modal isOpen={showSummary} onClose={() => setShowSummary(false)} title="Daily Summary">
        <div className="space-y-4 pb-6">
          <p className="text-xs text-slate-400 text-center">
            {new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          </p>

          {/* Revenue */}
          <div className="bg-slate-900 rounded-2xl p-5 text-center">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Total Revenue</p>
            <p className="text-4xl font-extrabold text-white">Rs.{summary.revenue.toFixed(0)}</p>
            {summary.discountGiven > 0 &&
              <p className="text-green-400 text-xs mt-2">Rs.{summary.discountGiven.toFixed(0)} discount given</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-blue-600 text-2xl font-extrabold">{todaySales.length}</p>
              <p className="text-blue-400 text-xs mt-1">Total Sales</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <p className="text-green-600 text-2xl font-extrabold">{summary.itemCount}</p>
              <p className="text-green-400 text-xs mt-1">Items Sold</p>
            </div>
          </div>

          {/* Top products */}
          {summary.topProducts.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide px-4 py-3 border-b border-slate-100">
                Top Products Today
              </p>
              {summary.topProducts.map(([name, qty], i) => (
                <div key={name} className="flex justify-between items-center px-4 py-2.5
                                           border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full
                                     flex items-center justify-center text-xs font-extrabold">
                      {i+1}
                    </span>
                    <span className="text-sm font-semibold text-slate-700">{name}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-500">{qty} sold</span>
                </div>
              ))}
            </div>
          )}

          {/* Per worker summary */}
          {(() => {
            const byWorker = {}
            todaySales.forEach(s => {
              const w = s.workerName || 'Unknown'
              byWorker[w] = (byWorker[w] || 0) + parseFloat(s.total || 0)
            })
            return Object.keys(byWorker).length > 0 && (
              <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide px-4 py-3 border-b border-slate-100">
                  Sales by Worker
                </p>
                {Object.entries(byWorker).map(([name, amt]) => (
                  <div key={name} className="flex justify-between px-4 py-2.5
                                              border-b border-slate-50 last:border-0">
                    <span className="text-sm font-semibold text-slate-700">{name}</span>
                    <span className="text-sm font-bold text-blue-600">Rs.{amt.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )
          })()}
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

// ── Individual sale item row ──
function SaleRow({ row, products, onUpdate, onRemove, canRemove }) {
  const selected = products.find(p => p.id === row.productId)
  return (
    <div className="flex gap-2 items-center bg-slate-50 border border-slate-200 rounded-xl p-2.5">
      <select value={row.productId}
        onChange={e => onUpdate(row.id, 'productId', e.target.value)}
        className="flex-1 min-w-0 text-sm border border-slate-200 rounded-lg
                   py-2 px-2.5 outline-none bg-white focus:border-blue-400">
        <option value="">-- Select --</option>
        {products.filter(p => p.stock > 0).map(p => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.stock} {p.unit}s)
          </option>
        ))}
      </select>
      <input type="number" value={row.qty}
        onChange={e => onUpdate(row.id, 'qty', e.target.value)}
        min="1" max={selected?.stock || 9999}
        className="w-16 text-center border border-slate-200 rounded-lg
                   py-2 px-1 text-sm outline-none bg-white focus:border-blue-400"/>
      <span className="text-xs text-slate-400 w-8 text-center flex-shrink-0">
        {selected ? selected.unit.slice(0,3) : ''}
      </span>
      {canRemove && (
        <button onClick={onRemove}
          className="w-8 h-8 flex items-center justify-center
                     bg-red-50 text-red-500 rounded-lg font-bold flex-shrink-0">
          x
        </button>
      )}
    </div>
  )
}
