import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import {
  BACKLOG_STATUSES,
  getStatusConfig,
  formatSessionDuration,
  formatSessionDateTime,
  formatRelativeTime,
  generateActivityHeatmapData,
  generatePunchcardData,
  generateWeeklyTrends,
  generateMonthHeatmapData,
  generateAllMonthsHistory,
} from '../src/statusWorkflow.js'
import { normalizeGame } from '../src/App.jsx'
import BacklogBadge from '../src/components/BacklogBadge.jsx'
import PlaytimeHeatmap from '../src/components/PlaytimeHeatmap.jsx'
import SessionLog from '../src/components/SessionLog.jsx'
import Analytics from '../src/components/Analytics.jsx'

describe('Backlog Status Workflow & Helper Calculations', () => {
  it('defines all required completion statuses', () => {
    const ids = BACKLOG_STATUSES.map(s => s.id)
    expect(ids).toContain('Backlog')
    expect(ids).toContain('Currently Playing')
    expect(ids).toContain('Completed')
    expect(ids).toContain('100%')
    expect(ids).toContain('On Hold')
    expect(ids).toContain('Abandoned')
  })

  it('retrieves status config with icon and colors', () => {
    const playing = getStatusConfig('Currently Playing')
    expect(playing).not.toBeNull()
    expect(playing.icon).toBe('🎮')
    expect(playing.label).toBe('Currently Playing')

    const comp = getStatusConfig('100%')
    expect(comp.icon).toBe('🏆')
  })

  it('formats session durations cleanly', () => {
    expect(formatSessionDuration(0)).toBe('< 1m')
    expect(formatSessionDuration(25)).toBe('25m')
    expect(formatSessionDuration(60)).toBe('1h')
    expect(formatSessionDuration(125)).toBe('2h 5m')
  })

  it('normalizes game completion status and sessions array correctly', () => {
    const raw = {
      id: 'g1',
      name: 'Elden Ring',
      status: 'Currently Playing',
      sessions: [
        { start: 1690000000000, durationMinutes: 90, notes: 'Stormveil Castle' }
      ]
    }
    const normalized = normalizeGame(raw)
    expect(normalized.status).toBe('Currently Playing')
    expect(normalized.sessions.length).toBe(1)
    expect(normalized.sessions[0].durationMinutes).toBe(90)
    expect(normalized.sessions[0].notes).toBe('Stormveil Castle')

    // Invalid status should be normalized to null
    const invalid = normalizeGame({ id: 'g2', status: 'InvalidStatus' })
    expect(invalid.status).toBeNull()
  })

  it('generates GitHub-style activity punchcard / heatmap data', () => {
    const now = Date.now()
    const sampleSessions = [
      { start: now, durationMinutes: 120 },
      { start: now - 86400000, durationMinutes: 45 },
    ]
    const data = generateActivityHeatmapData(sampleSessions, 12)
    expect(data.weeks.length).toBe(12)
    expect(data.totalActiveDays).toBeGreaterThanOrEqual(1)
    expect(data.totalMinutes).toBe(165)
    expect(data.currentStreak).toBeGreaterThanOrEqual(1)
  })

  it('generates single month heatmap data for current month with intensity based on games played', () => {
    const today = new Date()
    const now = today.getTime()
    const sampleSessions = [
      { start: now, durationMinutes: 30, gameId: 'g1', gameName: 'Game 1' },
      { start: now, durationMinutes: 40, gameId: 'g2', gameName: 'Game 2' },
      { start: now, durationMinutes: 20, gameId: 'g3', gameName: 'Game 3' },
    ]
    const monthData = generateMonthHeatmapData(sampleSessions)
    expect(monthData.weeks.length).toBeGreaterThanOrEqual(4)
    expect(monthData.monthTotalMinutes).toBe(90)
    expect(monthData.monthActiveDays).toBe(1)
    expect(monthData.monthName).toBeDefined()

    // Find today's cell and verify level is 3 (since 3 distinct games were played today)
    const allDays = monthData.weeks.flatMap(w => w.days)
    const todayCell = allDays.find(d => d.isToday)
    expect(todayCell).toBeDefined()
    expect(todayCell.gamesCount).toBe(3)
    expect(todayCell.level).toBe(3)
    expect(todayCell.gameNames).toContain('Game 1')
    expect(todayCell.gameNames).toContain('Game 2')
    expect(todayCell.gameNames).toContain('Game 3')
  })

  it('generates month-by-month history from first month played to current month', () => {
    const today = new Date()
    const now = today.getTime()
    const past = new Date(today.getFullYear(), today.getMonth() - 3, 10).getTime()
    const sampleSessions = [
      { start: past, durationMinutes: 100 },
      { start: now, durationMinutes: 50 },
    ]
    const history = generateAllMonthsHistory(sampleSessions)
    expect(history.totalMonthsCount).toBeGreaterThanOrEqual(4)
    expect(history.startMonthName).toBeDefined()
    expect(history.months[0].monthTotalMinutes).toBeGreaterThanOrEqual(50)
  })

  it('generates punchcard day-of-week distribution and weekly trends', () => {
    const now = Date.now()
    const sampleSessions = [
      { start: now, durationMinutes: 60 },
      { start: now - 7 * 86400000, durationMinutes: 120 },
    ]
    const punchcard = generatePunchcardData(sampleSessions)
    expect(punchcard.matrix.length).toBe(7)
    expect(punchcard.dayTotals.length).toBe(7)

    const trends = generateWeeklyTrends(sampleSessions, 8)
    expect(trends.weeks.length).toBe(8)
    expect(trends.maxMins).toBeGreaterThanOrEqual(60)
  })
})

describe('Backlog and Playtime UI Component Rendering (SSR)', () => {
  it('renders BacklogBadge without throwing', () => {
    const html = renderToString(
      <BacklogBadge status="Backlog" editable={true} />
    )
    expect(html).toContain('Backlog')
    expect(html).toContain('💤')
  })

  it('renders PlaytimeHeatmap without throwing and with clean tiles and games legend', () => {
    const sessions = [
      { start: Date.now(), durationMinutes: 45, gameId: 'p2', gameName: 'Portal 2' },
    ]
    const html = renderToString(
      <PlaytimeHeatmap sessions={sessions} totalPlaytime={45} gameTitle="Portal 2" />
    )
    expect(html).toContain('Playtime Activity')
    expect(html).toContain('Portal 2')
    expect(html).toContain('Month Grid')
    expect(html).toContain('0 games')
    expect(html).toContain('4+ games')
  })

  it('renders SessionLog without throwing', () => {
    const sessions = [
      { id: 's1', start: Date.now(), durationMinutes: 75, notes: 'Boss defeated' }
    ]
    const html = renderToString(
      <SessionLog sessions={sessions} gameTitle="Hollow Knight" />
    )
    expect(html).toContain('Historical Session Log')
    expect(html).toContain('1h 15m')
    expect(html).toContain('Boss defeated')
  })

  it('renders full Analytics dashboard without throwing', () => {
    const testGames = [
      {
        id: '1',
        name: 'The Witcher 3',
        playtime: 1500,
        status: 'Completed',
        sessions: [
          { id: 's1', start: Date.now() - 3600000, durationMinutes: 120 }
        ]
      },
      {
        id: '2',
        name: 'Celeste',
        playtime: 300,
        status: 'Currently Playing',
        sessions: []
      },
    ]
    const html = renderToString(
      <Analytics games={testGames} />
    )
    expect(html).toContain('Playtime &amp; Backlog Analytics')
    expect(html).toContain('The Witcher 3')
    expect(html).toContain('Completed')
    expect(html).toContain('Currently Playing')
  })
})
