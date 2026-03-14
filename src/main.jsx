/*
  main.jsx — App entry point
  This is the first file that runs.
  It mounts the React app into index.html's <div id="root">
*/

import React       from 'react'
import ReactDOM    from 'react-dom/client'
import App         from './App'
import './styles/index.css'

// ReactDOM.createRoot finds the <div id="root"> in index.html
// and renders our entire App component inside it
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
