/*
  Reorder.jsx — Auto-generate reorder list
  
  Shows all low/out stock medicines grouped by wholesaler.
  One tap to send the entire list to wholesaler on WhatsApp!
*/

import React, { useMemo, useState } from 'react'
import { useApp }                    from '../App'
import { formatStock, stockStatus }  from '../firebase'

export default function Reorder() {
  const { products, wholesalers } = useApp()
  const [sentTo, setSentTo]       = useState({}) // track which wholesalers got WhatsApp

  // Get all low/out stock items
  const needsReorder = useMemo(() =>
    products.filter(p => stockStatus(p) === 'low' || stockStatus(p) === 'out')
      .sort((a,b) => (a.stock ?? 0) - (b.stock ?? 0))
  , [products])

  // Group by wholesaler
  const byWholesaler = useMemo(() => {
    const groups = {}
    needsReorder.forEach(p => {
      const wId   = p.wholesalerId || 'unknown'
      const wName = p.wholesalerName || 'Unknown Wholesaler'
      if (!groups[wId]) groups[wId] = { name: wName, items: [], phone: '' }
      groups[wId].items.push(p)
    })
    // Add phone numbers from wholesalers list
    wholesalers.forEach(w => {
      if (groups[w.id]) groups[w.id].phone = w.phone || ''
    })
    return groups
  }, [needsReorder, wholesalers])

  // Send WhatsApp message to a wholesaler with their reorder list
  function sendWhatsApp(wId) {
    const group = byWholesaler[wId]
    if (!group) return

    let msg = `Namaste! 🙏\n*Sarvesh Medicals* ka order:\n\n`
    group.items.forEach((p, i) => {
      const isOut = p.stock <= 0
      msg += `${i+1}. *${p.name}*\n`
      msg += `   Current: ${isOut ? '🚫 Out' : formatStock(p)}\n`
      msg += `   Please send: _____ strips\n\n`
    })
    msg += `Thank you! 💊`

    const encoded = encodeURIComponent(msg)
    const url = group.phone
      ? `https://wa.me/91${group.phone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`
    window.open(url, '_blank')
    setSentTo(s => ({...s, [wId]: true}))
  }

  // Send all as one message
  function sendAll() {
    let msg = `*Sarvesh Medicals* — Complete Reorder List 📋\n\n`
    Object.entries(byWholesaler).forEach(([wId, group]) => {
      msg += `*${group.name}:*\n`
      group.items.forEach((p,i) => {
        msg += `  ${i+1}. ${p.name} (${p.stock <= 0 ? 'OUT' : formatStock(p)})\n`
      })
      msg += '\n'
    })
    msg += `Date: ${new Date().toLocaleDateString('en-IN')}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div className="page-enter">
      <div className="bg-gradient-to-br from-purple-900 to-purple-600 text-white px-5 pt-12 pb-6">
        <h1 className="text-2xl font-extrabold">Reorder List 📋</h1>
        <p className="text-purple-200 text-sm mt-1">{needsReorder.length} medicines need restocking</p>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {needsReorder.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <div className="text-5xl mb-4">✅</div>
            <p className="font-bold text-lg text-slate-600">All stocks are sufficient!</p>
            <p className="text-sm mt-1">No reorder needed right now</p>
          </div>
        ) : (
          <>
            {/* Send all button */}
            <button onClick={sendAll}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold
                         py-3.5 rounded-2xl shadow-lg shadow-green-200 active:scale-[0.98]
                         flex items-center justify-center gap-2">
              📱 Send Full List on WhatsApp
            </button>

            {/* Grouped by wholesaler */}
            {Object.entries(byWholesaler).map(([wId, group]) => (
              <div key={wId} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">

                {/* Wholesaler header */}
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100
                                flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-800">🏪 {group.name}</p>
                    {group.phone && <p className="text-xs text-slate-400">📞 {group.phone}</p>}
                  </div>
                  <button onClick={() => sendWhatsApp(wId)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all
                      ${sentTo[wId]
                        ? 'bg-green-100 text-green-700'
                        : 'bg-green-500 text-white shadow-sm shadow-green-200'}`}>
                    {sentTo[wId] ? '✅ Sent' : '📱 WhatsApp'}
                  </button>
                </div>

                {/* Medicine list */}
                <div className="divide-y divide-slate-50">
                  {group.items.map(p => {
                    const isOut = p.stock <= 0
                    return (
                      <div key={p.id} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="font-semibold text-sm text-slate-800">{p.name}</p>
                          <p className="text-xs text-slate-400">{p.category}</p>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full
                            ${isOut ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                            {isOut ? '🚫 Out' : `⚠️ ${formatStock(p)}`}
                          </span>
                          {p.sellPrice && p.buyPrice && (
                            <p className="text-xs text-slate-400 mt-1">
                              Buy: ₹{p.buyPrice}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
