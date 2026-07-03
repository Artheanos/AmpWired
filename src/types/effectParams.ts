import type { EffectType } from './patch'

export interface ParamDef {
  key: string
  label: string
  min: number
  max: number
  default: number
}

export const EFFECT_PARAM_DEFS: Record<EffectType, ParamDef[]> = {
  distortion: [
    { key: 'drive', label: 'Drive', min: 0, max: 1, default: 0.5 },
    { key: 'tone', label: 'Tone', min: 0, max: 1, default: 0.7 },
    { key: 'level', label: 'Level', min: 0, max: 1, default: 0.8 },
  ],
  reverb: [
    { key: 'mix', label: 'Mix', min: 0, max: 1, default: 0.4 },
    { key: 'decay', label: 'Decay', min: 0, max: 1, default: 0.5 },
  ],
  delay: [
    { key: 'time', label: 'Time', min: 0, max: 1, default: 0.3 },
    { key: 'feedback', label: 'Feedback', min: 0, max: 0.9, default: 0.4 },
    { key: 'mix', label: 'Mix', min: 0, max: 1, default: 0.5 },
  ],
  chorus: [
    { key: 'rate', label: 'Rate', min: 0, max: 1, default: 0.3 },
    { key: 'depth', label: 'Depth', min: 0, max: 1, default: 0.5 },
    { key: 'mix', label: 'Mix', min: 0, max: 1, default: 0.5 },
  ],
  eq: [
    { key: 'low', label: 'Low', min: 0, max: 1, default: 0.5 },
    { key: 'mid', label: 'Mid', min: 0, max: 1, default: 0.5 },
    { key: 'high', label: 'High', min: 0, max: 1, default: 0.5 },
  ],
  compressor: [
    { key: 'threshold', label: 'Threshold', min: 0, max: 1, default: 0.5 },
    { key: 'ratio', label: 'Ratio', min: 0, max: 1, default: 0.4 },
    { key: 'attack', label: 'Attack', min: 0, max: 1, default: 0.3 },
    { key: 'release', label: 'Release', min: 0, max: 1, default: 0.5 },
  ],
}

export const SOURCE_PARAMS: ParamDef[] = [
  { key: 'gain', label: 'Gain', min: 0, max: 1, default: 0.8 },
]

export const DESTINATION_PARAMS: ParamDef[] = [
  { key: 'volume', label: 'Volume', min: 0, max: 1, default: 0.8 },
  { key: 'mono', label: 'Mono', min: 0, max: 1, default: 0 },
]

export function getDefaultParams(effectType: EffectType): Record<string, number> {
  const defs = EFFECT_PARAM_DEFS[effectType]
  return Object.fromEntries(defs.map((d) => [d.key, d.default]))
}

export function getParamDefs(
  type: 'source' | 'effect' | 'destination',
  effectType?: EffectType,
): ParamDef[] {
  if (type === 'source') return SOURCE_PARAMS
  if (type === 'destination') return DESTINATION_PARAMS
  if (effectType) return EFFECT_PARAM_DEFS[effectType]
  return []
}

export function formatParamValue(def: ParamDef, value: number): string {
  if (def.key === 'mono') return value >= 0.5 ? 'Mono' : 'Stereo'
  if (def.min === 0 && def.max === 1) return `${Math.round(value * 100)}%`
  return value.toFixed(2)
}
