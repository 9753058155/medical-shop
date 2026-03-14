# 💊 Medical Shop Manager — Setup Guide

## 📁 File Structure
```
medical-shop/
├── index.html              ← Browser entry point
├── package.json            ← Project dependencies
├── vite.config.js          ← Build tool config
├── tailwind.config.js      ← CSS framework config
├── postcss.config.js       ← CSS processor config
└── src/
    ├── main.jsx            ← React entry point
    ├── App.jsx             ← Routing + shared data + nav
    ├── firebase.js         ← 🔴 PUT YOUR FIREBASE CONFIG HERE
    ├── styles/
    │   └── index.css       ← Global styles + animations
    ├── pages/
    │   ├── Dashboard.jsx   ← Home screen with stats
    │   ├── Products.jsx    ← Add/edit/search medicines
    │   ├── Sell.jsx        ← Record sales
    │   ├── Wholesalers.jsx ← Wholesaler + bill upload
    │   └── Reports.jsx     ← Sales reports
    └── components/
        ├── Modal.jsx       ← Reusable popup
        └── StockBadge.jsx  ← Stock status badge
```

---

## 🚀 STEP 1 — Install Node.js
Download from: https://nodejs.org (choose LTS version)
After install, open VS Code terminal and check:
```bash
node --version   # should show v18 or higher
npm --version
```

---

## 🔥 STEP 2 — Set Up Firebase (5 minutes)

1. Go to https://firebase.google.com → Sign in with Google
2. Click **"Create a project"** → name it `medical-shop` → Continue
3. Disable Google Analytics (not needed) → Create project

### Enable Firestore Database:
4. Left sidebar → **Firestore Database** → Create database
5. Choose **"Start in test mode"** → Next → Enable

### Enable Storage (for bill images):
6. Left sidebar → **Storage** → Get started → Next → Done

### Get your config:
7. Left sidebar → **Project Overview** (⚙️ gear icon) → **Project settings**
8. Scroll down → **Your apps** → Click **</>** (web icon)
9. App nickname: `medical-shop-web` → Register app
10. **Copy the firebaseConfig object** — it looks like:
```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "medical-shop-xxxxx.firebaseapp.com",
  projectId: "medical-shop-xxxxx",
  storageBucket: "medical-shop-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456:web:abcdef"
}
```

### Paste config into firebase.js:
11. Open `src/firebase.js` in VS Code
12. Find the `firebaseConfig` object (line ~30)
13. Replace the placeholder values with your real values
14. Save the file ✅

---

## 💻 STEP 3 — Run the App

Open VS Code terminal in the project folder:
```bash
# Install all dependencies (only first time)
npm install

# Start the development server
npm run dev
```

Open your browser at: **http://localhost:5173**

---

## 🌐 STEP 4 — Deploy Free (Netlify)

```bash
# Build for production
npm run build

# This creates a "dist" folder
```

Then:
1. Go to https://netlify.com → Sign up free
2. Drag the `dist` folder onto Netlify
3. You get a free URL like `https://medical-shop-abc.netlify.app`
4. Share this URL with all your workers — they open it on their phones!

---

## 📱 Future: Make it a Mobile App (WebView)

Since this is a React web app, converting to mobile is easy:

### Android (React Native WebView):
```jsx
import { WebView } from 'react-native-webview'
<WebView source={{ uri: 'https://your-netlify-url.netlify.app' }} />
```

### iPhone (WKWebView in Swift):
```swift
let webView = WKWebView()
webView.load(URLRequest(url: URL(string: "https://your-netlify-url.netlify.app")!))
```

Or use **Capacitor** (free) to wrap the web app into a real Android/iOS app:
```bash
npm install @capacitor/core @capacitor/cli
npx cap init
npx cap add android
npx cap add ios
```

---

## 👥 Multi-user (4-5 workers)

No login needed for now! Just share the URL.
All workers see the same data in real time (Firebase syncs in <1 second).

To add login later → Enable Firebase Authentication → add Google/phone login.

---

## ❓ Common Issues

**"Firebase: Error (auth/...)"** → Check your firebaseConfig values in firebase.js

**Page shows loading forever** → Firebase config is wrong, check projectId

**npm: command not found** → Node.js not installed, go to Step 1

**Images not uploading** → Make sure Firebase Storage is enabled (Step 2)
