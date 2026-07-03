export type NodeType = 'source' | 'effect' | 'destination'

export type EffectType =
  | 'distortion'
  | 'reverb'
  | 'delay'
  | 'chorus'
  | 'eq'
  | 'compressor'

export type PortName = 'input' | 'output'

export interface Node {
  id: string
  type: NodeType
  effectType?: EffectType
  x: number
  y: number
  params: Record<string, number>
  label: string
}

export interface Connection {
  id: string
  sourceNodeId: string
  sourcePort: 'output'
  targetNodeId: string
  targetPort: 'input'
}

export interface PatchMetadata {
  name: string
  created: string
}

export interface Patch {
  version: string
  nodes: Node[]
  connections: Connection[]
  metadata: PatchMetadata
}

export interface PatchState {
  nodes: Node[]
  connections: Connection[]
  metadata: PatchMetadata
  selectedWireId: string | null
  muted: boolean
  toast: string | null
}
