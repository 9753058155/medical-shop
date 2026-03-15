import React, { useState, useEffect, useMemo } from 'react'
import { useToast }                             from '../App'
import { addUdhaar, updateUdhaar,
         deleteUdhaar, listenUdhaar }           from '../firebase'
import Modal                                    from '../components/Modal'
import PhoneInput                               from '../components/PhoneInput'
import { useLanguage, validatePhone }           from '../i18n'

const EMPTY = { customerName:'', phone:'', amount:'', notes:'', items:'' }

export default function Udhaar() {
  const showToast            = useToast()
  const { t }                = useLanguage()
  const [udhaarList,  setUdhaarList]  = useState([])
  const [showModal,   setShowModal]   = useState(false)
  const [form,        setForm]        = useState(EMPTY)
  const [editId,      setEditId]      = useState(null)
  const [filter,      setFilter]      = useState('unpaid')
  const [saving,      setSaving]      = useState(false)
  const [showPayModal,setShowPayModal]= useState(false)
  const [payEntry,    setPayEntry]    = useState(null)
  const [payAmount,   setPayAmount]   = useState('')

  useEffect(() => {
    const unsub = listenUdhaar(data => setUdhaarList(data))
    return () => unsub()
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'unpaid') return udhaarList.filter(u => !u.paid && parseFloat(u.remaining || u.amount) > 0)
    if (filter === 'paid')   return udhaarList.filter(u => u.paid || parseFloat(u.remaining || u.amount) <= 0)
    return udhaarList
  }, [udhaarList, filter])

  const totalOutstanding = useMemo(() =>
    udhaarList.filter(u => !u.paid).reduce((s, u) => s + parseFloat(u.remaining || u.amount || 0), 0)
  , [udhaarList])

  function openAdd() { setForm(EMPTY); setEditId(null); setShowModal(true) }

  function openEdit(u) {
    setForm({ customerName: u.customerName||'', phone: u.phone||'', amount: u.amount||'', notes: u.notes||'', items: u.items||'' })
    setEditId(u.id)
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.customerName.trim()) { showToast('Enter customer name', 'warning'); return }
    if (!form.amount) { showToast('Enter amount', 'warning'); return }
    const phoneCheck = validatePhone(form.phone)
    if (form.phone && !phoneCheck.valid) { showToast('Invalid phone number', 'error'); return }
    setSaving(true)
    try {
      const data = {
        customerName: form.customerName.trim(),
        phone:        form.phone.trim(),
        amount:       parseFloat(form.amount),
        remaining:    parseFloat(form.amount),
        notes:        form.notes.trim(),
        items:        form.items.trim(),
        paid:         false,
        date:         new Date().toISOString(),
      }
      if (editId) { await updateUdhaar(editId, data); showToast('✅ Updated!') }
      else        { await addUdhaar(data);             showToast('✅ Udhaar added!') }
      setShowModal(false)
    } catch (e) { showToast('Error: ' + e.message, 'error') }
    finally     { setSaving(false) }
  }

  async function markPaid(u) {
    if (!confirm(`Mark Rs.${u.remaining || u.amount} from ${u.customerName} as paid?`)) return
    try { await updateUdhaar(u.id, { paid: true, remaining: 0, paidAt: new Date().toISOString() }); showToast('✅ Paid!') }
    catch (e) { showToast('Error', 'error') }
  }

  function openPartialPay(u) { setPayEntry(u); setPayAmount(''); setShowPayModal(true) }

  async function savePartialPay() {
    const amt = parseFloat(payAmount)
    if (!amt || amt <= 0) { showToast('Enter valid amount', 'warning'); return }
    const remaining = parseFloat(payEntry.remaining || payEntry.amount) - amt
    try {
      await updateUdhaar(payEntry.id, { remaining: Math.max(0, remaining), paid: remaining <= 0, paidAt: remaining <= 0 ? new Date().toISOString() : null })
      showToast(remaining <= 0 ? '✅ Fully paid!' : `Rs.${amt} received. Rs.${remaining.toFixed(0)} remaining`)
      setShowPayModal(false)
    } catch (e) { showToast('Error', 'error') }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this entry?')) return
    try { await deleteUdhaar(id); showToast('🗑️ Deleted') }
    catch (e) { showToast('Error', 'error') }
  }

  function sendWhatsAppReminder(u) {
    if (!u.phone) { showToast('No phone number saved', 'warning'); return }
    const msg = encodeURIComponent(
      `Namaste ${u.customerName} ji! 🙏\n\nSarvesh Medicals se yaad dila rahe hain.\nAapka *Rs.${parseFloat(u.remaining || u.amount).toFixed(0)}* udhaar baaki hai.\n\nDhanyawad! 💊`
    )
    window.open(`https://wa.me/91${u.phone}?text=${msg}`, '_blank')
  }

  return (
    <div className="page-enter">
      <div className="bg-gradient-to-br from-orange-600 to-orange-500 text-white px-5 pt-12 pb-6">
        <h1 className="text-2xl font-extrabold">Udhaar Tracker 💸</h1>
        <p className="text-orange-100 text-sm mt-1">Credit — {udhaarList.filter(u=>!u.paid).length} pending</p>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {totalOutstanding > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex justify-between items-center">
            <div>
              <p className="text-xs font-bold text-orange-600 uppercase tracking-wide">Total Outstanding</p>
              <p className="text-3xl font-extrabold text-orange-700 mt-1">Rs.{totalOutstanding.toFixed(0)}</p>
            </div>
            <span className="text-4xl opacity-40">💸</span>
          </div>
        )}

        <button onClick={openAdd}
          className="w-full bg-orange-500 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-orange-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
          ➕ Add Udhaar / उधार जोड़ें
        </button>

        <div className="flex gap-2">
          {[{key:'unpaid',label:'Unpaid',cls:'bg-orange-500 text-white'},{key:'paid',label:'Paid',cls:'bg-green-500 text-white'},{key:'all',label:'All',cls:'bg-slate-600 text-white'}].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${filter===f.key ? f.cls : 'bg-slate-100 text-slate-500'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <div className="text-4xl mb-3">💸</div>
            <p className="font-medium">{filter==='unpaid' ? 'No pending udhaar!' : 'No entries found'}</p>
          </div>
        ) : filtered.map(u => {
          const remaining = parseFloat(u.remaining ?? u.amount ?? 0)
          const original  = parseFloat(u.amount ?? 0)
          const isPaid    = u.paid || remaining <= 0
          const date      = new Date(u.date || Date.now())
          return (
            <div key={u.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${isPaid ? 'border-green-100' : 'border-orange-100'}`}>
              <div className="flex">
                <div className={`w-1.5 flex-shrink-0 ${isPaid ? 'bg-green-400' : 'bg-orange-400'}`} />
                <div className="flex-1 p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold text-slate-800">{u.customerName}</p>
                      <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                        {u.phone && <p>📞 {u.phone}</p>}
                        {u.items && <p>💊 {u.items}</p>}
                        {u.notes && <p>📝 {u.notes}</p>}
                        <p>📅 {date.toLocaleDateString('en-IN')}</p>
                      </div>
                    </div>
                    <div className="text-right ml-3">
                      {isPaid ? (
                        <span className="text-xs font-bold px-2.5 py-1 bg-green-50 text-green-700 rounded-full">✅ Paid</span>
                      ) : (
                        <>
                          <p className="text-xl font-extrabold text-orange-600">Rs.{remaining.toFixed(0)}</p>
                          {remaining !== original && <p className="text-xs text-slate-400">of Rs.{original.toFixed(0)}</p>}
                        </>
                      )}
                    </div>
                  </div>

                  {!isPaid && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <button onClick={() => markPaid(u)} className="flex-1 py-2 bg-green-50 text-green-700 rounded-xl text-xs font-bold">✅ Full Payment</button>
                      <button onClick={() => openPartialPay(u)} className="flex-1 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold">💰 Partial</button>
                      {u.phone && (
                        <button onClick={() => sendWhatsAppReminder(u)} className="flex-1 py-2 bg-green-500 text-white rounded-xl text-xs font-bold">📱 Remind</button>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => openEdit(u)} className="flex-1 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold">✏️ Edit</button>
                    <button onClick={() => handleDelete(u.id)} className="flex-1 py-1.5 bg-red-50 text-red-600 rounded-xl text-xs font-bold">🗑️ Delete</button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? '✏️ Edit Udhaar' : '💸 Add Udhaar'}>
        <div className="space-y-4 pb-4">
          <div>
            <label className="field-label">Customer Name *</label>
            <input value={form.customerName} onChange={e => setForm({...form, customerName: e.target.value})} placeholder="e.g. Ramesh ji" className="field-input" />
          </div>
          <PhoneInput value={form.phone} onChange={val => setForm({...form, phone: val})} label="Phone / फोन (WhatsApp)" />
          <div>
            <label className="field-label">Amount Rs. *</label>
            <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="e.g. 250" className="field-input" />
          </div>
          <div>
            <label className="field-label">Items / सामान</label>
            <input value={form.items} onChange={e => setForm({...form, items: e.target.value})} placeholder="e.g. Paracetamol, Syrup" className="field-input" />
          </div>
          <div>
            <label className="field-label">Notes</label>
            <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Any extra info..." className="field-input" />
          </div>
          <button onClick={handleSave} disabled={saving} className="w-full bg-orange-500 text-white font-bold py-3.5 rounded-xl disabled:opacity-50">
            {saving ? 'Saving...' : '💾 Save'}
          </button>
        </div>
      </Modal>

      <Modal isOpen={showPayModal} onClose={() => setShowPayModal(false)} title={`💰 Partial Payment — ${payEntry?.customerName}`}>
        <div className="space-y-4 pb-4">
          <div className="bg-orange-50 rounded-xl p-4 text-center">
            <p className="text-xs text-orange-600 font-semibold">Outstanding</p>
            <p className="text-3xl font-extrabold text-orange-700">Rs.{parseFloat(payEntry?.remaining || payEntry?.amount || 0).toFixed(0)}</p>
          </div>
          <div>
            <label className="field-label">Amount Received Rs.</label>
            <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="Enter amount" className="field-input" />
          </div>
          <button onClick={savePartialPay} className="w-full bg-green-500 text-white font-bold py-3.5 rounded-xl">✅ Confirm Payment</button>
        </div>
      </Modal>

      <style>{`
        .field-label{display:block;font-size:.72rem;font-weight:700;color:#64748b;margin-bottom:4px}
        .field-input{width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:.875rem;outline:none}
        .field-input:focus{border-color:#f97316;box-shadow:0 0 0 3px #ffedd5}
      `}</style>
    </div>
  )
}
