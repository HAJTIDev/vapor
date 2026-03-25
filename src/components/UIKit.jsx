import React from 'react'

// ===== DESIGN TOKENS =====

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  xxl: '24px',
  xxxl: '28px',
  '4xl': '32px',
}

export const radius = {
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
}

export const shadows = {
  sm: '0 1px 2px #00000015',
  md: '0 4px 8px #00000020',
  lg: '0 8px 20px #00000030',
  xl: '0 12px 32px #00000040',
  inner: 'inset 0 1px 3px #00000010',
}

export const transitions = {
  fast: '0.08s ease',
  base: '0.12s ease',
  slow: '0.18s ease',
}

export const typography = {
  h1: { fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em' },
  h2: { fontSize: '22px', fontWeight: 700, letterSpacing: '-0.01em' },
  h3: { fontSize: '18px', fontWeight: 700, letterSpacing: '0em' },
  h4: { fontSize: '16px', fontWeight: 600, letterSpacing: '0.01em' },
  body: { fontSize: '14px', fontWeight: 400, letterSpacing: '0em' },
  bodyMedium: { fontSize: '14px', fontWeight: 500, letterSpacing: '0em' },
  bodySm: { fontSize: '13px', fontWeight: 400, letterSpacing: '0em' },
  caption: { fontSize: '12px', fontWeight: 500, letterSpacing: '0.02em' },
  captionMono: { fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', fontFamily: 'var(--mono)' },
}

// ===== BUTTON COMPONENT =====

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  disabled = false,
  onClick,
  className = '',
  style = {},
  ...props
}) {
  const variantStyles = {
    primary: {
      background: 'var(--accent-gradient)',
      color: '#fff',
      border: 'none',
    },
    success: {
      background: 'var(--green-gradient)',
      color: '#fff',
      border: 'none',
    },
    secondary: {
      background: 'var(--surface2)',
      color: 'var(--text)',
      border: '1px solid var(--border)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-dim)',
      border: '1px solid transparent',
    },
    danger: {
      background: 'transparent',
      color: 'var(--red)',
      border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)',
    },
  }

  const sizeStyles = {
    xs: { padding: `${spacing.xs} ${spacing.md}`, fontSize: '11px', borderRadius: radius.sm },
    sm: { padding: `${spacing.sm} ${spacing.md}`, fontSize: '12px', borderRadius: radius.md },
    md: { padding: `${spacing.md} ${spacing.lg}`, fontSize: '13px', borderRadius: radius.md },
    lg: { padding: `${spacing.lg} ${spacing.xl}`, fontSize: '14px', borderRadius: radius.lg },
  }

  const baseStyle = {
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: `all ${transitions.base}`,
    fontFamily: 'inherit',
    fontWeight: 500,
    opacity: disabled ? 0.5 : 1,
    pointerEvents: disabled ? 'none' : 'auto',
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...style,
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`ui-btn ${className}`}
      style={baseStyle}
      {...props}
    >
      {children}
    </button>
  )
}

// ===== INPUT COMPONENT =====

export function Input({
  value,
  onChange,
  placeholder,
  disabled = false,
  type = 'text',
  className = '',
  style = {},
  ...props
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={`ui-input ${className}`}
      style={{
        padding: `${spacing.md} ${spacing.lg}`,
        fontSize: '13px',
        borderRadius: radius.md,
        fontFamily: 'inherit',
        ...style,
      }}
      {...props}
    />
  )
}

// ===== CARD COMPONENT =====

export function Card({
  children,
  variant = 'default',
  interactive = false,
  onClick,
  className = '',
  style = {},
}) {
  const isHoverable = interactive && onClick

  const variantStyles = {
    default: {
      background: 'var(--surface)',
      border: '1px solid var(--border)',
    },
    elevated: {
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      boxShadow: shadows.md,
    },
    subtle: {
      background: 'var(--surface2)',
      border: '1px solid transparent',
    },
  }

  const baseStyle = {
    borderRadius: radius.lg,
    padding: spacing.lg,
    transition: `all ${transitions.base}`,
    cursor: isHoverable ? 'pointer' : 'default',
    ...variantStyles[variant],
    ...(isHoverable && {
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: shadows.lg,
      },
    }),
    ...style,
  }

  return (
    <div
      onClick={onClick}
      className={className}
      style={baseStyle}
      onMouseEnter={(e) => {
        if (isHoverable) {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = shadows.lg
        }
      }}
      onMouseLeave={(e) => {
        if (isHoverable) {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = variantStyles[variant].boxShadow || 'none'
        }
      }}
    >
      {children}
    </div>
  )
}

// ===== SECTION COMPONENT =====

export function Section({ children, title, subtitle, className = '', style = {} }) {
  return (
    <div
      className={className}
      style={{
        ...Card.variantStyles?.subtle,
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: radius.lg,
        padding: spacing.lg,
        ...style,
      }}
    >
      {(title || subtitle) && (
        <div style={{ marginBottom: spacing.lg }}>
          {title && (
            <div
              style={{
                ...typography.caption,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                marginBottom: spacing.xs,
              }}
            >
              {title}
            </div>
          )}
          {subtitle && (
            <div style={{ ...typography.body, color: 'var(--text-dim)' }}>
              {subtitle}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

// ===== BADGE COMPONENT =====

export function Badge({ children, variant = 'default', className = '' }) {
  const variantStyles = {
    default: {
      background: 'var(--surface2)',
      color: 'var(--text-dim)',
      border: '1px solid var(--border)',
    },
    accent: {
      background: 'var(--accent-dim)',
      color: 'var(--accent)',
      border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)',
    },
    success: {
      background: 'color-mix(in srgb, var(--green) 15%, transparent)',
      color: 'var(--green)',
      border: '1px solid color-mix(in srgb, var(--green) 40%, transparent)',
    },
  }

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: `${spacing.xs} ${spacing.md}`,
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.02em',
        ...variantStyles[variant],
      }}
    >
      {children}
    </span>
  )
}

// ===== STAT COMPONENT =====

export function Stat({ label, value, icon }) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
          marginBottom: spacing.xs,
        }}
      >
        {icon && (
          <span style={{ color: 'var(--text-dim)', display: 'inline-flex' }}>
            {icon}
          </span>
        )}
        <span
          style={{
            ...typography.captionMono,
            color: 'var(--text-muted)',
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          ...typography.h4,
          color: 'var(--text)',
        }}
      >
        {value}
      </div>
    </div>
  )
}

// ===== DIVIDER COMPONENT =====

export function Divider({ style = {} }) {
  return (
    <div
      style={{
        height: '1px',
        background: 'var(--border)',
        margin: `${spacing.lg} 0`,
        ...style,
      }}
    />
  )
}

// ===== FLEX CONTAINER =====

export function Flex({
  children,
  direction = 'row',
  gap = spacing.md,
  align = 'center',
  justify = 'flex-start',
  wrap = 'nowrap',
  className = '',
  style = {},
}) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: direction,
        gap,
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ===== TEXT COMPONENTS =====

export const Text = {
  H1: ({ children, style = {} }) => (
    <h1 style={{ ...typography.h1, color: 'var(--text)', ...style }}>
      {children}
    </h1>
  ),
  H2: ({ children, style = {} }) => (
    <h2 style={{ ...typography.h2, color: 'var(--text)', ...style }}>
      {children}
    </h2>
  ),
  H3: ({ children, style = {} }) => (
    <h3 style={{ ...typography.h3, color: 'var(--text)', ...style }}>
      {children}
    </h3>
  ),
  H4: ({ children, style = {} }) => (
    <h4 style={{ ...typography.h4, color: 'var(--text)', ...style }}>
      {children}
    </h4>
  ),
  Body: ({ children, dim = false, style = {} }) => (
    <p style={{ ...typography.body, color: dim ? 'var(--text-dim)' : 'var(--text)', ...style }}>
      {children}
    </p>
  ),
  Muted: ({ children, style = {} }) => (
    <span style={{ ...typography.body, color: 'var(--text-muted)', ...style }}>
      {children}
    </span>
  ),
  Caption: ({ children, mono = false, style = {} }) => (
    <span
      style={{
        ...(mono ? typography.captionMono : typography.caption),
        color: 'var(--text-dim)',
        ...style,
      }}
    >
      {children}
    </span>
  ),
}

// ===== GRID LAYOUT =====

export function Grid({
  children,
  cols = 2,
  gap = spacing.lg,
  className = '',
  style = {},
}) {
  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${cols === 1 ? '100%' : cols === 2 ? '300px' : '200px'}, 1fr))`,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ===== MODAL OVERLAY =====

export function ModalOverlay({ children, onClose, style = {} }) {
  return (
    <div
      onClick={() => onClose?.()}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#00000060',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9000,
        padding: spacing.xl,
        ...style,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: radius.xl,
          boxShadow: shadows.xl,
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  )
}
