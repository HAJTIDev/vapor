import React from 'react'

function GamepadButtonGlyph({ label, color = '#22c55e', bg = '#161922' }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '22px',
        height: '22px',
        padding: '0 6px',
        borderRadius: '12px',
        background: bg,
        color: color,
        border: `1.5px solid ${color}`,
        fontSize: '11px',
        fontWeight: 800,
        fontFamily: 'var(--mono)',
        boxShadow: `0 0 8px ${color}33`,
        lineHeight: 1,
        letterSpacing: '-0.02em',
      }}
    >
      {label}
    </span>
  )
}

function BumperGlyph({ label }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2px 7px',
        borderRadius: '6px',
        background: '#1a1d28',
        color: '#cbd5e1',
        border: '1px solid #475569',
        fontSize: '10px',
        fontWeight: 700,
        fontFamily: 'var(--mono)',
        letterSpacing: '0.04em',
      }}
    >
      {label}
    </span>
  )
}

function TriggerGlyph({ label }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2px 7px',
        borderRadius: '6px',
        background: '#1e1b4b',
        color: '#c7d2fe',
        border: '1px solid #6366f1',
        fontSize: '10px',
        fontWeight: 700,
        fontFamily: 'var(--mono)',
        letterSpacing: '0.04em',
      }}
    >
      {label}
    </span>
  )
}

export default function GamepadBar({ isVisible, view, selectedGame, activeCollection = 'all', gamepadName }) {
  if (!isVisible) return null

  // Simplify gamepad name (e.g. "Xbox 360 Controller (XInput STANDARD GAMEPAD)" -> "Xbox Controller")
  const displayName = gamepadName
    ? gamepadName.replace(/\(.*?\)/g, '').replace(/STANDARD GAMEPAD/i, '').trim() || 'Controller'
    : 'Gamepad'

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '14px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9990,
        background: 'rgba(15, 17, 26, 0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '30px',
        padding: '8px 20px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5), 0 0 20px rgba(108, 99, 255, 0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: '18px',
        animation: 'slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: 'none',
      }}
    >
      {/* Gamepad badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '14px' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="6" y1="12" x2="10" y2="12" />
          <line x1="8" y1="10" x2="8" y2="14" />
          <line x1="15" y1="13" x2="15.01" y2="13" />
          <line x1="18" y1="11" x2="18.01" y2="11" />
          <rect x="2" y="6" width="20" height="12" rx="6" />
        </svg>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>{displayName}</span>
      </div>

      {/* Prompts depending on view */}
      {view === 'library' && !selectedGame && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <GamepadButtonGlyph label="A" color="#22c55e" />
            <span style={{ fontSize: '12px', color: 'var(--text)' }}>Szczegóły</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <GamepadButtonGlyph label="Y" color="#eab308" />
            <span style={{ fontSize: '12px', color: 'var(--text)' }}>Uruchom</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <GamepadButtonGlyph label="X" color="#3b82f6" />
            <span style={{ fontSize: '12px', color: 'var(--text)' }}>Ulubione</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <TriggerGlyph label="LT" />
            <TriggerGlyph label="RT" />
            <span style={{ fontSize: '12px', color: activeCollection === 'vr' ? '#a5b4fc' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>Kategorie</span>
              {activeCollection === 'vr' && <span style={{ fontSize: '10px', background: 'rgba(99, 102, 241, 0.35)', padding: '1px 5px', borderRadius: '4px', color: '#c7d2fe', fontWeight: 700 }}>🥽 VR</span>}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <GamepadButtonGlyph label="Select" color="#818cf8" />
            <span style={{ fontSize: '12px', color: activeCollection === 'vr' ? '#a5b4fc' : 'var(--text)', fontWeight: 600 }}>
              {activeCollection === 'vr' ? 'Wszystkie Gry 🎮' : 'Gry VR 🥽'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <BumperGlyph label="LB" />
            <BumperGlyph label="RB" />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Widoki</span>
          </div>
        </>
      )}

      {view === 'library' && selectedGame && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <GamepadButtonGlyph label="A" color="#22c55e" />
            <span style={{ fontSize: '12px', color: 'var(--text)' }}>Wybierz</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <GamepadButtonGlyph label="B" color="#ef4444" />
            <span style={{ fontSize: '12px', color: 'var(--text)' }}>Wróć</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <GamepadButtonGlyph label="Y" color="#eab308" />
            <span style={{ fontSize: '12px', color: 'var(--text)' }}>Graj</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <GamepadButtonGlyph label="X" color="#3b82f6" />
            <span style={{ fontSize: '12px', color: 'var(--text)' }}>Ulubione</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <GamepadButtonGlyph label="Select" color="#818cf8" />
            <span style={{ fontSize: '12px', color: '#c7d2fe' }}>
              {selectedGame.isVR ? 'Wyłącz VR' : 'Oznacz jako VR 🥽'}
            </span>
          </div>
        </>
      )}

      {view !== 'library' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <GamepadButtonGlyph label="B" color="#ef4444" />
            <span style={{ fontSize: '12px', color: 'var(--text)' }}>Biblioteka</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <BumperGlyph label="LB" />
            <BumperGlyph label="RB" />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Zakładki</span>
          </div>
        </>
      )}
    </div>
  )
}
