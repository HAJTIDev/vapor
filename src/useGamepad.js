import { useState, useEffect, useRef, useCallback } from 'react'

const STICK_DEADZONE = 0.35
const INITIAL_REPEAT_DELAY = 280
const REPEAT_INTERVAL = 130

export function vibrateGamepad(type = 'click', vibrationEnabled = true) {
  if (!vibrationEnabled) return
  try {
    const gamepads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : []
    for (const pad of gamepads) {
      if (!pad) continue
      const actuator = pad.vibrationActuator
      if (actuator && typeof actuator.playEffect === 'function') {
        if (type === 'click') {
          actuator.playEffect('dual-rumble', {
            startDelay: 0,
            duration: 45,
            weakMagnitude: 0.35,
            strongMagnitude: 0.15,
          })
        } else if (type === 'favorite') {
          actuator.playEffect('dual-rumble', {
            startDelay: 0,
            duration: 80,
            weakMagnitude: 0.6,
            strongMagnitude: 0.3,
          })
        } else if (type === 'launch') {
          actuator.playEffect('dual-rumble', {
            startDelay: 0,
            duration: 180,
            weakMagnitude: 0.5,
            strongMagnitude: 0.8,
          })
        }
        break
      }
    }
  } catch {
    // Gamepad vibration unsupported or denied
  }
}

export function useGamepad({
  onNavigate,
  onButtonPress,
  vibrationEnabled = true,
} = {}) {
  const [isGamepadActive, setIsGamepadActive] = useState(false)
  const [gamepadInfo, setGamepadInfo] = useState(null)

  const onNavigateRef = useRef(onNavigate)
  const onButtonPressRef = useRef(onButtonPress)
  const vibrationEnabledRef = useRef(vibrationEnabled)

  useEffect(() => {
    onNavigateRef.current = onNavigate
    onButtonPressRef.current = onButtonPress
    vibrationEnabledRef.current = vibrationEnabled
  })

  const activeRef = useRef(false)
  const prevButtonsRef = useRef({})
  const prevAxesRef = useRef({ x: 0, y: 0 })
  const lastNavTimeRef = useRef(0)
  const navHoldDirectionRef = useRef(null)
  const navHoldStartRef = useRef(0)
  const rafIdRef = useRef(null)

  const vibrate = useCallback((type = 'click') => {
    vibrateGamepad(type, vibrationEnabledRef.current)
  }, [])

  // Mouse move switches back to mouse mode
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (Math.abs(e.movementX) > 2 || Math.abs(e.movementY) > 2) {
        if (activeRef.current) {
          activeRef.current = false
          setIsGamepadActive(false)
          if (typeof document !== 'undefined') {
            document.body.classList.remove('gamepad-mode')
          }
        }
      }
    }

    const handleKeyDown = (e) => {
      // Keyboard interaction
      if (e.key === 'Tab' || e.key.startsWith('Arrow')) {
        // keep mode
      }
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('keydown', handleKeyDown, { passive: true })

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Check connection events
  useEffect(() => {
    const onConnected = (e) => {
      const pad = e.gamepad
      setGamepadInfo({
        id: pad.id,
        index: pad.index,
        buttons: pad.buttons.length,
        axes: pad.axes.length,
      })
      vibrateGamepad('click', vibrationEnabledRef.current)
    }

    const onDisconnected = (e) => {
      const pads = (navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean)
      if (pads.length === 0) {
        setGamepadInfo(null)
        activeRef.current = false
        setIsGamepadActive(false)
        if (typeof document !== 'undefined') {
          document.body.classList.remove('gamepad-mode')
        }
      } else {
        setGamepadInfo({
          id: pads[0].id,
          index: pads[0].index,
          buttons: pads[0].buttons.length,
          axes: pads[0].axes.length,
        })
      }
    }

    window.addEventListener('gamepadconnected', onConnected)
    window.addEventListener('gamepaddisconnected', onDisconnected)

    // Initial check
    const existing = (navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean)
    if (existing.length > 0) {
      setGamepadInfo({
        id: existing[0].id,
        index: existing[0].index,
        buttons: existing[0].buttons.length,
        axes: existing[0].axes.length,
      })
    }

    return () => {
      window.removeEventListener('gamepadconnected', onConnected)
      window.removeEventListener('gamepaddisconnected', onDisconnected)
    }
  }, [])

  // Polling loop
  useEffect(() => {
    const buttonNames = [
      'A',       // 0
      'B',       // 1
      'X',       // 2
      'Y',       // 3
      'LB',      // 4
      'RB',      // 5
      'LT',      // 6
      'RT',      // 7
      'Select',  // 8
      'Start',   // 9
      'L3',      // 10
      'R3',      // 11
      'Up',      // 12 (D-pad)
      'Down',    // 13 (D-pad)
      'Left',    // 14 (D-pad)
      'Right',   // 15 (D-pad)
    ]

    const pollGamepads = () => {
      const now = performance.now()
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : []
      let activePad = null

      for (const pad of gamepads) {
        if (pad && pad.connected) {
          activePad = pad
          break
        }
      }

      if (activePad) {
        // 1. Process discrete button presses
        activePad.buttons.forEach((btn, idx) => {
          const isPressed = btn.pressed || btn.value > 0.5
          const name = buttonNames[idx] || `Btn${idx}`
          const wasPressed = prevButtonsRef.current[idx]

          if (isPressed && !wasPressed) {
            // New button press
            if (!activeRef.current) {
              activeRef.current = true
              setIsGamepadActive(true)
              if (typeof document !== 'undefined') {
                document.body.classList.add('gamepad-mode')
              }
            }
            onButtonPressRef.current?.(name, activePad)
          }

          prevButtonsRef.current[idx] = isPressed
        })

        // 2. Process directional input (D-Pad + Left Stick)
        const dpadUp = activePad.buttons[12]?.pressed
        const dpadDown = activePad.buttons[13]?.pressed
        const dpadLeft = activePad.buttons[14]?.pressed
        const dpadRight = activePad.buttons[15]?.pressed

        const stickX = activePad.axes[0] || 0
        const stickY = activePad.axes[1] || 0

        let direction = null

        if (dpadUp || stickY < -STICK_DEADZONE) {
          direction = 'up'
        } else if (dpadDown || stickY > STICK_DEADZONE) {
          direction = 'down'
        } else if (dpadLeft || stickX < -STICK_DEADZONE) {
          direction = 'left'
        } else if (dpadRight || stickX > STICK_DEADZONE) {
          direction = 'right'
        }

        if (direction) {
          if (!activeRef.current) {
            activeRef.current = true
            setIsGamepadActive(true)
            if (typeof document !== 'undefined') {
              document.body.classList.add('gamepad-mode')
            }
          }

          if (navHoldDirectionRef.current !== direction) {
            // First press in this direction
            navHoldDirectionRef.current = direction
            navHoldStartRef.current = now
            lastNavTimeRef.current = now
            onNavigateRef.current?.(direction)
            vibrateGamepad('click', vibrationEnabledRef.current)
          } else {
            // Holding direction -> repeat
            const holdDuration = now - navHoldStartRef.current
            if (holdDuration > INITIAL_REPEAT_DELAY && now - lastNavTimeRef.current > REPEAT_INTERVAL) {
              lastNavTimeRef.current = now
              onNavigateRef.current?.(direction)
            }
          }
        } else {
          navHoldDirectionRef.current = null
        }

        prevAxesRef.current = { x: stickX, y: stickY }
      }

      rafIdRef.current = requestAnimationFrame(pollGamepads)
    }

    rafIdRef.current = requestAnimationFrame(pollGamepads)
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
    }
  }, [])

  return {
    isGamepadActive,
    gamepadInfo,
    vibrate,
  }
}
