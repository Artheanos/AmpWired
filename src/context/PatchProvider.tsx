import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import { AudioEngine } from '../audio/AudioEngine'
import { getActivePath, wouldCreateCycle } from '../audio/graphUtils'
import {
  DESTINATION_PARAMS,
  getDefaultParams,
  SOURCE_PARAMS,
} from '../types/effectParams'
import type {
  Connection,
  EffectType,
  Node,
  NodeType,
  Patch,
  PatchState,
} from '../types/patch'
import { createId } from '../utils/id'
import { loadAutosave, saveAutosave } from '../utils/patchIO'

type Action =
  | { type: 'ADD_NODE'; node: Node }
  | { type: 'REMOVE_NODE'; id: string }
  | { type: 'MOVE_NODE'; id: string; x: number; y: number }
  | { type: 'UPDATE_PARAM'; id: string; key: string; value: number }
  | { type: 'UPDATE_LABEL'; id: string; label: string }
  | { type: 'ADD_CONNECTION'; connection: Connection }
  | { type: 'REMOVE_CONNECTION'; id: string }
  | { type: 'LOAD_PATCH'; patch: Patch }
  | { type: 'CLEAR_ALL' }
  | { type: 'SELECT_WIRE'; id: string | null }
  | { type: 'SET_MUTED'; muted: boolean }
  | { type: 'SHOW_TOAST'; message: string }
  | { type: 'CLEAR_TOAST' }

const NODE_WIDTH = 180
const NODE_HEIGHT = 140

function createNode(
  type: NodeType,
  effectType: EffectType | undefined,
  x: number,
  y: number,
  existingNodes: Node[],
): Node {
  const id = createId()
  let label = 'Node'
  let params: Record<string, number> = {}

  if (type === 'source') {
    label = 'Input'
    params = Object.fromEntries(SOURCE_PARAMS.map((p) => [p.key, p.default]))
  } else if (type === 'destination') {
    label = 'Output'
    params = Object.fromEntries(DESTINATION_PARAMS.map((p) => [p.key, p.default]))
  } else if (effectType) {
    const count = existingNodes.filter((n) => n.effectType === effectType).length + 1
    label = `${effectType.charAt(0).toUpperCase()}${effectType.slice(1)} ${count}`
    params = getDefaultParams(effectType)
  }

  return { id, type, effectType, x, y, params, label }
}

function getDefaultState(): PatchState {
  const autosave = loadAutosave()
  if (autosave) {
    return {
      nodes: autosave.nodes,
      connections: autosave.connections,
      metadata: autosave.metadata,
      selectedWireId: null,
      muted: false,
      toast: null,
    }
  }

  return {
    nodes: [],
    connections: [],
    metadata: { name: 'My Patch', created: new Date().toISOString() },
    selectedWireId: null,
    muted: false,
    toast: null,
  }
}

function reducer(state: PatchState, action: Action): PatchState {
  switch (action.type) {
    case 'ADD_NODE':
      return { ...state, nodes: [...state.nodes, action.node] }

    case 'REMOVE_NODE': {
      const nodes = state.nodes.filter((n) => n.id !== action.id)
      const connections = state.connections.filter(
        (c) => c.sourceNodeId !== action.id && c.targetNodeId !== action.id,
      )
      const selectedWireId =
        state.selectedWireId &&
        connections.some((c) => c.id === state.selectedWireId)
          ? state.selectedWireId
          : null
      return { ...state, nodes, connections, selectedWireId }
    }

    case 'MOVE_NODE':
      return {
        ...state,
        nodes: state.nodes.map((n) =>
          n.id === action.id ? { ...n, x: action.x, y: action.y } : n,
        ),
      }

    case 'UPDATE_PARAM':
      return {
        ...state,
        nodes: state.nodes.map((n) =>
          n.id === action.id
            ? { ...n, params: { ...n.params, [action.key]: action.value } }
            : n,
        ),
      }

    case 'UPDATE_LABEL':
      return {
        ...state,
        nodes: state.nodes.map((n) =>
          n.id === action.id ? { ...n, label: action.label } : n,
        ),
      }

    case 'ADD_CONNECTION': {
      const targetNode = state.nodes.find((n) => n.id === action.connection.targetNodeId)
      const sourceNode = state.nodes.find((n) => n.id === action.connection.sourceNodeId)

      if (!targetNode || !sourceNode) return state
      if (sourceNode.type === 'destination' || targetNode.type === 'source') return state
      if (action.connection.sourceNodeId === action.connection.targetNodeId) {
        return { ...state, toast: 'Cannot connect a node to itself' }
      }
      if (wouldCreateCycle(action.connection.sourceNodeId, action.connection.targetNodeId, state.connections)) {
        return { ...state, toast: 'Connection would create a cycle' }
      }

      const connections = state.connections.filter(
        (c) => c.targetNodeId !== action.connection.targetNodeId,
      )
      return {
        ...state,
        connections: [...connections, action.connection],
        toast: null,
      }
    }

    case 'REMOVE_CONNECTION':
      return {
        ...state,
        connections: state.connections.filter((c) => c.id !== action.id),
        selectedWireId: state.selectedWireId === action.id ? null : state.selectedWireId,
      }

    case 'LOAD_PATCH':
      return {
        ...state,
        nodes: action.patch.nodes,
        connections: action.patch.connections,
        metadata: action.patch.metadata,
        selectedWireId: null,
        toast: null,
      }

    case 'CLEAR_ALL':
      return {
        ...state,
        nodes: [],
        connections: [],
        selectedWireId: null,
        metadata: { ...state.metadata, created: new Date().toISOString() },
      }

    case 'SELECT_WIRE':
      return { ...state, selectedWireId: action.id }

    case 'SET_MUTED':
      return { ...state, muted: action.muted }

    case 'SHOW_TOAST':
      return { ...state, toast: action.message }

    case 'CLEAR_TOAST':
      return { ...state, toast: null }

    default:
      return state
  }
}

interface PatchContextValue {
  state: PatchState
  activeNodeIds: Set<string>
  activeConnectionIds: Set<string>
  audioEngine: AudioEngine
  addNode: (type: NodeType, effectType?: EffectType, canvasRect?: DOMRect) => void
  removeNode: (id: string) => void
  moveNode: (id: string, x: number, y: number) => void
  updateParam: (id: string, key: string, value: number) => void
  updateLabel: (id: string, label: string) => void
  addConnection: (sourceNodeId: string, targetNodeId: string) => void
  removeConnection: (id: string) => void
  loadPatch: (patch: Patch) => void
  clearAll: () => void
  selectWire: (id: string | null) => void
  toggleMute: () => void
  clearToast: () => void
  setSourceDevice: (nodeId: string, deviceId: string) => Promise<void>
  setDestinationDevice: (nodeId: string, deviceId: string) => Promise<void>
  isUsingOscillator: (nodeId: string) => boolean
  nodeWidth: number
  nodeHeight: number
}

const PatchContext = createContext<PatchContextValue | null>(null)

export function PatchProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, getDefaultState)
  const audioEngine = useRef(new AudioEngine()).current
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { activeNodeIds, activeConnectionIds } = useMemo(
    () => getActivePath(state.nodes, state.connections),
    [state.nodes, state.connections],
  )

  useEffect(() => {
    void audioEngine.syncGraph(state.nodes, state.connections)
  }, [audioEngine, state.nodes, state.connections])

  useEffect(() => {
    void audioEngine.setMuted(state.muted)
  }, [audioEngine, state.muted])

  useEffect(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => {
      saveAutosave({
        version: '1.0',
        nodes: state.nodes,
        connections: state.connections,
        metadata: state.metadata,
      })
    }, 1_000);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
  }, [state.nodes, state.connections, state.metadata])

  useEffect(() => {
    if (!state.toast) return
    const timer = setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 3000)
    return () => clearTimeout(timer)
  }, [state.toast])

  useEffect(() => {
    return () => audioEngine.dispose()
  }, [audioEngine])

  const addNode = useCallback(
    (type: NodeType, effectType?: EffectType, canvasRect?: DOMRect) => {
      void audioEngine.ensureContext()
      const centerX = canvasRect
        ? canvasRect.width / 2 - NODE_WIDTH / 2
        : 300
      const centerY = canvasRect
        ? canvasRect.height / 2 - NODE_HEIGHT / 2
        : 200
      const offset = state.nodes.length * 24
      const node = createNode(type, effectType, centerX + offset, centerY + offset, state.nodes)
      dispatch({ type: 'ADD_NODE', node })
    },
    [audioEngine, state.nodes],
  )

  const removeNode = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_NODE', id })
  }, [])

  const moveNode = useCallback((id: string, x: number, y: number) => {
    dispatch({ type: 'MOVE_NODE', id, x, y })
  }, [])

  const updateParam = useCallback(
    (id: string, key: string, value: number) => {
      void audioEngine.ensureContext()
      dispatch({ type: 'UPDATE_PARAM', id, key, value })
      audioEngine.updateParam(id, key, value)
    },
    [audioEngine],
  )

  const updateLabel = useCallback((id: string, label: string) => {
    dispatch({ type: 'UPDATE_LABEL', id, label })
  }, [])

  const addConnection = useCallback((sourceNodeId: string, targetNodeId: string) => {
    dispatch({
      type: 'ADD_CONNECTION',
      connection: {
        id: createId(),
        sourceNodeId,
        sourcePort: 'output',
        targetNodeId,
        targetPort: 'input',
      },
    })
  }, [])

  const removeConnection = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_CONNECTION', id })
  }, [])

  const loadPatch = useCallback((patch: Patch) => {
    dispatch({ type: 'LOAD_PATCH', patch })
  }, [])

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' })
  }, [])

  const selectWire = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_WIRE', id })
  }, [])

  const toggleMute = useCallback(() => {
    void audioEngine.ensureContext()
    dispatch({ type: 'SET_MUTED', muted: !state.muted })
  }, [audioEngine, state.muted])

  const clearToast = useCallback(() => {
    dispatch({ type: 'CLEAR_TOAST' })
  }, [])

  const setSourceDevice = useCallback(
    async (nodeId: string, deviceId: string) => {
      const node = state.nodes.find((n) => n.id === nodeId)
      await audioEngine.setSourceDevice(nodeId, deviceId, node?.params ?? {})
    },
    [audioEngine, state.nodes],
  )

  const setDestinationDevice = useCallback(
    async (nodeId: string, deviceId: string) => {
      await audioEngine.ensureContext()
      await audioEngine.setDestinationDevice(nodeId, deviceId)
    },
    [audioEngine],
  )

  const isUsingOscillator = useCallback(
    (nodeId: string) => audioEngine.isUsingOscillator(nodeId),
    [audioEngine],
  )

  const value: PatchContextValue = {
    state,
    activeNodeIds,
    activeConnectionIds,
    audioEngine,
    addNode,
    removeNode,
    moveNode,
    updateParam,
    updateLabel,
    addConnection,
    removeConnection,
    loadPatch,
    clearAll,
    selectWire,
    toggleMute,
    clearToast,
    setSourceDevice,
    setDestinationDevice,
    isUsingOscillator,
    nodeWidth: NODE_WIDTH,
    nodeHeight: NODE_HEIGHT,
  }

  return <PatchContext.Provider value={value}>{children}</PatchContext.Provider>
}

export function usePatch(): PatchContextValue {
  const ctx = useContext(PatchContext)
  if (!ctx) throw new Error('usePatch must be used within PatchProvider')
  return ctx
}
