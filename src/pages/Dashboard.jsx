/*
  Dashboard.jsx — Home screen
  v3.0 — Added expiry alerts, udhaar summary
*/

import React, { useMemo } from 'react'
import { useApp }          from '../App'
import { formatStock, stockStatus, expiryStatus, daysUntilExpiry } from '../firebase'
import { Link }            from 'react-router-dom'

export default function Dashboard() {
  const { products, wholesalers, todaySales, udhaarList } = useApp()

  const stats = useMemo(() => {
    const low     = products.filter(p => stockStatus(p) === 'low')
    const out     = products.filter(p => stockStatus(p) === 'out')
    const expired = products.filter(p => expiryStatus(p) === 'expired')
    const expiring = products.filter(p => expiryStatus(p) === 'soon')
    const revenue = todaySales.reduce((s, x) => s + parseFloat(x.total || 0), 0)
    const discountGiven = todaySales.reduce((s, x) => s + parseFloat(x.discountAmt || 0), 0)
    const unpaidUdhaar  = udhaarList.filter(u => !u.paid)
    const udhaarTotal   = unpaidUdhaar.reduce((s, u) => s + parseFloat(u.amount || 0), 0)
    return { low, out, expired, expiring, revenue, discountGiven, unpaidUdhaar, udhaarTotal }
  }, [products, todaySales, udhaarList])

  const dueToday = useMemo(() => {
    const today = new Date()
    return wholesalers.filter(w =>
      (w.scheduleType === 'weekly'  && parseInt(w.payDay)  === today.getDay()) ||
      (w.scheduleType === 'monthly' && parseInt(w.payDate) === today.getDate())
    )
  }, [wholesalers])

  const hour     = new Date().getHours()
  const greeting = hour < 12 ? '🌅 Good Morning' : hour < 17 ? '☀️ Good Afternoon' : '🌙 Good Evening'
  const today    = new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })

  return (
    <div className="page-enter">

      <div className="bg-gradient-to-br from-blue-900 to-blue-600 text-white px-5 pt-12 pb-8">
        <p className="text-blue-200 text-sm font-medium">{today}</p>
        <h1 className="text-2xl font-extrabold mt-1">{greeting}! 👋</h1>
        <p className="text-blue-200 text-sm mt-1">Sarvesh Medicals</p>
      </div>

      <div className="px-4 -mt-4 space-y-4 pb-4">

        {/* ── WHOLESALER ALERTS ── */}
        {dueToday.map(w => (
          <div key={w.id} className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3">
            <span className="text-xl">🔔</span>
            <div>
              <p className="font-bold text-red-800 text-sm">Payment Due Today!</p>
              <p className="text-red-700 text-sm mt-0.5">
                {w.name} — ₹{parseFloat(w.amount || 0).toLocaleString()}
                {w.phone && <span> · 📞 {w.phone}</span>}
              </p>
            </div>
          </div>
        ))}

        {/* ── EXPIRED MEDICINES ALERT ── */}
        {stats.expired.length > 0 && (
          <div className="bg-red-50 border border-red-300 rounded-2xl p-4 flex gap-3">
            <span className="text-xl">⛔</span>
            <div>
              <p className="font-bold text-red-800 text-sm">Expired Medicines!</p>
              <p className="text-red-700 text-sm mt-0.5">
                {stats.expired.map(p => p.name).join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* ── EXPIRING SOON ALERT ── */}
        {stats.expiring.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
            <span className="text-xl">⏰</span>
            <div>
              <p className="font-bold text-amber-800 text-sm">Expiring Within 30 Days!</p>
              <p className="text-amber-700 text-sm mt-0.5">
                {stats.expiring.map(p => {
                  const days = daysUntilExpiry(p.expiryDate)
                  return `${p.name} (${days}d)`
                }).join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* ── UDHAAR ALERT ── */}
        {stats.unpaidUdhaar.length > 0 && (
          <Link to="/udhaar">
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex gap-3">
              <span className="text-xl">💸</span>
              <div className="flex-1">
                <p className="font-bold text-orange-800 text-sm">Pending Udhaar</p>
                <p className="text-orange-700 text-sm mt-0.5">
                  {stats.unpaidUdhaar.length} customers owe ₹{stats.udhaarTotal.toLocaleString()}
                </p>
              </div>
              <span className="text-orange-400 text-sm font-bold">View →</span>
            </div>
          </Link>
        )}

        {/* ── STAT CARDS ── */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard color="blue"  icon="💊" num={products.length}      label="Total Products" sub="कुल उत्पाद"/>
          <StatCard color="amber" icon="⚠️" num={stats.low.length}     label="Low Stock"      sub="कम स्टॉक"/>
          <StatCard color="red"   icon="🚫" num={stats.out.length}      label="Out of Stock"   sub="खत्म"/>
          <StatCard color="green" icon="🧾" num={todaySales.length}     label="Today's Sales"  sub="आज की बिक्री"/>
        </div>

        {/* ── REVENUE ── */}
        <div className="bg-slate-900 rounded-2xl p-5 flex justify-between items-center">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Today's Revenue</p>
            <p className="text-3xl font-extrabold text-white mt-1">₹{stats.revenue.toLocaleString()}</p>
            {stats.discountGiven > 0 && (
              <p className="text-green-400 text-xs mt-1">💝 ₹{stats.discountGiven.toFixed(0)} discount given</p>
            )}
          </div>
          <span className="text-4xl opacity-30">💰</span>
        </div>

        {/* ── LOW STOCK ── */}
        <Section title="⚠️ Low Stock Alert" sub="कम स्टॉक" link="/products">
          {stats.low.length === 0 && stats.out.length === 0 ? (
            <Empty icon="✅" text="All stocks sufficient!"/>
          ) : (
            [...stats.out, ...stats.low].slice(0,5).map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-semibold text-sm text-slate-800">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.category}</p>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full
                  ${stockStatus(p) === 'out' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                  {stockStatus(p) === 'out' ? '🚫 Out' : `⚠️ ${formatStock(p)}`}
                </span>
              </div>
            ))
          )}
        </Section>

        {/* ── EXPIRY ALERTS ── */}
        {(stats.expired.length > 0 || stats.expiring.length > 0) && (
          <Section title="⏰ Expiry Alerts" sub="एक्सपायरी" link="/products">
            {[...stats.expired, ...stats.expiring].slice(0,5).map(p => {
              const days   = daysUntilExpiry(p.expiryDate)
              const status = expiryStatus(p)
              return (
                <div key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-semibold text-sm text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-400">
                      Exp: {new Date(p.expiryDate).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full
                    ${status === 'expired' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                    {status === 'expired' ? '⛔ Expired' : `⏰ ${days}d left`}
                  </span>
                </div>
              )
            })}
          </Section>
        )}

        {/* ── RECENT SALES ── */}
        <Section title="🧾 Recent Sales" sub="हाल की बिक्री" link="/reports">
          {todaySales.length === 0 ? (
            <Empty icon="🛒" text="No sales today"/>
          ) : (
            todaySales.slice(0,5).map(s => (
              <div key={s.id} className="flex justify-between items-start px-4 py-3">
                <div>
                  <p className="font-semibold text-sm text-slate-800">{s.customer || 'Customer'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {(s.items||[]).map(i => `${i.name} ×${i.qty}`).join(', ')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-blue-600 text-sm">₹{s.total}</p>
                  {s.paymentMethod && (
                    <p className="text-xs text-slate-400">
                      {s.paymentMethod === 'cash' ? '💵' : s.paymentMethod === 'upi' ? '📱' : '💸'}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </Section>

      </div>
    </div>
  )
}

function StatCard({ color, icon, num, label, sub }) {
  const colors = {
    blue:  'from-blue-500  to-blue-600',
    amber: 'from-amber-500 to-amber-600',
    red:   'from-red-500   to-red-600',
    green: 'from-green-500 to-green-600',
  }
  return (
    <div className={`bg-gradient-to-br ${colors[color]} rounded-2xl p-4 text-white`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-semibold opacity-80">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className="text-3xl font-extrabold leading-none">{num}</div>
      <div className="text-xs opacity-70 mt-1">{sub}</div>
    </div>
  )
}

function Section({ title, sub, link, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100">
        <div>
          <p className="font-bold text-sm text-slate-800">{title}</p>
          <p className="text-xs text-slate-400">{sub}</p>
        </div>
        <Link to={link} className="text-xs text-blue-600 font-semibold">See all →</Link>
      </div>
      <div className="divide-y divide-slate-50">{children}</div>
    </div>
  )
}

function Empty({ icon, text }) {
  return (
    <div className="text-center py-8 text-slate-400">
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-sm">{text}</p>
    </div>
  )
}
