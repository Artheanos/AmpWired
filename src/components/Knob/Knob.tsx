import { useCallback, useRef } from 'react'
import type { ParamDef } from '../../types/effectParams'
import { formatParamValue } from '../../types/effectParams'
import styles from './Knob.module.css'

interface KnobProps {
  def: ParamDef
  value: number
  onChange: (value: number) => void
}

export function Knob({ def, value, onChange }: KnobProps) {
  const dragging = useRef(false)
  const startY = useRef(0)
  const startValue = useRef(0)

  const clamp = useCallback(
    (v: number) => Math.max(def.min, Math.min(def.max, v)),
    [def.min, def.max],
  )

  const normalized = (value - def.min) / (def.max - def.min)

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    dragging.current = true
    startY.current = e.clientY
    startValue.current = value
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const delta = (startY.current - e.clientY) / 100
    const range = def.max - def.min
    onChange(clamp(startValue.current + delta * range))
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    dragging.current = false
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const range = def.max - def.min
    const step = range * 0.02
    onChange(clamp(value + (e.deltaY < 0 ? step : -step)))
  }

  return (
    <div className={styles.knob}>
      <div
        className={styles.dial}
        style={{ '--value': normalized } as React.CSSProperties}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        role="slider"
        aria-valuenow={value}
        aria-valuemin={def.min}
        aria-valuemax={def.max}
        aria-label={def.label}
      />
      <span className={styles.label}>{def.label}</span>
      <span className={styles.value}>{formatParamValue(def, value)}</span>
    </div>
  )
}
