/*
  Products.jsx — Add NEW medicines + view/search/delete
  
  FIXED:
  1. "Add Product" always adds NEW — no more accidental updates
  2. Separate "Update Stock" button for adding stock to existing medicine
  3. Multiple wholesalers per product supported
  4. iPhone-friendly expiry date (month dropdown + year input)
*/

import React, { useState, useMemo } from 'react'
import { useApp, useToast }          from '../App'
import { addProduct, updateProduct,
         deleteProduct, formatStock,
         stockStatus }               from '../firebase'
import Modal                         from '../components/Modal'
import StockBadge                    from '../components/StockBadge'

// Empty form for a brand new product
const EMPTY_NEW = {
  name:'', category:'Tablet / गोली', unit:'tablet',
  perStrip:'', stock:'', lowAlert:'',
  buyPrice:'', sellPrice:'', wholesalerId:'', expiryDate:'',
}

// Empty form for adding stock to existing product
const EMPTY_STOCK = {
  stripsToAdd:'', stock:'', buyPrice:'',
}

export default function Products() {
  const { products, wholesalers } = useApp()
  const showToast = useToast()

  // Modal modes: 'add' | 'stock' | null
  const [modalMode,  setModalMode]  = useState(null)
  const [newForm,    setNewForm]     = useState(EMPTY_NEW)
  const [stockForm,  setStockForm]   = useState(EMPTY_STOCK)
  const [selectedP,  setSelectedP]   = useState(null)  // product being restocked
  const [filter,     setFilter]      = useState('all')
  const [search,     setSearch]      = useState('')
  const [saving,     setSaving]      = useState(false)

  const isTablet = newForm.unit === 'tablet' || newForm.unit === 'capsule'

  // Filtered list
  const filtered = useMemo(() => products.filter(p => {
    const matchQ = p.name.toLowerCase().includes(search.toLowerCase()) ||
                   (p.category||'').toLowerCase().includes(search.toLowerCase())
    const matchF = filter === 'all' || filter === stockStatus(p)
    return matchQ && matchF
  }), [products, search, filter])

  // Expiry helpers
  const expiryMonth = newForm.expiryDate ? (newForm.expiryDate.split('/')[0] || '') : ''
  const expiryYear  = newForm.expiryDate ? (newForm.expiryDate.split('/')[1] || '') : ''
  const setExpiryMonth = m => setNewForm({...newForm, expiryDate: `${m}/${expiryYear}`})
  const setExpiryYear  = y => setNewForm({...newForm, expiryDate: `${expiryMonth}/${y.replace(/\D/g,'').slice(0,4)}`})

  // ── Save NEW product ──
  async function handleAddNew() {
    if (!newForm.name.trim()) { showToast('Enter medicine name', 'error'); return }
    setSaving(true)
    try {
      const w        = wholesalers.find(x => x.id === newForm.wholesalerId)
      const perStrip = parseInt(newForm.perStrip) || 1
      const stock    = isTablet
        ? Math.round((parseFloat(newForm.stock) || 0) * perStrip)
        : parseInt(newForm.stock) || 0

      await addProduct({
        name:           newForm.name.trim(),
        category:       newForm.category,
        unit:           newForm.unit,
        perStrip:       isTablet ? perStrip : 1,
        stock,
        lowAlert:       parseInt(newForm.lowAlert) || (isTablet ? 20 : 5),
        buyPrice:       parseFloat(newForm.buyPrice)  || 0,
        sellPrice:      parseFloat(newForm.sellPrice) || 0,
        wholesalerId:   newForm.wholesalerId || '',
        wholesalerName: w ? w.name : '',
        expiryDate:     newForm.expiryDate || '',
      })
      showToast('✅ Product added!')
      setModalMode(null)
      setNewForm(EMPTY_NEW)
    } catch (e) { showToast('Error: ' + e.message, 'error') }
    finally     { setSaving(false) }
  }

  // ── Add stock to existing product ──
  async function handleAddStock() {
    if (!selectedP) return
    setSaving(true)
    try {
      const perStrip   = selectedP.perStrip || 1
      const isTab      = selectedP.unit === 'tablet' || selectedP.unit === 'capsule'
      const addQty     = isTab
        ? Math.round((parseFloat(stockForm.stripsToAdd) || 0) * perStrip)
        : parseInt(stockForm.stock) || 0
      const w          = wholesalers.find(x => x.id === stockForm.wholesalerId)

      await updateProduct(selectedP.id, {
        stock:          (selectedP.stock || 0) + addQty,
        buyPrice:       parseFloat(stockForm.buyPrice) || selectedP.buyPrice || 0,
        wholesalerId:   stockForm.wholesalerId   || selectedP.wholesalerId   || '',
        wholesalerName: w ? w.name : (selectedP.wholesalerName || ''),
      })
      showToast(`✅ +${addQty} ${isTab ? 'tablets' : 'units'} added to ${selectedP.name}`)
      setModalMode(null)
    } catch (e) { showToast('Error: ' + e.message, 'error') }
    finally     { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this product?')) return
    try { await deleteProduct(id); showToast('🗑️ Deleted') }
    catch (e) { showToast('Error', 'error') }
  }

  return (
    <div className="page-enter">

      {/* HEADER */}
      <div className="bg-gradient-to-br from-blue-900 to-blue-600 text-white px-5 pt-12 pb-6">
        <h1 className="text-2xl font-extrabold">Products 📦</h1>
        <p className="text-blue-200 text-sm mt-1">उत्पाद — {products.length} total</p>
      </div>

      <div className="px-4 pt-4 space-y-3">

        {/* Add NEW product button */}
        <button onClick={() => { setNewForm(EMPTY_NEW); setModalMode('add') }}
          className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-blue-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
          ➕ Add New Medicine / नई दवाई जोड़ें
        </button>

        {/* Search */}
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search medicine... / दवाई खोजें..."
            className="w-full pl-9 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
        </div>

        {/* Filter pills */}
        <div className="flex gap-2">
          {[{key:'all',label:'All'},{key:'low',label:'⚠️ Low'},{key:'out',label:'🚫 Out'}].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all
                ${filter===f.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Product list */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <div className="text-4xl mb-3">💊</div>
            <p className="font-medium">No products found</p>
            <p className="text-sm mt-1">Tap "Add New Medicine" to get started</p>
          </div>
        ) : filtered.map(p => {
          const status  = stockStatus(p)
          const barClr  = status === 'out' ? 'bg-red-400' : status === 'low' ? 'bg-amber-400' : 'bg-green-400'
          return (
            <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 flex overflow-hidden">
              <div className={`w-1 ${barClr} flex-shrink-0`} />
              <div className="flex-1 p-4">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm">{p.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {p.category}
                      {p.sellPrice ? ` · ₹${p.sellPrice}/${p.unit}` : ''}
                      {p.wholesalerName ? ` · 🏪 ${p.wholesalerName}` : ''}
                      {p.expiryDate ? ` · Exp: ${p.expiryDate}` : ''}
                    </p>
                    <p className="text-sm font-semibold text-slate-700 mt-2">📦 {formatStock(p)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <StockBadge product={p} showCount={false} />
                    <div className="flex gap-1.5">
                      {/* Add stock button */}
                      <button onClick={() => { setSelectedP(p); setStockForm({...EMPTY_STOCK, wholesalerId: p.wholesalerId||'', buyPrice: p.buyPrice||''}); setModalMode('stock') }}
                        className="px-2 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-semibold">
                        +Stock
                      </button>
                      <button onClick={() => handleDelete(p.id)}
                        className="px-2 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-semibold">
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── ADD NEW PRODUCT MODAL ── */}
      <Modal isOpen={modalMode==='add'} onClose={() => setModalMode(null)} title="➕ Add New Medicine">
        <div className="space-y-4 pb-4">

          <div>
            <label className="field-label">Medicine Name *</label>
            <input value={newForm.name} onChange={e => setNewForm({...newForm, name: e.target.value})}
              placeholder="e.g. Paracetamol 500mg" className="field-input" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Category</label>
              <select value={newForm.category} onChange={e => setNewForm({...newForm, category: e.target.value})} className="field-input">
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
              <label className="field-label">Sell Unit</label>
              <select value={newForm.unit} onChange={e => setNewForm({...newForm, unit: e.target.value})} className="field-input">
                <option value="tablet">Tablet</option>
                <option value="capsule">Capsule</option>
                <option value="bottle">Bottle</option>
                <option value="piece">Piece</option>
                <option value="pack">Pack</option>
                <option value="strip">Strip (whole)</option>
              </select>
            </div>
          </div>

          {/* Strip settings for tablet/capsule */}
          {isTablet ? (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-blue-700 uppercase">📦 Strip Settings</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Tablets per Strip *</label>
                  <input type="number" value={newForm.perStrip} onChange={e => setNewForm({...newForm, perStrip: e.target.value})} placeholder="e.g. 10" className="field-input" />
                </div>
                <div>
                  <label className="field-label">Initial Strips</label>
                  <input type="number" value={newForm.stock} onChange={e => setNewForm({...newForm, stock: e.target.value})} placeholder="e.g. 5" className="field-input" />
                </div>
              </div>
              {newForm.perStrip && newForm.stock && (
                <p className="text-xs text-blue-600 font-medium">
                  = {Math.round(parseFloat(newForm.stock||0) * parseInt(newForm.perStrip||1))} tablets total
                </p>
              )}
              <div>
                <label className="field-label">Low Stock Alert (tablets)</label>
                <input type="number" value={newForm.lowAlert} onChange={e => setNewForm({...newForm, lowAlert: e.target.value})} placeholder="e.g. 20" className="field-input" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Initial Stock</label>
                <input type="number" value={newForm.stock} onChange={e => setNewForm({...newForm, stock: e.target.value})} placeholder="e.g. 20" className="field-input" />
              </div>
              <div>
                <label className="field-label">Low Stock Alert</label>
                <input type="number" value={newForm.lowAlert} onChange={e => setNewForm({...newForm, lowAlert: e.target.value})} placeholder="e.g. 5" className="field-input" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Buy Price ₹</label>
              <input type="number" value={newForm.buyPrice} onChange={e => setNewForm({...newForm, buyPrice: e.target.value})} placeholder="25" className="field-input" />
            </div>
            <div>
              <label className="field-label">Sell Price ₹ / unit</label>
              <input type="number" value={newForm.sellPrice} onChange={e => setNewForm({...newForm, sellPrice: e.target.value})} placeholder="2" className="field-input" />
            </div>
          </div>

          {/* Expiry date — iPhone friendly */}
          <div>
            <label className="field-label">Expiry Date / समाप्ति तिथि</label>
            <div className="grid grid-cols-2 gap-3">
              <select value={expiryMonth} onChange={e => setExpiryMonth(e.target.value)} className="field-input">
                <option value="">Month</option>
                {['01 Jan','02 Feb','03 Mar','04 Apr','05 May','06 Jun','07 Jul','08 Aug','09 Sep','10 Oct','11 Nov','12 Dec'].map(m => (
                  <option key={m} value={m.slice(0,2)}>{m}</option>
                ))}
              </select>
              <input type="number" value={expiryYear} onChange={e => setExpiryYear(e.target.value)}
                placeholder="2026" min="2024" max="2035" inputMode="numeric" className="field-input" />
            </div>
            <p className="text-xs text-slate-400 mt-1">Leave blank if no expiry</p>
          </div>

          {/* Wholesaler */}
          <div>
            <label className="field-label">Wholesaler (optional)</label>
            <select value={newForm.wholesalerId} onChange={e => setNewForm({...newForm, wholesalerId: e.target.value})} className="field-input">
              <option value="">-- Select --</option>
              {wholesalers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          <button onClick={handleAddNew} disabled={saving}
            className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl disabled:opacity-50 active:scale-[0.98]">
            {saving ? '⏳ Saving...' : '💾 Add Medicine'}
          </button>
        </div>
      </Modal>

      {/* ── ADD STOCK TO EXISTING MODAL ── */}
      <Modal isOpen={modalMode==='stock'} onClose={() => setModalMode(null)}
        title={`📦 Add Stock — ${selectedP?.name}`}>
        <div className="space-y-4 pb-4">

          {/* Current stock info */}
          {selectedP && (
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 font-semibold">Current Stock</p>
              <p className="text-xl font-extrabold text-blue-600 mt-1">{formatStock(selectedP)}</p>
              {selectedP.expiryDate && <p className="text-xs text-slate-400 mt-1">Exp: {selectedP.expiryDate}</p>}
            </div>
          )}

          {/* Strips or qty */}
          {(selectedP?.unit === 'tablet' || selectedP?.unit === 'capsule') ? (
            <div>
              <label className="field-label">
                Strips to Add (1 strip = {selectedP?.perStrip || '?'} tablets)
              </label>
              <input type="number" value={stockForm.stripsToAdd}
                onChange={e => setStockForm({...stockForm, stripsToAdd: e.target.value})}
                placeholder="e.g. 10" className="field-input" />
              {stockForm.stripsToAdd && selectedP?.perStrip && (
                <p className="text-xs text-blue-600 mt-1 font-medium">
                  = {Math.round(parseFloat(stockForm.stripsToAdd) * selectedP.perStrip)} tablets will be added
                </p>
              )}
            </div>
          ) : (
            <div>
              <label className="field-label">Quantity to Add</label>
              <input type="number" value={stockForm.stock}
                onChange={e => setStockForm({...stockForm, stock: e.target.value})}
                placeholder="e.g. 20" className="field-input" />
            </div>
          )}

          {/* Buy price this time — can be different wholesaler */}
          <div>
            <label className="field-label">Buy Price ₹ this time</label>
            <input type="number" value={stockForm.buyPrice}
              onChange={e => setStockForm({...stockForm, buyPrice: e.target.value})}
              placeholder={selectedP?.buyPrice || '25'} className="field-input" />
          </div>

          {/* Can select DIFFERENT wholesaler this time */}
          <div>
            <label className="field-label">Wholesaler this time (can be different)</label>
            <select value={stockForm.wholesalerId}
              onChange={e => setStockForm({...stockForm, wholesalerId: e.target.value})}
              className="field-input">
              <option value="">-- Same as before --</option>
              {wholesalers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          <button onClick={handleAddStock} disabled={saving}
            className="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl disabled:opacity-50 active:scale-[0.98]">
            {saving ? '⏳ Adding...' : '✅ Add Stock'}
          </button>
        </div>
      </Modal>

      <style>{`
        .field-label{display:block;font-size:.72rem;font-weight:700;color:#64748b;margin-bottom:4px}
        .field-input{width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:.875rem;outline:none;background:white}
        .field-input:focus{border-color:#3b82f6;box-shadow:0 0 0 3px #dbeafe}
      `}</style>
    </div>
  )
}
