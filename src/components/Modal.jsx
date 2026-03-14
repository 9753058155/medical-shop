/*
  Modal.jsx — Reusable bottom-sheet popup component

  USAGE:
    <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Product">
      <p>Content goes here</p>
    </Modal>

  PROPS:
  • isOpen  — boolean: show or hide the modal
  • onClose — function: called when user taps outside or close button
  • title   — string: modal heading
  • children — anything inside <Modal>...</Modal>
*/

import React, { useEffect } from 'react'

export default function Modal({ isOpen, onClose, title, children }) {

  // Lock body scroll when modal is open (prevents background scrolling)
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else        document.body.style.overflow = ''
    return ()  => { document.body.style.overflow = '' }
  }, [isOpen])

  // Don't render anything if modal is closed
  if (!isOpen) return null

  return (
    // Dark overlay — clicking it closes the modal
    <div
      className="fixed inset-0 z-50 flex items-end justify-center
                 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal box — stop click from bubbling to overlay */}
      <div
        className="w-full max-w-2xl bg-white rounded-t-3xl
                   max-h-[92vh] overflow-y-auto sheet-up
                   pb-8 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h2 className="text-lg font-extrabold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center
                       rounded-full bg-slate-100 text-slate-500
                       hover:bg-slate-200 transition-colors text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="px-5 pt-4">
          {children}
        </div>
      </div>
    </div>
  )
}
