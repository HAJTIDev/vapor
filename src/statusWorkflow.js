export const BACKLOG_STATUSES = [
  {
    id: 'Backlog',
    label: 'Backlog',
    icon: '💤',
    color: '#818cf8',
    glow: 'rgba(129, 140, 248, 0.4)',
    bg: 'rgba(129, 140, 248, 0.12)',
    border: 'rgba(129, 140, 248, 0.32)',
    desc: 'Waiting to be played in your collection',
  },
  {
    id: 'Currently Playing',
    label: 'Currently Playing',
    icon: '🎮',
    color: '#10b981',
    glow: 'rgba(16, 185, 129, 0.45)',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.32)',
    desc: 'Active game currently in progress',
  },
  {
    id: 'Completed',
    label: 'Completed',
    icon: '✅',
    color: '#0ea5e9',
    glow: 'rgba(14, 165, 233, 0.4)',
    bg: 'rgba(14, 165, 233, 0.12)',
    border: 'rgba(14, 165, 233, 0.32)',
    desc: 'Finished main campaign or storyline',
  },
  {
    id: '100%',
    label: '100%',
    icon: '🏆',
    color: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.45)',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.32)',
    desc: 'All achievements, quests, and secrets completed',
  },
  {
    id: 'On Hold',
    label: 'On Hold',
    icon: '⏸️',
    color: '#fb923c',
    glow: 'rgba(251, 146, 60, 0.4)',
    bg: 'rgba(251, 146, 60, 0.12)',
    border: 'rgba(251, 146, 60, 0.32)',
    desc: 'Temporarily paused, intending to resume',
  },
  {
    id: 'Abandoned',
    label: 'Abandoned',
    icon: '🛑',
    color: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.4)',
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.32)',
    desc: 'Dropped and not planning to finish',
  },
]

export const STATUS_MAP = Object.fromEntries(
  BACKLOG_STATUSES.map(s => [s.id, s])
)

export function getStatusConfig(status) {
  if (!status) return null
  return STATUS_MAP[status] || {
    id: status,
    label: status,
    icon: '🏷️',
    color: 'var(--text-muted)',
    glow: 'transparent',
    bg: 'var(--surface2)',
    border: 'var(--border)',
    desc: '',
  }
}

export function formatSessionDuration(mins) {
  const m = Math.round(Number(mins) || 0)
  if (m <= 0) return '< 1m'
  const hours = Math.floor(m / 60)
  const remainingMins = m % 60
  if (hours > 0 && remainingMins > 0) {
    return `${hours}h ${remainingMins}m`
  }
  if (hours > 0) {
    return `${hours}h`
  }
  return `${remainingMins}m`
}

export function formatSessionDateTime(timestamp) {
  if (!timestamp) return 'Unknown'
  const d = new Date(timestamp)
  if (isNaN(d.getTime())) return 'Unknown'
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatRelativeTime(timestamp) {
  if (!timestamp) return ''
  const now = Date.now()
  const diffMs = now - Number(timestamp)
  if (diffMs < 0) return 'Just now'
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay === 1) return 'Yesterday'
  if (diffDay < 7) return `${diffDay}d ago`
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`
  if (diffDay < 365) return `${Math.floor(diffDay / 30)}mo ago`
  return `${Math.floor(diffDay / 365)}y ago`
}

/**
 * Generate activity heatmap data for a GitHub-style activity punchcard.
 * @param {Array} sessions - Array of session objects { start, durationMinutes, ... }
 * @param {number} totalWeeks - Number of weeks to display (default 18)
 */
export function generateActivityHeatmapData(sessions = [], totalWeeks = 18) {
  const safeSessions = Array.isArray(sessions) ? sessions : []
  
  // Create a day lookup map: 'YYYY-MM-DD' -> { minutes, count, sessions, gameIds, gameNames }
  const dayMap = {}
  safeSessions.forEach(s => {
    if (!s || !s.start) return
    const d = new Date(s.start)
    if (isNaN(d.getTime())) return
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!dayMap[dateKey]) {
      dayMap[dateKey] = { minutes: 0, count: 0, sessions: [], gameIds: new Set(), gameNames: new Set() }
    }
    const mins = Math.max(1, Math.round(Number(s.durationMinutes) || 0))
    dayMap[dateKey].minutes += mins
    dayMap[dateKey].count += 1
    if (s.gameId) dayMap[dateKey].gameIds.add(s.gameId)
    if (s.gameName) dayMap[dateKey].gameNames.add(s.gameName)
    dayMap[dateKey].sessions.push(s)
  })

  // Determine current end date (today) and align to end of the week (Saturday)
  const today = new Date()
  today.setHours(23, 59, 59, 999)

  const endDay = new Date(today)
  const dayOfWeek = endDay.getDay() // 0 is Sunday, 6 is Saturday
  // Align to Saturday so the grid ends nicely on the current week
  const daysUntilSaturday = (6 - dayOfWeek + 7) % 7
  endDay.setDate(endDay.getDate() + daysUntilSaturday)

  const totalDays = totalWeeks * 7
  const startDay = new Date(endDay)
  startDay.setDate(startDay.getDate() - totalDays + 1)
  startDay.setHours(0, 0, 0, 0)

  const weeks = []
  let currentWeek = []
  let maxDayMinutes = 0
  let totalActiveDays = 0
  let totalMinutes = 0

  const pointer = new Date(startDay)
  for (let i = 0; i < totalDays; i++) {
    const dateKey = `${pointer.getFullYear()}-${String(pointer.getMonth() + 1).padStart(2, '0')}-${String(pointer.getDate()).padStart(2, '0')}`
    const record = dayMap[dateKey] || { minutes: 0, count: 0, sessions: [], gameIds: new Set(), gameNames: new Set() }
    
    if (record.minutes > maxDayMinutes) {
      maxDayMinutes = record.minutes
    }
    if (record.minutes > 0) {
      totalActiveDays += 1
      totalMinutes += record.minutes
    }

    // Determine intensity level (0 to 4) based on number of games played that day
    const gamesPlayed = record.gameIds && record.gameIds.size > 0 ? record.gameIds.size : (record.count > 0 ? 1 : 0)
    let level = 0
    if (gamesPlayed > 0 || record.minutes > 0) {
      if (gamesPlayed <= 1) level = 1
      else if (gamesPlayed === 2) level = 2
      else if (gamesPlayed === 3) level = 3
      else level = 4
    }

    const isFuture = pointer.getTime() > today.getTime()

    currentWeek.push({
      dateKey,
      date: new Date(pointer),
      isFuture,
      minutes: record.minutes,
      count: record.count,
      gamesCount: gamesPlayed,
      gameNames: record.gameNames ? Array.from(record.gameNames) : [],
      level: isFuture ? 0 : level,
      formattedDate: pointer.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    })

    if (currentWeek.length === 7) {
      weeks.push({
        weekIndex: weeks.length,
        days: currentWeek,
        monthLabel: currentWeek[0].date.getDate() <= 7 ? currentWeek[0].date.toLocaleDateString(undefined, { month: 'short' }) : '',
      })
      currentWeek = []
    }

    pointer.setDate(pointer.getDate() + 1)
  }

  // Calculate streak with defensive safety cap (up to 10 years / 3650 days)
  let currentStreak = 0
  let checkDate = new Date(today)
  let checkCount = 0
  const MAX_STREAK_DAYS = 3650

  while (checkCount < MAX_STREAK_DAYS) {
    checkCount += 1
    const key = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`
    if (dayMap[key] && dayMap[key].minutes > 0) {
      currentStreak += 1
      checkDate.setDate(checkDate.getDate() - 1)
    } else {
      // If today has no playtime yet, check if yesterday had
      if (currentStreak === 0) {
        checkDate.setDate(checkDate.getDate() - 1)
        const yestKey = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`
        if (dayMap[yestKey] && dayMap[yestKey].minutes > 0) {
          currentStreak += 1
          checkDate.setDate(checkDate.getDate() - 1)
          continue
        }
      }
      break
    }
  }

  return {
    weeks,
    maxDayMinutes,
    totalActiveDays,
    totalMinutes,
    currentStreak,
  }
}

/**
 * Generate punchcard data (Day of week vs Hour of day / Time of day)
 */
export function generatePunchcardData(sessions = []) {
  const safeSessions = Array.isArray(sessions) ? sessions : []
  // 7 days (0: Sun to 6: Sat), 24 hours
  const matrix = Array.from({ length: 7 }, () => Array(24).fill(0))
  let maxHourMins = 0

  safeSessions.forEach(s => {
    if (!s || !s.start) return
    const d = new Date(s.start)
    if (isNaN(d.getTime())) return
    const day = d.getDay()
    const hour = d.getHours()
    const mins = Math.max(1, Math.round(Number(s.durationMinutes) || 0))
    matrix[day][hour] += mins
    if (matrix[day][hour] > maxHourMins) {
      maxHourMins = matrix[day][hour]
    }
  })

  // Also day-of-week totals
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayTotals = matrix.map((hours, idx) => ({
    day: dayLabels[idx],
    dayIndex: idx,
    minutes: hours.reduce((a, b) => a + b, 0),
  }))

  return {
    matrix,
    maxHourMins,
    dayTotals,
    dayLabels,
  }
}

/**
 * Generate weekly activity chart (last 12 weeks)
 */
export function generateWeeklyTrends(sessions = [], numWeeks = 10) {
  const safeSessions = Array.isArray(sessions) ? sessions : []
  const now = new Date()
  const weeks = []

  for (let w = numWeeks - 1; w >= 0; w--) {
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - (w * 7 + weekStart.getDay()))
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    let totalMins = 0
    let sessionCount = 0

    safeSessions.forEach(s => {
      if (!s || !s.start) return
      const t = Number(s.start)
      if (t >= weekStart.getTime() && t <= weekEnd.getTime()) {
        totalMins += Math.max(1, Math.round(Number(s.durationMinutes) || 0))
        sessionCount += 1
      }
    })

    weeks.push({
      label: `${weekStart.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}`,
      fullLabel: `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
      minutes: totalMins,
      sessionCount,
    })
  }

  const maxMins = Math.max(1, ...weeks.map(w => w.minutes))
  return { weeks, maxMins }
}

/**
 * Generate GitHub-style heatmap data for a single specific month (e.g. current month).
 * @param {Array} sessions - Array of session objects
 * @param {number} [targetYear] - Full year (e.g. 2026). Defaults to current year.
 * @param {number} [targetMonth] - 0-indexed month (0-11). Defaults to current month.
 */
export function generateMonthHeatmapData(sessions = [], targetYear = null, targetMonth = null) {
  const safeSessions = Array.isArray(sessions) ? sessions : []
  const today = new Date()
  const year = targetYear !== null && targetYear !== undefined ? targetYear : today.getFullYear()
  const month = targetMonth !== null && targetMonth !== undefined ? targetMonth : today.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const monthName = firstDay.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const monthShortName = firstDay.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })

  // Build day lookup map
  const dayMap = {}
  let monthTotalMinutes = 0
  let monthActiveDays = 0
  let monthSessionsCount = 0
  let maxDayMinutes = 0

  safeSessions.forEach(s => {
    if (!s || !s.start) return
    const d = new Date(s.start)
    if (isNaN(d.getTime())) return
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!dayMap[dateKey]) {
      dayMap[dateKey] = { minutes: 0, count: 0, sessions: [], gameIds: new Set(), gameNames: new Set() }
    }
    const mins = Math.max(1, Math.round(Number(s.durationMinutes) || 0))
    dayMap[dateKey].minutes += mins
    dayMap[dateKey].count += 1
    if (s.gameId) dayMap[dateKey].gameIds.add(s.gameId)
    if (s.gameName) dayMap[dateKey].gameNames.add(s.gameName)
    dayMap[dateKey].sessions.push(s)
  })

  // Align to Monday start (0: Mon, 6: Sun)
  const firstDayOfWeek = (firstDay.getDay() + 6) % 7
  const calendarStart = new Date(year, month, 1 - firstDayOfWeek)
  calendarStart.setHours(0, 0, 0, 0)

  const lastDayOfWeek = (lastDay.getDay() + 6) % 7
  const calendarEnd = new Date(year, month, lastDay.getDate() + (6 - lastDayOfWeek))
  calendarEnd.setHours(23, 59, 59, 999)

  const weeks = []
  let currentWeek = []
  const pointer = new Date(calendarStart)

  while (pointer <= calendarEnd) {
    const isCurrentMonth = pointer.getMonth() === month && pointer.getFullYear() === year
    const dateKey = `${pointer.getFullYear()}-${String(pointer.getMonth() + 1).padStart(2, '0')}-${String(pointer.getDate()).padStart(2, '0')}`
    const record = dayMap[dateKey] || { minutes: 0, count: 0, sessions: [], gameIds: new Set(), gameNames: new Set() }

    if (isCurrentMonth && record.minutes > 0) {
      monthTotalMinutes += record.minutes
      monthActiveDays += 1
      monthSessionsCount += record.count
      if (record.minutes > maxDayMinutes) {
        maxDayMinutes = record.minutes
      }
    }

    // Determine intensity level (0 to 4) based on number of games played that day
    const gamesPlayed = record.gameIds && record.gameIds.size > 0 ? record.gameIds.size : (record.count > 0 ? 1 : 0)
    let level = 0
    if (isCurrentMonth && (gamesPlayed > 0 || record.minutes > 0)) {
      if (gamesPlayed <= 1) level = 1
      else if (gamesPlayed === 2) level = 2
      else if (gamesPlayed === 3) level = 3
      else level = 4
    }

    const isToday = pointer.getFullYear() === today.getFullYear() &&
      pointer.getMonth() === today.getMonth() &&
      pointer.getDate() === today.getDate()

    const isFuture = pointer.getTime() > today.getTime()

    currentWeek.push({
      dateKey,
      dayNumber: pointer.getDate(),
      date: new Date(pointer),
      isCurrentMonth,
      isToday,
      isFuture,
      minutes: isCurrentMonth ? record.minutes : 0,
      count: isCurrentMonth ? record.count : 0,
      gamesCount: isCurrentMonth ? gamesPlayed : 0,
      gameNames: (isCurrentMonth && record.gameNames) ? Array.from(record.gameNames) : [],
      level: isCurrentMonth && !isFuture ? level : 0,
      formattedDate: pointer.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    })

    if (currentWeek.length === 7) {
      weeks.push({
        weekIndex: weeks.length,
        days: currentWeek,
      })
      currentWeek = []
    }

    pointer.setDate(pointer.getDate() + 1)
  }

  return {
    year,
    month,
    monthName,
    monthShortName,
    weeks,
    monthTotalMinutes,
    monthActiveDays,
    monthSessionsCount,
    maxDayMinutes,
  }
}

/**
 * Generate month-by-month history starting from the first month played up to the current month.
 * @param {Array} sessions - Array of session objects
 * @param {Array} games - Optional list of games for top-game attribution
 * @param {Date|number} [referenceDate] - Optional reference date (defaults to new Date())
 */
export function generateAllMonthsHistory(sessions = [], games = [], referenceDate = new Date()) {
  const safeSessions = Array.isArray(sessions) ? sessions : []
  const today = referenceDate instanceof Date ? referenceDate : new Date(referenceDate || Date.now())
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth()

  // Find earliest recorded play timestamp
  let earliestTimestamp = today.getTime()
  let hasHistory = false

  safeSessions.forEach(s => {
    const t = Number(s?.start)
    if (t && !isNaN(t) && t > 0) {
      earliestTimestamp = Math.min(earliestTimestamp, t)
      hasHistory = true
    }
  })

  ;(games || []).forEach(g => {
    const lp = Number(g?.lastPlayed)
    if (lp && !isNaN(lp) && lp > 0) {
      earliestTimestamp = Math.min(earliestTimestamp, lp)
      hasHistory = true
    }
  })

  const startDate = new Date(earliestTimestamp)
  let startYear = startDate.getFullYear()
  let startMonth = startDate.getMonth()

  // Guard against unrealistic dates (earlier than 2020)
  if (startYear < 2020) {
    startYear = 2020
    startMonth = 0
  }

  // Generate list of months from start up to current month
  const months = []
  let y = startYear
  let m = startMonth

  while (y < currentYear || (y === currentYear && m <= currentMonth)) {
    const monthData = generateMonthHeatmapData(safeSessions, y, m)

    // Calculate top game for this month if games provided
    let topGameThisMonth = null
    if (monthData.monthTotalMinutes > 0 && Array.isArray(games) && games.length > 0) {
      const monthStart = new Date(y, m, 1).getTime()
      const monthEnd = new Date(y, m + 1, 0, 23, 59, 59, 999).getTime()

      const gameMonthMins = {}
      safeSessions.forEach(s => {
        const t = Number(s?.start)
        if (t >= monthStart && t <= monthEnd) {
          const gid = s.gameId
          if (gid) {
            gameMonthMins[gid] = (gameMonthMins[gid] || 0) + (Number(s.durationMinutes) || 0)
          }
        }
      })

      const bestGid = Object.entries(gameMonthMins).sort((a, b) => b[1] - a[1])[0]
      if (bestGid) {
        const matched = games.find(g => g.id === bestGid[0])
        if (matched) {
          topGameThisMonth = {
            id: matched.id,
            name: matched.name,
            minutes: bestGid[1],
            art: matched.art?.grid,
          }
        }
      }
    }

    months.push({
      ...monthData,
      topGame: topGameThisMonth,
    })

    m += 1
    if (m > 11) {
      m = 0
      y += 1
    }
  }

  // Return newest first by default, and also provide chronological order
  return {
    months: [...months].reverse(),
    chronologicalMonths: months,
    startMonthName: new Date(startYear, startMonth, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    currentMonthName: new Date(currentYear, currentMonth, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    totalMonthsCount: months.length,
  }
}

