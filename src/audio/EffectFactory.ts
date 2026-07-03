import type { EffectType } from '../types/patch'
import { generateImpulseResponse, makeDistortionCurve, mapDb, mapLinear } from './impulseResponse'

export interface EffectGraph {
  input: AudioNode
  output: AudioNode
  nodes: AudioNode[]
  updateParam: (key: string, value: number) => void
  dispose: () => void
}

export function createDistortion(context: AudioContext, params: Record<string, number>): EffectGraph {
  const input = context.createGain()
  const preGain = context.createGain()
  const shaper = context.createWaveShaper()
  const tone = context.createBiquadFilter()
  tone.type = 'lowpass'
  const level = context.createGain()
  const output = context.createGain()

  input.connect(preGain)
  preGain.connect(shaper)
  shaper.connect(tone)
  tone.connect(level)
  level.connect(output)

  const nodes = [input, preGain, shaper, tone, level, output]

  const updateParam = (key: string, value: number) => {
    if (key === 'drive') {
      preGain.gain.value = 1 + value * 30
      shaper.curve = makeDistortionCurve(value)
    } else if (key === 'tone') {
      tone.frequency.value = mapLinear(value, 500, 8000)
    } else if (key === 'level') {
      level.gain.value = value
    }
  }

  for (const [key, value] of Object.entries(params)) {
    updateParam(key, value)
  }

  return {
    input,
    output,
    nodes,
    updateParam,
    dispose: () => nodes.forEach((n) => n.disconnect()),
  }
}

export function createReverb(context: AudioContext, params: Record<string, number>): EffectGraph {
  const input = context.createGain()
  const dry = context.createGain()
  const wet = context.createGain()
  const convolver = context.createConvolver()
  const output = context.createGain()

  let decay = 1.5
  convolver.buffer = generateImpulseResponse(context, decay)

  input.connect(dry)
  input.connect(convolver)
  convolver.connect(wet)
  dry.connect(output)
  wet.connect(output)

  const nodes = [input, dry, wet, convolver, output]

  const updateParam = (key: string, value: number) => {
    if (key === 'mix') {
      dry.gain.value = 1 - value
      wet.gain.value = value
    } else if (key === 'decay') {
      decay = mapLinear(value, 0.1, 5)
      convolver.buffer = generateImpulseResponse(context, decay)
    }
  }

  for (const [key, value] of Object.entries(params)) {
    updateParam(key, value)
  }

  return {
    input,
    output,
    nodes,
    updateParam,
    dispose: () => nodes.forEach((n) => n.disconnect()),
  }
}

export function createDelay(context: AudioContext, params: Record<string, number>): EffectGraph {
  const input = context.createGain()
  const dry = context.createGain()
  const wet = context.createGain()
  const delay = context.createDelay(1)
  const feedback = context.createGain()
  const output = context.createGain()

  input.connect(dry)
  input.connect(delay)
  delay.connect(feedback)
  feedback.connect(delay)
  delay.connect(wet)
  dry.connect(output)
  wet.connect(output)

  const nodes = [input, dry, wet, delay, feedback, output]

  const updateParam = (key: string, value: number) => {
    if (key === 'time') {
      delay.delayTime.value = value
    } else if (key === 'feedback') {
      feedback.gain.value = value
    } else if (key === 'mix') {
      dry.gain.value = 1 - value
      wet.gain.value = value
    }
  }

  for (const [key, value] of Object.entries(params)) {
    updateParam(key, value)
  }

  return {
    input,
    output,
    nodes,
    updateParam,
    dispose: () => nodes.forEach((n) => n.disconnect()),
  }
}

export function createChorus(context: AudioContext, params: Record<string, number>): EffectGraph {
  const input = context.createGain()
  const dry = context.createGain()
  const wet = context.createGain()
  const delay = context.createDelay(0.05)
  delay.delayTime.value = 0.02
  const lfo = context.createOscillator()
  lfo.type = 'sine'
  const lfoGain = context.createGain()
  const output = context.createGain()

  input.connect(dry)
  input.connect(delay)
  delay.connect(wet)
  dry.connect(output)
  wet.connect(output)

  lfo.connect(lfoGain)
  lfoGain.connect(delay.delayTime)
  lfo.start()

  const nodes = [input, dry, wet, delay, lfo, lfoGain, output]

  const updateParam = (key: string, value: number) => {
    if (key === 'rate') {
      lfo.frequency.value = mapLinear(value, 0.1, 20)
    } else if (key === 'depth') {
      lfoGain.gain.value = value * 0.01
    } else if (key === 'mix') {
      dry.gain.value = 1 - value
      wet.gain.value = value
    }
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
      lfo.stop()
      nodes.forEach((n) => n.disconnect())
    },
  }
}

export function createEq(context: AudioContext, params: Record<string, number>): EffectGraph {
  const input = context.createGain()
  const low = context.createBiquadFilter()
  low.type = 'lowshelf'
  low.frequency.value = 320
  const mid = context.createBiquadFilter()
  mid.type = 'peaking'
  mid.frequency.value = 1000
  mid.Q.value = 1
  const high = context.createBiquadFilter()
  high.type = 'highshelf'
  high.frequency.value = 3200
  const output = context.createGain()

  input.connect(low)
  low.connect(mid)
  mid.connect(high)
  high.connect(output)

  const nodes = [input, low, mid, high, output]

  const updateParam = (key: string, value: number) => {
    if (key === 'low') low.gain.value = mapDb(value)
    else if (key === 'mid') mid.gain.value = mapDb(value)
    else if (key === 'high') high.gain.value = mapDb(value)
  }

  for (const [key, value] of Object.entries(params)) {
    updateParam(key, value)
  }

  return {
    input,
    output,
    nodes,
    updateParam,
    dispose: () => nodes.forEach((n) => n.disconnect()),
  }
}

export function createCompressor(context: AudioContext, params: Record<string, number>): EffectGraph {
  const input = context.createGain()
  const compressor = context.createDynamicsCompressor()
  const output = context.createGain()

  input.connect(compressor)
  compressor.connect(output)

  const nodes = [input, compressor, output]

  const updateParam = (key: string, value: number) => {
    if (key === 'threshold') {
      compressor.threshold.value = mapLinear(value, -60, 0)
    } else if (key === 'ratio') {
      compressor.ratio.value = mapLinear(value, 1, 20)
    } else if (key === 'attack') {
      compressor.attack.value = mapLinear(value, 0.001, 1)
    } else if (key === 'release') {
      compressor.release.value = mapLinear(value, 0.01, 1)
    }
  }

  for (const [key, value] of Object.entries(params)) {
    updateParam(key, value)
  }

  return {
    input,
    output,
    nodes,
    updateParam,
    dispose: () => nodes.forEach((n) => n.disconnect()),
  }
}

export function createEffect(
  context: AudioContext,
  effectType: EffectType,
  params: Record<string, number>,
): EffectGraph {
  switch (effectType) {
    case 'distortion':
      return createDistortion(context, params)
    case 'reverb':
      return createReverb(context, params)
    case 'delay':
      return createDelay(context, params)
    case 'chorus':
      return createChorus(context, params)
    case 'eq':
      return createEq(context, params)
    case 'compressor':
      return createCompressor(context, params)
  }
}
