/*
  firebase.js — Database connection, auth & helpers
  
  SECURITY:
  - Uses Firebase Anonymous Auth
  - Workers enter a shop PIN → app signs them in anonymously
  - Firestore rules only allow signed-in users
  - Strangers on internet cannot access your data
*/

import { initializeApp }          from 'firebase/app'
import { getFirestore, collection, doc,
         addDoc, updateDoc, deleteDoc,
         onSnapshot, serverTimestamp,
         query, orderBy, where,
         writeBatch }             from 'firebase/firestore'
import { getAuth, signInAnonymously,
         onAuthStateChanged }     from 'firebase/auth'

// YOUR FIREBASE CONFIG
const firebaseConfig = {
  apiKey:            "AIzaSyCL4p8k03mrd_nMFaGhE0WegSYImPA-5qQ",
  authDomain:        "medical-shop-f7f0d.firebaseapp.com",
  projectId:         "medical-shop-f7f0d",
  storageBucket:     "medical-shop-f7f0d.firebasestorage.app",
  messagingSenderId: "664136068030",
  appId:             "1:664136068030:web:919edd7dbad5449200e7ef",
  measurementId:     "G-7QJTRRTBL1"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Firestore database
export const db   = getFirestore(app)

// Firebase Auth
export const auth = getAuth(app)

// ─────────────────────────────────────────────────────
// SHOP PIN — change this to your own secret PIN!
// Tell this PIN to your workers only.
// ─────────────────────────────────────────────────────
export const SHOP_PIN = '1234'

// Sign in anonymously (called after PIN is verified)
// This creates a temporary anonymous user in Firebase
// Firestore rules check this user exists before allowing access
export const signInToShop = () => signInAnonymously(auth)

// Listen to auth state changes
// callback(user) — user is null if not logged in
export const onAuthChange = (callback) => onAuthStateChanged(auth, callback)

// Sign out
export const signOut = () => auth.signOut()


// ─────────────────────────────────────────────────────
// COLLECTION REFERENCES
// ─────────────────────────────────────────────────────
export const productsCol    = collection(db, 'products')
export const salesCol       = collection(db, 'sales')
export const wholesalersCol = collection(db, 'wholesalers')


// ─────────────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────────────
export const addProduct = (data) =>
  addDoc(productsCol, { ...data, createdAt: serverTimestamp() })

export const updateProduct = (id, data) =>
  updateDoc(doc(db, 'products', id), { ...data, updatedAt: serverTimestamp() })

export const deleteProduct = (id) =>
  deleteDoc(doc(db, 'products', id))

export const listenProducts = (callback) =>
  onSnapshot(
    query(productsCol, orderBy('createdAt', 'desc')),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  )


// ─────────────────────────────────────────────────────
// SALES
// ─────────────────────────────────────────────────────
export const addSale = (data) =>
  addDoc(salesCol, { ...data, createdAt: serverTimestamp() })

export const listenTodaySales = (callback) => {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  return onSnapshot(
    query(salesCol, where('createdAt', '>=', startOfDay), orderBy('createdAt', 'desc')),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  )
}

export const listenAllSales = (callback) =>
  onSnapshot(
    query(salesCol, orderBy('createdAt', 'desc')),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  )


// ─────────────────────────────────────────────────────
// WHOLESALERS
// ─────────────────────────────────────────────────────
export const addWholesaler    = (data) =>
  addDoc(wholesalersCol, { ...data, createdAt: serverTimestamp() })

export const updateWholesaler = (id, data) =>
  updateDoc(doc(db, 'wholesalers', id), data)

export const deleteWholesaler = (id) =>
  deleteDoc(doc(db, 'wholesalers', id))

export const listenWholesalers = (callback) =>
  onSnapshot(
    query(wholesalersCol, orderBy('createdAt', 'desc')),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  )


// ─────────────────────────────────────────────────────
// STOCK HELPERS
// ─────────────────────────────────────────────────────

// Format stock as "4 strips + 7 tablets"
export const formatStock = (product) => {
  const isTablet = product.unit === 'tablet' || product.unit === 'capsule'
  if (!isTablet || !product.perStrip || product.perStrip <= 1) {
    return `${product.stock ?? 0} ${product.unit}(s)`
  }
  const strips   = Math.floor((product.stock ?? 0) / product.perStrip)
  const leftover = (product.stock ?? 0) % product.perStrip
  const parts    = []
  if (strips   > 0) parts.push(`${strips} strip${strips > 1 ? 's' : ''}`)
  if (leftover > 0) parts.push(`${leftover} tablet${leftover > 1 ? 's' : ''}`)
  return parts.length ? parts.join(' + ') : '0 tablets'
}

// Get stock status: 'out' | 'low' | 'ok'
export const stockStatus = (product) => {
  if ((product.stock ?? 0) <= 0) return 'out'
  if ((product.stock ?? 0) <= (product.lowAlert ?? 10)) return 'low'
  return 'ok'
}
