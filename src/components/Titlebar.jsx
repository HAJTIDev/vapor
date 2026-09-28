import React, { useState, useEffect } from 'react'
import vaporApi from '../vaporApi.js'
import logo from '../img/image.png'

export default function Titlebar({ gamepadName }) {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    let alive = true
    if (vaporApi.win?.isMaximized) {
      vaporApi.win.isMaximized().then((max) => {
        if (alive) setIsMaximized(!!max)
      })
    }

    const onMaxChange = (max) => {
      setIsMaximized(!!max)
    }

    vaporApi.on('win:maximize-change', onMaxChange)
    return () => {
      alive = false
      vaporApi.off('win:maximize-change', onMaxChange)
    }
  }, [])

  const handleTitlebarDoubleClick = (e) => {
    if (e.target.closest('.titlebar-controls') || e.target.closest('button')) return
    vaporApi.win.maximize()
  }

  const shortPadName = gamepadName
    ? gamepadName.replace(/\(.*?\)/g, '').replace(/STANDARD GAMEPAD/i, '').trim() || 'Gamepad'
    : null

  return (
    <div
      className="titlebar"
      onDoubleClick={handleTitlebarDoubleClick}
      style={{
        height: 38,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        WebkitAppRegion: 'drag',
        flexShrink: 0,
        paddingLeft: 16,
        paddingRight: 0,
        position: 'relative',
        zIndex: 100,
      }}
    >
      <div className="titlebar-brand" style={{ display: 'flex', alignItems: 'center', gap: 10, WebkitAppRegion: 'no-drag' }}>
        <img
          src={logo}
          alt="Vapor"
          style={{ width: 18, height: 18, objectFit: 'contain' }}
        />
        <span style={{ fontWeight: 600, fontSize: 13, letterSpacing: '0.12em', color: 'var(--text)', fontFamily: 'var(--mono)' }}>
          VAPOR
        </span>

        {shortPadName && (
          <div
            title={`Connected: ${gamepadName}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '999px',
              background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)',
              fontSize: '11px',
              fontWeight: 500,
              color: 'var(--text)',
              marginLeft: '8px',
            }}
          >
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#22c55e',
              boxShadow: '0 0 8px #22c55e',
              animation: 'livePulse 1.8s infinite',
            }} />
            <span>🎮 {shortPadName}</span>
          </div>
        )}
      </div>

      <div className="titlebar-controls" style={{ display: 'flex', height: '100%', WebkitAppRegion: 'no-drag' }}>
        <WinBtn
          action="minimize"
          title="Minimize"
          hoverBg="var(--surface2)"
          icon={
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1" />
            </svg>
          }
        />
        <WinBtn
          action="maximize"
          title={isMaximized ? 'Restore Down' : 'Maximize'}
          hoverBg="var(--surface2)"
          icon={
            isMaximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.5 2.5V0.5H9.5V7.5H7.5" stroke="currentColor" strokeWidth="1" />
                <rect x="0.5" y="2.5" width="7" height="7" stroke="currentColor" strokeWidth="1" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" />
              </svg>
            )
          }
        />
        <WinBtn
          action="close"
          title="Close"
          hoverBg="#c42b1c"
          icon={
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="0.5" y1="0.5" x2="9.5" y2="9.5" stroke="currentColor" strokeWidth="1" />
              <line x1="9.5" y1="0.5" x2="0.5" y2="9.5" stroke="currentColor" strokeWidth="1" />
            </svg>
          }
        />
      </div>
    </div>
  )
}

function WinBtn({ action, title, icon, hoverBg }) {
  const [hov, setHov] = React.useState(false)
  return (
    <button
      onClick={() => vaporApi.win[action]()}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={title}
      aria-label={title}
      className={`ui-btn titlebar-btn titlebar-btn-${action}`}
      style={{
        width: 46,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: hov ? '#fff' : 'var(--text-muted)',
        background: hov ? hoverBg : 'transparent',
        transition: 'background 0.12s ease, color 0.12s ease',
      }}
    >
      {icon}
    </button>
  )
}
