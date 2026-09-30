import React, { useState, useMemo } from 'react'
import {
  generateMonthHeatmapData,
  generatePunchcardData,
  generateWeeklyTrends,
  formatSessionDuration,
} from '../statusWorkflow.js'

export default function PlaytimeHeatmap({
  sessions = [],
  totalPlaytime = 0,
  gameTitle = null,
  initialYear = null,
  initialMonth = null,
  showNavigation = true,
  compact = false,
}) {
  const today = useMemo(() => new Date(), [])
  const [selectedYear, setSelectedYear] = useState(initialYear ?? today.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(initialMonth ?? today.getMonth())
  const [activeTab, setActiveTab] = useState('month') // 'month' | 'weekly' | 'punchcard'
  const [hoveredCell, setHoveredCell] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const isCurrentMonthNow = selectedYear === today.getFullYear() && selectedMonth === today.getMonth()

  // Generate monthly data for the selected month
  const monthData = useMemo(() => {
    return generateMonthHeatmapData(sessions, selectedYear, selectedMonth)
  }, [sessions, selectedYear, selectedMonth])

  // Filter sessions for this month to calculate punchcard and trends if requested
  const monthSessions = useMemo(() => {
    const safe = Array.isArray(sessions) ? sessions : []
    const startTs = new Date(selectedYear, selectedMonth, 1).getTime()
    const endTs = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999).getTime()
    return safe.filter(s => {
      const t = Number(s?.start)
      return t >= startTs && t <= endTs
    })
  }, [sessions, selectedYear, selectedMonth])

  const punchcardData = useMemo(() => {
    return generatePunchcardData(monthSessions.length > 0 ? monthSessions : sessions)
  }, [monthSessions, sessions])

  const weeklyData = useMemo(() => {
    return generateWeeklyTrends(sessions, 10)
  }, [sessions])

  // Navigation handlers
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedYear(y => y - 1)
      setSelectedMonth(11)
    } else {
      setSelectedMonth(m => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedYear(y => y + 1)
      setSelectedMonth(0)
    } else {
      setSelectedMonth(m => m + 1)
    }
  }

  const handleCurrentMonth = () => {
    setSelectedYear(today.getFullYear())
    setSelectedMonth(today.getMonth())
  }

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  // Intensity color palettes
  const getCellBg = (level, isCurrentMonth) => {
    if (!isCurrentMonth) return 'rgba(255, 255, 255, 0.02)'
    switch (level) {
      case 1:
        return 'rgba(16, 185, 129, 0.35)'
      case 2:
        return 'rgba(16, 185, 129, 0.6)'
      case 3:
        return 'rgba(16, 185, 129, 0.85)'
      case 4:
        return '#10b981'
      default:
        return 'rgba(255, 255, 255, 0.05)'
    }
  }

  const getCellBorder = (level, isCurrentMonth, isToday) => {
    if (isToday) return '#38bdf8'
    if (!isCurrentMonth) return 'rgba(255, 255, 255, 0.03)'
    if (level === 0) return 'rgba(255, 255, 255, 0.07)'
    if (level === 4) return '#34d399'
    return 'rgba(16, 185, 129, 0.5)'
  }

  return (
    <div
      style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: compact ? '14px' : '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        position: 'relative',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
      }}
    >
      {/* Header & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
          }}>
            📅
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Playtime Activity ({monthData.monthName})
              </span>
              {isCurrentMonthNow && (
                <span style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: 'rgba(16, 185, 129, 0.18)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                }}>
                  Current Month
                </span>
              )}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {gameTitle ? `Monthly activity punchcard for ${gameTitle}` : 'Monthly commit-style activity calendar'}
            </div>
          </div>
        </div>

        {/* Month Navigation & Tab Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {showNavigation && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                className="ui-btn"
                onClick={handlePrevMonth}
                title="Previous Month"
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                }}
              >
                ◀
              </button>

              {!isCurrentMonthNow && (
                <button
                  type="button"
                  className="ui-btn"
                  onClick={handleCurrentMonth}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    color: 'var(--accent)',
                    cursor: 'pointer',
                  }}
                >
                  Current Month
                </button>
              )}

              <button
                type="button"
                className="ui-btn"
                onClick={handleNextMonth}
                title="Next Month"
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                }}
              >
                ▶
              </button>
            </div>
          )}

          {/* View Tab Switcher */}
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
              onClick={() => setActiveTab('month')}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: activeTab === 'month' ? 600 : 500,
                borderRadius: 6,
                background: activeTab === 'month' ? 'var(--surface2)' : 'transparent',
                color: activeTab === 'month' ? 'var(--text)' : 'var(--text-muted)',
                border: activeTab === 'month' ? '1px solid var(--border2)' : '1px solid transparent',
                cursor: 'pointer',
              }}
            >
              Month Grid
            </button>
            <button
              type="button"
              className="ui-btn"
              onClick={() => setActiveTab('weekly')}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: activeTab === 'weekly' ? 600 : 500,
                borderRadius: 6,
                background: activeTab === 'weekly' ? 'var(--surface2)' : 'transparent',
                color: activeTab === 'weekly' ? 'var(--text)' : 'var(--text-muted)',
                border: activeTab === 'weekly' ? '1px solid var(--border2)' : '1px solid transparent',
                cursor: 'pointer',
              }}
            >
              Weekly Trends
            </button>
            <button
              type="button"
              className="ui-btn"
              onClick={() => setActiveTab('punchcard')}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: activeTab === 'punchcard' ? 600 : 500,
                borderRadius: 6,
                background: activeTab === 'punchcard' ? 'var(--surface2)' : 'transparent',
                color: activeTab === 'punchcard' ? 'var(--text)' : 'var(--text-muted)',
                border: activeTab === 'punchcard' ? '1px solid var(--border2)' : '1px solid transparent',
                cursor: 'pointer',
              }}
            >
              Day Punchcard
            </button>
          </div>
        </div>
      </div>

      {/* Monthly Summary Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
        gap: '10px',
      }}>
        <div style={{ background: 'var(--surface)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
            {monthData.monthShortName} Playtime
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#10b981', marginTop: '2px', fontFamily: 'var(--mono)' }}>
            {formatSessionDuration(monthData.monthTotalMinutes)}
          </div>
        </div>

        <div style={{ background: 'var(--surface)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
            Active Days
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginTop: '2px', fontFamily: 'var(--mono)' }}>
            {monthData.monthActiveDays} {monthData.monthActiveDays === 1 ? 'day' : 'days'}
          </div>
        </div>

        <div style={{ background: 'var(--surface)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
            Month Sessions
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginTop: '2px', fontFamily: 'var(--mono)' }}>
            {monthData.monthSessionsCount}
          </div>
        </div>

        <div style={{ background: 'var(--surface)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
            All-Time Total
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-dim)', marginTop: '2px', fontFamily: 'var(--mono)' }}>
            {formatSessionDuration(totalPlaytime)}
          </div>
        </div>
      </div>

      {/* Month GitHub Commit Grid */}
      {activeTab === 'month' && (
        <div style={{ position: 'relative', overflowX: 'auto', paddingBottom: '4px' }}>
          <div style={{ minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Week Columns Header */}
            <div style={{ display: 'flex', marginLeft: '32px', gap: '6px' }}>
              {monthData.weeks.map((w, idx) => (
                <div
                  key={idx}
                  style={{
                    width: '32px',
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--mono)',
                    textAlign: 'center',
                  }}
                >
                  W{idx + 1}
                </div>
              ))}
            </div>

            {/* 7 Rows for Days of Week (Mon to Sun) */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {/* Day Labels Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '26px', flexShrink: 0 }}>
                {dayLabels.map((lbl, idx) => (
                  <div
                    key={idx}
                    style={{
                      height: '24px',
                      fontSize: '10px',
                      color: 'var(--text-muted)',
                      lineHeight: '24px',
                      textAlign: 'right',
                      paddingRight: '4px',
                      fontWeight: 500,
                    }}
                  >
                    {lbl}
                  </div>
                ))}
              </div>

              {/* Weeks Columns */}
              <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
                {monthData.weeks.map((week, wIdx) => (
                  <div key={wIdx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {week.days.map((day, dIdx) => {
                      const bg = getCellBg(day.level, day.isCurrentMonth)
                      const border = getCellBorder(day.level, day.isCurrentMonth, day.isToday)
                      return (
                        <div
                          key={dIdx}
                          onMouseEnter={(e) => {
                            if (!day.isCurrentMonth) return
                            const rect = e.currentTarget.getBoundingClientRect()
                            setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top })
                            setHoveredCell(day)
                          }}
                          onMouseLeave={() => setHoveredCell(null)}
                          style={{
                            width: '32px',
                            height: '24px',
                            borderRadius: '4px',
                            background: bg,
                            border: `1px solid ${border}`,
                            cursor: day.isCurrentMonth ? 'pointer' : 'default',
                            transition: 'all 0.12s ease',
                            boxShadow: day.level >= 3 ? '0 0 8px rgba(16, 185, 129, 0.45)' : 'none',
                          }}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer with Legend */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '6px',
              paddingTop: '8px',
              borderTop: '1px solid var(--border)',
              fontSize: '11px',
              color: 'var(--text-muted)',
            }}>
              <div>
                <span>{monthData.monthActiveDays} active days in {monthData.monthName}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span>0 games</span>
                {[0, 1, 2, 3, 4].map((lvl) => (
                  <div
                    key={lvl}
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '3px',
                      background: getCellBg(lvl, true),
                      border: `1px solid ${getCellBorder(lvl, true, false)}`,
                    }}
                  />
                ))}
                <span>4+ games</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Weekly Trends Tab */}
      {activeTab === 'weekly' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '160px', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: '140px', padding: '0 10px' }}>
            {weeklyData.weeks.map((w, idx) => {
              const heightPct = Math.max(6, Math.round((w.minutes / weeklyData.maxMins) * 100))
              const isHighlight = w.minutes === weeklyData.maxMins && w.minutes > 0
              return (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '100%',
                    justifyContent: 'flex-end',
                    gap: '6px',
                  }}
                  title={`${w.fullLabel}: ${formatSessionDuration(w.minutes)} (${w.sessionCount} sessions)`}
                >
                  <div style={{ fontSize: '10px', color: isHighlight ? '#10b981' : 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                    {w.minutes > 0 ? formatSessionDuration(w.minutes) : ''}
                  </div>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '36px',
                      height: `${heightPct}%`,
                      background: isHighlight
                        ? 'linear-gradient(180deg, #34d399 0%, #059669 100%)'
                        : w.minutes > 0
                        ? 'linear-gradient(180deg, rgba(16, 185, 129, 0.7) 0%, rgba(16, 185, 129, 0.3) 100%)'
                        : 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '4px 4px 2px 2px',
                      border: '1px solid ' + (w.minutes > 0 ? 'rgba(16, 185, 129, 0.5)' : 'var(--border)'),
                      boxShadow: isHighlight ? '0 0 12px rgba(16, 185, 129, 0.3)' : 'none',
                      transition: 'height 0.3s ease',
                    }}
                  />
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontFamily: 'var(--mono)' }}>
                    {w.label}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>
            Weekly playtime breakdown over the last 10 weeks
          </div>
        </div>
      )}

      {/* Day of Week Punchcard Tab */}
      {activeTab === 'punchcard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Playtime distribution by day of the week
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {punchcardData.dayTotals.map((item) => {
              const maxDayMins = Math.max(1, ...punchcardData.dayTotals.map(d => d.minutes))
              const pct = Math.round((item.minutes / maxDayMins) * 100)
              return (
                <div key={item.day} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {item.day}
                  </div>
                  <div style={{
                    flex: 1,
                    height: '16px',
                    background: 'var(--surface)',
                    borderRadius: 4,
                    overflow: 'hidden',
                    border: '1px solid var(--border)',
                  }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: pct > 0 ? 'linear-gradient(90deg, #10b981 0%, #34d399 100%)' : 'transparent',
                        borderRadius: 3,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                  <div style={{ width: '55px', fontSize: '11px', color: item.minutes > 0 ? 'var(--text)' : 'var(--text-muted)', fontFamily: 'var(--mono)', textAlign: 'right' }}>
                    {item.minutes > 0 ? formatSessionDuration(item.minutes) : '0m'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Interactive Tooltip for Cell Hover */}
      {hoveredCell && (
        <div
          style={{
            position: 'fixed',
            left: tooltipPos.x,
            top: tooltipPos.y - 10,
            transform: 'translate(-50%, -100%)',
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: '11px',
            pointerEvents: 'none',
            zIndex: 9999,
            whiteSpace: 'nowrap',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>
            {hoveredCell.formattedDate}
          </div>
          <div style={{ color: hoveredCell.minutes > 0 ? '#10b981' : 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>●</span>
            <span>
              {hoveredCell.minutes > 0
                ? `${hoveredCell.gamesCount || (hoveredCell.count > 0 ? 1 : 0)} ${(hoveredCell.gamesCount || (hoveredCell.count > 0 ? 1 : 0)) === 1 ? 'game' : 'games'} played • ${formatSessionDuration(hoveredCell.minutes)} (${hoveredCell.count} ${hoveredCell.count === 1 ? 'session' : 'sessions'})`
                : 'No play activity recorded'}
            </span>
          </div>
          {hoveredCell.gameNames && hoveredCell.gameNames.length > 0 && (
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '3px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              🎮 {hoveredCell.gameNames.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
