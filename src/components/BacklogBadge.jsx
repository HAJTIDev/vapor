import React, { useState, useRef, useEffect } from 'react'
import { BACKLOG_STATUSES, getStatusConfig } from '../statusWorkflow.js'

export default function BacklogBadge({
  status,
  onChange,
  editable = false,
  size = 'md', // 'xs', 'sm', 'md', 'lg'
  compact = false,
  showLabel = true,
  style = {},
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const config = getStatusConfig(status)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const sizeStyles = {
    xs: { padding: '2px 6px', fontSize: '10px', iconSize: '11px', gap: '4px', radius: '4px' },
    sm: { padding: '3px 8px', fontSize: '11px', iconSize: '12px', gap: '5px', radius: '6px' },
    md: { padding: '6px 12px', fontSize: '12px', iconSize: '14px', gap: '6px', radius: '8px' },
    lg: { padding: '8px 16px', fontSize: '14px', iconSize: '16px', gap: '8px', radius: '10px' },
  }[size] || sizeStyles.md

  if (!config && !editable) {
    return null
  }

  const badgeContent = (
    <div
      onClick={(e) => {
        if (!editable) return
        e.stopPropagation()
        setOpen((prev) => !prev)
      }}
      title={config ? `${config.label}: ${config.desc}` : 'Set completion status'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: sizeStyles.gap,
        padding: sizeStyles.padding,
        borderRadius: sizeStyles.radius,
        fontSize: sizeStyles.fontSize,
        fontWeight: 600,
        fontFamily: 'inherit',
        cursor: editable ? 'pointer' : 'default',
        userSelect: 'none',
        transition: 'all 0.18s ease',
        background: config ? config.bg : 'var(--surface2)',
        color: config ? config.color : 'var(--text-muted)',
        border: `1px solid ${config ? config.border : 'var(--border2)'}`,
        boxShadow: config?.id === 'Currently Playing'
          ? `0 0 12px ${config.glow}`
          : config?.id === '100%'
          ? `0 0 10px ${config.glow}`
          : 'none',
        backdropFilter: 'blur(8px)',
        position: 'relative',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (editable) {
          e.currentTarget.style.transform = 'translateY(-1px)'
          e.currentTarget.style.filter = 'brightness(1.1)'
        }
      }}
      onMouseLeave={(e) => {
        if (editable) {
          e.currentTarget.style.transform = 'none'
          e.currentTarget.style.filter = 'none'
        }
      }}
    >
      <span style={{ fontSize: sizeStyles.iconSize, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}>
        {config?.icon || '🏷️'}
      </span>
      {showLabel && (
        <span style={{ whiteSpace: 'nowrap' }}>
          {config?.label || (editable ? '+ Set Status' : 'Untagged')}
        </span>
      )}
      {editable && (
        <span style={{ fontSize: '9px', opacity: 0.65, marginLeft: 2, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          ▼
        </span>
      )}
    </div>
  )

  if (!editable) {
    return badgeContent
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={menuRef}>
      {badgeContent}

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 1050,
            background: 'var(--surface)',
            border: '1px solid var(--border2)',
            borderRadius: 10,
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.45)',
            padding: '6px',
            minWidth: 200,
            backdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          <div style={{
            padding: '4px 8px 6px',
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
            fontWeight: 600,
          }}>
            Completion Status
          </div>

          {BACKLOG_STATUSES.map((st) => {
            const isSelected = status === st.id
            return (
              <button
                key={st.id}
                type="button"
                className="ui-btn"
                onClick={() => {
                  onChange?.(st.id)
                  setOpen(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: 6,
                  border: isSelected ? `1px solid ${st.border}` : '1px solid transparent',
                  background: isSelected ? st.bg : 'transparent',
                  color: isSelected ? st.color : 'var(--text)',
                  fontSize: '12px',
                  fontWeight: isSelected ? 600 : 500,
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'var(--surface2)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <span style={{ fontSize: '14px', lineHeight: 1 }}>{st.icon}</span>
                <span style={{ flex: 1 }}>{st.label}</span>
                {isSelected && (
                  <span style={{ fontSize: '11px', color: st.color, fontWeight: 700 }}>✓</span>
                )}
              </button>
            )
          })}

          {status && (
            <>
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              <button
                type="button"
                className="ui-btn"
                onClick={() => {
                  onChange?.(null)
                  setOpen(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid transparent',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
                  e.currentTarget.style.color = 'var(--red)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text-muted)'
                }}
              >
                <span>✕</span>
                <span>Clear Status</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
