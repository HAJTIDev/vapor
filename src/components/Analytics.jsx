import React, { useState, useMemo } from 'react'
import {
  BACKLOG_STATUSES,
  getStatusConfig,
  formatSessionDuration,
  formatSessionDateTime,
  formatRelativeTime,
  generateAllMonthsHistory,
} from '../statusWorkflow.js'
import PlaytimeHeatmap from './PlaytimeHeatmap.jsx'

export default function Analytics({
  games = [],
  onSelectGame,
  onFilterByStatus,
  onLaunchGame,
}) {
  const [selectedGameFilter, setSelectedGameFilter] = useState('all')
  const [monthSortOrder, setMonthSortOrder] = useState('desc') // 'desc' | 'asc'
  const [monthDisplayMode, setMonthDisplayMode] = useState('grid') // 'grid' | 'focus'
  const [focusedMonth, setFocusedMonth] = useState(null) // { year, month }

  // Calculate library-wide stats
  const libraryStats = useMemo(() => {
    let totalMinutes = 0
    let allSessions = []
    const statusCounts = {}
    BACKLOG_STATUSES.forEach(s => { statusCounts[s.id] = 0 })
    let unassignedStatus = 0

    games.forEach(g => {
      totalMinutes += Number(g.playtime || 0)
      if (Array.isArray(g.sessions)) {
        g.sessions.forEach(s => {
          allSessions.push({
            ...s,
            gameId: g.id,
            gameName: g.name,
            gameArt: g.art?.grid || g.art?.hero,
          })
        })
      }
      if (g.status && statusCounts[g.status] !== undefined) {
        statusCounts[g.status] += 1
      } else {
        unassignedStatus += 1
      }
    })

    // Sort sessions by start date descending
    allSessions.sort((a, b) => Number(b.start || 0) - Number(a.start || 0))

    // Top played games
    const topPlayed = [...games]
      .filter(g => (g.playtime || 0) > 0)
      .sort((a, b) => (b.playtime || 0) - (a.playtime || 0))
      .slice(0, 6)

    const maxPlayedMins = topPlayed.length > 0 ? (topPlayed[0].playtime || 1) : 1

    return {
      totalMinutes,
      allSessions,
      statusCounts,
      unassignedStatus,
      topPlayed,
      maxPlayedMins,
      completedCount: (statusCounts['Completed'] || 0) + (statusCounts['100%'] || 0),
      playingCount: statusCounts['Currently Playing'] || 0,
      backlogCount: statusCounts['Backlog'] || 0,
    }
  }, [games])

  // Sessions to pass into Heatmap based on game selector
  const activeSessions = useMemo(() => {
    if (selectedGameFilter === 'all') {
      return libraryStats.allSessions
    }
    const target = games.find(g => g.id === selectedGameFilter)
    return Array.isArray(target?.sessions) ? target.sessions : []
  }, [selectedGameFilter, games, libraryStats.allSessions])

  const activeTotalPlaytime = useMemo(() => {
    if (selectedGameFilter === 'all') {
      return libraryStats.totalMinutes
    }
    const target = games.find(g => g.id === selectedGameFilter)
    return target?.playtime || 0
  }, [selectedGameFilter, games, libraryStats.totalMinutes])

  const selectedGameName = useMemo(() => {
    if (selectedGameFilter === 'all') return 'All Games in Library'
    const target = games.find(g => g.id === selectedGameFilter)
    return target?.name || 'Selected Game'
  }, [selectedGameFilter, games])

  // All months history since starting to play
  const monthHistory = useMemo(() => {
    return generateAllMonthsHistory(activeSessions, games)
  }, [activeSessions, games])

  const displayedMonths = useMemo(() => {
    return monthSortOrder === 'desc'
      ? monthHistory.months
      : monthHistory.chronologicalMonths
  }, [monthHistory, monthSortOrder])

  const today = useMemo(() => new Date(), [])
  const activeFocus = focusedMonth || { year: today.getFullYear(), month: today.getMonth() }

  return (
    <div className="analytics-view" style={{ height: '100%', overflow: 'auto', padding: '28px 32px' }}>
      {/* View Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)', lineHeight: 1.2 }}>
              Playtime & Backlog Analytics 📈
            </h1>
            <span style={{
              fontSize: '11px',
              fontFamily: 'var(--mono)',
              fontWeight: 600,
              color: 'var(--text-dim)',
              background: 'var(--surface2)',
              border: '1px solid var(--border2)',
              padding: '3px 10px',
              borderRadius: '999px',
            }}>
              {games.length} {games.length === 1 ? 'game' : 'games'} tracked
            </span>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Comprehensive overview of your play history, monthly punchcards, and backlog progress
          </div>
        </div>

        {/* Game Filter Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Focus on:</span>
          <select
            value={selectedGameFilter}
            onChange={(e) => setSelectedGameFilter(e.target.value)}
            className="ui-input"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              borderRadius: 8,
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              cursor: 'pointer',
              maxWidth: 240,
            }}
          >
            <option value="all">Entire Library (All Games)</option>
            {games.map(g => (
              <option key={g.id} value={g.id}>{g.name} ({formatSessionDuration(g.playtime)})</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Top Summary Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, var(--surface2) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 12,
            padding: '16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
              Total Library Playtime
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', marginTop: '4px', fontFamily: 'var(--mono)' }}>
              {formatSessionDuration(libraryStats.totalMinutes)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
              Across {games.filter(g => (g.playtime || 0) > 0).length} played games
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, rgba(129, 140, 248, 0.12) 0%, var(--surface2) 100%)',
            border: '1px solid rgba(129, 140, 248, 0.25)',
            borderRadius: 12,
            padding: '16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
              Backlog Size
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#818cf8', marginTop: '4px', fontFamily: 'var(--mono)' }}>
              {libraryStats.backlogCount} {libraryStats.backlogCount === 1 ? 'game' : 'games'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
              Waiting to be played
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, var(--surface2) 100%)',
            border: '1px solid rgba(14, 165, 233, 0.25)',
            borderRadius: 12,
            padding: '16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
              Completed / 100%
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0ea5e9', marginTop: '4px', fontFamily: 'var(--mono)' }}>
              {libraryStats.completedCount} {libraryStats.completedCount === 1 ? 'game' : 'games'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
              {games.length > 0 ? `${Math.round((libraryStats.completedCount / games.length) * 100)}% completion rate` : '0%'}
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, var(--surface2) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: 12,
            padding: '16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
              Gaming Journey
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b', marginTop: '4px', fontFamily: 'var(--mono)' }}>
              {monthHistory.totalMonthsCount} {monthHistory.totalMonthsCount === 1 ? 'month' : 'months'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
              Since {monthHistory.startMonthName}
            </div>
          </div>
        </div>

        {/* Backlog Status Workflow Breakdown Card */}
        <div style={{
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🏷️</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Library Backlog & Completion Breakdown
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Click any status below to filter your library
            </span>
          </div>

          {/* Visual Progress Bar Distribution */}
          <div style={{
            display: 'flex',
            height: '14px',
            borderRadius: '6px',
            overflow: 'hidden',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
          }}>
            {BACKLOG_STATUSES.map(st => {
              const count = libraryStats.statusCounts[st.id] || 0
              if (count === 0 || games.length === 0) return null
              const pct = (count / games.length) * 100
              return (
                <div
                  key={st.id}
                  title={`${st.label}: ${count} (${Math.round(pct)}%)`}
                  style={{
                    width: `${pct}%`,
                    background: st.color,
                    height: '100%',
                    transition: 'width 0.4s ease',
                  }}
                />
              )
            })}
            {libraryStats.unassignedStatus > 0 && games.length > 0 && (
              <div
                title={`Untagged: ${libraryStats.unassignedStatus} (${Math.round((libraryStats.unassignedStatus / games.length) * 100)}%)`}
                style={{
                  width: `${(libraryStats.unassignedStatus / games.length) * 100}%`,
                  background: 'var(--border2)',
                  height: '100%',
                }}
              />
            )}
          </div>

          {/* Status Badges Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
            {BACKLOG_STATUSES.map(st => {
              const count = libraryStats.statusCounts[st.id] || 0
              return (
                <button
                  key={st.id}
                  type="button"
                  className="ui-btn"
                  onClick={() => onFilterByStatus?.(st.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: count > 0 ? st.bg : 'var(--surface)',
                    border: `1px solid ${count > 0 ? st.border : 'var(--border)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '15px' }}>{st.icon}</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: count > 0 ? st.color : 'var(--text-dim)' }}>
                      {st.label}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '12px',
                    fontFamily: 'var(--mono)',
                    fontWeight: 700,
                    color: count > 0 ? st.color : 'var(--text-muted)',
                  }}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Monthly Playtime History Section */}
        <div style={{
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
        }}>
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
                🗓️
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Monthly Playtime Journey (Month-by-Month)
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Every month from {monthHistory.startMonthName} to {monthHistory.currentMonthName} ({monthHistory.totalMonthsCount} {monthHistory.totalMonthsCount === 1 ? 'month' : 'months'})
                </div>
              </div>
            </div>

            {/* View and Sort Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{
                display: 'flex',
                background: 'var(--surface)',
                padding: '3px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                gap: '2px',
              }}>
                <button
                  type="button"
                  className="ui-btn"
                  onClick={() => setMonthDisplayMode('grid')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: monthDisplayMode === 'grid' ? 600 : 500,
                    borderRadius: 6,
                    background: monthDisplayMode === 'grid' ? 'var(--surface2)' : 'transparent',
                    color: monthDisplayMode === 'grid' ? 'var(--text)' : 'var(--text-muted)',
                    border: monthDisplayMode === 'grid' ? '1px solid var(--border2)' : '1px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  All Months Grid
                </button>
                <button
                  type="button"
                  className="ui-btn"
                  onClick={() => setMonthDisplayMode('focus')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: monthDisplayMode === 'focus' ? 600 : 500,
                    borderRadius: 6,
                    background: monthDisplayMode === 'focus' ? 'var(--surface2)' : 'transparent',
                    color: monthDisplayMode === 'focus' ? 'var(--text)' : 'var(--text-muted)',
                    border: monthDisplayMode === 'focus' ? '1px solid var(--border2)' : '1px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  Single Month Focus
                </button>
              </div>

              {monthDisplayMode === 'grid' && (
                <button
                  type="button"
                  className="ui-btn"
                  onClick={() => setMonthSortOrder(o => o === 'desc' ? 'asc' : 'desc')}
                  style={{
                    padding: '5px 10px',
                    fontSize: '11px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                  }}
                >
                  {monthSortOrder === 'desc' ? 'Newest First ▼' : 'Oldest First ▲'}
                </button>
              )}
            </div>
          </div>

          {/* Month Cards Grid View */}
          {monthDisplayMode === 'grid' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '14px',
            }}>
              {displayedMonths.map((m) => {
                const isCurrentMonth = m.year === today.getFullYear() && m.month === today.getMonth()
                const isStartMonth = m.monthName === monthHistory.startMonthName && !isCurrentMonth

                return (
                  <div
                    key={`${m.year}-${m.month}`}
                    style={{
                      background: 'var(--surface)',
                      border: `1px solid ${isCurrentMonth ? 'rgba(16, 185, 129, 0.4)' : 'var(--border)'}`,
                      borderRadius: 10,
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      boxShadow: isCurrentMonth ? '0 0 16px rgba(16, 185, 129, 0.1)' : 'none',
                    }}
                  >
                    {/* Month Card Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                          {m.monthName}
                        </span>
                        {isCurrentMonth && (
                          <span style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: 'rgba(16, 185, 129, 0.18)',
                            color: '#10b981',
                            border: '1px solid rgba(16, 185, 129, 0.35)',
                            textTransform: 'uppercase',
                          }}>
                            Current
                          </span>
                        )}
                        {isStartMonth && (
                          <span style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: 'rgba(129, 140, 248, 0.18)',
                            color: '#818cf8',
                            border: '1px solid rgba(129, 140, 248, 0.35)',
                            textTransform: 'uppercase',
                          }}>
                            Started
                          </span>
                        )}
                      </div>

                      <div style={{
                        fontSize: '13px',
                        fontFamily: 'var(--mono)',
                        fontWeight: 700,
                        color: m.monthTotalMinutes > 0 ? '#10b981' : 'var(--text-muted)',
                      }}>
                        {formatSessionDuration(m.monthTotalMinutes)}
                      </div>
                    </div>

                    {/* Stats sub-bar */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span>{m.monthActiveDays} active {m.monthActiveDays === 1 ? 'day' : 'days'} • {m.monthSessionsCount} sessions</span>
                      {m.topGame && (
                        <span style={{ color: 'var(--accent)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }} title={`Top: ${m.topGame.name}`}>
                          ★ {m.topGame.name}
                        </span>
                      )}
                    </div>

                    {/* Compact Month GitHub Grid */}
                    <div style={{ display: 'flex', gap: '3px', marginTop: '2px', overflowX: 'auto', paddingBottom: '2px' }}>
                      {m.weeks.map((week, wIdx) => (
                        <div key={wIdx} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {week.days.map((day, dIdx) => {
                            let bg = 'rgba(255, 255, 255, 0.04)'
                            let border = 'rgba(255, 255, 255, 0.06)'
                            if (!day.isCurrentMonth) {
                              bg = 'transparent'
                              border = 'transparent'
                            } else if (day.level === 1) {
                              bg = 'rgba(16, 185, 129, 0.35)'
                              border = 'rgba(16, 185, 129, 0.5)'
                            } else if (day.level === 2) {
                              bg = 'rgba(16, 185, 129, 0.6)'
                              border = 'rgba(16, 185, 129, 0.6)'
                            } else if (day.level === 3) {
                              bg = 'rgba(16, 185, 129, 0.85)'
                              border = '#34d399'
                            } else if (day.level === 4) {
                              bg = '#10b981'
                              border = '#34d399'
                            }
                            if (day.isToday) {
                              border = '#38bdf8'
                            }

                            const titleText = day.isCurrentMonth
                              ? `${day.formattedDate}: ${day.gamesCount || (day.count > 0 ? 1 : 0)} ${(day.gamesCount || (day.count > 0 ? 1 : 0)) === 1 ? 'game' : 'games'} played • ${formatSessionDuration(day.minutes)} (${day.count} sessions)${day.gameNames && day.gameNames.length > 0 ? ` • ${day.gameNames.join(', ')}` : ''}`
                              : ''

                            return (
                              <div
                                key={dIdx}
                                title={titleText}
                                style={{
                                  width: '18px',
                                  height: '14px',
                                  borderRadius: '2.5px',
                                  background: bg,
                                  border: `1px solid ${border}`,
                                  opacity: day.isCurrentMonth ? 1 : 0.15,
                                }}
                              />
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Single Month Focus View */}
          {monthDisplayMode === 'focus' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Horizontal Month Timeline Tabs */}
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px' }}>
                {monthHistory.months.map((m) => {
                  const isSelected = activeFocus.year === m.year && activeFocus.month === m.month
                  return (
                    <button
                      key={`${m.year}-${m.month}`}
                      type="button"
                      className="ui-btn"
                      onClick={() => setFocusedMonth({ year: m.year, month: m.month })}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        fontSize: '11px',
                        fontWeight: isSelected ? 700 : 500,
                        background: isSelected ? 'var(--accent-gradient)' : 'var(--surface)',
                        color: isSelected ? '#ffffff' : 'var(--text-dim)',
                        border: `1px solid ${isSelected ? 'transparent' : 'var(--border)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        boxShadow: isSelected ? '0 4px 12px color-mix(in srgb, var(--accent) 35%, transparent)' : 'none',
                      }}
                    >
                      <span>{m.monthShortName}</span>
                      <span style={{
                        fontSize: '10px',
                        fontFamily: 'var(--mono)',
                        opacity: 0.85,
                        background: isSelected ? 'rgba(255,255,255,0.15)' : 'var(--surface2)',
                        padding: '1px 5px',
                        borderRadius: 6,
                      }}>
                        {formatSessionDuration(m.monthTotalMinutes)}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Render Detailed Heatmap for the focused month */}
              <PlaytimeHeatmap
                sessions={activeSessions}
                totalPlaytime={activeTotalPlaytime}
                gameTitle={selectedGameName}
                initialYear={activeFocus.year}
                initialMonth={activeFocus.month}
                showNavigation={false}
              />
            </div>
          )}
        </div>

        {/* Bottom Split: Top Most Played & Recent Sessions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Top Played Games Leaderboard */}
          <div style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>🏆</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Most Played Games
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Top {libraryStats.topPlayed.length}</span>
            </div>

            {libraryStats.topPlayed.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '12px' }}>
                No games with playtime recorded yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {libraryStats.topPlayed.map((g, idx) => {
                  const pct = Math.round(((g.playtime || 0) / libraryStats.maxPlayedMins) * 100)
                  return (
                    <div
                      key={g.id}
                      onClick={() => onSelectGame?.(g)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        padding: '8px 10px',
                        background: 'var(--surface)',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <span style={{ fontSize: '11px', fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text-muted)', width: '16px' }}>
                            #{idx + 1}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {g.name}
                          </span>
                        </div>
                        <span style={{ fontSize: '12px', fontFamily: 'var(--mono)', fontWeight: 700, color: '#10b981' }}>
                          {formatSessionDuration(g.playtime)}
                        </span>
                      </div>

                      {/* Bar indicator */}
                      <div style={{ height: '5px', borderRadius: 3, background: 'var(--surface2)', overflow: 'hidden' }}>
                        <div style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: idx === 0
                            ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                            : idx === 1
                            ? 'linear-gradient(90deg, #94a3b8, #cbd5e1)'
                            : idx === 2
                            ? 'linear-gradient(90deg, #d97706, #b45309)'
                            : 'var(--accent-gradient)',
                          borderRadius: 3,
                          transition: 'width 0.4s ease',
                        }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Recent Play Sessions across library */}
          <div style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>🕒</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Recent Play Sessions
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Latest activity</span>
            </div>

            {libraryStats.allSessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '12px' }}>
                No recent play sessions logged yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {libraryStats.allSessions.slice(0, 6).map((s, idx) => (
                  <div
                    key={s.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'var(--surface)',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {s.gameName || 'Game Session'}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {formatSessionDateTime(s.start)} ({formatRelativeTime(s.start)})
                      </div>
                    </div>

                    <div style={{
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: '#10b981',
                      fontFamily: 'var(--mono)',
                      fontSize: '11px',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}>
                      {formatSessionDuration(s.durationMinutes)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
