export function generateImpulseResponse(
  context: AudioContext,
  decay: number,
  duration = 3,
): AudioBuffer {
  const sampleRate = context.sampleRate
  const length = sampleRate * duration
  const buffer = context.createBuffer(2, length, sampleRate)

  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate
      const envelope = Math.exp(-t / (decay * 2 + 0.1))
      data[i] = (Math.random() * 2 - 1) * envelope
    }
  }

  return buffer
}

export function makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const samples = 44100
  const curve = new Float32Array(samples)
  const k = amount * 100 + 1

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1
    curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x))
  }

  return curve
}

export function mapLinear(value: number, min: number, max: number): number {
  return min + value * (max - min)
}

export function mapDb(value: number): number {
  return mapLinear(value, -20, 20)
}
