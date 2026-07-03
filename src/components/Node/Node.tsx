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
  const { removeNode, moveNode, updateParam, updateLabel, setSourceDevice, isUsingOscillator } =
    usePatch()
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const [showDeviceModal, setShowDeviceModal] = useState(false)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [oscillatorWarning, setOscillatorWarning] = useState(false)

  const paramDefs = getParamDefs(node.type, node.effectType)
  const icon = node.type === 'effect' && node.effectType ? ICONS[node.effectType] : ICONS[node.type]

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

  const openDeviceModal = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      const all = await navigator.mediaDevices.enumerateDevices()
      setDevices(all.filter((d) => d.kind === 'audioinput'))
      setShowDeviceModal(true)
    } catch {
      setDevices([])
      setShowDeviceModal(true)
    }
  }, [])

  const handleDeviceSelect = async (deviceId: string) => {
    await setSourceDevice(node.id, deviceId)
    setShowDeviceModal(false)
    setOscillatorWarning(isUsingOscillator(node.id))
  }

  const hasInput = node.type === 'effect' || node.type === 'destination'
  const hasOutput = node.type === 'source' || node.type === 'effect'

  const inputPortClass = [
    styles.port,
    styles.portInput,
    hoveredInputId === node.id && wireDragValid === true ? styles.portValid : '',
    hoveredInputId === node.id && wireDragValid === false ? styles.portInvalid : '',
    hoveredInputId === node.id ? styles.portHover : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <div
        className={`${styles.node} ${isActive ? styles.nodeActive : ''}`}
        style={{ left: node.x, top: node.y }}
        data-node-id={node.id}
      >
        <div className={styles.header}>
          <span className={styles.icon}>{icon}</span>
          <input
            className={styles.label}
            value={node.label}
            onChange={(e) => updateLabel(node.id, e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className={styles.close}
            onClick={() => removeNode(node.id)}
            aria-label="Delete node"
          >
            ×
          </button>
        </div>

        <div
          className={styles.body}
          onPointerDown={handleBodyPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {node.type === 'source' && (
            <>
              <button type="button" className={styles.deviceBtn} onClick={openDeviceModal}>
                Select Input Device
              </button>
              {oscillatorWarning && (
                <span className={styles.warning}>Mic unavailable — using test tone</span>
              )}
            </>
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

        {hasInput && (
          <div
            ref={(el) => onPortRef(node.id, 'input', el)}
            className={inputPortClass}
            data-port="input"
            data-node-id={node.id}
            onPointerEnter={() => onInputDragOver(node.id)}
          />
        )}

        {hasOutput && (
          <div
            ref={(el) => onPortRef(node.id, 'output', el)}
            className={`${styles.port} ${styles.portOutput}`}
            data-port="output"
            data-node-id={node.id}
            onPointerDown={(e) => {
              e.stopPropagation()
              onOutputDragStart(node.id, e)
            }}
          />
        )}
      </div>

      {showDeviceModal && (
        <Modal title="Select Input Device" onClose={() => setShowDeviceModal(false)}>
          {devices.length === 0 ? (
            <p>No audio input devices found.</p>
          ) : (
            <ul className={modalStyles.list}>
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
