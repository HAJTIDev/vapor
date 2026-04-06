import React, { useEffect, useMemo, useState } from 'react'

function TrophyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v3a5 5 0 0 1-10 0V4Z" />
      <path d="M5 6H3a4 4 0 0 0 4 4" />
      <path d="M19 6h2a4 4 0 0 1-4 4" />
      <path d="M9 12.5h6" />
    </svg>
  )
}

function normalizeAchievement(definition, fallbackId = '') {
  const safe = definition && typeof definition === 'object' && !Array.isArray(definition) ? definition : {}
  const id = String(safe.id || safe.apiname || fallbackId || '').trim()
  if (!id) return null

  return {
    id,
    name: String(safe.name || safe.displayName || id).trim(),
    description: String(safe.description || '').trim(),
    hidden: !!safe.hidden,
  }
}

function normalizeState(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}

  return Object.entries(input).reduce((acc, [id, entry]) => {
    const key = String(id || '').trim()
    if (!key) return acc
    acc[key] = {
      achieved: !!entry?.achieved,
      achievedAt: Number.isFinite(Number(entry?.achievedAt)) ? Math.max(0, Math.round(Number(entry.achievedAt))) : 0,
    }
    return acc
  }, {})
}

function normalizeDefinitions(input) {
  const list = Array.isArray(input) ? input : []
  return list
    .map((definition, index) => normalizeAchievement(definition, `achievement_${index}`))
    .filter(Boolean)
    .filter((definition, index, self) => self.findIndex((candidate) => candidate.id === definition.id) === index)
}

function parseImportedDefinitions(text) {
  const parsed = JSON.parse(text)
  if (Array.isArray(parsed)) return normalizeDefinitions(parsed)
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    if (Array.isArray(parsed.achievements)) return normalizeDefinitions(parsed.achievements)
    if (Array.isArray(parsed.definitions)) return normalizeDefinitions(parsed.definitions)
    if (Array.isArray(parsed.achievementDefinitions)) return normalizeDefinitions(parsed.achievementDefinitions)
  }
  return []
}

function formatSummary(definitions, state) {
  const total = definitions.length
  const unlocked = definitions.filter((definition) => state[definition.id]?.achieved).length
  const percent = total > 0 ? Math.round((unlocked / total) * 100) : 0
  return { total, unlocked, percent }
}

function StatCard({ label, value }) {
  return (
    <div style={{ minWidth: 180, flex: '1 1 180px', padding: 14, borderRadius: 14, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{value}</div>
    </div>
  )
}

function SectionCard({ title, subtitle, children, action }) {
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 18, padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
          {subtitle ? <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.45 }}>{subtitle}</div> : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        padding: 2,
        border: 'none',
        cursor: 'pointer',
        background: checked ? 'var(--accent)' : 'var(--surface)',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          transform: checked ? 'translateX(20px)' : 'translateX(0)',
          transition: 'transform 180ms ease',
        }}
      />
    </button>
  )
}

export default function AchievementsWindow({
  title = 'Achievements',
  description = 'Local achievements stored per game, with a simple JSON import/export flow.',
  icon = <TrophyIcon />,
  game,
  onUpdate,
  children,
}) {
  const definitions = useMemo(() => normalizeDefinitions(game?.achievementDefinitions), [game?.achievementDefinitions])
  const state = useMemo(() => normalizeState(game?.achievementState), [game?.achievementState])
  const summary = useMemo(() => formatSummary(definitions, state), [definitions, state])

  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newHidden, setNewHidden] = useState(false)

  useEffect(() => {
    if (!game?.id || !onUpdate || definitions.length === 0) return

    const nextState = { ...state }
    let changed = false

    definitions.forEach((definition) => {
      if (!nextState[definition.id]) {
        nextState[definition.id] = { achieved: false, achievedAt: 0 }
        changed = true
      }
    })

    Object.keys(nextState).forEach((id) => {
      if (!definitions.some((definition) => definition.id === id)) {
        delete nextState[id]
        changed = true
      }
    })

    if (changed) {
      onUpdate(game.id, { achievementState: nextState })
    }
  }, [definitions, game?.id, onUpdate, state])

  const exportText = useMemo(() => JSON.stringify(definitions, null, 2), [definitions])

  const importDefinitions = () => {
    if (!game?.id || !importText.trim()) return

    try {
      const nextDefinitions = parseImportedDefinitions(importText)
      if (!nextDefinitions.length) {
        setImportError('No achievements were found in that JSON.')
        return
      }

      const nextState = nextDefinitions.reduce((acc, definition) => {
        const current = state[definition.id]
        acc[definition.id] = current || { achieved: false, achievedAt: 0 }
        return acc
      }, {})

      onUpdate(game.id, {
        achievementDefinitions: nextDefinitions,
        achievementState: nextState,
      })
      setImportError('')
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Invalid JSON.')
    }
  }

  const addAchievement = () => {
    if (!game?.id || !newName.trim()) return

    const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const nextDefinitions = [
      ...definitions,
      {
        id,
        name: newName.trim(),
        description: newDescription.trim(),
        hidden: newHidden,
      },
    ]

    onUpdate(game.id, {
      achievementDefinitions: nextDefinitions,
      achievementState: {
        ...state,
        [id]: { achieved: false, achievedAt: 0 },
      },
    })

    setNewName('')
    setNewDescription('')
    setNewHidden(false)
  }

  const toggleAchievement = (achievementId, achieved) => {
    if (!game?.id) return
    onUpdate(game.id, {
      achievementState: {
        ...state,
        [achievementId]: {
          achieved,
          achievedAt: achieved ? (state[achievementId]?.achievedAt || Date.now()) : 0,
        },
      },
    })
  }

  const removeAchievement = (achievementId) => {
    if (!game?.id) return
    const nextDefinitions = definitions.filter((definition) => definition.id !== achievementId)
    const nextState = { ...state }
    delete nextState[achievementId]
    onUpdate(game.id, {
      achievementDefinitions: nextDefinitions,
      achievementState: nextState,
    })
  }

  const clearUnlocks = () => {
    if (!game?.id) return
    const nextState = definitions.reduce((acc, definition) => {
      acc[definition.id] = { achieved: false, achievedAt: 0 }
      return acc
    }, {})
    onUpdate(game.id, { achievementState: nextState })
  }

  return (
    <section style={{ height: '100%', padding: 28, overflow: 'auto' }}>
      <div style={{ maxWidth: 940, margin: '0 auto', background: 'linear-gradient(180deg, color-mix(in srgb, var(--surface) 92%, transparent), var(--surface))', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 18px 50px #00000035', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 24, borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, transparent), transparent 72%)' }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, display: 'grid', placeItems: 'center', color: '#fff', background: 'var(--accent-gradient)', boxShadow: '0 10px 24px color-mix(in srgb, var(--accent) 26%, transparent)', flexShrink: 0 }}>
            {icon}
          </div>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', marginBottom: 6 }}>
              {title}
            </h2>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-dim)', maxWidth: 760 }}>
              {description}
            </p>
          </div>
        </div>

        <div style={{ padding: 24, display: 'grid', gap: 18 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <StatCard label="Game" value={game?.name || 'Game'} />
            <StatCard label="Unlocked" value={`${summary.unlocked}/${summary.total}`} />
            <StatCard label="Completion" value={`${summary.percent}%`} />
          </div>

          <SectionCard
            title="File Import / Export"
            subtitle="Paste a Goldberg-style achievement list or export the current local definitions as JSON."
            action={
              <button
                onClick={clearUnlocks}
                disabled={!definitions.length}
                style={{ padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, color: 'var(--text)', background: 'transparent', border: '1px solid var(--border)', cursor: definitions.length ? 'pointer' : 'default', opacity: definitions.length ? 1 : 0.5 }}
              >
                Clear Unlocks
              </button>
            }
          >
            <div style={{ display: 'grid', gap: 12 }}>
              <textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                placeholder="Paste achievements JSON here"
                rows={7}
                style={textareaStyle}
              />
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={importDefinitions} style={primaryButtonStyle}>Import JSON</button>
                <button onClick={() => setImportText(exportText)} style={secondaryButtonStyle}>Load Current JSON</button>
              </div>
              {importError ? <div style={{ fontSize: 12, color: 'var(--red)' }}>{importError}</div> : null}
            </div>
          </SectionCard>

          <SectionCard
            title="Local Achievements"
            subtitle="These are stored on the game record and unlocked locally, no Steam API involved."
          >
            <div style={{ display: 'grid', gap: 10 }}>
              {definitions.length > 0 ? definitions.map((achievement) => {
                const unlocked = !!state[achievement.id]?.achieved
                const achievedAt = Number(state[achievement.id]?.achievedAt || 0)
                return (
                  <div key={achievement.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, border: '1px solid var(--border)', background: unlocked ? 'color-mix(in srgb, var(--green) 12%, var(--surface2))' : 'var(--surface)' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, display: 'grid', placeItems: 'center', background: unlocked ? 'var(--green-gradient)' : 'var(--surface2)', color: unlocked ? '#fff' : 'var(--text-muted)', flexShrink: 0, fontWeight: 700 }}>
                      {unlocked ? '✓' : '•'}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{achievement.name || 'Unnamed achievement'}</div>
                        <div style={{ fontSize: 11, color: unlocked ? 'var(--green)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{unlocked ? 'Unlocked' : 'Locked'}</div>
                        {achievement.hidden ? <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Hidden</div> : null}
                      </div>
                      {achievement.description ? <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.4 }}>{achievement.description}</div> : null}
                      {achievedAt ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Unlocked {new Date(achievedAt).toLocaleString()}</div> : null}
                    </div>
                    <Toggle checked={unlocked} onChange={(nextValue) => toggleAchievement(achievement.id, nextValue)} label={`Toggle ${achievement.name}`} />
                    <button
                      onClick={() => removeAchievement(achievement.id)}
                      style={{ padding: '8px 12px', borderRadius: 10, background: 'transparent', color: 'var(--red)', border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
                    >
                      Remove
                    </button>
                  </div>
                )
              }) : (
                <div style={{ padding: 18, borderRadius: 14, border: '1px dashed var(--border)', color: 'var(--text-muted)', fontSize: 13 }}>
                  No local achievements yet. Import a JSON file or add one below.
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Add Local Achievement"
            subtitle="Create a new local entry that will be stored on this game record."
            action={
              <button
                onClick={addAchievement}
                disabled={!newName.trim()}
                style={{ padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#fff', background: newName.trim() ? 'var(--accent)' : 'var(--surface3)', border: 'none', cursor: newName.trim() ? 'pointer' : 'default' }}
              >
                Add Achievement
              </button>
            }
          >
            <div style={{ display: 'grid', gap: 12 }}>
              <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Achievement name" style={inputStyle} />
              <textarea value={newDescription} onChange={(event) => setNewDescription(event.target.value)} placeholder="Short description" rows={3} style={textareaStyle} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text)' }}>
                <input type="checkbox" checked={newHidden} onChange={(event) => setNewHidden(event.target.checked)} />
                Hidden until unlocked
              </label>
            </div>
          </SectionCard>

          <SectionCard
            title="Export Preview"
            subtitle="This is the JSON currently stored for the game."
          >
            <textarea readOnly value={exportText} rows={8} style={textareaStyle} />
          </SectionCard>

          {children}
        </div>
      </div>
    </section>
  )
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 12,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  fontSize: 13,
}

const textareaStyle = {
  ...inputStyle,
  resize: 'vertical',
}

const primaryButtonStyle = {
  padding: '8px 14px',
  borderRadius: 10,
  border: 'none',
  background: 'var(--accent)',
  color: '#fff',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
}

const secondaryButtonStyle = {
  padding: '8px 14px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
}
