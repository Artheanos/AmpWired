import type { Connection, Node } from '../types/patch'
import { createEffect } from './EffectFactory'

export interface NodeAudioHandle {
  input: AudioNode
  output: AudioNode
  updateParam: (key: string, value: number) => void
  dispose: () => void
  usingOscillator?: boolean
}

export class AudioEngine {
  private context: AudioContext | null = null
  private handles = new Map<string, NodeAudioHandle>()
  private wireConnections = new Map<string, { source: AudioNode; target: AudioNode }>()
  private sourceStreams = new Map<string, MediaStream>()
  private lastConnections: Connection[] = []
  private muted = false
  private syncGeneration = 0

  get audioContext(): AudioContext | null {
    return this.context
  }

  get isMuted(): boolean {
    return this.muted
  }

  private isSyncCurrent(generation: number): boolean {
    return (
      generation === this.syncGeneration &&
      this.context !== null &&
      this.context.state !== 'closed'
    )
  }

  private isHandleValid(handle: NodeAudioHandle, ctx: AudioContext): boolean {
    return handle.output.context === ctx && ctx.state !== 'closed'
  }

  private clearHandles(): void {
    for (const stream of this.sourceStreams.values()) {
      stream.getTracks().forEach((t) => t.stop())
    }
    this.sourceStreams.clear()
    for (const handle of this.handles.values()) {
      handle.dispose()
    }
    this.handles.clear()
    this.wireConnections.clear()
  }

  async ensureContext(): Promise<AudioContext> {
    if (!this.context || this.context.state === 'closed') {
      if (this.context?.state === 'closed') {
        this.syncGeneration++
      }
      this.clearHandles()
      this.context = new AudioContext()
    }
    if (this.context.state === 'suspended' && !this.muted) {
      await this.context.resume()
    }
    return this.context
  }

  async setMuted(muted: boolean): Promise<void> {
    this.muted = muted
    if (!this.context) return
    if (muted) {
      await this.context.suspend()
    } else {
      await this.context.resume()
    }
  }

  async syncGraph(nodes: Node[], connections: Connection[]): Promise<void> {
    const generation = this.syncGeneration
    const ctx = await this.ensureContext()
    if (!this.isSyncCurrent(generation)) return

    const nodeIds = new Set(nodes.map((n) => n.id))

    for (const [id, handle] of this.handles) {
      if (!nodeIds.has(id) || !this.isHandleValid(handle, ctx)) {
        handle.dispose()
        this.handles.delete(id)
        const stream = this.sourceStreams.get(id)
        if (stream) {
          stream.getTracks().forEach((t) => t.stop())
          this.sourceStreams.delete(id)
        }
      }
    }

    for (const node of nodes) {
      if (!this.isSyncCurrent(generation)) return

      const existing = this.handles.get(node.id)
      if (existing && !this.isHandleValid(existing, ctx)) {
        existing.dispose()
        this.handles.delete(node.id)
      }

      if (!this.handles.has(node.id)) {
        const handle = await this.createNodeHandle(ctx, node, generation)
        if (!handle || !this.isSyncCurrent(generation)) return
        this.handles.set(node.id, handle)
      } else {
        const handle = this.handles.get(node.id)!
        for (const [key, value] of Object.entries(node.params)) {
          handle.updateParam(key, value)
        }
      }
    }

    if (!this.isSyncCurrent(generation)) return

    const validWireIds = new Set(connections.map((c) => c.id))

    for (const [wireId, wire] of this.wireConnections) {
      if (!validWireIds.has(wireId)) {
        try {
          wire.source.disconnect(wire.target)
        } catch {
          // already disconnected
        }
        this.wireConnections.delete(wireId)
      }
    }

    for (const conn of connections) {
      if (!this.isSyncCurrent(generation)) return

      const sourceHandle = this.handles.get(conn.sourceNodeId)
      const targetHandle = this.handles.get(conn.targetNodeId)
      if (!sourceHandle || !targetHandle) continue
      if (!this.isHandleValid(sourceHandle, ctx) || !this.isHandleValid(targetHandle, ctx)) {
        continue
      }
      if (sourceHandle.output.context !== targetHandle.output.context) {
        continue
      }

      const existing = this.wireConnections.get(conn.id)
      if (
        existing &&
        existing.source === sourceHandle.output &&
        existing.target === targetHandle.input
      ) {
        continue
      }

      if (existing) {
        try {
          existing.source.disconnect(existing.target)
        } catch {
          // ignore
        }
      }

      for (const [wireId, wire] of [...this.wireConnections]) {
        if (wire.target === targetHandle.input && wireId !== conn.id) {
          try {
            wire.source.disconnect(wire.target)
          } catch {
            // ignore
          }
          this.wireConnections.delete(wireId)
        }
      }

      try {
        sourceHandle.output.connect(targetHandle.input)
        this.wireConnections.set(conn.id, {
          source: sourceHandle.output,
          target: targetHandle.input,
        })
      } catch {
        // stale context or already connected
      }
    }

    this.lastConnections = connections
  }

  private reconnectNodeWires(nodeId: string): void {
    for (const conn of this.lastConnections) {
      if (conn.sourceNodeId !== nodeId && conn.targetNodeId !== nodeId) continue

      const sourceHandle = this.handles.get(conn.sourceNodeId)
      const targetHandle = this.handles.get(conn.targetNodeId)
      if (!sourceHandle || !targetHandle) continue

      const existing = this.wireConnections.get(conn.id)
      if (existing) {
        try {
          existing.source.disconnect(existing.target)
        } catch {
          // ignore
        }
      }

      sourceHandle.output.connect(targetHandle.input)
      this.wireConnections.set(conn.id, {
        source: sourceHandle.output,
        target: targetHandle.input,
      })
    }
  }

  updateParam(nodeId: string, key: string, value: number): void {
    this.handles.get(nodeId)?.updateParam(key, value)
  }

  async setSourceDevice(nodeId: string, deviceId: string): Promise<void> {
    const generation = this.syncGeneration
    const ctx = await this.ensureContext()
    if (!this.isSyncCurrent(generation)) return

    const oldStream = this.sourceStreams.get(nodeId)
    if (oldStream) {
      oldStream.getTracks().forEach((t) => t.stop())
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      })
      if (!this.isSyncCurrent(generation)) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      this.sourceStreams.set(nodeId, stream)
      await this.recreateSource(nodeId, ctx, stream, false, generation)
    } catch {
      if (!this.isSyncCurrent(generation)) return
      await this.recreateSource(nodeId, ctx, null, true, generation)
    }
    if (this.isSyncCurrent(generation)) {
      this.reconnectNodeWires(nodeId)
    }
  }

  private async createNodeHandle(
    ctx: AudioContext,
    node: Node,
    generation: number,
  ): Promise<NodeAudioHandle | null> {
    if (node.type === 'source') {
      return this.createSourceHandle(ctx, node, generation)
    }
    if (!this.isSyncCurrent(generation)) return null
    if (node.type === 'destination') {
      return this.createDestinationHandle(ctx, node)
    }
    if (node.type === 'effect' && node.effectType) {
      const effect = createEffect(ctx, node.effectType, node.params)
      return {
        input: effect.input,
        output: effect.output,
        updateParam: effect.updateParam,
        dispose: effect.dispose,
      }
    }

    const pass = ctx.createGain()
    return {
      input: pass,
      output: pass,
      updateParam: () => {},
      dispose: () => pass.disconnect(),
    }
  }

  private async createSourceHandle(
    ctx: AudioContext,
    node: Node,
    generation: number,
  ): Promise<NodeAudioHandle | null> {
    let stream: MediaStream | null = null
    let usingOscillator = false

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!this.isSyncCurrent(generation)) {
        stream.getTracks().forEach((t) => t.stop())
        return null
      }
      this.sourceStreams.set(node.id, stream)
    } catch {
      if (!this.isSyncCurrent(generation)) return null
      usingOscillator = true
    }

    return this.buildSourceHandle(ctx, node, stream, usingOscillator)
  }

  private buildSourceHandle(
    ctx: AudioContext,
    node: Node,
    stream: MediaStream | null,
    usingOscillator: boolean,
  ): NodeAudioHandle {
    const gain = ctx.createGain()
    const output = ctx.createGain()
    let sourceNode: AudioNode
    let oscillator: OscillatorNode | null = null

    if (stream && !usingOscillator) {
      sourceNode = ctx.createMediaStreamSource(stream)
    } else {
      oscillator = ctx.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.value = 220
      oscillator.start()
      sourceNode = oscillator
      usingOscillator = true
    }

    sourceNode.connect(gain)
    gain.connect(output)

    const updateParam = (key: string, value: number) => {
      if (key === 'gain') gain.gain.value = value
    }

    for (const [key, value] of Object.entries(node.params)) {
      updateParam(key, value)
    }

    return {
      input: output,
      output,
      updateParam,
      usingOscillator,
      dispose: () => {
        sourceNode.disconnect()
        gain.disconnect()
        output.disconnect()
        oscillator?.stop()
      },
    }
  }

  private async recreateSource(
    nodeId: string,
    ctx: AudioContext,
    stream: MediaStream | null,
    usingOscillator: boolean,
    generation: number,
  ): Promise<void> {
    if (!this.isSyncCurrent(generation)) return

    const old = this.handles.get(nodeId)
    old?.dispose()
    const gain = ctx.createGain()
    const output = ctx.createGain()
    let sourceNode: AudioNode
    let oscillator: OscillatorNode | null = null

    if (stream && !usingOscillator) {
      sourceNode = ctx.createMediaStreamSource(stream)
    } else {
      oscillator = ctx.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.value = 220
      oscillator.start()
      sourceNode = oscillator
      usingOscillator = true
    }

    sourceNode.connect(gain)
    gain.connect(output)
    gain.gain.value = 0.8

    this.handles.set(nodeId, {
      input: output,
      output,
      updateParam: (key, value) => {
        if (key === 'gain') gain.gain.value = value
      },
      usingOscillator,
      dispose: () => {
        sourceNode.disconnect()
        gain.disconnect()
        output.disconnect()
        oscillator?.stop()
      },
    })
  }

  private createDestinationHandle(ctx: AudioContext, node: Node): NodeAudioHandle {
    const input = ctx.createGain()
    const volume = ctx.createGain()
    const merger = ctx.createChannelMerger(2)
    const splitter = ctx.createChannelSplitter(2)
    const monoGainL = ctx.createGain()
    const monoGainR = ctx.createGain()
    monoGainL.gain.value = 0.5
    monoGainR.gain.value = 0.5

    input.connect(volume)

    let connectedToDest = false

    const connectStereo = () => {
      if (connectedToDest) volume.disconnect()
      volume.connect(ctx.destination)
      connectedToDest = true
    }

    const connectMono = () => {
      if (connectedToDest) volume.disconnect()
      volume.connect(splitter)
      splitter.connect(monoGainL, 0)
      splitter.connect(monoGainR, 0)
      monoGainL.connect(merger, 0, 0)
      monoGainR.connect(merger, 0, 1)
      merger.connect(ctx.destination)
      connectedToDest = true
    }

    const updateParam = (key: string, value: number) => {
      if (key === 'volume') {
        volume.gain.value = value
      } else if (key === 'mono') {
        volume.disconnect()
        splitter.disconnect()
        monoGainL.disconnect()
        monoGainR.disconnect()
        merger.disconnect()
        connectedToDest = false
        if (value >= 0.5) connectMono()
        else connectStereo()
      }
    }

    for (const [key, value] of Object.entries(node.params)) {
      updateParam(key, value)
    }

    if (node.params.mono === undefined || node.params.mono < 0.5) {
      connectStereo()
    } else {
      connectMono()
    }

    return {
      input,
      output: input,
      updateParam,
      dispose: () => {
        input.disconnect()
        volume.disconnect()
        splitter.disconnect()
        monoGainL.disconnect()
        monoGainR.disconnect()
        merger.disconnect()
      },
    }
  }

  isUsingOscillator(nodeId: string): boolean {
    return this.handles.get(nodeId)?.usingOscillator ?? false
  }

  dispose(): void {
    this.syncGeneration++
    this.clearHandles()
    void this.context?.close()
    this.context = null
  }
}
