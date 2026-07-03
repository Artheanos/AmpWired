import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { usePatch } from '../../context/PatchProvider'
import { wouldCreateCycle } from '../../audio/graphUtils'
import { NodeComponent } from '../Node/Node'
import { WirePath, type Point } from '../Wire/Wire'
import wireStyles from '../Wire/Wire.module.css'
import styles from './Canvas.module.css'

interface WireDrag {
  sourceNodeId: string
  mouse: Point
}

interface ContextMenu {
  wireId: string
  x: number
  y: number
}

export function Canvas() {
  const {
    state,
    activeNodeIds,
    activeConnectionIds,
    addConnection,
    removeConnection,
    selectWire,
  } = usePatch()

  const canvasRef = useRef<HTMLDivElement>(null)
  const portRefs = useRef<Map<string, HTMLElement>>(new Map())
  const [wireDrag, setWireDrag] = useState<WireDrag | null>(null)
  const [hoveredInputId, setHoveredInputId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [, forceUpdate] = useState(0)

  const getPortCenter = useCallback((nodeId: string, port: 'input' | 'output'): Point | null => {
    const el = portRefs.current.get(`${nodeId}:${port}`)
    const canvas = canvasRef.current
    if (!el || !canvas) return null
    const portRect = el.getBoundingClientRect()
    const canvasRect = canvas.getBoundingClientRect()
    return {
      x: portRect.left + portRect.width / 2 - canvasRect.left,
      y: portRect.top + portRect.height / 2 - canvasRect.top,
    }
  }, [])

  const onPortRef = useCallback((nodeId: string, port: 'input' | 'output', el: HTMLElement | null) => {
    const key = `${nodeId}:${port}`
    if (el) portRefs.current.set(key, el)
    else portRefs.current.delete(key)
  }, [])

  // Port refs are set during child commit; re-measure wires before paint.
  useLayoutEffect(() => {
    forceUpdate((n) => n + 1)
  }, [state.nodes, state.connections])

  useEffect(() => {
    const handleResize = () => forceUpdate((n) => n + 1)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedWireId) {
        removeConnection(state.selectedWireId)
        selectWire(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.selectedWireId, removeConnection, selectWire])

  useEffect(() => {
    if (!wireDrag) return

    const handlePointerMove = (e: PointerEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      setWireDrag((prev) =>
        prev
          ? { ...prev, mouse: { x: e.clientX - rect.left, y: e.clientY - rect.top } }
          : null,
      )

      const el = document.elementFromPoint(e.clientX, e.clientY)
      const portEl = el?.closest('[data-port="input"]') as HTMLElement | null
      if (portEl) {
        setHoveredInputId(portEl.dataset.nodeId ?? null)
      } else {
        setHoveredInputId(null)
      }
    }

    const handlePointerUp = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const portEl = el?.closest('[data-port="input"]') as HTMLElement | null
      if (portEl && wireDrag) {
        const targetId = portEl.dataset.nodeId
        if (targetId && targetId !== wireDrag.sourceNodeId) {
          addConnection(wireDrag.sourceNodeId, targetId)
        }
      }
      setWireDrag(null)
      setHoveredInputId(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [wireDrag, addConnection])

  const handleOutputDragStart = (nodeId: string, e: React.PointerEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    setWireDrag({
      sourceNodeId: nodeId,
      mouse: { x: e.clientX - rect.left, y: e.clientY - rect.top },
    })
  }

  const wireDragValid = hoveredInputId
    ? !wouldCreateCycle(wireDrag?.sourceNodeId ?? '', hoveredInputId, state.connections) &&
      hoveredInputId !== wireDrag?.sourceNodeId
    : null

  const handleWireContextMenu = (wireId: string, e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ wireId, x: e.clientX, y: e.clientY })
  }

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu])

  const tempWireFrom = wireDrag ? getPortCenter(wireDrag.sourceNodeId, 'output') : null

  return (
    <div ref={canvasRef} className={styles.canvas} data-canvas>
      <svg className={`${styles.svg} ${styles.svgInteractive}`}>
        {state.connections.map((conn) => {
          const from = getPortCenter(conn.sourceNodeId, 'output')
          const to = getPortCenter(conn.targetNodeId, 'input')
          if (!from || !to) return null

          const isActive = activeConnectionIds.has(conn.id)
          const isSelected = state.selectedWireId === conn.id
          const className = [
            wireStyles.wire,
            isActive ? wireStyles.wireActive : '',
            isSelected ? wireStyles.wireSelected : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <WirePath
              key={conn.id}
              from={from}
              to={to}
              className={className}
              onClick={(e) => {
                e.stopPropagation()
                selectWire(conn.id)
              }}
              onContextMenu={(e) => handleWireContextMenu(conn.id, e)}
            />
          )
        })}

        {wireDrag && tempWireFrom && (
          <WirePath
            from={tempWireFrom}
            to={wireDrag.mouse}
            className={
              hoveredInputId
                ? wireDragValid
                  ? wireStyles.wireTempValid
                  : wireStyles.wireTempInvalid
                : wireStyles.wireTempNeutral
            }
          />
        )}
      </svg>

      {state.nodes.length === 0 && (
        <div className={styles.empty}>Click &quot;+ Add Node&quot; to start building your patch</div>
      )}

      {state.nodes.map((node) => (
        <NodeComponent
          key={node.id}
          node={node}
          isActive={activeNodeIds.has(node.id)}
          onPortRef={onPortRef}
          onOutputDragStart={handleOutputDragStart}
          onInputDragOver={setHoveredInputId}
          hoveredInputId={hoveredInputId}
          wireDragValid={wireDrag ? wireDragValid : null}
        />
      ))}

      {contextMenu && (
        <div
          className={wireStyles.contextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            className={wireStyles.contextMenuItem}
            onClick={() => {
              removeConnection(contextMenu.wireId)
              setContextMenu(null)
            }}
          >
            Remove wire
          </button>
        </div>
      )}
    </div>
  )
}
