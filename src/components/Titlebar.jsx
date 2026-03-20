import React from 'react'
import vaporApi from '../vaporApi.js'
import logo from '../img/image.png'

export default function Titlebar() {
  return (
    <div style={{
      height: 38, display:'flex', alignItems:'center', justifyContent:'space-between',
      background:'var(--bg)', borderBottom:'1px solid var(--border)',
      WebkitAppRegion:'drag', flexShrink:0, paddingLeft:16, paddingRight:0,
      position:'relative', zIndex:100
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <img
          src={logo}
          alt="Vapor"
          style={{ width:18, height:18, objectFit:'contain' }}
        />
        <span style={{ fontWeight:600, fontSize:13, letterSpacing:'0.12em', color:'var(--text)', fontFamily:'var(--mono)' }}>
          VAPOR
        </span>
      </div>
      <div style={{ display:'flex', WebkitAppRegion:'no-drag' }}>
        {[
          { label:'−', action:'minimize', hoverBg:'var(--surface2)' },
          { label:'□', action:'maximize', hoverBg:'var(--surface2)' },
          { label:'✕', action:'close',    hoverBg:'#c0392b' },
        ].map(btn => (
          <WinBtn key={btn.action} {...btn} />
        ))}
      </div>
    </div>
  )
}

function WinBtn({ label, action, hoverBg }) {
  const [hov, setHov] = React.useState(false)
  return (
    <button
      onClick={() => vaporApi.win[action]()}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width:46, height:38, display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:14, color: hov ? '#fff' : 'var(--text-muted)',
        background: hov ? hoverBg : 'transparent',
        transition:'all 0.12s'
      }}
    >{label}</button>
  )
}
