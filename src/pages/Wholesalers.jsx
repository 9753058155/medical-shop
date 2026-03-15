/*
  Wholesalers.jsx — Manage wholesalers
  
  FIXED:
  1. Permission error — wrapped in try/catch with better error handling
  2. Bill date field added
  3. Phone validation
*/

import React, { useState }           from 'react'
import { useApp, useToast }           from '../App'
import { addWholesaler, updateWholesaler, deleteWholesaler } from '../firebase'
import Modal                          from '../components/Modal'
import PhoneInput                     from '../components/PhoneInput'
import { validatePhone }              from '../i18n'

const EMPTY = { name:'', phone:'', amount:'', scheduleType:'weekly', payDay:'1', payDate:'', notes:'' }
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

export default function Wholesalers() {
  const { wholesalers } = useApp()
  const showToast       = useToast()

  const [showModal,  setShowModal]  = useState(false)
  const [form,       setForm]       = useState(EMPTY)
  const [editId,     setEditId]     = useState(null)
  const [saving,     setSaving]     = useState(false)

  // Bill upload modal
  const [showBillModal, setShowBillModal] = useState(false)
  const [billW,         setBillW]         = useState(null)
  const [billDate,      setBillDate]      = useState('')
  const [billNotes,     setBillNotes]     = useState('')
  const [billAmount,    setBillAmount]    = useState('')
  const [billSaving,    setBillSaving]    = useState(false)

  const today     = new Date()
  const todayDay  = today.getDay()
  const todayDate = today.getDate()

  function getDue(w) {
    const isToday = (w.scheduleType==='weekly'  && parseInt(w.payDay)===todayDay) ||
                    (w.scheduleType==='monthly' && parseInt(w.payDate)===todayDate)
    const isSoon  = (w.scheduleType==='weekly'  && parseInt(w.payDay)===(todayDay+1)%7) ||
                    (w.scheduleType==='monthly' && Math.abs(parseInt(w.payDate)-todayDate)<=3)
    return isToday ? 'today' : isSoon ? 'soon' : 'ok'
  }

  function openAdd() { setForm(EMPTY); setEditId(null); setShowModal(true) }

  function openEdit(w) {
    setForm({ name:w.name||'', phone:w.phone||'', amount:w.amount||'',
              scheduleType:w.scheduleType||'weekly', payDay:w.payDay??'1',
              payDate:w.payDate||'', notes:w.notes||'' })
    setEditId(w.id)
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { showToast('Enter wholesaler name', 'warning'); return }
    if (form.phone) {
      const check = validatePhone(form.phone)
      if (!check.valid) { showToast('Invalid phone number (10 digits, starts with 6-9)', 'error'); return }
    }
    setSaving(true)
    try {
      const data = {
        name:         form.name.trim(),
        phone:        form.phone.trim(),
        amount:       parseFloat(form.amount) || 0,
        scheduleType: form.scheduleType,
        payDay:       form.scheduleType==='weekly'  ? form.payDay   : null,
        payDate:      form.scheduleType==='monthly' ? form.payDate  : null,
        notes:        form.notes.trim(),
      }
      if (editId) { await updateWholesaler(editId, data); showToast('✅ Updated!') }
      else        { await addWholesaler(data);             showToast('✅ Wholesaler added!') }
      setShowModal(false)
    } catch (e) {
      console.error('Wholesaler save error:', e)
      if (e.code === 'permission-denied') {
        showToast('❌ Permission denied — check Firestore rules in Firebase Console', 'error')
      } else {
        showToast('❌ Error: ' + e.message, 'error')
      }
    } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this wholesaler?')) return
    try { await deleteWholesaler(id); showToast('🗑️ Deleted') }
    catch (e) { showToast('Error: ' + e.message, 'error') }
  }

  // Save bill record with date
  async function handleSaveBill() {
    if (!billDate) { showToast('Select bill date', 'warning'); return }
    setBillSaving(true)
    try {
      const currentBills = billW.bills || []
      await updateWholesaler(billW.id, {
        bills: [...currentBills, {
          date:   billDate,
          amount: parseFloat(billAmount) || 0,
          notes:  billNotes.trim(),
          addedAt: new Date().toISOString(),
        }]
      })
      showToast('✅ Bill record saved!')
      setShowBillModal(false)
    } catch (e) { showToast('Error: ' + e.message, 'error') }
    finally     { setBillSaving(false) }
  }

  return (
    <div className="page-enter">
      <div className="bg-gradient-to-br from-blue-900 to-blue-600 text-white px-5 pt-12 pb-6">
        <h1 className="text-2xl font-extrabold">Wholesalers 🏪</h1>
        <p className="text-blue-200 text-sm mt-1">थोक विक्रेता — {wholesalers.length} total</p>
      </div>

      <div className="px-4 pt-4 space-y-3">
        <button onClick={openAdd}
          className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-blue-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
          ➕ Add Wholesaler / थोक विक्रेता जोड़ें
        </button>

        {wholesalers.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <div className="text-4xl mb-3">🏪</div>
            <p className="font-medium">No wholesalers yet</p>
          </div>
        ) : wholesalers.map(w => {
          const due = getDue(w)
          const dueCfg = {
            today: { bg:'bg-red-50 border-red-200',   badge:'bg-red-100 text-red-700',   txt:'🔴 Due Today' },
            soon:  { bg:'bg-amber-50 border-amber-200',badge:'bg-amber-100 text-amber-700',txt:'🟡 Due Soon'  },
            ok:    { bg:'bg-white border-slate-100',   badge:'bg-green-100 text-green-700',txt:'🟢 OK'        },
          }[due]
          const sched = w.scheduleType==='weekly'
            ? `Every ${DAY_NAMES[w.payDay]}`
            : `Every month ${w.payDate}th`

          return (
            <div key={w.id} className={`rounded-2xl shadow-sm border p-4 ${dueCfg.bg}`}>
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
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${dueCfg.badge}`}>
                  {dueCfg.txt}
                </span>
              </div>

              {/* Bill records */}
              {w.bills?.length > 0 && (
                <div className="mt-3 bg-white/60 rounded-xl p-2.5">
                  <p className="text-xs text-slate-400 font-semibold mb-1.5">📄 Bill Records:</p>
                  {w.bills.slice(-3).map((bill, i) => (
                    <div key={i} className="flex justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                      <span className="text-slate-600">📅 {bill.date} {bill.notes ? `· ${bill.notes}` : ''}</span>
                      {bill.amount > 0 && <span className="font-bold text-slate-700">₹{bill.amount}</span>}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 mt-3 flex-wrap">
                <button onClick={() => openEdit(w)}
                  className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold">
                  ✏️ Edit
                </button>
                <button onClick={() => { setBillW(w); setBillDate(''); setBillNotes(''); setBillAmount(''); setShowBillModal(true) }}
                  className="flex-1 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold">
                  📄 Add Bill Date
                </button>
                {w.phone && (
                  <a href={`tel:${w.phone}`}
                    className="flex-1 py-2 bg-green-50 text-green-700 rounded-xl text-xs font-bold text-center">
                    📞 Call
                  </a>
                )}
                <button onClick={() => handleDelete(w.id)}
                  className="px-3 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold">
                  🗑️
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ADD/EDIT MODAL */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editId ? '✏️ Edit Wholesaler' : '🏪 Add Wholesaler'}>
        <div className="space-y-4 pb-4">
          <div>
            <label className="field-label">Name / नाम *</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
              placeholder="e.g. Sharma Medical" className="field-input" />
          </div>
          <PhoneInput value={form.phone} onChange={val => setForm({...form, phone: val})} label="Phone / फोन" />
          <div>
            <label className="field-label">Amount Due ₹ / बकाया</label>
            <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})}
              placeholder="5000" className="field-input" />
          </div>
          <div>
            <label className="field-label">Schedule Type</label>
            <select value={form.scheduleType} onChange={e => setForm({...form, scheduleType: e.target.value})} className="field-input">
              <option value="weekly">Weekly / हर हफ्ते</option>
              <option value="monthly">Monthly / हर महीने</option>
            </select>
          </div>
          {form.scheduleType==='weekly' ? (
            <div>
              <label className="field-label">Payment Day</label>
              <select value={form.payDay} onChange={e => setForm({...form, payDay: e.target.value})} className="field-input">
                {DAY_NAMES.map((d,i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="field-label">Payment Date (1-28)</label>
              <input type="number" value={form.payDate} onChange={e => setForm({...form, payDate: e.target.value})}
                placeholder="5" min="1" max="28" className="field-input" />
            </div>
          )}
          <div>
            <label className="field-label">Notes / नोट्स</label>
            <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
              placeholder="Any extra info..." className="field-input" />
          </div>
          <button onClick={handleSave} disabled={saving}
            className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl disabled:opacity-50 active:scale-[0.98]">
            {saving ? '⏳ Saving...' : '💾 Save Wholesaler'}
          </button>
        </div>
      </Modal>

      {/* ADD BILL DATE MODAL */}
      <Modal isOpen={showBillModal} onClose={() => setShowBillModal(false)}
        title={`📄 Add Bill — ${billW?.name}`}>
        <div className="space-y-4 pb-4">
          <div>
            <label className="field-label">Bill Date / बिल की तारीख *</label>
            <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)}
              className="field-input" />
          </div>
          <div>
            <label className="field-label">Bill Amount ₹ / राशि</label>
            <input type="number" value={billAmount} onChange={e => setBillAmount(e.target.value)}
              placeholder="e.g. 5000" className="field-input" />
          </div>
          <div>
            <label className="field-label">Notes / नोट्स</label>
            <input value={billNotes} onChange={e => setBillNotes(e.target.value)}
              placeholder="e.g. Invoice #123, March order..." className="field-input" />
          </div>
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-xs text-blue-600 font-medium">
              💡 This saves the bill record with date. For image upload, upgrade to paid Firebase plan.
            </p>
          </div>
          <button onClick={handleSaveBill} disabled={billSaving}
            className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl disabled:opacity-50">
            {billSaving ? '⏳ Saving...' : '💾 Save Bill Record'}
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
