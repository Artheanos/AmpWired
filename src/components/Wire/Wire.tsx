import styles from './Wire.module.css'

export interface Point {
  x: number
  y: number
}

const SEG = {
  tip: 5.5,
  insulator: 2.5,
  sleeve: 25,
  barrel: 18,
  boot: 4.5,
} as const

/** Total plug length from tip (at jack) to cable attach point. */
export const PLUG_LENGTH = SEG.tip + SEG.insulator + SEG.sleeve + SEG.barrel + SEG.boot - 2;
const THIN_PART_LENGTH = 21;


const TIP_HALF = 6
const SHAFT_HALF = 4.5
const BARREL_HALF = 7.5

export function bezierPath(from: Point, to: Point): string {
  const cpOffset = 50
  const cp1x = from.x + cpOffset
  const cp1y = from.y
  const cp2x = to.x - cpOffset
  const cp2y = to.y
  return `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`
}

export function getWireGeometry(
  from: Point,
  to: Point,
  endPlug: 'input' | 'floating' | false = 'input',
) {
  const cableFrom = { x: from.x + THIN_PART_LENGTH, y: from.y }
  const cableTo = { x: to.x - THIN_PART_LENGTH, y: to.y }
  const endAngle = endPlug === 'input' ? 180 : 0;

  return {
    cableFrom,
    cableTo,
    endAngle,
    path: bezierPath(cableFrom, cableTo),
  }
}

interface JackPlugProps {
  anchor: Point
  rotation?: number
}

/** Side-profile 1/4" TS plug: tip → insulator → sleeve → knurled barrel → boot. */
function JackPlug({ anchor, rotation = 0 }: JackPlugProps) {
  const { x: t, y } = anchor
  const x1 = t + SEG.tip
  const x2 = x1 + SEG.insulator
  const x3 = x2 + SEG.sleeve
  const x4 = x3 + SEG.barrel
  const knurlStart = x3 + SEG.barrel * 0.45

  return (
    <g
      className={styles.plugGroup}
      transform={`translate(${t}, ${y}) rotate(${rotation}) translate(${-t}, ${-y})`}
    >
      <path
        d={`M ${t} ${y} L ${x1} ${y - TIP_HALF} L ${x1} ${y + TIP_HALF} Z`}
        className={styles.plugTipMetal}
      />
      <rect
        x={x1}
        y={y - SHAFT_HALF}
        width={SEG.insulator}
        height={SHAFT_HALF * 2}
        className={styles.plugInsulator}
      />
      <rect
        x={x2}
        y={y - SHAFT_HALF}
        width={SEG.sleeve}
        height={SHAFT_HALF * 2}
        rx={0.6}
        className={styles.plugSleeve}
      />
      <rect
        x={x3}
        y={y - BARREL_HALF}
        width={SEG.barrel}
        height={BARREL_HALF * 2}
        rx={1.5}
        className={styles.plugBarrel}
      />
      <rect
        x={knurlStart}
        y={y - BARREL_HALF}
        width={x4 - knurlStart}
        height={BARREL_HALF * 2}
        className={styles.plugKnurl}
      />
      <rect
        x={x3 + 1.5}
        y={y - BARREL_HALF + 1.5}
        width={SEG.barrel - 3}
        height={2}
        rx={0.5}
        className={styles.plugHighlight}
      />
    </g>
  )
}

export function CableDefs() {
  return (
    <defs>
      <pattern id="cableBraid" width="5" height="5" patternUnits="userSpaceOnUse">
        <rect width="5" height="5" fill="#141414" />
        <path d="M0,5 L5,0 M-1,1 L1,-1 M4,6 L6,4" stroke="#222" strokeWidth="0.6" />
        <path d="M0,0 L5,5 M-1,4 L1,6 M4,-1 L6,1" stroke="#1a1a1a" strokeWidth="0.5" />
      </pattern>
    </defs>
  )
}

export function PlugDefs() {
  return (
    <defs>
      <linearGradient id="plugChrome" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#f4f4f8" />
        <stop offset="18%" stopColor="#c8c8d0" />
        <stop offset="50%" stopColor="#888890" />
        <stop offset="82%" stopColor="#606068" />
        <stop offset="100%" stopColor="#484850" />
      </linearGradient>
      <linearGradient id="plugSleeveChrome" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#e8e8f0" />
        <stop offset="50%" stopColor="#9898a0" />
        <stop offset="100%" stopColor="#585860" />
      </linearGradient>
      <pattern id="plugKnurl" width="2" height="12" patternUnits="userSpaceOnUse">
        <rect width="1" height="12" fill="rgba(255,255,255,0.08)" />
        <rect x="1" width="1" height="12" fill="rgba(0,0,0,0.12)" />
      </pattern>
    </defs>
  )
}

export function WireDefs() {
  return (
    <>
      <CableDefs />
      <PlugDefs />
    </>
  )
}

type PlugEnds = 'both' | 'output' | 'input'

interface WirePlugsProps {
  from: Point
  to: Point
  endPlug?: 'input' | 'floating' | false
  ends?: PlugEnds
}

export function WirePlugs({ from, to, endPlug = 'input', ends = 'both' }: WirePlugsProps) {
  return (
    <>
      {(ends === 'both' || ends === 'output') && <JackPlug anchor={{ x: from.x - 30, y: from.y }} rotation={0} />}
      {(ends === 'both' || ends === 'input') && endPlug !== false && (
        <JackPlug anchor={{ x: to.x + 30, y: to.y }} rotation={180} />
      )}
    </>
  )
}

interface WirePathProps {
  from: Point
  to: Point
  className: string
  endPlug?: 'input' | 'floating' | false
  onClick?: (e: React.MouseEvent) => void
  onContextMenu?: (e: React.MouseEvent) => void
}

/** Cable + output plug in one group: cable drawn first, plug on top. Input plug renders in overlay layer. */
export function WirePath({
  from,
  to,
  className,
  endPlug = 'input',
  onClick,
  onContextMenu,
}: WirePathProps) {
  const { path } = getWireGeometry(from, to, endPlug)

  return (
    <g className={className}>
      <path
        d={path}
        className={styles.cableSheath}
        onClick={onClick}
        onContextMenu={onContextMenu}
      />
      <WirePlugs from={from} to={to} endPlug={endPlug} ends="both" />
    </g>
  )
}

/** Cable paths only (behind nodes). */
export function WireCable({
  from,
  to,
  className,
  endPlug = 'input',
  onClick,
  onContextMenu,
}: WirePathProps) {
  const { path } = getWireGeometry(from, to, endPlug)

  return (
    <g className={className}>
      <path
        d={path}
        className={styles.cableSheath}
        onClick={onClick}
        onContextMenu={onContextMenu}
      />
    </g>
  )
}
