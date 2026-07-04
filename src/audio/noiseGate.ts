import { mapLinear } from './impulseResponse'

export interface NoiseGateGraph {
  input: AudioNode
  output: AudioNode
  nodes: AudioNode[]
  updateParam: (key: string, value: number) => void
  dispose: () => void
}

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20)
}

export function createNoiseGate(
  context: AudioContext,
  params: Record<string, number>,
): NoiseGateGraph {
  const input = context.createGain()
  const analyser = context.createAnalyser()
  analyser.fftSize = 1024
  analyser.smoothingTimeConstant = 0.3
  const gateGain = context.createGain()
  const output = context.createGain()

  input.connect(analyser)
  input.connect(gateGain)
  gateGain.connect(output)

  const nodes = [input, analyser, gateGain, output]
  const timeData = new Float32Array(analyser.fftSize)

  let enabled = false
  let threshold = 0.001
  const floor = 0.0001
  let envelope = 0
  let rafId = 0
  let disposed = false

  const tick = () => {
    if (disposed) return

    analyser.getFloatTimeDomainData(timeData)
    let peak = 0
    for (let i = 0; i < timeData.length; i++) {
      peak = Math.max(peak, Math.abs(timeData[i]))
    }

    if (enabled) {
      const envCoeff = peak > envelope ? 0.3 : 0.05
      envelope += (peak - envelope) * envCoeff

      if (envelope > threshold) {
        gateGain.gain.setTargetAtTime(1, context.currentTime, 0.003)
      } else {
        gateGain.gain.setTargetAtTime(floor, context.currentTime, 0.1)
      }
    } else {
      gateGain.gain.setTargetAtTime(1, context.currentTime, 0.003)
      envelope = 0
    }

    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)

  const applyGate = (value: number) => {
    if (value <= 0) {
      enabled = false
    } else {
      enabled = true
      threshold = dbToLinear(mapLinear(value, -60, -15))
    }
  }

  const updateParam = (key: string, value: number) => {
    if (key === 'gate') applyGate(value)
  }

  for (const [key, value] of Object.entries(params)) {
    updateParam(key, value)
  }

  return {
    input,
    output,
    nodes,
    updateParam,
    dispose: () => {
      disposed = true
      cancelAnimationFrame(rafId)
      nodes.forEach((n) => n.disconnect())
    },
  }
}
