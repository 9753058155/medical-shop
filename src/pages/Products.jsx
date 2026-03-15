/*
  Products.jsx — Add, edit, search, delete medicines
  Features: autocomplete search, strip/tablet tracking, real-time sync
*/

import React, { useState, useMemo, useRef } from 'react'
import { useApp, useToast } from '../App'
import { addProduct, updateProduct, deleteProduct, formatStock, stockStatus, expiryStatus, daysUntilExpiry } from '../firebase'
import Modal from '../components/Modal'
import StockBadge from '../components/StockBadge'

// Empty form state
const EMPTY_FORM = {
  name: '', category: 'Tablet / गोली', unit: 'tablet',
  perStrip: '', stripsToAdd: '', stock: '',
  lowAlert: '', buyPrice: '', sellPrice: '',
  wholesalerId: '', wholesalerName: '', expiryDate: '',
}

export default function Products() {
  const { products, wholesalers } = useApp()
  const showToast = useToast()

  const [showModal,  setShowModal]  = useState(false)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [editId,     setEditId]     = useState(null)   // null = adding new
  const [filter,     setFilter]     = useState('all')  // 'all' | 'low' | 'out'
  const [search,     setSearch]     = useState('')
  const [saving,     setSaving]     = useState(false)

  // Autocomplete state
  const [acQuery,    setAcQuery]    = useState('')
  const [acResults,  setAcResults]  = useState([])
  const [acOpen,     setAcOpen]     = useState(false)
  const acRef = useRef(null)

  // ── Derived: filtered product list ──
  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchQ = p.name.toLowerCase().includes(search.toLowerCase()) ||
                     (p.category || '').toLowerCase().includes(search.toLowerCase())
      const status = stockStatus(p)
      const matchF = filter === 'all' || filter === status
      return matchQ && matchF
    })
  }, [products, search, filter])

  const isTabletUnit = form.unit === 'tablet' || form.unit === 'capsule'

  // ── Open ADD modal ──
  function openAdd() {
    setForm(EMPTY_FORM)
    setEditId(null)
    setAcQuery('')
    setAcResults([])
    setShowModal(true)
  }

  // ── Open EDIT modal ──
  function openEdit(product) {
    setForm({
      name:            product.name         || '',
      category:        product.category     || 'Tablet / गोली',
      unit:            product.unit         || 'tablet',
      perStrip:        product.perStrip     || '',
      stripsToAdd:     '',   // always blank — user enters what to ADD
      stock:           '',   // same
      lowAlert:        product.lowAlert     || '',
      buyPrice:        product.buyPrice     || '',
      sellPrice:       product.sellPrice    || '',
      wholesalerId:    product.wholesalerId || '',
      expiryDate:      product.expiryDate || '',
      wholesalerName:  product.wholesalerName || '',
    })
    setEditId(product.id)
    setAcQuery('')
    setShowModal(true)
  }

  // ── Autocomplete: filter products by typed name ──
  function handleAcInput(val) {
    setAcQuery(val)
    if (val.trim().length < 1) { setAcResults([]); setAcOpen(false); return }
    const matches = products.filter(p => p.name.toLowerCase().includes(val.toLowerCase())).slice(0, 8)
    setAcResults(matches)
    setAcOpen(matches.length > 0)
  }

  // ── User picks a product from autocomplete ──
  function selectProduct(product) {
    setForm({
      name:           product.name          || '',
      category:       product.category      || 'Tablet / गोली',
      unit:           product.unit          || 'tablet',
      perStrip:       product.perStrip      || '',
      stripsToAdd:    '',
      stock:          '',
      lowAlert:       product.lowAlert      || '',
      buyPrice:       product.buyPrice      || '',
      sellPrice:      product.sellPrice     || '',
      wholesalerId:   product.wholesalerId  || '',
      wholesalerName: product.wholesalerName || '',
    })
    setEditId(product.id)
    setAcQuery(product.name)
    setAcOpen(false)
    showToast(`📦 ${product.name} selected — enter stock to add`)
  }

  // ── Save product to Firebase ──
  async function handleSave() {
    if (!form.name.trim()) { showToast('⚠️ Enter medicine name', 'error'); return }
    setSaving(true)

    try {
      const w      = wholesalers.find(x => x.id === form.wholesalerId)
      const isTab  = form.unit === 'tablet' || form.unit === 'capsule'
      const perStrip = parseInt(form.perStrip) || 1

      // Calculate how many units to ADD
      let stockToAdd = 0
      if (isTab) {
        stockToAdd = Math.round((parseFloat(form.stripsToAdd) || 0) * perStrip)
      } else {
        stockToAdd = parseInt(form.stock) || 0
      }

      const data = {
        name:           form.name.trim(),
        category:       form.category,
        unit:           form.unit,
        perStrip:       isTab ? perStrip : 1,
        lowAlert:       parseInt(form.lowAlert) || (isTab ? 20 : 5),
        buyPrice:       parseFloat(form.buyPrice)  || 0,
        sellPrice:      parseFloat(form.sellPrice) || 0,
        wholesalerId:   form.wholesalerId  || '',
        wholesalerName: w ? w.name : '',
        expiryDate:     form.expiryDate || '',
      }

      if (editId) {
        // Get current stock and ADD to it
        const existing = products.find(p => p.id === editId)
        data.stock = (existing?.stock || 0) + stockToAdd
        await updateProduct(editId, data)
        showToast(stockToAdd > 0 ? `✅ Stock updated! +${stockToAdd} ${isTab ? 'tablets' : 'units'}` : '✅ Product updated!')
      } else {
        data.stock = stockToAdd
        await addProduct(data)
        showToast('✅ Product added!')
      }

      setShowModal(false)
    } catch (err) {
      showToast('❌ Error saving: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete product ──
  async function handleDelete(id) {
    if (!confirm('Delete this product?')) return
    try {
      await deleteProduct(id)
      showToast('🗑️ Product deleted')
    } catch (e) {
      showToast('❌ Error deleting', 'error')
    }
  }

  return (
    <div className="page-enter">

      {/* ── HEADER ── */}
      <div className="bg-gradient-to-br from-blue-900 to-blue-600 text-white px-5 pt-12 pb-6">
        <h1 className="text-2xl font-extrabold">Products 📦</h1>
        <p className="text-blue-200 text-sm mt-1">उत्पाद — {products.length} total</p>
      </div>

      <div className="px-4 pt-4 space-y-3">

        {/* ── ADD BUTTON ── */}
        <button
          onClick={openAdd}
          className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98]
                     text-white font-bold py-3.5 rounded-2xl transition-all
                     shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
        >
          ➕ Add / Update Product
        </button>

        {/* ── SEARCH ── */}
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search medicine... / दवाई खोजें..."
            className="w-full pl-9 pr-4 py-3 bg-white border border-slate-200
                       rounded-xl text-sm outline-none focus:border-blue-400
                       focus:ring-2 focus:ring-blue-50 transition-all"
          />
        </div>

        {/* ── FILTER PILLS ── */}
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'All',         cls: 'bg-blue-600 text-white' },
            { key: 'low', label: '⚠️ Low',       cls: 'bg-amber-100 text-amber-700' },
            { key: 'out', label: '🚫 Out',       cls: 'bg-red-100 text-red-700' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all
                ${filter === f.key ? f.cls : 'bg-slate-100 text-slate-500'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ── PRODUCT LIST ── */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <div className="text-4xl mb-3">💊</div>
            <p className="font-medium">No products found</p>
            <p className="text-sm mt-1">Tap "Add Product" to get started</p>
          </div>
        ) : (
          filtered.map(p => {
            const status  = stockStatus(p)
            const leftBar = status === 'out' ? 'bg-red-400' : status === 'low' ? 'bg-amber-400' : 'bg-green-400'
            return (
              <div key={p.id}
                className="bg-white rounded-2xl shadow-sm border border-slate-100
                           flex items-stretch overflow-hidden">
                {/* Colored left bar */}
                <div className={`w-1 ${leftBar} flex-shrink-0`} />
                <div className="flex-1 p-4">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 text-sm leading-tight">{p.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {p.category}
                        {p.sellPrice ? ` · ₹${p.sellPrice}/${p.unit}` : ''}
                        {p.wholesalerName ? ` · 🏪 ${p.wholesalerName}` : ''}
                      </p>
                      <p className="text-sm font-semibold text-slate-700 mt-2">
                        📦 {formatStock(p)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StockBadge product={p} showCount={false} />
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => openEdit(p)}
                          className="px-3 py-1 bg-slate-100 hover:bg-slate-200
                                     text-slate-600 rounded-lg text-xs font-semibold transition-colors"
                        >✏️ Edit</button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="px-3 py-1 bg-red-50 hover:bg-red-100
                                     text-red-600 rounded-lg text-xs font-semibold transition-colors"
                        >🗑️</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── ADD/EDIT MODAL ── */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editId ? '✏️ Edit Product' : '➕ Add Product'}
      >
        <div className="space-y-4 pb-4">

          {/* AUTOCOMPLETE SEARCH */}
          <div className="relative" ref={acRef}>
            <label className="field-label">Search Existing / मौजूदा खोजें</label>
            <input
              value={acQuery}
              onChange={e => handleAcInput(e.target.value)}
              onFocus={() => acQuery && setAcOpen(acResults.length > 0)}
              placeholder="Type to search existing products..."
              className="field-input"
            />
            {/* Dropdown */}
            {acOpen && (
              <div className="absolute z-10 left-0 right-0 top-full mt-1
                              bg-white border border-blue-200 rounded-xl shadow-xl
                              max-h-48 overflow-y-auto">
                {acResults.map(p => (
                  <div
                    key={p.id}
                    onClick={() => selectProduct(p)}
                    className="px-4 py-3 cursor-pointer hover:bg-blue-50 border-b border-slate-50 last:border-0"
                  >
                    <p className="font-semibold text-sm text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.category} · Stock: {formatStock(p)}</p>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-400 mt-1">💡 Select to update stock, or fill below to add new</p>
          </div>

          {/* NAME */}
          <div>
            <label className="field-label">Medicine Name *</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
              placeholder="e.g. Paracetamol 500mg" className="field-input" />
          </div>

          {/* CATEGORY + UNIT */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Category</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="field-input">
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
              <select value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="field-input">
                <option value="tablet">Tablet</option>
                <option value="capsule">Capsule</option>
                <option value="bottle">Bottle</option>
                <option value="piece">Piece</option>
                <option value="pack">Pack</option>
                <option value="strip">Strip (whole)</option>
              </select>
            </div>
          </div>

          {/* STRIP SETTINGS — only for tablet/capsule */}
          {isTabletUnit ? (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">📦 Strip Settings</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Tablets per Strip *</label>
                  <input type="number" value={form.perStrip}
                    onChange={e => setForm({...form, perStrip: e.target.value})}
                    placeholder="e.g. 10" className="field-input" />
                </div>
                <div>
                  <label className="field-label">Add Strips (from wholesaler)</label>
                  <input type="number" value={form.stripsToAdd}
                    onChange={e => setForm({...form, stripsToAdd: e.target.value})}
                    placeholder="e.g. 5" className="field-input" />
                </div>
              </div>
              {form.perStrip && form.stripsToAdd && (
                <p className="text-xs text-blue-600 font-medium">
                  = {Math.round(parseFloat(form.stripsToAdd||0) * parseInt(form.perStrip||1))} tablets will be added
                </p>
              )}
              <div>
                <label className="field-label">Low Stock Alert (tablets)</label>
                <input type="number" value={form.lowAlert}
                  onChange={e => setForm({...form, lowAlert: e.target.value})}
                  placeholder="e.g. 20" className="field-input" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Add Stock</label>
                <input type="number" value={form.stock}
                  onChange={e => setForm({...form, stock: e.target.value})}
                  placeholder="e.g. 20" className="field-input" />
              </div>
              <div>
                <label className="field-label">Low Stock Alert</label>
                <input type="number" value={form.lowAlert}
                  onChange={e => setForm({...form, lowAlert: e.target.value})}
                  placeholder="e.g. 5" className="field-input" />
              </div>
            </div>
          )}

          {/* PRICES */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Buy Price ₹</label>
              <input type="number" value={form.buyPrice}
                onChange={e => setForm({...form, buyPrice: e.target.value})}
                placeholder="25" className="field-input" />
            </div>
            <div>
              <label className="field-label">Sell Price ₹ (per unit)</label>
              <input type="number" value={form.sellPrice}
                onChange={e => setForm({...form, sellPrice: e.target.value})}
                placeholder="2" className="field-input" />
            </div>
          </div>


          {/* EXPIRY DATE
              Two dropdowns: Month + Year
              Works perfectly on iPhone 15 — no distortion.
              Month is a <select>, Year is a number input.
              Stored as "MM/YYYY" string e.g. "03/2026"
          */}
          <div>
            <label className="field-label">
              Expiry Date / समाप्ति तिथि
            </label>
            <div style={{display:'flex', gap:'8px'}}>

              {/* Month dropdown — clean native picker on all devices */}
              <select
                value={form.expiryDate ? (form.expiryDate.split('/')[0] || '') : ''}
                onChange={e => {
                  const month = e.target.value
                  const year  = form.expiryDate ? (form.expiryDate.split('/')[1] || '') : ''
                  setForm({...form, expiryDate: month || year ? `${month}/${year}` : ''})
                }}
                className="field-input"
                style={{flex: 1}}
              >
                <option value="">Month</option>
                <option value="01">01 - Jan</option>
                <option value="02">02 - Feb</option>
                <option value="03">03 - Mar</option>
                <option value="04">04 - Apr</option>
                <option value="05">05 - May</option>
                <option value="06">06 - Jun</option>
                <option value="07">07 - Jul</option>
                <option value="08">08 - Aug</option>
                <option value="09">09 - Sep</option>
                <option value="10">10 - Oct</option>
                <option value="11">11 - Nov</option>
                <option value="12">12 - Dec</option>
              </select>

              {/* Year input — numeric keyboard on mobile */}
              <input
                type="number"
                value={form.expiryDate ? (form.expiryDate.split('/')[1] || '') : ''}
                onChange={e => {
                  const year  = e.target.value.replace(/\D/g,'').slice(0,4)
                  const month = form.expiryDate ? (form.expiryDate.split('/')[0] || '') : ''
                  setForm({...form, expiryDate: `${month}/${year}`})
                }}
                placeholder="2026"
                inputMode="numeric"
                className="field-input"
                style={{flex: 1}}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Leave blank if no expiry date
            </p>
          </div>

          {/* WHOLESALER */}
          <div>
            <label className="field-label">Wholesaler</label>
            <select value={form.wholesalerId}
              onChange={e => setForm({...form, wholesalerId: e.target.value})}
              className="field-input">
              <option value="">-- Select --</option>
              {wholesalers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          {/* SAVE BUTTON */}
          {saving ? '⏳ Saving...' : '💾 Save Product'}
          </button>
        </div>
      </Modal>

      {/* Inline styles for form fields */}
      <style>{`
        .field-label { display:block; font-size:0.72rem; font-weight:700;
                       color:#64748b; margin-bottom:4px; letter-spacing:0.2px; }
        .field-input { width:100%; padding:10px 12px; border:1.5px solid #e2e8f0;
                       border-radius:10px; font-size:0.875rem; outline:none;
                       transition:border-color 0.2s; }
        .field-input:focus { border-color:#3b82f6; box-shadow:0 0 0 3px #dbeafe; }
      `}</style>
    </div>
  )
}
