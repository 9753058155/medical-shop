/*
  StockBadge.jsx — Shows stock status as a colored badge

  USAGE:
    <StockBadge product={product} />

  Shows:
  • ✅ Green  — In Stock
  • ⚠️ Amber  — Low Stock
  • 🚫 Red    — Out of Stock
*/

import React from 'react'
import { stockStatus, formatStock } from '../firebase'

export default function StockBadge({ product, showCount = true }) {
  const status = stockStatus(product)

  const config = {
    ok:  { bg: 'bg-green-50',  text: 'text-green-700',  label: '✅ In Stock'      },
    low: { bg: 'bg-amber-50',  text: 'text-amber-700',  label: '⚠️ Low Stock'     },
    out: { bg: 'bg-red-50',    text: 'text-red-700',    label: '🚫 Out of Stock'  },
  }[status]

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1
                      rounded-full text-xs font-bold
                      ${config.bg} ${config.text}`}>
      {showCount && status !== 'out'
        ? formatStock(product)
        : config.label}
    </span>
  )
}
