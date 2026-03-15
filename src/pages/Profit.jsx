/*
  Profit.jsx — Profit margin per medicine
  
  Shows:
  - Profit per medicine (sell price - buy price)
  - Profit % margin
  - Total profit today / this month
  - Most profitable medicines
  - Least profitable (needs price review)
*/

import React, { useMemo, useState } from 'react'
import { useApp }                    from '../App'

export default function Profit() {
  const { products, todaySales, allSales } = useApp()
  const [sortBy, setSortBy] = useState('margin') // 'margin' | 'profit' | 'name'
  const [period, setPeriod] = useState('today')  // 'today' | 'month' | 'all'

  // Calculate profit per product
  const productProfits = useMemo(() => {
    return products
      .filter(p => p.buyPrice > 0 && p.sellPrice > 0)
      .map(p => {
        const profit    = (p.sellPrice || 0) - (p.buyPrice || 0)
        const margin    = p.buyPrice > 0 ? (profit / p.buyPrice) * 100 : 0
        return { ...p, profit, margin }
      })
      .sort((a,b) => {
        if (sortBy === 'margin') return b.margin  - a.margin
        if (sortBy === 'profit') return b.profit  - a.profit
        return a.name.localeCompare(b.name)
      })
  }, [products, sortBy])

  // Calculate actual profit from sales
  const salesProfit = useMemo(() => {
    const today  = new Date(); today.setHours(0,0,0,0)
    const month  = new Date(); month.setDate(1); month.setHours(0,0,0,0)

    const salesData = allSales?.length > 0 ? allSales : todaySales

    const filtered = salesData.filter(s => {
      const d = s.createdAt?.toDate?.() || new Date(s.date || s.createdAt)
      if (period === 'today') return d >= today
      if (period === 'month') return d >= month
      return true
    })

    let totalRevenue = 0
    let totalProfit  = 0
    const byProduct  = {}

    filtered.forEach(sale => {
      totalRevenue += parseFloat(sale.total || 0)
      ;(sale.items || []).forEach(item => {
        const p = products.find(x => x.id === item.productId)
        if (!p) return
        const itemProfit = (p.sellPrice - p.buyPrice) * item.qty
        totalProfit += itemProfit
        if (!byProduct[item.name]) byProduct[item.name] = 0
        byProduct[item.name] += itemProfit
      })
    })

    const topProfitable = Object.entries(byProduct)
      .sort((a,b) => b[1]-a[1])
      .slice(0,5)

    return { totalRevenue, totalProfit, topProfitable }
  }, [allSales, todaySales, products, period])

  const periods = [
    { key:'today', label:'Today' },
    { key:'month', label:'This Month' },
    { key:'all',   label:'All Time' },
  ]

  return (
    <div className="page-enter">
      <div className="bg-gradient-to-br from-emerald-900 to-emerald-600 text-white px-5 pt-12 pb-6">
        <h1 className="text-2xl font-extrabold">Profit Report 💰</h1>
        <p className="text-emerald-200 text-sm mt-1">Margin & earnings per medicine</p>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* Period filter */}
        <div className="flex gap-2">
          {periods.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all
                ${period===p.key ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-600 rounded-2xl p-4 text-white">
            <p className="text-emerald-200 text-xs font-semibold">Revenue</p>
            <p className="text-2xl font-extrabold mt-1">₹{salesProfit.totalRevenue.toFixed(0)}</p>
          </div>
          <div className="bg-slate-900 rounded-2xl p-4 text-white">
            <p className="text-slate-400 text-xs font-semibold">Est. Profit</p>
            <p className="text-2xl font-extrabold mt-1">₹{salesProfit.totalProfit.toFixed(0)}</p>
          </div>
        </div>

        {/* Top profitable from sales */}
        {salesProfit.topProfitable.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="font-bold text-sm">🏆 Most Profitable (by sales)</p>
            </div>
            {salesProfit.topProfitable.map(([name, profit], i) => (
              <div key={name} className="flex justify-between items-center px-4 py-3
                                         border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-emerald-100 text-emerald-700 rounded-full
                                   flex items-center justify-center text-xs font-extrabold">
                    {i+1}
                  </span>
                  <span className="text-sm font-semibold text-slate-700">{name}</span>
                </div>
                <span className="text-sm font-bold text-emerald-600">+₹{profit.toFixed(0)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Per medicine margin table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
            <p className="font-bold text-sm text-slate-800">Margin per Medicine</p>
            {/* Sort options */}
            <div className="flex gap-1">
              {[
                { key:'margin', label:'% Margin' },
                { key:'profit', label:'₹ Profit' },
                { key:'name',   label:'A-Z' },
              ].map(s => (
                <button key={s.key} onClick={() => setSortBy(s.key)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all
                    ${sortBy===s.key ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {productProfits.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p className="text-sm">Add buy price & sell price to medicines to see profit</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {productProfits.map(p => {
                const isGood = p.margin >= 20
                const isBad  = p.margin < 5
                return (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-slate-800 truncate">{p.name}</p>
                      <p className="text-xs text-slate-400">
                        Buy ₹{p.buyPrice} → Sell ₹{p.sellPrice}
                      </p>
                    </div>
                    <div className="text-right ml-3">
                      <p className={`font-extrabold text-sm
                        ${isGood ? 'text-emerald-600' : isBad ? 'text-red-500' : 'text-amber-600'}`}>
                        +₹{p.profit.toFixed(1)}
                      </p>
                      <p className={`text-xs font-bold
                        ${isGood ? 'text-emerald-500' : isBad ? 'text-red-400' : 'text-amber-500'}`}>
                        {p.margin.toFixed(0)}% margin
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Low margin warning */}
        {productProfits.filter(p => p.margin < 5).length > 0 && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
            <p className="font-bold text-red-700 text-sm mb-2">⚠️ Low Margin Medicines</p>
            <p className="text-xs text-red-600 mb-2">These medicines have less than 5% profit — consider revising prices:</p>
            {productProfits.filter(p => p.margin < 5).map(p => (
              <p key={p.id} className="text-xs text-red-700 font-semibold">
                • {p.name} ({p.margin.toFixed(1)}%)
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
