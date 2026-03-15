/*
  Wholesalers.jsx — Manage wholesalers + payment schedule + bill image upload
  Features: add/edit/delete, payment due alerts, upload bill images from phone/PC
*/

import React, { useState } from 'react'
import { useApp, useToast } from '../App'
import { addWholesaler, updateWholesaler, deleteWholesaler } from '../firebase'
import Modal from '../components/Modal'
import PhoneInput from '../components/PhoneInput'
import { useLanguage, validatePhone } from '../i18n'

const EMPTY = { name:'', phone:'', amount:'', scheduleType:'weekly',
                payDay:'1', payDate:'', notes:'' }

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

export default function Wholesalers() {
  const { wholesalers } = useApp()
  const showToast = useToast()
  const { t } = useLanguage()

  const [showModal,    setShowModal]    = useState(false)
  const [form,         setForm]         = useState(EMPTY)
  const [editId,       setEditId]       = useState(null)
  const [saving,       setSaving]       = useState(false)

  // Image upload state
  const [showBillModal, setShowBillModal] = useState(false)
  const [billWholesaler, setBillWholesaler] = useState(null)
  const [billFile,       setBillFile]      = useState(null)
  const [billPreview,    setBillPreview]   = useState(null)
  const [uploading,      setUploading]     = useState(false)
  const [billNotes,      setBillNotes]     = useState('')

  const today     = new Date()
  const todayDay  = today.getDay()
  const todayDate = today.getDate()

  function getDueStatus(w) {
    const isToday =
      (w.scheduleType === 'weekly'  && parseInt(w.payDay)  === todayDay) ||
      (w.scheduleType === 'monthly' && parseInt(w.payDate) === todayDate)
    const isSoon =
      (w.scheduleType === 'weekly'  && parseInt(w.payDay)  === (todayDay + 1) % 7) ||
      (w.scheduleType === 'monthly' && Math.abs(parseInt(w.payDate) - todayDate) <= 3)
    return isToday ? 'today' : isSoon ? 'soon' : 'ok'
  }

  function openAdd() {
    setForm(EMPTY); setEditId(null); setShowModal(true)
  }

  function openEdit(w) {
    setForm({
      name:         w.name         || '',
      phone:        w.phone        || '',
      amount:       w.amount       || '',
      scheduleType: w.scheduleType || 'weekly',
      payDay:       w.payDay       ?? '1',
      payDate:      w.payDate      || '',
      notes:        w.notes        || '',
    })
    setEditId(w.id)
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { showToast('Enter wholesaler name', 'warning'); return }
    const phoneCheck = validatePhone(form.phone)
    if (form.phone && !phoneCheck.valid) { showToast('Invalid phone number (must be 10 digits, starts with 6-9)', 'error'); return }
    setSaving(true)
    try {
      const data = {
        name:         form.name.trim(),
        phone:        form.phone.trim(),
        amount:       parseFloat(form.amount) || 0,
        scheduleType: form.scheduleType,
        payDay:       form.scheduleType === 'weekly'  ? form.payDay  : null,
        payDate:      form.scheduleType === 'monthly' ? form.payDate : null,
        notes:        form.notes.trim(),
      }
      if (editId) { await updateWholesaler(editId, data); showToast('✅ Wholesaler updated!') }
      else        { await addWholesaler(data);             showToast('✅ Wholesaler added!') }
      setShowModal(false)
    } catch (e) {
      showToast('❌ Error: ' + e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this wholesaler?')) return
    try { await deleteWholesaler(id); showToast('🗑️ Deleted') }
    catch (e) { showToast('❌ Error', 'error') }
  }

  // ── Bill image upload ──
  function openBillUpload(w) {
    setBillWholesaler(w)
    setBillFile(null)
    setBillPreview(null)
    setBillNotes('')
    setShowBillModal(true)
  }

  function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setBillFile(file)
    // Create a preview URL so we can show the image
    setBillPreview(URL.createObjectURL(file))
  }

  async function handleBillUpload() {
    // Image upload coming soon with Cloudinary (free, no credit card)
    // Firebase Storage requires paid plan
    showToast('Image upload coming soon!', 'warning')
    setShowBillModal(false)
  }

  return (
    <div className="page-enter">

      {/* ── HEADER ── */}
      <div className="bg-gradient-to-br from-blue-900 to-blue-600 text-white px-5 pt-12 pb-6">
        <h1 className="text-2xl font-extrabold">Wholesalers 🏪</h1>
        <p className="text-blue-200 text-sm mt-1">थोक विक्रेता — {wholesalers.length} total</p>
      </div>

      <div className="px-4 pt-4 space-y-3">

        <button onClick={openAdd}
          className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-2xl
                     shadow-lg shadow-blue-200 active:scale-[0.98] transition-all
                     flex items-center justify-center gap-2">
          ➕ Add Wholesaler / थोक विक्रेता जोड़ें
        </button>

        {wholesalers.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <div className="text-4xl mb-3">🏪</div>
            <p className="font-medium">No wholesalers yet</p>
          </div>
        ) : wholesalers.map(w => {
          const due = getDueStatus(w)
          const dueConfig = {
            today: { bg: 'bg-red-50',   text: 'text-red-700',   badge: '🔴 Due Today' },
            soon:  { bg: 'bg-amber-50', text: 'text-amber-700', badge: '🟡 Due Soon'  },
            ok:    { bg: 'bg-green-50', text: 'text-green-700', badge: '🟢 OK'        },
          }[due]
          const sched = w.scheduleType === 'weekly'
            ? `Every ${DAY_NAMES[w.payDay]}`
            : `Every month, ${w.payDate}th`

          return (
            <div key={w.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-slate-800">{w.name}</p>
                    <div className="text-xs text-slate-500 mt-1.5 space-y-0.5">
                      {w.phone  && <p>📞 {w.phone}</p>}
                      {w.amount > 0 && <p>💰 ₹{parseFloat(w.amount).toLocaleString()} due</p>}
                      <p>📅 {sched}</p>
                      {w.notes  && <p>📝 {w.notes}</p>}
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0
                                   ${dueConfig.bg} ${dueConfig.text}`}>
                    {dueConfig.badge}
                  </span>
                </div>

                {/* Bill images */}
                {w.bills?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-slate-400 font-semibold mb-2">📄 Bills / बिल:</p>
                    <div className="flex gap-2 flex-wrap">
                      {w.bills.map((bill, i) => (
                        <a key={i} href={bill.url} target="_blank" rel="noreferrer"
                          className="block w-16 h-16 rounded-xl overflow-hidden border border-slate-200
                                     hover:opacity-80 transition-opacity relative">
                          <img src={bill.url} alt="bill" className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 mt-3">
                  <button onClick={() => openEdit(w)}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200
                               text-slate-700 rounded-xl text-xs font-bold transition-colors">
                    ✏️ Edit
                  </button>
                  <button onClick={() => openBillUpload(w)}
                    className="flex-1 py-2 bg-blue-50 hover:bg-blue-100
                               text-blue-600 rounded-xl text-xs font-bold transition-colors">
                    📷 Upload Bill
                  </button>
                  {w.phone && (
                    <a href={`tel:${w.phone}`}
                      className="flex-1 py-2 bg-green-50 hover:bg-green-100
                                 text-green-700 rounded-xl text-xs font-bold text-center transition-colors">
                      📞 Call
                    </a>
                  )}
                  <button onClick={() => handleDelete(w.id)}
                    className="px-3 py-2 bg-red-50 hover:bg-red-100
                               text-red-600 rounded-xl text-xs font-bold transition-colors">
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── ADD/EDIT WHOLESALER MODAL ── */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}
             title={editId ? '✏️ Edit Wholesaler' : '🏪 Add Wholesaler'}>
        <div className="space-y-4 pb-4">
          <Field label="Name / नाम *">
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
              placeholder="e.g. Sharma Medical" className="field-input" />
          </Field>
          <Field label="">
            <PhoneInput
              value={form.phone}
              onChange={val => setForm({...form, phone: val})}
              label="Phone / फोन (WhatsApp)"
            />
          </Field>
          <Field label="Amount Due ₹ / बकाया">
            <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})}
              placeholder="5000" className="field-input" />
          </Field>
          <Field label="Schedule Type">
            <select value={form.scheduleType} onChange={e => setForm({...form, scheduleType: e.target.value})} className="field-input">
              <option value="weekly">Weekly / हर हफ्ते</option>
              <option value="monthly">Monthly / हर महीने</option>
            </select>
          </Field>
          {form.scheduleType === 'weekly' ? (
            <Field label="Payment Day / भुगतान का दिन">
              <select value={form.payDay} onChange={e => setForm({...form, payDay: e.target.value})} className="field-input">
                {DAY_NAMES.map((d,i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="Payment Date (1–28)">
              <input type="number" value={form.payDate} onChange={e => setForm({...form, payDate: e.target.value})}
                placeholder="5" min="1" max="28" className="field-input" />
            </Field>
          )}
          <Field label="Notes / नोट्स">
            <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
              placeholder="Any extra info..." className="field-input" />
          </Field>
          <button onClick={handleSave} disabled={saving}
            className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl
                       disabled:opacity-50 transition-all active:scale-[0.98]">
            {saving ? '⏳ Saving...' : '💾 Save Wholesaler'}
          </button>
        </div>
      </Modal>

      {/* ── BILL UPLOAD MODAL ── */}
      <Modal isOpen={showBillModal} onClose={() => setShowBillModal(false)}
             title={`📷 Upload Bill — ${billWholesaler?.name}`}>
        <div className="space-y-4 pb-4">

          {/* File pick area */}
          <label className="block cursor-pointer">
            <div className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors
                            ${billPreview ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}>
              {billPreview ? (
                // Show image preview
                <img src={billPreview} alt="preview"
                  className="max-h-48 mx-auto rounded-xl object-contain" />
              ) : (
                <>
                  <div className="text-4xl mb-3">📷</div>
                  <p className="font-semibold text-slate-700">Tap to select bill image</p>
                  <p className="text-xs text-slate-400 mt-1">Photo, screenshot, or scan</p>
                </>
              )}
            </div>
            {/* Hidden file input — clicking the label triggers this */}
            <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          </label>

          {billFile && (
            <p className="text-xs text-slate-500 text-center">
              Selected: {billFile.name} ({(billFile.size / 1024).toFixed(0)} KB)
            </p>
          )}

          <Field label="Notes / नोट्स (optional)">
            <input value={billNotes} onChange={e => setBillNotes(e.target.value)}
              placeholder="e.g. Invoice #123, March order..."
              className="field-input" />
          </Field>

          <button onClick={handleBillUpload} disabled={uploading || !billFile}
            className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl
                       disabled:opacity-50 transition-all active:scale-[0.98]">
            {uploading ? '⏳ Uploading...' : '☁️ Upload Bill'}
          </button>
        </div>
      </Modal>

      <style>{`
        .field-input { width:100%; padding:10px 12px; border:1.5px solid #e2e8f0;
                       border-radius:10px; font-size:0.875rem; outline:none; }
        .field-input:focus { border-color:#3b82f6; box-shadow:0 0 0 3px #dbeafe; }
      `}</style>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
