import type { Connection, Node, Patch, PatchMetadata } from '../types/patch'

const VALID_EFFECT_TYPES = new Set([
  'distortion',
  'reverb',
  'delay',
  'chorus',
  'eq',
  'compressor',
])

const VALID_NODE_TYPES = new Set(['source', 'effect', 'destination'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateNode(node: unknown): node is Node {
  if (!isRecord(node)) return false
  if (typeof node.id !== 'string') return false
  if (!VALID_NODE_TYPES.has(node.type as string)) return false
  if (typeof node.x !== 'number' || typeof node.y !== 'number') return false
  if (typeof node.label !== 'string') return false
  if (!isRecord(node.params)) return false

  if (node.type === 'effect') {
    if (!VALID_EFFECT_TYPES.has(node.effectType as string)) return false
  }

  return true
}

function validateConnection(conn: unknown): conn is Connection {
  if (!isRecord(conn)) return false
  if (typeof conn.id !== 'string') return false
  if (typeof conn.sourceNodeId !== 'string') return false
  if (typeof conn.targetNodeId !== 'string') return false
  if (conn.sourcePort !== 'output') return false
  if (conn.targetPort !== 'input') return false
  return true
}

export function validatePatch(data: unknown): { ok: true; patch: Patch } | { ok: false; error: string } {
  if (!isRecord(data)) return { ok: false, error: 'Invalid patch: not an object' }
  if (data.version !== '1.0') return { ok: false, error: 'Unsupported patch version' }
  if (!Array.isArray(data.nodes)) return { ok: false, error: 'Missing nodes array' }
  if (!Array.isArray(data.connections)) return { ok: false, error: 'Missing connections array' }

  for (const node of data.nodes) {
    if (!validateNode(node)) return { ok: false, error: 'Invalid node in patch' }
  }

  for (const conn of data.connections) {
    if (!validateConnection(conn)) return { ok: false, error: 'Invalid connection in patch' }
  }

  const nodeIds = new Set((data.nodes as Node[]).map((n) => n.id))
  for (const conn of data.connections as Connection[]) {
    if (!nodeIds.has(conn.sourceNodeId) || !nodeIds.has(conn.targetNodeId)) {
      return { ok: false, error: 'Connection references missing node' }
    }
  }

  const metadata = isRecord(data.metadata)
    ? {
        name: typeof data.metadata.name === 'string' ? data.metadata.name : 'Imported Patch',
        created:
          typeof data.metadata.created === 'string'
            ? data.metadata.created
            : new Date().toISOString(),
      }
    : { name: 'Imported Patch', created: new Date().toISOString() }

  return {
    ok: true,
    patch: {
      version: '1.0',
      nodes: data.nodes as Node[],
      connections: data.connections as Connection[],
      metadata,
    },
  }
}

export function createPatch(
  nodes: Node[],
  connections: Connection[],
  metadata?: Partial<PatchMetadata>,
): Patch {
  return {
    version: '1.0',
    nodes,
    connections,
    metadata: {
      name: metadata?.name ?? 'My Patch',
      created: metadata?.created ?? new Date().toISOString(),
    },
  }
}

export function downloadPatch(patch: Patch): void {
  const blob = new Blob([JSON.stringify(patch, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'patch.json'
  a.click()
  URL.revokeObjectURL(url)
}

export async function parsePatchFile(file: File): Promise<Patch> {
  const text = await file.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Invalid JSON file')
  }

  const result = validatePatch(data)
  if (!result.ok) throw new Error(result.error)
  return result.patch
}

export const AUTOSAVE_KEY = 'ampwired-autosave'

export function saveAutosave(patch: Patch): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(patch))
  } catch {
    // ignore quota errors
  }
}

export function loadAutosave(): Patch | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as unknown
    const result = validatePatch(data)
    return result.ok ? result.patch : null
  } catch {
    return null
  }
}
