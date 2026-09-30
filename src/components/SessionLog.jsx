import React, { useState } from 'react'
import {
  formatSessionDuration,
  formatSessionDateTime,
  formatRelativeTime,
} from '../statusWorkflow.js'

export default function SessionLog({
  sessions = [],
  onAddSession,
  onDeleteSession,
  gameTitle = '',
}) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAll, setShowAll] = useState(false)

  // Manual Session Form state
  const now = new Date()
  const defaultDateStr = now.toISOString().slice(0, 16)
  const [sessionDate, setSessionDate] = useState(defaultDateStr)
  const [hoursVal, setHoursVal] = useState('1')
  const [minsVal, setMinsVal] = useState('0')
  const [notesVal, setNotesVal] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const safeSessions = Array.isArray(sessions) ? [...sessions] : []
  // Sort descending by start time
  safeSessions.sort((a, b) => Number(b.start || 0) - Number(a.start || 0))

  const visibleSessions = showAll ? safeSessions : safeSessions.slice(0, 8)

  const handleSaveManual = (e) => {
    e.preventDefault()
    setErrorMsg('')
    const dateObj = new Date(sessionDate)
    if (isNaN(dateObj.getTime())) {
      setErrorMsg('Please enter a valid date and time.')
      return
    }

    const h = Math.max(0, parseInt(hoursVal, 10) || 0)
    const m = Math.max(0, parseInt(minsVal, 10) || 0)
    const totalMinutes = h * 60 + m

    if (totalMinutes <= 0) {
      setErrorMsg('Duration must be greater than 0 minutes.')
      return
    }

    const newSession = {
      id: String(Date.now()),
      start: dateObj.getTime(),
      end: dateObj.getTime() + totalMinutes * 60000,
      durationMinutes: totalMinutes,
      notes: notesVal.trim(),
      manual: true,
    }

    onAddSession?.(newSession)
    setShowAddModal(false)
    setHoursVal('1')
    setMinsVal('0')
    setNotesVal('')
  }

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

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="ui-btn btn-accent"
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 600,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
          }}
        >
          <span>+</span>
          <span>Log Session</span>
        </button>
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
            Sessions are logged automatically when launched from Vapor, or you can record past play manually.
          </span>
          <button
            type="button"
            className="ui-btn"
            onClick={() => setShowAddModal(true)}
            style={{
              marginTop: '4px',
              padding: '5px 12px',
              fontSize: '11px',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--accent)',
              cursor: 'pointer',
            }}
          >
            + Log First Session
          </button>
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

      {/* Manual Session Log Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border2)',
              borderRadius: 14,
              width: '100%',
              maxWidth: '460px',
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>📝</span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
                  Log Past Play Session
                </span>
              </div>
              <button
                type="button"
                className="ui-btn"
                onClick={() => setShowAddModal(false)}
                style={{ color: 'var(--text-muted)', fontSize: '14px', padding: '4px 8px' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveManual} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {errorMsg && (
                <div style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: 'var(--red)',
                  fontSize: '12px',
                }}>
                  {errorMsg}
                </div>
              )}

              {/* Start Date & Time */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
                  Date & Start Time
                </label>
                <input
                  type="datetime-local"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="ui-input"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    fontSize: '13px',
                  }}
                  required
                />
              </div>

              {/* Duration inputs */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
                  Session Duration
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      value={hoursVal}
                      onChange={(e) => setHoursVal(e.target.value)}
                      className="ui-input"
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        fontSize: '13px',
                      }}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>hours</span>
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={minsVal}
                      onChange={(e) => setMinsVal(e.target.value)}
                      className="ui-input"
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        fontSize: '13px',
                      }}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>minutes</span>
                  </div>
                </div>
              </div>

              {/* Session Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notesVal}
                  onChange={(e) => setNotesVal(e.target.value)}
                  placeholder="e.g. Played offline on Steam Deck, Finished Chapter 2"
                  className="ui-input"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    fontSize: '13px',
                  }}
                />
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="ui-btn"
                  style={{
                    padding: '8px 14px',
                    fontSize: '12px',
                    borderRadius: 8,
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ui-btn btn-accent"
                  style={{
                    padding: '8px 18px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                >
                  Save Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
