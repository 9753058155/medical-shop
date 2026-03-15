/*
  PhoneInput.jsx — Reusable phone input with Indian mobile validation
  
  USAGE:
    <PhoneInput value={phone} onChange={setPhone} label="Phone" />
  
  VALIDATES:
  - Must be exactly 10 digits
  - Must start with 6, 7, 8, or 9 (Indian mobile numbers)
  - Shows green tick when valid, red message when invalid
  - Allows empty (phone is usually optional)
*/

import React, { useState } from 'react'
import { validatePhone }   from '../i18n'

export default function PhoneInput({ value, onChange, label = 'Phone / फोन', placeholder = '9876543210', required = false }) {
  const [touched, setTouched] = useState(false)

  const { valid, msg } = validatePhone(value)
  const showError = touched && value && !valid
  const showValid = touched && value && valid

  function handleChange(e) {
    // Only allow digits, max 10
    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10)
    onChange(cleaned)
  }

  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div className="relative">
        {/* India flag + code prefix */}
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 font-medium select-none">
          🇮🇳 +91
        </span>

        <input
          type="tel"
          value={value}
          onChange={handleChange}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          inputMode="numeric"
          maxLength={10}
          className={`w-full pl-16 pr-10 py-2.5 rounded-xl text-sm outline-none border
                      transition-all font-medium
                      ${showError ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-100' :
                        showValid ? 'border-green-400 bg-green-50 focus:border-green-500 focus:ring-2 focus:ring-green-100' :
                        'border-slate-200 bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-50'}
                      `}
          style={{ border: '1.5px solid', borderColor: showError ? '#f87171' : showValid ? '#4ade80' : '#e2e8f0' }}
        />

        {/* Status icon */}
        {value && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
            {valid ? '✅' : '❌'}
          </span>
        )}
      </div>

      {/* Validation message */}
      {showError && (
        <p className="text-xs text-red-500 font-medium mt-1">
          ⚠️ {msg || '10 अंकों का सही मोबाइल नंबर डालें (starts with 6-9)'}
        </p>
      )}
      {showValid && (
        <p className="text-xs text-green-600 font-medium mt-1">
          ✓ Valid Indian mobile number
        </p>
      )}

      {/* Character count */}
      {value && (
        <p className="text-xs text-slate-400 mt-0.5 text-right">
          {value.length}/10
        </p>
      )}
    </div>
  )
}
