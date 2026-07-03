export interface Point {
  x: number
  y: number
}

export function bezierPath(from: Point, to: Point): string {
  const cpOffset = 50
  const cp1x = from.x + cpOffset
  const cp1y = from.y
  const cp2x = to.x - cpOffset
  const cp2y = to.y
  return `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`
}

interface WirePathProps {
  from: Point
  to: Point
  className: string
  onClick?: (e: React.MouseEvent) => void
  onContextMenu?: (e: React.MouseEvent) => void
}

export function WirePath({ from, to, className, onClick, onContextMenu }: WirePathProps) {
  return (
    <path
      d={bezierPath(from, to)}
      className={className}
      onClick={onClick}
      onContextMenu={onContextMenu}
    />
  )
}
