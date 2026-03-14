/*
  Reports.jsx — Sales summary and history
  Shows: total revenue, sales count, top products, date filter
*/

import React, { useState, useMemo } from 'react'
import { useApp } from '../App'

export default function Reports() {
  const { products } = useApp()
  const [allSales,  setAllSales]  = useState([])
  const [dateRange, setDateRange] = useState('today') // 'today'|'week'|'month'|'all'

  // Subscribe to all sales
  React.useEffect(() => {
    // Import the listener only when this page loads (lazy import)
    import('../firebase').then(({ listenAllSales }) => {
      const unsub = listenAllSales(data => setAllSales(data))
      return () => unsub()
    })
  }, [])

  // Filter sales by date range
  const filtered = useMemo(() => {
    const now   = new Date()
    const today = new Date(); today.setHours(0,0,0,0)
    const week  = new Date(today); week.setDate(week.getDate() - 7)
    const month = new Date(today); month.setDate(1)

    return allSales.filter(s => {
      const d = s.createdAt?.toDate?.() || new Date(s.date || s.createdAt)
      if (dateRange === 'today') return d >= today
      if (dateRange === 'week')  return d >= week
      if (dateRange === 'month') return d >= month
      return true
    })
  }, [allSales, dateRange])

  // Aggregate stats
  const stats = useMemo(() => {
    const revenue      = filtered.reduce((s, x) => s + parseFloat(x.total || 0), 0)
    const discountGiven = filtered.reduce((s, x) => s + parseFloat(x.discountAmt || 0), 0)

    // Count sales per product
    const productCount = {}
    filtered.forEach(sale => {
      (sale.items || []).forEach(item => {
        productCount[item.name] = (productCount[item.name] || 0) + parseFloat(item.qty || 0)
      })
    })
    const topProducts = Object.entries(productCount)
      .sort((a,b) => b[1] - a[1])
      .slice(0, 5)

    return { revenue, discountGiven, topProducts }
  }, [filtered])

  const ranges = [
    { key: 'today', label: 'Today'     },
    { key: 'week',  label: 'This Week' },
    { key: 'month', label: 'This Month'},
    { key: 'all',   label: 'All Time'  },
  ]

  return (
    <div className="page-enter">

      <div className="bg-gradient-to-br from-blue-900 to-blue-600 text-white px-5 pt-12 pb-6">
        <h1 className="text-2xl font-extrabold">Reports 📈</h1>
        <p className="text-blue-200 text-sm mt-1">Sales summary / बिक्री रिपोर्ट</p>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* Date range filter */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {ranges.map(r => (
            <button key={r.key} onClick={() => setDateRange(r.key)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all
                ${dateRange === r.key ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>
              {r.label}
            </button>
          ))}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900 rounded-2xl p-4 text-white">
            <p className="text-slate-400 text-xs font-semibold">Revenue / कमाई</p>
            <p className="text-2xl font-extrabold mt-1">₹{stats.revenue.toLocaleString()}</p>
          </div>
          <div className="bg-blue-600 rounded-2xl p-4 text-white">
            <p className="text-blue-200 text-xs font-semibold">Total Sales</p>
            <p className="text-2xl font-extrabold mt-1">{filtered.length}</p>
          </div>
          {stats.discountGiven > 0 && (
            <div className="col-span-2 bg-green-50 border border-green-100 rounded-2xl p-4">
              <p className="text-green-600 text-xs font-semibold">Discount Given / दी गई छूट</p>
              <p className="text-2xl font-extrabold text-green-700 mt-1">₹{stats.discountGiven.toFixed(0)}</p>
            </div>
          )}
        </div>

        {/* Top products */}
        {stats.topProducts.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="font-bold text-sm text-slate-800">🏆 Top Products</p>
            </div>
            {stats.topProducts.map(([name, qty], i) => (
              <div key={name} className="flex justify-between items-center px-4 py-3 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full
                                   flex items-center justify-center text-xs font-extrabold">
                    {i + 1}
                  </span>
                  <span className="text-sm font-semibold text-slate-700">{name}</span>
                </div>
                <span className="text-sm font-bold text-slate-500">{qty} sold</span>
              </div>
            ))}
          </div>
        )}

        {/* Sales list */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="font-bold text-sm text-slate-800">All Sales / सभी बिक्री</p>
          </div>
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <div className="text-3xl mb-2">📊</div>
              <p className="text-sm">No sales in this period</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filtered.map(s => {
                const date = s.createdAt?.toDate?.() || new Date(s.date || s.createdAt)
                return (
                  <div key={s.id} className="flex justify-between items-start px-4 py-3">
                    <div>
                      <p className="font-semibold text-sm text-slate-800">{s.customer}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {(s.items||[]).map(i => `${i.name} ×${i.qty}`).join(', ')}
                      </p>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {date.toLocaleDateString('en-IN')} {date.toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-600">₹{s.total}</p>
                      {parseFloat(s.discountAmt) > 0 &&
                        <p className="text-xs text-green-600">−₹{parseFloat(s.discountAmt).toFixed(0)}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
