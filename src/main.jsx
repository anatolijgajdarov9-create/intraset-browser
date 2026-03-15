import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

console.log('[RENDERER] main.jsx loading...');
const isElectron = typeof window.electronAPI !== 'undefined';
console.log('[RENDERER] isElectron:', isElectron);

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<App />)

const loader = document.getElementById('loader')
if (loader) {
  const observer = new MutationObserver(() => {
    if (document.getElementById('root').classList.contains('visible')) {
      loader.style.display = 'none'
      observer.disconnect()
    }
  })
  observer.observe(document.getElementById('root'), { attributes: true })
}