import { useCallback, useEffect, useRef, useState } from 'react'
import { usePatch } from '../../context/PatchProvider'
import { getParamDefs } from '../../types/effectParams'
import type { Node as PatchNode } from '../../types/patch'
import { Knob } from '../Knob/Knob'
import { Modal } from '../Modal/Modal'
import modalStyles from '../Modal/Modal.module.css'
import styles from './Node.module.css'

const ICONS: Record<string, string> = {
  source: '🎤',
  destination: '🔊',
  distortion: '🎸',
  reverb: '🌊',
  delay: '⏱',
  chorus: '〰',
  eq: '📊',
  compressor: '📉',
}

interface NodeProps {
  node: PatchNode
  isActive: boolean
  onPortRef: (nodeId: string, port: 'input' | 'output', el: HTMLElement | null) => void
  onOutputDragStart: (nodeId: string, e: React.PointerEvent) => void
  onInputDragOver: (nodeId: string) => void
  hoveredInputId: string | null
  wireDragValid: boolean | null
}

export function NodeComponent({
  node,
  isActive,
  onPortRef,
  onOutputDragStart,
  onInputDragOver,
  hoveredInputId,
  wireDragValid,
}: NodeProps) {
  const {
    removeNode,
    moveNode,
    updateParam,
    updateLabel,
    setSourceDevice,
    setDestinationDevice,
    isUsingOscillator,
  } = usePatch()
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const [deviceModalKind, setDeviceModalKind] = useState<'input' | 'output' | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [oscillatorWarning, setOscillatorWarning] = useState(false)

  const paramDefs = getParamDefs(node.type, node.effectType)
  const icon = node.type === 'effect' && node.effectType ? ICONS[node.effectType] : ICONS[node.type]
  const pedalType = node.type === 'effect' ? node.effectType : node.type

  useEffect(() => {
    if (node.type === 'source') {
      const check = () => setOscillatorWarning(isUsingOscillator(node.id))
      const timer = setInterval(check, 1000)
      check()
      return () => clearInterval(timer)
    }
  }, [node.id, node.type, isUsingOscillator])

  const handleBodyPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, input, [role="slider"]')) return
    const canvas = document.querySelector('[data-canvas]')
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    dragging.current = true
    dragOffset.current = {
      x: e.clientX - rect.left - node.x,
      y: e.clientY - rect.top - node.y,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const canvas = document.querySelector('[data-canvas]')
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    moveNode(
      node.id,
      e.clientX - rect.left - dragOffset.current.x,
      e.clientY - rect.top - dragOffset.current.y,
    )
  }

  const handlePointerUp = () => {
    dragging.current = false
  }

  const openDeviceModal = useCallback(async (kind: 'input' | 'output') => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      const all = await navigator.mediaDevices.enumerateDevices()
      const filterKind = kind === 'input' ? 'audioinput' : 'audiooutput'
      setDevices(all.filter((d) => d.kind === filterKind))
      setDeviceModalKind(kind)
    } catch {
      setDevices([])
      setDeviceModalKind(kind)
    }
  }, [])

  const handleDeviceSelect = async (deviceId: string) => {
    if (deviceModalKind === 'input') {
      await setSourceDevice(node.id, deviceId)
      setOscillatorWarning(isUsingOscillator(node.id))
    } else if (deviceModalKind === 'output') {
      await setDestinationDevice(node.id, deviceId)
    }
    setDeviceModalKind(null)
  }

  const hasInput = node.type === 'effect' || node.type === 'destination'
  const hasOutput = node.type === 'source' || node.type === 'effect'

  const inputJackClass = [
    styles.jack,
    styles.jackInput,
    hoveredInputId === node.id && wireDragValid === true ? styles.jackValid : '',
    hoveredInputId === node.id && wireDragValid === false ? styles.jackInvalid : '',
    hoveredInputId === node.id ? styles.jackHover : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <div
        className={`${styles.node} ${isActive ? styles.nodeActive : ''}`}
        style={{ left: node.x, top: node.y }}
        data-node-id={node.id}
        data-pedal-type={pedalType}
      >
        <div className={styles.enclosure}>
          <span className={`${styles.screw} ${styles.screwTopLeft}`} aria-hidden />
          <span className={`${styles.screw} ${styles.screwTopRight}`} aria-hidden />
          <span className={`${styles.screw} ${styles.screwBottomLeft}`} aria-hidden />
          <span className={`${styles.screw} ${styles.screwBottomRight}`} aria-hidden />

          <button
            type="button"
            className={styles.close}
            onClick={() => removeNode(node.id)}
            aria-label="Delete node"
          >
            ×
          </button>

          <div className={styles.ledStrip}>
            <span className={styles.led} aria-hidden />
          </div>

          <div className={styles.header}>
            <span className={styles.icon}>{icon}</span>
            <input
              className={styles.label}
              value={node.label}
              onChange={(e) => updateLabel(node.id, e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
            />
          </div>

          <div
            className={styles.body}
            onPointerDown={handleBodyPointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {node.type === 'source' && (
              <>
                <button
                  type="button"
                  className={styles.deviceBtn}
                  onClick={() => openDeviceModal('input')}
                >
                  Select Input Device
                </button>
                {oscillatorWarning && (
                  <span className={styles.warning}>Mic unavailable — using test tone</span>
                )}
              </>
            )}
            {node.type === 'destination' && (
              <button
                type="button"
                className={styles.deviceBtn}
                onClick={() => openDeviceModal('output')}
              >
                Select Output Device
              </button>
            )}
            {paramDefs.map((def) => (
              <Knob
                key={def.key}
                def={def}
                value={node.params[def.key] ?? def.default}
                onChange={(v) => updateParam(node.id, def.key, v)}
              />
            ))}
          </div>
        </div>

        {hasInput && (
          <div
            ref={(el) => onPortRef(node.id, 'input', el)}
            className={inputJackClass}
            data-port="input"
            data-node-id={node.id}
            onPointerEnter={() => onInputDragOver(node.id)}
          >
            <div className={styles.jackNut}/>
          </div>
        )}

        {hasOutput && (
          <div
            ref={(el) => onPortRef(node.id, 'output', el)}
            className={`${styles.jack} ${styles.jackOutput}`}
            data-port="output"
            data-node-id={node.id}
            onPointerDown={(e) => {
              e.stopPropagation()
              onOutputDragStart(node.id, e)
            }}
          >
            <div className={styles.jackNut}/>
          </div>
        )}
      </div>

      {deviceModalKind && (
        <Modal
          title={deviceModalKind === 'input' ? 'Select Input Device' : 'Select Output Device'}
          onClose={() => setDeviceModalKind(null)}
        >
          {devices.length === 0 ? (
            <p>
              {deviceModalKind === 'input'
                ? 'No audio input devices found.'
                : 'No audio output devices found. Output selection needs a browser with setSinkId support (e.g. Chrome).'}
            </p>
          ) : (
            <ul className={modalStyles.list}>
              {deviceModalKind === 'output' && (
                <li>
                  <button
                    type="button"
                    className={modalStyles.listItem}
                    onClick={() => handleDeviceSelect('')}
                  >
                    System Default
                  </button>
                </li>
              )}
              {devices.map((d) => (
                <li key={d.deviceId}>
                  <button
                    type="button"
                    className={modalStyles.listItem}
                    onClick={() => handleDeviceSelect(d.deviceId)}
                  >
                    {d.label || `Device ${d.deviceId.slice(0, 8)}`}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </>
  )
}
