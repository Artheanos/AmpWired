import type { Connection, Node } from '../types/patch'

export function getOutgoingConnections(
  nodeId: string,
  connections: Connection[],
): Connection[] {
  return connections.filter((c) => c.sourceNodeId === nodeId)
}

export function getIncomingConnection(
  nodeId: string,
  connections: Connection[],
): Connection | undefined {
  return connections.find((c) => c.targetNodeId === nodeId)
}

export function wouldCreateCycle(
  sourceNodeId: string,
  targetNodeId: string,
  connections: Connection[],
): boolean {
  if (sourceNodeId === targetNodeId) return true

  const visited = new Set<string>()
  const stack = [targetNodeId]

  while (stack.length > 0) {
    const current = stack.pop()!
    if (current === sourceNodeId) return true
    if (visited.has(current)) continue
    visited.add(current)

    for (const conn of getOutgoingConnections(current, connections)) {
      stack.push(conn.targetNodeId)
    }
  }

  return false
}

export function topologicalSort(
  nodes: Node[],
  connections: Connection[],
): Node[] {
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const node of nodes) {
    inDegree.set(node.id, 0)
    adjacency.set(node.id, [])
  }

  for (const conn of connections) {
    adjacency.get(conn.sourceNodeId)?.push(conn.targetNodeId)
    inDegree.set(conn.targetNodeId, (inDegree.get(conn.targetNodeId) ?? 0) + 1)
  }

  const queue = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0)
  const sorted: Node[] = []
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  while (queue.length > 0) {
    const node = queue.shift()!
    sorted.push(node)

    for (const targetId of adjacency.get(node.id) ?? []) {
      const deg = (inDegree.get(targetId) ?? 0) - 1
      inDegree.set(targetId, deg)
      if (deg === 0) {
        const target = nodeMap.get(targetId)
        if (target) queue.push(target)
      }
    }
  }

  return sorted
}

export function getActivePath(
  nodes: Node[],
  connections: Connection[],
): { activeNodeIds: Set<string>; activeConnectionIds: Set<string> } {
  const sourceIds = nodes.filter((n) => n.type === 'source').map((n) => n.id)
  const activeNodeIds = new Set<string>()
  const activeConnectionIds = new Set<string>()

  for (const sourceId of sourceIds) {
    const queue = [sourceId]
    const visited = new Set<string>()

    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current)) continue
      visited.add(current)
      activeNodeIds.add(current)

      for (const conn of getOutgoingConnections(current, connections)) {
        activeConnectionIds.add(conn.id)
        queue.push(conn.targetNodeId)
      }
    }
  }

  return { activeNodeIds, activeConnectionIds }
}
