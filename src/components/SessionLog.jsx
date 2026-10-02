import React, { useState } from 'react'
import {
  formatSessionDuration,
  formatSessionDateTime,
  formatRelativeTime,
} from '../statusWorkflow.js'

export default function SessionLog({
  sessions = [],
  onDeleteSession,
  gameTitle = '',
}) {
  const [showAll, setShowAll] = useState(false)

  const safeSessions = Array.isArray(sessions) ? [...sessions] : []
  // Sort descending by start time
  safeSessions.sort((a, b) => Number(b.start || 0) - Number(a.start || 0))

  const visibleSessions = showAll ? safeSessions : safeSessions.slice(0, 8)

  return (
    <div
      style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        position: 'relative',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
          }}>
            🕒
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Historical Session Log
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {safeSessions.length} {safeSessions.length === 1 ? 'play session' : 'play sessions'} recorded
            </div>
          </div>
        </div>
      </div>

      {/* Session List */}
      {safeSessions.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '24px 16px',
          background: 'var(--surface)',
          borderRadius: 8,
          border: '1px dashed var(--border)',
          color: 'var(--text-muted)',
          fontSize: '12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ fontSize: '24px' }}>⏱️</span>
          <span>No historical play sessions recorded yet.</span>
          <span style={{ fontSize: '11px', opacity: 0.8 }}>
            Sessions are automatically recorded whenever you launch and play the game.
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {visibleSessions.map((session, idx) => (
            <div
              key={session.id || idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                gap: '12px',
                transition: 'border-color 0.15s',
              }}
            >
              {/* Left: Date & Time info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  flexShrink: 0,
                }}>
                  {session.manual ? '📝' : '🎮'}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                      {formatSessionDateTime(session.start)}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      ({formatRelativeTime(session.start)})
                    </span>
                    {session.manual && (
                      <span style={{
                        fontSize: '9px',
                        padding: '1px 5px',
                        borderRadius: 4,
                        background: 'rgba(129, 140, 248, 0.15)',
                        color: '#818cf8',
                        border: '1px solid rgba(129, 140, 248, 0.3)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        fontWeight: 600,
                      }}>
                        Manual
                      </span>
                    )}
                  </div>

                  {session.notes && (
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px', fontStyle: 'italic' }}>
                      "{session.notes}"
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Duration Pill & Delete action */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                <div style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#10b981',
                  fontFamily: 'var(--mono)',
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  <span>⏱</span>
                  <span>{formatSessionDuration(session.durationMinutes)}</span>
                </div>

                {onDeleteSession && (
                  <button
                    type="button"
                    title="Delete session"
                    onClick={() => {
                      if (window.confirm('Delete this play session? Total playtime will be updated.')) {
                        onDeleteSession(session.id || session)
                      }
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: 4,
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--red)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                  >
                    🗑
                  </button>
                )}
              </div>
            </div>
          ))}

          {safeSessions.length > 8 && (
            <button
              type="button"
              className="ui-btn"
              onClick={() => setShowAll(prev => !prev)}
              style={{
                alignSelf: 'center',
                marginTop: '4px',
                padding: '6px 14px',
                fontSize: '11px',
                color: 'var(--accent)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              {showAll ? 'Show Fewer Sessions ▲' : `View All ${safeSessions.length} Sessions ▼`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
