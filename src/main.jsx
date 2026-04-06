import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { applyTheme, getCurrentTheme } from './themes.js'

applyTheme(getCurrentTheme())

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
