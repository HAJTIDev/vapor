import React, { useState, useMemo } from 'react'
import { getGameTheme } from '../gameArtTheme.js'

// SVG vector patterns for rich poster backdrops
function PatternSvg({ type, accent, accent2 }) {
  const color1 = accent || '#38bdf8'
  const color2 = accent2 || '#818cf8'

  switch (type) {
    case 'circuits':
      return (
        <svg
          viewBox="0 0 200 300"
          preserveAspectRatio="xMidYMid slice"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.16, pointerEvents: 'none' }}
        >
          <path d="M 20,40 L 80,40 L 110,70 L 170,70" fill="none" stroke={color1} strokeWidth="1.5" strokeDasharray="3 3" />
          <circle cx="20" cy="40" r="3" fill={color1} />
          <circle cx="170" cy="70" r="3.5" fill={color2} />
          
          <path d="M 180,120 L 130,120 L 100,150 L 30,150" fill="none" stroke={color2} strokeWidth="1.5" />
          <circle cx="180" cy="120" r="3" fill={color2} />
          <circle cx="30" cy="150" r="3.5" fill={color1} />

          <path d="M 40,210 L 90,210 L 130,250 L 180,250" fill="none" stroke={color1} strokeWidth="1.5" strokeDasharray="4 2" />
          <circle cx="40" cy="210" r="3.5" fill={color1} />
          <circle cx="180" cy="250" r="3" fill={color2} />

          <line x1="100" y1="0" x2="100" y2="300" stroke={color1} strokeWidth="0.75" strokeOpacity="0.3" strokeDasharray="8 8" />
        </svg>
      )

    case 'hexagons':
      return (
        <svg
          viewBox="0 0 200 300"
          preserveAspectRatio="xMidYMid slice"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.14, pointerEvents: 'none' }}
        >
          <defs>
            <pattern id={`hex-pat-${color1.replace('#','')}`} width="36" height="62.35" patternUnits="userSpaceOnUse">
              <path
                d="M18 0 L36 10.39 L36 31.18 L18 41.57 L0 31.18 L0 10.39 Z M18 62.35 L36 51.96 L36 31.18 L18 41.57 L0 31.18 L0 51.96 Z"
                fill="none"
                stroke={color1}
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#hex-pat-${color1.replace('#','')})`} />
        </svg>
      )

    case 'isometric':
      return (
        <svg
          viewBox="0 0 200 300"
          preserveAspectRatio="xMidYMid slice"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15, pointerEvents: 'none' }}
        >
          <g stroke={color1} strokeWidth="0.8" fill="none">
            <line x1="0" y1="50" x2="200" y2="150" />
            <line x1="0" y1="100" x2="200" y2="200" />
            <line x1="0" y1="150" x2="200" y2="250" />
            <line x1="0" y1="200" x2="200" y2="300" />
            <line x1="200" y1="50" x2="0" y2="150" stroke={color2} />
            <line x1="200" y1="100" x2="0" y2="200" stroke={color2} />
            <line x1="200" y1="150" x2="0" y2="250" stroke={color2} />
            <line x1="200" y1="200" x2="0" y2="300" stroke={color2} />
          </g>
        </svg>
      )

    case 'rings':
      return (
        <svg
          viewBox="0 0 200 300"
          preserveAspectRatio="xMidYMid slice"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.18, pointerEvents: 'none' }}
        >
          <circle cx="100" cy="130" r="35" fill="none" stroke={color1} strokeWidth="1" strokeDasharray="3 3" />
          <circle cx="100" cy="130" r="60" fill="none" stroke={color2} strokeWidth="1" />
          <circle cx="100" cy="130" r="90" fill="none" stroke={color1} strokeWidth="0.8" strokeDasharray="6 4" />
          <circle cx="100" cy="130" r="125" fill="none" stroke={color2} strokeWidth="0.6" />
          <line x1="100" y1="10" x2="100" y2="250" stroke={color1} strokeWidth="0.8" strokeOpacity="0.4" />
          <line x1="10" y1="130" x2="190" y2="130" stroke={color1} strokeWidth="0.8" strokeOpacity="0.4" />
        </svg>
      )

    case 'chevrons':
      return (
        <svg
          viewBox="0 0 200 300"
          preserveAspectRatio="xMidYMid slice"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.14, pointerEvents: 'none' }}
        >
          <g fill="none" stroke={color1} strokeWidth="1.5">
            <polyline points="20,40 100,75 180,40" />
            <polyline points="20,70 100,105 180,70" stroke={color2} />
            <polyline points="20,190 100,225 180,190" />
            <polyline points="20,220 100,255 180,220" stroke={color2} />
          </g>
        </svg>
      )

    case 'waves':
    case 'mesh':
    default:
      return (
        <svg
          viewBox="0 0 200 300"
          preserveAspectRatio="xMidYMid slice"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15, pointerEvents: 'none' }}
        >
          <path d="M-20,60 Q 50,30 100,60 T 220,60" fill="none" stroke={color1} strokeWidth="1.2" />
          <path d="M-20,100 Q 50,70 100,100 T 220,100" fill="none" stroke={color2} strokeWidth="1" strokeDasharray="4 2" />
          <path d="M-20,190 Q 50,160 100,190 T 220,190" fill="none" stroke={color1} strokeWidth="1" />
          <path d="M-20,230 Q 50,200 100,230 T 220,230" fill="none" stroke={color2} strokeWidth="1.2" strokeDasharray="6 3" />
        </svg>
      )
  }
}

// Emblems & vector icons for game genres
function GenreIcon({ type, size = 28, color = 'currentColor' }) {
  switch (type) {
    case 'vr':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="10" rx="3" />
          <path d="M9 17a2 2 0 0 1-2-2v-2a2 2 0 0 1 4 0v2a2 2 0 0 1-2 2z" opacity="0.3" fill={color} />
          <path d="M15 17a2 2 0 0 1-2-2v-2a2 2 0 0 1 4 0v2a2 2 0 0 1-2 2z" opacity="0.3" fill={color} />
          <path d="M10 17a2 2 0 0 1 4 0" />
          <line x1="2" y1="12" x2="4" y2="12" />
          <line x1="20" y1="12" x2="22" y2="12" />
        </svg>
      )

    case 'crosshair':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3" fill={color} fillOpacity="0.25" />
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
        </svg>
      )

    case 'sword':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
          <line x1="13" y1="19" x2="19" y2="13" />
          <line x1="16" y1="16" x2="20" y2="20" />
          <circle cx="20.5" cy="20.5" r="1" fill={color} />
        </svg>
      )

    case 'rocket':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
          <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
          <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
          <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
        </svg>
      )

    case 'racing':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 4a8 8 0 0 0-8 8c0 2.2.9 4.2 2.3 5.7L12 12l5.7 5.7A7.95 7.95 0 0 0 20 12a8 8 0 0 0-8-8z" />
          <circle cx="12" cy="12" r="2" fill={color} />
          <line x1="12" y1="12" x2="16" y2="8" strokeWidth="2.2" />
        </svg>
      )

    case 'skull':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="12" r="1.5" fill={color} />
          <circle cx="15" cy="12" r="1.5" fill={color} />
          <path d="M8 20v-2h8v2" />
          <path d="M12 15v1" />
          <path d="M18.5 13a6.5 6.5 0 1 0-13 0c0 3 1.5 5 2.5 5h8c1 0 2.5-2 2.5-5z" />
        </svg>
      )

    case 'strategy':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l9 5v10l-9 5-9-5V7z" />
          <circle cx="12" cy="12" r="3" fill={color} fillOpacity="0.3" />
          <line x1="12" y1="2" x2="12" y2="22" strokeDasharray="2 2" />
        </svg>
      )

    case 'controller':
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="20" height="12" rx="4" />
          <path d="M6 12h4m-2-2v4" />
          <circle cx="15.5" cy="10.5" r="1" fill={color} />
          <circle cx="17.5" cy="13.5" r="1" fill={color} />
        </svg>
      )
  }
}

/**
 * Universal Game Cover & Artwork component
 * Renders actual image when available, or a state-of-the-art procedural poster when missing.
 */
export default function GameCoverArt({
  game,
  src,
  alt = '',
  variant = 'card', // 'card' | 'hero' | 'detail-cover' | 'thumb'
  className = '',
  style = {},
  onImageError,
}) {
  const [loadError, setLoadError] = useState(false)
  const theme = useMemo(() => getGameTheme(game), [game?.name, game?.id, game?.isVR, game?.genres])

  const effectiveSrc = !loadError && src ? src : null

  // If a valid image source exists, render the image
  if (effectiveSrc) {
    if (variant === 'hero') {
      return (
        <img
          src={effectiveSrc}
          alt={alt}
          className={className}
          style={style}
          onError={() => {
            setLoadError(true)
            onImageError?.()
          }}
        />
      )
    }

    return (
      <img
        src={effectiveSrc}
        alt={alt}
        className={className}
        style={style}
        onError={() => {
          setLoadError(true)
          onImageError?.()
        }}
      />
    )
  }

  // Widescreen atmospheric banner for Game Detail page
  if (variant === 'hero') {
    return (
      <div
        className={`game-hero-fallback ${className}`}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          inset: 0,
          background: theme.heroBg,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
        }}
      >
        <PatternSvg type={theme.pattern} accent={theme.accent} accent2={theme.accent2} />

        {/* Ambient atmospheric glowing spotlight */}
        <div
          style={{
            position: 'absolute',
            width: '600px',
            height: '400px',
            top: '-50px',
            left: '10%',
            background: `radial-gradient(circle, ${theme.glow} 0%, transparent 70%)`,
            filter: 'blur(60px)',
            opacity: 0.6,
            pointerEvents: 'none',
          }}
        />

        {/* Huge faint background monogram watermark */}
        <div
          style={{
            position: 'absolute',
            right: '8%',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '180px',
            fontWeight: 900,
            fontFamily: 'var(--font)',
            letterSpacing: '-6px',
            color: '#ffffff',
            opacity: 0.035,
            userSelect: 'none',
            pointerEvents: 'none',
            lineHeight: 1,
          }}
        >
          {theme.monogram}
        </div>
      </div>
    )
  }

  // Sidebar mini thumbnail (24x32 or 20x28)
  if (variant === 'thumb') {
    return (
      <div
        className={`game-thumb-fallback ${className}`}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: theme.bg,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 'inherit',
          ...style,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at 50% 30%, ${theme.glow} 0%, transparent 80%)`,
            opacity: 0.6,
          }}
        />
        <span
          style={{
            fontSize: '11px',
            fontWeight: 800,
            fontFamily: 'var(--font)',
            color: '#ffffff',
            letterSpacing: '-0.5px',
            zIndex: 1,
            textShadow: `0 1px 4px rgba(0,0,0,0.8), 0 0 6px ${theme.glow}`,
          }}
        >
          {theme.monogram?.slice(0, 2) || '?'}
        </span>
      </div>
    )
  }

  // Detail cover (120x180) or Standard library card poster (2:3 aspect ratio)
  const isDetailCover = variant === 'detail-cover'
  const title = game?.name || 'Untitled Game'
  const titleLen = title.length

  // Calculate balanced font size based on title length and variant
  let titleFontSize = isDetailCover ? '12px' : '15px'
  if (titleLen <= 10) {
    titleFontSize = isDetailCover ? '14px' : '18px'
  } else if (titleLen > 24) {
    titleFontSize = isDetailCover ? '11px' : '13px'
  }

  return (
    <div
      className={`game-poster-fallback ${className}`}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: theme.bg,
        position: 'relative',
        overflow: 'hidden',
        padding: isDetailCover ? '12px 10px' : '16px 14px',
        boxSizing: 'border-box',
        userSelect: 'none',
        ...style,
      }}
    >
      {/* Background geometric pattern */}
      <PatternSvg type={theme.pattern} accent={theme.accent} accent2={theme.accent2} />

      {/* Central luminous radial glow */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: isDetailCover ? '100px' : '160px',
          height: isDetailCover ? '100px' : '160px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${theme.glow} 0%, transparent 75%)`,
          filter: 'blur(20px)',
          pointerEvents: 'none',
          opacity: 0.75,
        }}
      />

      {/* Sleek physical card sheen overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, transparent 45%, rgba(255, 255, 255, 0.02) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Top Header Pill: Badge & subtle branding */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          zIndex: 2,
        }}
      >
        <div
          style={{
            fontSize: isDetailCover ? '8px' : '9px',
            fontFamily: 'var(--mono)',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: theme.accent,
            background: 'rgba(0, 0, 0, 0.45)',
            border: `1px solid color-mix(in srgb, ${theme.accent} 40%, transparent)`,
            padding: '2px 7px',
            borderRadius: '6px',
            backdropFilter: 'blur(6px)',
            boxShadow: `0 2px 8px rgba(0, 0, 0, 0.4)`,
            maxWidth: '85%',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {theme.badge}
        </div>

        <span
          style={{
            fontSize: '9px',
            fontFamily: 'var(--mono)',
            fontWeight: 800,
            letterSpacing: '0.05em',
            color: 'rgba(255, 255, 255, 0.28)',
          }}
        >
          VAULT
        </span>
      </div>

      {/* Center Emblem: Framed crest with monogram & genre icon */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          margin: 'auto 0',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div
          className="game-poster-crest"
          style={{
            width: isDetailCover ? 56 : 74,
            height: isDetailCover ? 56 : 74,
            borderRadius: '16px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: `1px solid color-mix(in srgb, ${theme.accent} 45%, rgba(255,255,255,0.15))`,
            backdropFilter: 'blur(8px)',
            boxShadow: `0 8px 24px rgba(0,0,0,0.6), 0 0 20px ${theme.glow}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            transition: 'transform 0.3s ease, border-color 0.3s ease',
          }}
        >
          {/* Subtle corner tech tick marks */}
          <div style={{
            position: 'absolute',
            top: 2,
            right: 4,
            width: 3,
            height: 3,
            borderRadius: '50%',
            background: theme.accent,
            boxShadow: `0 0 6px ${theme.accent}`,
          }} />

          <GenreIcon
            type={theme.icon}
            size={isDetailCover ? 22 : 28}
            color={theme.accent}
          />

          <span
            style={{
              fontSize: isDetailCover ? '11px' : '14px',
              fontWeight: 900,
              fontFamily: 'var(--font)',
              letterSpacing: '0.04em',
              color: '#ffffff',
              marginTop: '2px',
              textShadow: '0 2px 8px rgba(0,0,0,0.8)',
            }}
          >
            {theme.monogram}
          </span>
        </div>
      </div>

      {/* Bottom Typography: Full game title anchored like high-end box art */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          width: '100%',
          zIndex: 2,
        }}
      >
        {/* Subtle accent rule */}
        <div
          style={{
            width: '32px',
            height: '2px',
            borderRadius: '2px',
            background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`,
            marginBottom: '8px',
          }}
        />

        <div
          title={title}
          style={{
            fontSize: titleFontSize,
            fontWeight: 800,
            fontFamily: 'var(--font)',
            lineHeight: 1.25,
            letterSpacing: '-0.01em',
            color: '#ffffff',
            textShadow: '0 2px 12px rgba(0, 0, 0, 0.9)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            wordBreak: 'break-word',
            width: '100%',
          }}
        >
          {title}
        </div>
      </div>
    </div>
  )
}
