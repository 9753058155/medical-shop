/*
  firebase.js — Database connection, auth & helpers
  
  UPDATED: Added udhaar (credit) collection
*/

import { initializeApp }          from 'firebase/app'
import { getFirestore, collection, doc,
         addDoc, updateDoc, deleteDoc,
         onSnapshot, serverTimestamp,
         query, orderBy, where,
         writeBatch }             from 'firebase/firestore'
import { getAuth, signInAnonymously,
         onAuthStateChanged }     from 'firebase/auth'

const firebaseConfig = {
  apiKey:            "AIzaSyCL4p8k03mrd_nMFaGhE0WegSYImPA-5qQ",
  authDomain:        "medical-shop-f7f0d.firebaseapp.com",
  projectId:         "medical-shop-f7f0d",
  storageBucket:     "medical-shop-f7f0d.firebasestorage.app",
  messagingSenderId: "664136068030",
  appId:             "1:664136068030:web:919edd7dbad5449200e7ef",
  measurementId:     "G-7QJTRRTBL1"
}

const app = initializeApp(firebaseConfig)
export const db   = getFirestore(app)
export const auth = getAuth(app)

// ── Shop PIN ──
export const SHOP_PIN = '1234'

// ── Auth helpers ──
export const signInToShop = () => signInAnonymously(auth)
export const signOut      = () => auth.signOut()

// onAuthChange — wraps Firebase auth state with silent re-auth
// KEY FIX: When user = null but session is still valid, we silently
// re-authenticate WITHOUT calling cb(null) — this prevents the PIN
// screen from flashing when the auth token refreshes.
export const onAuthChange = (cb) => {
  let silentlyReAuthing = false

  return onAuthStateChanged(auth, async (user) => {
    if (silentlyReAuthing) return  // ignore intermediate null state

    if (!user) {
      const lastActive = parseInt(localStorage.getItem('ms_last_active') || '0')
      const eightHours = 8 * 60 * 60 * 1000

      if (lastActive && Date.now() - lastActive < eightHours) {
        // Session still valid — silently re-auth, DON'T show PIN screen
        silentlyReAuthing = true
        try {
          await signInAnonymously(auth)
          // onAuthStateChanged will fire again with the new user — handled below
        } catch (e) {
          console.error('Auto re-auth failed:', e)
          silentlyReAuthing = false
          cb(null)  // truly failed — show PIN
        }
        return
      }
      // No valid session — show PIN screen
      silentlyReAuthing = false
      cb(null)
    } else {
      // Got a valid user (either fresh login or after silent re-auth)
      silentlyReAuthing = false
      cb(user)
    }
  })
}

// ── Collections ──
export const productsCol    = collection(db, 'products')
export const salesCol       = collection(db, 'sales')
export const wholesalersCol = collection(db, 'wholesalers')
export const udhaarCol      = collection(db, 'udhaar')  // NEW: credit tracker

// ── Products ──
export const addProduct    = (data) => addDoc(productsCol, { ...data, createdAt: serverTimestamp() })
export const updateProduct = (id, data) => updateDoc(doc(db, 'products', id), { ...data, updatedAt: serverTimestamp() })
export const deleteProduct = (id) => deleteDoc(doc(db, 'products', id))
export const listenProducts = (cb) =>
  onSnapshot(query(productsCol, orderBy('createdAt', 'desc')), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

// ── Sales ──
export const addSale = (data) => addDoc(salesCol, { ...data, createdAt: serverTimestamp() })
export const listenTodaySales = (cb) => {
  // Note: Using orderBy only (no where) to avoid needing a composite Firestore index.
  // We filter today's sales in JavaScript instead.
  return onSnapshot(
    query(salesCol, orderBy('createdAt', 'desc')),
    snap => {
      const today = new Date(); today.setHours(0,0,0,0)
      const all   = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      const todayOnly = all.filter(s => {
        const d = s.createdAt?.toDate?.() || new Date(s.date || 0)
        return d >= today
      })
      cb(todayOnly)
    })
}
export const listenAllSales = (cb) =>
  onSnapshot(query(salesCol, orderBy('createdAt', 'desc')), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

// ── Wholesalers ──
export const addWholesaler    = (data) => addDoc(wholesalersCol, { ...data, createdAt: serverTimestamp() })
export const updateWholesaler = (id, data) => updateDoc(doc(db, 'wholesalers', id), data)
export const deleteWholesaler = (id) => deleteDoc(doc(db, 'wholesalers', id))
export const listenWholesalers = (cb) =>
  onSnapshot(query(wholesalersCol, orderBy('createdAt', 'desc')), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

// ── Udhaar (Credit) ──
export const addUdhaar    = (data) => addDoc(udhaarCol, { ...data, createdAt: serverTimestamp(), paid: false })
export const updateUdhaar = (id, data) => updateDoc(doc(db, 'udhaar', id), data)
export const deleteUdhaar = (id) => deleteDoc(doc(db, 'udhaar', id))
export const listenUdhaar = (cb) =>
  onSnapshot(query(udhaarCol, orderBy('createdAt', 'desc')), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

// ── Stock helpers ──
export const formatStock = (product) => {
  const isTablet = product.unit === 'tablet' || product.unit === 'capsule'
  if (!isTablet || !product.perStrip || product.perStrip <= 1)
    return `${product.stock ?? 0} ${product.unit}(s)`
  const strips   = Math.floor((product.stock ?? 0) / product.perStrip)
  const leftover = (product.stock ?? 0) % product.perStrip
  const parts    = []
  if (strips   > 0) parts.push(`${strips} strip${strips > 1 ? 's' : ''}`)
  if (leftover > 0) parts.push(`${leftover} tablet${leftover > 1 ? 's' : ''}`)
  return parts.length ? parts.join(' + ') : '0 tablets'
}

export const stockStatus = (product) => {
  if ((product.stock ?? 0) <= 0) return 'out'
  if ((product.stock ?? 0) <= (product.lowAlert ?? 10)) return 'low'
  return 'ok'
}

// ── Expiry helpers ──
// Returns 'expired' | 'soon' (within 30 days) | 'ok' | null (no expiry set)
export const expiryStatus = (product) => {
  if (!product.expiryDate) return null
  const today  = new Date()
  const expiry = new Date(product.expiryDate)
  const days   = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24))
  if (days <= 0)  return 'expired'
  if (days <= 30) return 'soon'
  return 'ok'
}

// Returns days until expiry (negative if expired)
export const daysUntilExpiry = (product) => {
  if (!product.expiryDate) return null
  const today  = new Date()
  const expiry = new Date(product.expiryDate)
  return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24))
}

// ── WhatsApp bill helper ──
// Generates a WhatsApp message with bill details
export const generateWhatsAppBill = (sale) => {
  const date  = sale.createdAt?.toDate?.() || new Date(sale.date || sale.createdAt)
  const items = (sale.items || []).map(i =>
    `  • ${i.name} x${i.qty} = Rs.${(i.qty * i.price).toFixed(0)}`
  ).join('\n')

  let msg = `*Sarvesh Medicals* 💊\n`
  msg += `_Medical Shop, Maheshwar_\n`
  msg += `─────────────────\n`
  msg += `📅 ${date.toLocaleDateString('en-IN')}\n`
  msg += `👤 ${sale.customer || 'Customer'}\n`
  msg += `─────────────────\n`
  msg += `*Items:*\n${items}\n`
  msg += `─────────────────\n`
  if (parseFloat(sale.discountAmt) > 0) {
    msg += `Subtotal: Rs.${parseFloat(sale.subtotal).toFixed(0)}\n`
    msg += `Discount: -Rs.${parseFloat(sale.discountAmt).toFixed(0)}\n`
  }
  msg += `*Total: Rs.${sale.total}*\n`
  if (sale.paymentMethod) msg += `Payment: ${sale.paymentMethod}\n`
  msg += `─────────────────\n`
  msg += `Thank you! 🙏`

  return encodeURIComponent(msg)
}
